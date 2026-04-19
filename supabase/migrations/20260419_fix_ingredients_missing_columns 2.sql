-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: ingredients table missing is_allergen, is_vegetarian, is_vegan
-- Error: PGRST204 "Could not find the 'is_allergen' column of 'ingredients'"
-- These columns are in SCHEMA_WHITELIST but were never applied to production.
-- ═══════════════════════════════════════════════════════════════════════════

-- ingredients: all columns referenced by KG agent whitelist
ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS flavor_profile   TEXT,
  ADD COLUMN IF NOT EXISTS common_pairings  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dietary_info     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS season_label     TEXT,
  ADD COLUMN IF NOT EXISTS origin_region    TEXT,
  ADD COLUMN IF NOT EXISTS health_notes     TEXT,
  ADD COLUMN IF NOT EXISTS substitutes      TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS storage_tip      TEXT,
  ADD COLUMN IF NOT EXISTS is_allergen      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vegetarian    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vegan         BOOLEAN DEFAULT false;

-- dishes: all columns referenced by KG agent whitelist
ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS preparation_style TEXT,
  ADD COLUMN IF NOT EXISTS dietary_tags      TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flavor_notes      TEXT,
  ADD COLUMN IF NOT EXISTS best_pairing      TEXT,
  ADD COLUMN IF NOT EXISTS course            TEXT CHECK (course IN ('appetizer','main','dessert','side','drink','snack','bread') OR course IS NULL),
  ADD COLUMN IF NOT EXISTS origin_city       TEXT,
  ADD COLUMN IF NOT EXISTS spicy_level       INTEGER,
  ADD COLUMN IF NOT EXISTS is_signature      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vegetarian        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vegan             BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gluten_free       BOOLEAN DEFAULT false;

-- cuisines: all columns referenced by KG agent whitelist
ALTER TABLE cuisines
  ADD COLUMN IF NOT EXISTS aliases          TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS typical_dishes   TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS key_ingredients  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flavor_profile   TEXT,
  ADD COLUMN IF NOT EXISTS region           TEXT;

-- Reload PostgREST schema cache — makes new columns immediately available
NOTIFY pgrst, 'reload schema';
