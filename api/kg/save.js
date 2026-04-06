/**
 * Vercel Serverless Function — Knowledge Graph Save Proxy
 *
 * Использует SUPABASE_SERVICE_ROLE_KEY для обхода RLS.
 * Простой надёжный INSERT без auto-migration (которая зависала).
 *
 * Flow:
 *  1. sanitize()  — типизация данных от AI
 *  2. dedup check — проверка по имени (ilike)
 *  3. INSERT      — с Prefer: return=representation
 */

const TABLE_MAP = {
    cuisine:    'cuisines',
    dish:       'dishes',
    ingredient: 'ingredients',
}

const INGREDIENT_CAT_MAP = {
    oil: 'oil', sauce: 'sauce', grain: 'grain', protein: 'meat', meat: 'meat',
    dairy: 'dairy', fruit: 'fruit', vegetable: 'vegetable', spice: 'spice',
    herb: 'herb', nut: 'nut', legume: 'legume', fish: 'fish', seafood: 'seafood',
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.status(200).end()

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Debug: логируем наличие env vars (без значений)
    console.log('[kg/save] env check:', {
        hasSupabaseUrl:      !!supabaseUrl,
        hasServiceKey:       !!serviceKey,
        supabaseUrlPrefix:   supabaseUrl?.slice(0, 30) || 'MISSING',
    })

    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({
            error: 'Server misconfiguration',
            missing: [
                !supabaseUrl ? 'SUPABASE_URL' : null,
                !serviceKey  ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
            ].filter(Boolean),
        })
    }

    let body = req.body
    if (typeof body === 'string') {
        try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON body' }) }
    }

    const { type, data } = body || {}
    if (!type || !data) return res.status(400).json({ error: 'type and data are required' })

    const table = TABLE_MAP[type]
    if (!table) return res.status(400).json({ error: `Unknown type: ${type}. Use: ${Object.keys(TABLE_MAP).join(', ')}` })

    const cleanedData = sanitize(type, data)
    const name = cleanedData.name?.trim()
    if (!name) return res.status(400).json({ error: 'name is required and cannot be empty' })

    console.log(`[kg/save] Saving ${type}: "${name}"`, JSON.stringify(cleanedData))

    const pgHeaders = {
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
    }

    try {
        // ── Step 1: Dedup check ───────────────────────────────────────────────
        const checkUrl = `${supabaseUrl}/rest/v1/${table}?name=ilike.${encodeURIComponent(name)}&limit=1`
        console.log(`[kg/save] Dedup check: GET ${checkUrl}`)

        const checkResp = await fetch(checkUrl, { headers: pgHeaders })

        if (!checkResp.ok) {
            const errText = await checkResp.text()
            console.error(`[kg/save] Dedup check failed: ${checkResp.status}`, errText)
            return res.status(checkResp.status).json({
                error: `Supabase dedup check failed: ${checkResp.status}`,
                details: errText.slice(0, 200),
            })
        }

        const existing = await checkResp.json()
        if (Array.isArray(existing) && existing.length > 0) {
            console.log(`[kg/save] Duplicate: "${name}" already exists in ${table}`)
            return res.status(200).json({ data: existing[0], duplicate: true })
        }

        // ── Step 2: Insert ────────────────────────────────────────────────────
        const insertUrl = `${supabaseUrl}/rest/v1/${table}`
        console.log(`[kg/save] INSERT into ${table}`)

        const insertResp = await fetch(insertUrl, {
            method:  'POST',
            headers: pgHeaders,
            body:    JSON.stringify(cleanedData),
        })

        const resultText = await insertResp.text()
        console.log(`[kg/save] INSERT response: ${insertResp.status}`, resultText.slice(0, 300))

        let result
        try { result = JSON.parse(resultText) } catch { result = resultText }

        if (!insertResp.ok) {
            const msg = (typeof result === 'object' ? result?.message || result?.error : result) || `Supabase error ${insertResp.status}`
            console.error(`[kg/save] INSERT failed for ${table}:`, msg)
            return res.status(insertResp.status).json({ error: msg, details: result })
        }

        const saved = Array.isArray(result) ? result[0] : result
        if (!saved || (Array.isArray(result) && result.length === 0)) {
            // Supabase может вернуть [] если ON CONFLICT — попробуем получить запись
            console.log(`[kg/save] Empty INSERT result — fetching by name`)
            const fetchResp = await fetch(checkUrl, { headers: pgHeaders })
            const fetched   = await fetchResp.json()
            const found     = Array.isArray(fetched) ? fetched[0] : null
            return res.status(200).json({ data: found || { name }, duplicate: !found })
        }

        console.log(`[kg/save] ✓ Saved ${type}: "${saved.name}" (id: ${saved.id})`)
        return res.status(200).json({ data: saved, duplicate: false })

    } catch (err) {
        console.error('[kg/save] Unexpected error:', err.message, err.stack)
        return res.status(500).json({ error: err.message })
    }
}

// ─── sanitize() ──────────────────────────────────────────────────────────────

function sanitize(type, data) {
    if (type === 'cuisine') {
        const { name, description, region, origin_country, flavor_profile, aliases, typical_dishes, key_ingredients } = data
        return clean({
            name:            name?.trim(),
            slug:            slugify(name),
            description,
            // AI sends 'region' (e.g. "Central European"), DB column is 'origin_country'
            origin_country:  origin_country || region || null,
            flavor_profile,
            aliases:         toArray(aliases),
            typical_dishes:  toArray(typical_dishes),
            key_ingredients: toArray(key_ingredients),
        })
    }
    if (type === 'dish') {
        const { name, cuisine_id, description, ingredients, preparation_style, dietary_tags, flavor_notes, best_pairing } = data
        return clean({
            name:              name?.trim(),
            slug:              slugify(name),
            cuisine_id:        cuisine_id || null,
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
