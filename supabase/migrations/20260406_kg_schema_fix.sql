-- ═══════════════════════════════════════════════════════════════════════════
-- KG SCHEMA FIX — Align columns with KG Agent output
-- Date: 2026-04-06
-- Problem: api/kg/save.js writes fields not present in DB schema,
--          and DB requires slug (NOT NULL) which AI does not generate.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── CUISINES: add AI-agent fields ────────────────────────────────────────────
ALTER TABLE cuisines
    ADD COLUMN IF NOT EXISTS region          TEXT,
    ADD COLUMN IF NOT EXISTS flavor_profile  TEXT,
    ADD COLUMN IF NOT EXISTS aliases         TEXT[]  DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS typical_dishes  TEXT[]  DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS key_ingredients TEXT[]  DEFAULT '{}'::text[];

-- Make slug nullable so AI-generated entries don't need it
ALTER TABLE cuisines
    ALTER COLUMN slug DROP NOT NULL;

-- ─── DISHES: add AI-agent fields ──────────────────────────────────────────────
-- ingredients column already exists as JSONB — but save.js sends TEXT[]
-- We keep JSONB and cast in save.js. Add missing text fields:
ALTER TABLE dishes
    ADD COLUMN IF NOT EXISTS cuisine_name      TEXT,
    ADD COLUMN IF NOT EXISTS preparation_style TEXT,
    ADD COLUMN IF NOT EXISTS dietary_tags      TEXT[]  DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS flavor_notes      TEXT,
    ADD COLUMN IF NOT EXISTS best_pairing      TEXT;

-- Make slug and category nullable (AI doesn't always generate them)
ALTER TABLE dishes
    ALTER COLUMN category DROP NOT NULL;

-- ─── INGREDIENTS: fix season column type ──────────────────────────────────────
-- Current schema: season TEXT[] DEFAULT '{}'
-- save.js sends: season TEXT (e.g. "year-round") — need to store as TEXT
-- Solution: add a separate season_label TEXT column, keep season[] for arrays
ALTER TABLE ingredients
    ADD COLUMN IF NOT EXISTS season_label    TEXT,
    ADD COLUMN IF NOT EXISTS flavor_profile  TEXT,
    ADD COLUMN IF NOT EXISTS common_pairings TEXT[]  DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS dietary_info    TEXT[]  DEFAULT '{}'::text[];

-- Make slug nullable
ALTER TABLE ingredients
    ALTER COLUMN slug DROP NOT NULL;

-- Make category CHECK constraint permissive — add new values
-- (existing CHECK only allows specific values, but save.js may send 'oil','sauce',etc.)
ALTER TABLE ingredients
    DROP CONSTRAINT IF EXISTS ingredients_category_check;

ALTER TABLE ingredients
    ADD CONSTRAINT ingredients_category_check
    CHECK (category IN ('vegetable','fruit','meat','fish','seafood','dairy','grain','spice','herb','nut','legume','oil','sauce','other'));

-- ─── UNIQUE CONSTRAINTS (dedup safety net) ─────────────────────────────────────
ALTER TABLE dishes
    DROP CONSTRAINT IF EXISTS dishes_name_unique;
ALTER TABLE dishes
    ADD CONSTRAINT dishes_name_unique UNIQUE (name);
