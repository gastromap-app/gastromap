#!/usr/bin/env node
/**
 * Apply the increment_location_view migration directly via Supabase Management API
 * Usage: node scripts/apply-increment-view-migration.js
 * 
 * Requires SUPABASE_ACCESS_TOKEN in env (from https://app.supabase.com/account/tokens)
 */

const SQL = `
-- 1. Add missing analytics columns to locations table
ALTER TABLE public.locations 
    ADD COLUMN IF NOT EXISTS views_count     integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS saves_count     integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS visits_count    integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS comments_count  integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trending_score  float4  DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trending_at     timestamptz,
    ADD COLUMN IF NOT EXISTS city_slug       text,
    ADD COLUMN IF NOT EXISTS country_slug    text;

-- 2. Create increment_location_view RPC function
CREATE OR REPLACE FUNCTION increment_location_view(location_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE locations 
    SET views_count = views_count + 1 
    WHERE id = location_id;
END;
$$;

-- 3. Grant execute permission
GRANT EXECUTE ON FUNCTION increment_location_view(uuid) TO anon, authenticated;

-- 4. Create index for trending
CREATE INDEX IF NOT EXISTS idx_locations_trending
    ON locations(trending_score DESC) WHERE status = 'approved';
`.trim()

const PROJECT_REF = 'myyzguendoruefiiufop'

async function main() {
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN
    if (!accessToken) {
        console.error('❌ SUPABASE_ACCESS_TOKEN not set.')
        console.error('   Get one from: https://app.supabase.com/account/tokens')
        console.error('   Then run: SUPABASE_ACCESS_TOKEN=xxx node scripts/apply-increment-view-migration.js')
        process.exit(1)
    }

    console.log('🔧 Applying migration via Supabase Management API...')
    
    const res = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: SQL }),
        }
    )

    if (res.ok) {
        const result = await res.json()
        console.log('✅ Migration applied successfully!')
        console.log(JSON.stringify(result, null, 2))
    } else {
        const err = await res.text()
        console.error('❌ Migration failed:', res.status, err)
        
        // Fallback: print SQL for manual execution
        console.log('\n📋 Please execute this SQL manually in Supabase Dashboard → SQL Editor:')
        console.log(`   https://app.supabase.com/project/${PROJECT_REF}/sql/new\n`)
        console.log(SQL)
        process.exit(1)
    }
}

main().catch(console.error)
