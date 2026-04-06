/**
 * Vercel Serverless Function — Knowledge Graph Save Proxy
 *
 * 🧠 SMART SCHEMA: перед каждым INSERT автоматически проверяет
 *    существующие колонки таблицы и добавляет недостающие через ALTER TABLE.
 *    Благодаря этому AI может добавить любое новое поле — БД подстроится сама.
 *
 * Flow:
 *  1. sanitize()      — базовая типизация данных от AI
 *  2. ensureColumns() — сравнивает поля с реальной схемой, ALTER TABLE если нужно
 *  3. dedup check     — проверка по имени
 *  4. INSERT          — запись с ON CONFLICT DO NOTHING
 */

const TABLE_MAP = {
    cuisine:    'cuisines',
    dish:       'dishes',
    ingredient: 'ingredients',
}

// Кэш схем таблиц на время жизни serverless-инстанса (не между запросами, но внутри батча)
const schemaCache = {}

const INGREDIENT_CAT_MAP = {
    oil: 'oil', sauce: 'sauce', grain: 'grain', protein: 'meat', meat: 'meat',
    dairy: 'dairy', fruit: 'fruit', vegetable: 'vegetable', spice: 'spice',
    herb: 'herb', nut: 'nut', legume: 'legume', fish: 'fish', seafood: 'seafood',
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured' })
    }

    const { type, data } = req.body
    if (!type || !data) return res.status(400).json({ error: 'type and data are required' })

    const table = TABLE_MAP[type]
    if (!table) return res.status(400).json({ error: `Unknown type: ${type}` })

    const cleanedData = sanitize(type, data)
    const name = cleanedData.name?.trim()
    if (!name) return res.status(400).json({ error: 'name is required' })

    const pgHeaders = {
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type':  'application/json',
    }

    try {
        // ── Step 1: Smart schema — ensure all fields exist in DB ──────────────
        const addedCols = await ensureColumns(table, cleanedData, supabaseUrl, serviceKey)
        if (addedCols.length > 0) {
            console.log(`[kg/save] 🧠 Auto-migrated ${table}: added columns [${addedCols.join(', ')}]`)
        }

        // ── Step 2: Dedup check ───────────────────────────────────────────────
        const checkResp = await fetch(
            `${supabaseUrl}/rest/v1/${table}?name=ilike.${encodeURIComponent(name)}&limit=1`,
            { headers: pgHeaders }
        )
        const existing = await checkResp.json()
        if (Array.isArray(existing) && existing.length > 0) {
            console.log(`[kg/save] Duplicate skipped: "${name}" already in ${table}`)
            return res.status(200).json({ data: existing[0], duplicate: true })
        }

        // ── Step 3: Insert ────────────────────────────────────────────────────
        const insertResp = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method:  'POST',
            headers: { ...pgHeaders, 'Prefer': 'return=representation,resolution=ignore-duplicates' },
            body:    JSON.stringify(cleanedData),
        })

        const result = await insertResp.json()

        if (!insertResp.ok) {
            const msg = result?.message || result?.error || `Supabase error ${insertResp.status}`
            console.error(`[kg/save] Insert error for ${table}:`, msg, JSON.stringify(cleanedData))
            return res.status(insertResp.status).json({ error: msg, details: result })
        }

        const saved = Array.isArray(result) ? result[0] : result
        if (!saved) {
            return res.status(200).json({ data: { name }, duplicate: true })
        }

        console.log(`[kg/save] ✓ Saved ${type}: "${saved.name}" (id: ${saved.id})`)
        return res.status(200).json({ data: saved, duplicate: false, addedColumns: addedCols })

    } catch (err) {
        console.error('[kg/save] Unexpected error:', err.message)
        return res.status(500).json({ error: err.message })
    }
}

// ─── Smart Schema Engine ──────────────────────────────────────────────────────

/**
 * Получает список реальных колонок таблицы из information_schema.
 * Результат кэшируется в памяти serverless-инстанса.
 */
