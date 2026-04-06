/**
 * Vercel Serverless Function — Knowledge Graph Save Proxy
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY (server-side only) to bypass RLS.
 * The anon key on the client cannot INSERT/UPDATE/DELETE KG tables
 * because RLS policies restrict writes to service_role.
 *
 * Supported operations:
 *   POST /api/kg/save
 *   Body: { type: 'cuisine' | 'dish' | 'ingredient', data: {...} }
 *
 * Returns: { data: {...} } or { error: '...' }
 */

const TABLE_MAP = {
    cuisine:    'cuisines',
    dish:       'dishes',
    ingredient: 'ingredients',
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({
            error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured on server',
        })
    }

    const { type, data } = req.body

    if (!type || !data) {
        return res.status(400).json({ error: 'type and data are required' })
    }

    const table = TABLE_MAP[type]
    if (!table) {
        return res.status(400).json({ error: `Unknown type: ${type}. Must be cuisine, dish, or ingredient` })
    }

    // Clean data — remove fields not in DB schema
    const cleanedData = sanitize(type, data)

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
                'apikey':        serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type':  'application/json',
                'Prefer':        'return=representation', // return inserted row
            },
            body: JSON.stringify(cleanedData),
        })

        const result = await response.json()

        if (!response.ok) {
            const msg = result?.message || result?.error || `Supabase error ${response.status}`
            console.error(`[kg/save] Supabase insert error for ${table}:`, msg)
            return res.status(response.status).json({ error: msg, details: result })
        }

        // Supabase returns array when Prefer: return=representation
        const saved = Array.isArray(result) ? result[0] : result

        console.log(`[kg/save] ✓ Saved ${type}: "${saved?.name || 'unknown'}" (id: ${saved?.id})`)
        return res.status(200).json({ data: saved })

    } catch (err) {
        console.error('[kg/save] Unexpected error:', err.message)
        return res.status(500).json({ error: err.message })
    }
}

/**
 * Remove extra fields AI might return that don't exist in the DB schema.
 * This prevents Supabase 400 "column does not exist" errors.
 */
function sanitize(type, data) {
    if (type === 'cuisine') {
        const { name, description, region, flavor_profile, aliases, typical_dishes, key_ingredients } = data
        return clean({ name, description, region, flavor_profile, aliases, typical_dishes, key_ingredients })
    }
    if (type === 'dish') {
        const { name, cuisine_id, description, ingredients, preparation_style, dietary_tags, flavor_notes, best_pairing } = data
        return clean({ name, cuisine_id, description, ingredients, preparation_style, dietary_tags, flavor_notes, best_pairing })
    }
    if (type === 'ingredient') {
        const { name, category, description, flavor_profile, common_pairings, dietary_info, season } = data
        return clean({ name, category, description, flavor_profile, common_pairings, dietary_info, season })
    }
    return data
}

/** Remove undefined/null keys so Supabase doesn't complain */
function clean(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null))
}
