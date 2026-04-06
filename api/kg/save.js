/**
 * Vercel Serverless Function — Knowledge Graph Save Proxy
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY (server-side only) to bypass RLS.
 * Deduplication: checks by name before insert — returns existing record if duplicate.
 * DB safety net: ON CONFLICT DO NOTHING via Prefer: resolution=ignore-duplicates.
 */

const TABLE_MAP = {
    cuisine:    'cuisines',
    dish:       'dishes',
    ingredient: 'ingredients',
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

        // ── Step 2: Insert with ON CONFLICT DO NOTHING ────────────────────────
        const insertResp = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
                ...headers,
                // If a UNIQUE constraint exists on name — DB will silently skip duplicates
                'Prefer': 'return=representation,resolution=ignore-duplicates',
            },
            body: JSON.stringify(cleanedData),
        })

        const result = await insertResp.json()

        if (!insertResp.ok) {
            const msg = result?.message || result?.error || `Supabase error ${insertResp.status}`
            console.error(`[kg/save] Insert error for ${table}:`, msg)
            return res.status(insertResp.status).json({ error: msg, details: result })
        }

        const saved = Array.isArray(result) ? result[0] : result
        if (!saved) {
            // resolution=ignore-duplicates returns empty array if conflict — treat as duplicate
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

function sanitize(type, data) {
    if (type === 'cuisine') {
        const { name, description, region, flavor_profile, aliases, typical_dishes, key_ingredients } = data
        return clean({ name, description, region, flavor_profile, aliases: toArray(aliases), typical_dishes: toArray(typical_dishes), key_ingredients: toArray(key_ingredients) })
    }
    if (type === 'dish') {
        const { name, cuisine_name, description, ingredients, preparation_style, dietary_tags, flavor_notes, best_pairing } = data
        return clean({ name, cuisine_name, description, ingredients: toArray(ingredients), preparation_style, flavor_notes, best_pairing, dietary_tags: toArray(dietary_tags) })
    }
    if (type === 'ingredient') {
        const { name, category, description, flavor_profile, common_pairings, dietary_info, season } = data
        const CAT_MAP = { oil: 'other', sauce: 'other', grain: 'grain', protein: 'meat', dairy: 'dairy', fruit: 'fruit', vegetable: 'vegetable', spice: 'spice', herb: 'herb' }
        return clean({ name, description, flavor_profile, category: CAT_MAP[category?.toLowerCase()] || 'other', common_pairings: toArray(common_pairings), dietary_info: toArray(dietary_info), season: season || null })
    }
    return data
}

function toArray(val) {
    if (!val) return []
    if (Array.isArray(val)) return val
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean)
    return []
}

function clean(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null))
}