async function getTableColumns(table, supabaseUrl, serviceKey) {
    if (schemaCache[table]) return schemaCache[table]

    const resp = await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_table_columns`,
        {
            method:  'POST',
            headers: {
                'apikey':        serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify({ p_table: table }),
        }
    )

    if (!resp.ok) {
        // Fallback: если RPC не создана — используем прямой information_schema запрос
        const fallback = await fetch(
            `${supabaseUrl}/rest/v1/information_schema_columns?table_name=eq.${table}&select=column_name,data_type`,
            {
                headers: {
                    'apikey':        serviceKey,
                    'Authorization': `Bearer ${serviceKey}`,
                },
            }
        )
        if (fallback.ok) {
            const cols = await fallback.json()
            const result = Object.fromEntries(cols.map(c => [c.column_name, c.data_type]))
            schemaCache[table] = result
            return result
        }
        console.warn(`[kg/save] Could not fetch schema for ${table}, skipping auto-migration`)
        return {}
    }

    const cols = await resp.json()
    const result = Object.fromEntries(cols.map(c => [c.column_name, c.data_type]))
    schemaCache[table] = result
    return result
}

/**
 * Определяет SQL-тип для значения из JS.
 * Массивы → TEXT[], числа → NUMERIC, булевы → BOOLEAN, остальное → TEXT
 */
function inferSqlType(value) {
    if (Array.isArray(value))          return 'TEXT[]'
    if (typeof value === 'boolean')    return 'BOOLEAN'
    if (typeof value === 'number')     return Number.isInteger(value) ? 'INTEGER' : 'NUMERIC'
    if (value !== null && typeof value === 'object') return 'JSONB'
    return 'TEXT'
}

/**
 * Для каждого поля в data которого нет в таблице — выполняет ALTER TABLE ADD COLUMN.
 * Пропускает системные поля (id, created_at, updated_at, embedding).
 * Возвращает список добавленных колонок.
 */
async function ensureColumns(table, data, supabaseUrl, serviceKey) {
    const SKIP = new Set(['id', 'created_at', 'updated_at', 'embedding', 'created_by'])

    const existing = await getTableColumns(table, supabaseUrl, serviceKey)
    if (Object.keys(existing).length === 0) return [] // не удалось получить схему

    const toAdd = []
    for (const [col, val] of Object.entries(data)) {
        if (SKIP.has(col)) continue
        if (existing[col])  continue  // колонка уже есть
        if (val === null || val === undefined) continue
        toAdd.push({ col, type: inferSqlType(val) })
    }

    if (toAdd.length === 0) return []

    // Выполняем ALTER TABLE через SQL RPC
    const added = []
    for (const { col, type } of toAdd) {
        const sql = `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "${col}" ${type}`
        const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method:  'POST',
            headers: {
                'apikey':        serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify({ query: sql }),
        })

        if (resp.ok) {
            added.push(col)
            // Обновить кэш
            if (schemaCache[table]) schemaCache[table][col] = type.toLowerCase()
        } else {
            const err = await resp.text()
            console.warn(`[kg/save] ALTER TABLE failed for ${table}.${col}:`, err.slice(0, 100))
        }
    }

    return added
}

// ─── sanitize() ──────────────────────────────────────────────────────────────

function sanitize(type, data) {
    if (type === 'cuisine') {
        const { name, description, region, flavor_profile, aliases, typical_dishes, key_ingredients } = data
        return clean({
            name:            name?.trim(),
            slug:            slugify(name),
            description,
            region,
            flavor_profile,
            aliases:         toArray(aliases),
            typical_dishes:  toArray(typical_dishes),
            key_ingredients: toArray(key_ingredients),
        })
    }
    if (type === 'dish') {
        const { name, cuisine_name, description, ingredients, preparation_style, dietary_tags, flavor_notes, best_pairing } = data
        return clean({
            name:              name?.trim(),
            slug:              slugify(name),
            cuisine_name,
            description,
            ingredients:       toArray(ingredients),
            preparation_style,
            dietary_tags:      toArray(dietary_tags),
            flavor_notes,
            best_pairing,
        })
    }
    if (type === 'ingredient') {
        const { name, category, description, flavor_profile, common_pairings, dietary_info, season } = data
        return clean({
            name:            name?.trim(),
            slug:            slugify(name),
            description,
            flavor_profile,
            category:        INGREDIENT_CAT_MAP[category?.toLowerCase()] || 'other',
            common_pairings: toArray(common_pairings),
            dietary_info:    toArray(dietary_info),
            season_label:    season || null,
        })
    }
    return data
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(str) {
    if (!str) return null
    return str.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function toArray(val) {
    if (!val) return []
    if (Array.isArray(val)) return val.filter(Boolean)
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean)
    return []
}

function clean(obj) {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
    )
}
