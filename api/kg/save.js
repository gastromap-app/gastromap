/**
 * Vercel Serverless Function — Knowledge Graph Save Proxy
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY (server-side only) to bypass RLS.
 * Deduplication: checks by name before insert — returns existing record if duplicate.
 * DB safety net: ON CONFLICT DO NOTHING via Prefer: resolution=ignore-duplicates.
 *
 * Schema alignment (2026-04-06):
 *  cuisines    → name, description, region, flavor_profile, aliases[], typical_dishes[], key_ingredients[]
 *  dishes      → name, cuisine_name, cuisine_id, description, ingredients(JSONB), preparation_style,
 *                dietary_tags[], flavor_notes, best_pairing
 *  ingredients → name, category, description, flavor_profile, common_pairings[], dietary_info[],
 *                season_label (TEXT — replaces season TEXT[])
 */

const TABLE_MAP = {
    cuisine:    'cuisines',
    dish:       'dishes',
    ingredient: 'ingredients',
}

// Maps AI-generated category names → DB CHECK constraint values
const INGREDIENT_CAT_MAP = {
    oil:       'oil',
    sauce:     'sauce',
    grain:     'grain',
    protein:   'meat',
    meat:      'meat',
    dairy:     'dairy',
    fruit:     'fruit',
    vegetable: 'vegetable',
    spice:     'spice',
    herb:      'herb',
    nut:       'nut',
    legume:    'legume',
    fish:      'fish',
    seafood:   'seafood',
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured on server' })
    }

    const { type, data } = req.body
    if (!type || !data) return res.status(400).json({ error: 'type and data are required' })

    const table = TABLE_MAP[type]
    if (!table) return res.status(400).json({ error: `Unknown type: ${type}` })

    const cleanedData = sanitize(type, data)
    const name = cleanedData.name?.trim()

    if (!name) return res.status(400).json({ error: 'name is required' })

    const headers = {
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
    }

    try {
        // ── Step 1: Check for existing record by name (case-insensitive) ──────
        const checkUrl = `${supabaseUrl}/rest/v1/${table}?name=ilike.${encodeURIComponent(name)}&limit=1`
        const checkResp = await fetch(checkUrl, { headers })
        const existing = await checkResp.json()

        if (Array.isArray(existing) && existing.length > 0) {
            console.log(`[kg/save] Duplicate skipped: "${name}" already in ${table} (id: ${existing[0].id})`)
            return res.status(200).json({ data: existing[0], duplicate: true })
        }

        // ── Step 2: Insert ────────────────────────────────────────────────────
        const insertResp = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
                ...headers,
                'Prefer': 'return=representation,resolution=ignore-duplicates',
            },
            body: JSON.stringify(cleanedData),
        })

        const result = await insertResp.json()

        if (!insertResp.ok) {
            const msg = result?.message || result?.error || `Supabase error ${insertResp.status}`
            console.error(`[kg/save] Insert error for ${table}:`, msg, JSON.stringify(cleanedData))
            return res.status(insertResp.status).json({ error: msg, details: result })
        }

        const saved = Array.isArray(result) ? result[0] : result
        if (!saved) {
            console.log(`[kg/save] Conflict ignored (UNIQUE): "${name}" already in ${table}`)
            return res.status(200).json({ data: { name }, duplicate: true })
        }

        console.log(`[kg/save] ✓ Saved ${type}: "${saved.name}" (id: ${saved.id})`)
        return res.status(200).json({ data: saved, duplicate: false })

    } catch (err) {
        console.error('[kg/save] Unexpected error:', err.message)
        return res.status(500).json({ error: err.message })
    }
}

/**
 * sanitize() — map AI-generated fields → real DB column names & types
 */
function sanitize(type, data) {
    if (type === 'cuisine') {
        const { name, description, region, flavor_profile, aliases, typical_dishes, key_ingredients } = data
        return clean({
            name:            name?.trim(),
            description:     description || null,
            region:          region || null,
            flavor_profile:  flavor_profile || null,
            aliases:         toArray(aliases),
            typical_dishes:  toArray(typical_dishes),
            key_ingredients: toArray(key_ingredients),
            // slug is optional now — generate from name as fallback
            slug: slugify(name),
        })
    }

    if (type === 'dish') {
        const { name, cuisine_name, description, ingredients, preparation_style, dietary_tags, flavor_notes, best_pairing } = data
        return clean({
            name:              name?.trim(),
            cuisine_name:      cuisine_name || null,
            description:       description || null,
            // ingredients stored as JSONB array of strings
            ingredients:       toArray(ingredients),
            preparation_style: preparation_style || null,
            dietary_tags:      toArray(dietary_tags),
            flavor_notes:      flavor_notes || null,
            best_pairing:      best_pairing || null,
            // slug optional
            slug: slugify(name),
        })
    }

    if (type === 'ingredient') {
        const { name, category, description, flavor_profile, common_pairings, dietary_info, season } = data
        const mappedCategory = INGREDIENT_CAT_MAP[category?.toLowerCase()] || 'other'
        return clean({
            name:            name?.trim(),
            description:     description || null,
            flavor_profile:  flavor_profile || null,
            category:        mappedCategory,
            common_pairings: toArray(common_pairings),
            dietary_info:    toArray(dietary_info),
            // season comes as TEXT from AI ("year-round", "summer") → store in season_label
            season_label:    season || null,
            // slug optional
            slug: slugify(name),
        })
    }

    return data
}

function slugify(str) {
    if (!str) return null
    return str
        .toLowerCase()
        .trim()
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
