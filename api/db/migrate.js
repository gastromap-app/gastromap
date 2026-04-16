/**
 * Vercel Serverless — One-time Database Migration
 * 
 * Adds KG columns to locations table.
 * Protected by MIGRATE_SECRET env var.
 * 
 * Usage (curl):
 *   curl -X POST https://gastromap-five.vercel.app/api/db/migrate \
 *     -H "Content-Type: application/json" \
 *     -d "{\"secret\": \"YOUR_SECRET\"}"
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

    const secret = process.env.MIGRATE_SECRET || 'gastromap-migrate-2026'
    const { secret: provided } = req.body || {}
    if (provided !== secret) return res.status(403).json({ error: 'Invalid secret' })

    const supabaseUrl  = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
    const serviceKey   = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
    }

    // We cannot run DDL directly via PostgREST REST API.
    // Strategy: use Supabase Management API with service role scope
    // If that fails, we return the SQL for manual execution.

    const migrationSQL = `
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS kg_cuisines    text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kg_dishes      text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kg_ingredients text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kg_allergens   text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kg_enriched_at timestamptz;

COMMENT ON COLUMN public.locations.kg_cuisines    IS 'KG Agent: matched cuisine names';
COMMENT ON COLUMN public.locations.kg_dishes      IS 'KG Agent: matched dish names';
COMMENT ON COLUMN public.locations.kg_ingredients IS 'KG Agent: matched ingredient names';
COMMENT ON COLUMN public.locations.kg_allergens   IS 'KG Agent: allergen flags from ingredients';
COMMENT ON COLUMN public.locations.kg_enriched_at IS 'KG Agent: last enrichment timestamp';
`.trim()

    // Try Management API
    try {
        const projectRef = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
        if (projectRef) {
            const mgmtRes = await fetch(
                `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query: migrationSQL }),
                }
            )
            if (mgmtRes.ok) {
                const result = await mgmtRes.json()
                return res.status(200).json({ success: true, method: 'management_api', result })
            }
            const err = await mgmtRes.text()
            console.warn('[migrate] Management API failed:', mgmtRes.status, err)
        }
    } catch (e) {
        console.warn('[migrate] Management API error:', e.message)
    }

    // Return SQL for manual execution in Supabase Dashboard
    return res.status(200).json({
        success: false,
        message: 'Cannot run DDL automatically. Please execute this SQL manually in Supabase Dashboard → SQL Editor:',
        sql: migrationSQL,
        supabase_dashboard: `https://app.supabase.com/project/myyzguendoruefiiufop/sql/new`
    })
}
