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
    // Direct mappings
    vegetable: 'vegetable', fruit: 'fruit', meat: 'meat', fish: 'fish',
    seafood: 'seafood', dairy: 'dairy', grain: 'grain', spice: 'spice',
    herb: 'herb', nut: 'nut', legume: 'legume', oil: 'oil', sauce: 'sauce',
    other: 'other',
    // Aliases AI might send
    protein: 'meat', poultry: 'meat', pork: 'meat', beef: 'meat',
    bread: 'grain', pasta: 'grain', rice: 'grain', cereal: 'grain',
    cheese: 'dairy', milk: 'dairy', cream: 'dairy', butter: 'dairy',
    mushroom: 'vegetable', fungi: 'vegetable',
    seed: 'nut', seeds: 'nut',
    condiment: 'sauce', dressing: 'sauce', paste: 'sauce',
    fat: 'oil', vinegar: 'sauce',
}

export default async function handler(req, res) {
    // CORS — allow production, all Vercel previews, and local dev
    const origin = req.headers.origin || ''
    const isAllowed = (
        !origin ||                                              // server-to-server
        origin.endsWith('.vercel.app') ||                       // any Vercel preview/deploy
        origin === 'https://gastromap.app' ||
        origin === 'http://localhost:5173' ||
        origin === 'http://localhost:3000'
    )
    const corsOrigin = isAllowed ? (origin || 'https://gastromap.app') : 'https://gastromap.app'
    res.setHeader('Access-Control-Allow-Origin', corsOrigin)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') return res.status(200).end()

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    // ── JWT Authentication — verify caller is a logged-in user ────────────────
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) {
        return res.status(401).json({ error: 'Missing Authorization header. Please log in.' })
    }

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

    // ── Verify JWT via Supabase Auth — ensures only authenticated users can save ──
    try {
        const verifyResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'apikey':        serviceKey,
                'Authorization': `Bearer ${jwt}`,
            },
        })
        if (!verifyResp.ok) {
            console.error('[kg/save] JWT verification failed:', verifyResp.status)
            return res.status(401).json({ error: 'Invalid or expired token. Please re-login.' })
        }
        const user = await verifyResp.json()
        console.log(`[kg/save] Authenticated user: ${user.email || user.id}`)
    } catch (authErr) {
        console.error('[kg/save] Auth check error:', authErr.message)
        return res.status(401).json({ error: 'Authentication failed' })
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

        let existing = await checkResp.json()

        // For cuisines: also check aliases array — e.g. "German Cuisine" → finds row "German" with aliases=["German Cuisine"]
        if ((!Array.isArray(existing) || existing.length === 0) && type === 'cuisine') {
            const aliasCheckUrl = `${supabaseUrl}/rest/v1/${table}?aliases=cs.${encodeURIComponent('{"' + name + '"}')}&limit=1`
            console.log(`[kg/save] Alias dedup check: GET ${aliasCheckUrl}`)
            try {
                const aliasResp = await fetch(aliasCheckUrl, { headers: pgHeaders })
                if (aliasResp.ok) {
                    const aliasMatches = await aliasResp.json()
                    if (Array.isArray(aliasMatches) && aliasMatches.length > 0) {
                        existing = aliasMatches
                        console.log(`[kg/save] Matched via alias: "${aliasMatches[0].name}"`)
                    }
                }
            } catch (e) {
                console.warn('[kg/save] Alias check failed (non-fatal):', e.message)
            }
        }

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
        const {
            name, description, region, origin_country, flavor_profile,
            aliases, typical_dishes, key_ingredients,
            spice_level, meal_structure, cooking_methods, dietary_notes,
        } = data

        // Validate spice_level enum
        const SPICE_LEVELS = ['mild', 'medium', 'spicy', 'very_spicy']
        const validSpiceLevel = SPICE_LEVELS.includes(spice_level) ? spice_level : null

        return clean({
            name:             name?.trim(),
            slug:             slugify(name),
            description,
            origin_country:   origin_country || null,
            region:           region || null,            // store both — region is broader
            flavor_profile,
            aliases:          toArray(aliases),
            typical_dishes:   toArray(typical_dishes),
            key_ingredients:  toArray(key_ingredients),
            spice_level:      validSpiceLevel,
            meal_structure:   meal_structure || null,
            cooking_methods:  toArray(cooking_methods),
            dietary_notes:    dietary_notes || null,
        })
    }

    if (type === 'dish') {
        const {
            name, cuisine_id, description, ingredients,
            preparation_style, dietary_tags, flavor_notes, best_pairing,
            serving_temp, course, cook_time_min, difficulty,
            origin_city, alternative_names, spicy_level, is_signature,
            vegetarian, vegan, gluten_free,
        } = data

        // Validate enums
        const SERVING_TEMPS = ['hot','warm','cold','room_temp']
        const COURSES = ['appetizer','main','dessert','side','drink','snack','bread']
        const DIFFICULTIES = ['easy','medium','hard']

        // Derive boolean flags from dietary_tags if not explicitly set
        const tags = toArray(dietary_tags)
        const isVegetarian = vegetarian ?? tags.includes('vegetarian') ?? tags.includes('vegan')
        const isVegan = vegan ?? tags.includes('vegan')
        const isGlutenFree = gluten_free ?? tags.includes('gluten-free')

        return clean({
            name:              name?.trim(),
            slug:              slugify(name),
            cuisine_id:        cuisine_id || null,
            description,
            ingredients:       toArray(ingredients),
            preparation_style: preparation_style || null,
            dietary_tags:      tags,
            flavor_notes:      flavor_notes || null,
            best_pairing:      best_pairing || null,
            serving_temp:      SERVING_TEMPS.includes(serving_temp) ? serving_temp : null,
            course:            COURSES.includes(course) ? course : null,
            cook_time_min:     Number.isInteger(cook_time_min) ? cook_time_min : null,
            difficulty:        DIFFICULTIES.includes(difficulty) ? difficulty : null,
            origin_city:       origin_city || null,
            alternative_names: toArray(alternative_names),
            spicy_level:       typeof spicy_level === 'number' ? Math.max(0, Math.min(5, spicy_level)) : null,
            is_signature:      typeof is_signature === 'boolean' ? is_signature : false,
            vegetarian:        isVegetarian || false,
            vegan:             isVegan || false,
            gluten_free:       isGlutenFree || false,
        })
    }

    if (type === 'ingredient') {
        const {
            name, category, description, flavor_profile,
            common_pairings, dietary_info, season,
            origin_region, health_notes, substitutes, storage_tip,
            is_allergen, is_vegan, is_vegetarian,
        } = data

        // Normalize season — AI may send string or array
        const seasonArr = toArray(season)
        const VALID_SEASONS = ['spring','summer','fall','winter','year-round']
        const cleanSeason = seasonArr.length
            ? seasonArr.filter(s => VALID_SEASONS.includes(s.toLowerCase()))
            : []

        // Derive booleans from dietary_info if not provided
        const dInfo = toArray(dietary_info)
        const derivedVegan = is_vegan ?? dInfo.includes('vegan')
        const derivedVeg   = is_vegetarian ?? (dInfo.includes('vegetarian') || derivedVegan)

        return clean({
            name:             name?.trim(),
            slug:             slugify(name),
            description:      description || null,
            flavor_profile:   flavor_profile || null,
            category:         INGREDIENT_CAT_MAP[category?.toLowerCase()] || 'other',
            common_pairings:  toArray(common_pairings),
            dietary_info:     dInfo,
            season:           cleanSeason,
            origin_region:    origin_region || null,
            health_notes:     health_notes || null,
            substitutes:      toArray(substitutes),
            storage_tip:      storage_tip || null,
            is_allergen:      typeof is_allergen === 'boolean' ? is_allergen : false,
            is_vegan:         derivedVegan || false,
            is_vegetarian:    derivedVeg || false,
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


