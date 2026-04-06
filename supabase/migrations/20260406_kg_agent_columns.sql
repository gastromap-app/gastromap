-- Migration: Add KG Agent fields to cuisines, dishes, ingredients
-- NOTE: cuisine_name is intentionally NOT stored in dishes table.
--       AI agent returns cuisine_name temporarily; resolveDishCuisineIds()
--       converts it to cuisine_id (FK) before saving to Supabase.

-- ── CUISINES ──────────────────────────────────────────────────────────────────
ALTER TABLE cuisines
    ADD COLUMN IF NOT EXISTS region          TEXT,
    ADD COLUMN IF NOT EXISTS aliases         TEXT[]   DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS typical_dishes  TEXT[]   DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS key_ingredients TEXT[]   DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS flavor_profile  TEXT;

-- ── DISHES ────────────────────────────────────────────────────────────────────
-- cuisine_name is NOT added here — dishes link to cuisines via cuisine_id (UUID FK)
ALTER TABLE dishes
    ADD COLUMN IF NOT EXISTS preparation_style  TEXT,
    ADD COLUMN IF NOT EXISTS dietary_tags       TEXT[]   DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS flavor_notes       TEXT,
    ADD COLUMN IF NOT EXISTS best_pairing       TEXT;

-- ── INGREDIENTS ───────────────────────────────────────────────────────────────
ALTER TABLE ingredients
    ADD COLUMN IF NOT EXISTS description     TEXT,
    ADD COLUMN IF NOT EXISTS flavor_profile  TEXT,
    ADD COLUMN IF NOT EXISTS common_pairings TEXT[]   DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS dietary_info    TEXT[]   DEFAULT '{}';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
