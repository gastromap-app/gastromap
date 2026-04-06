-- ═══════════════════════════════════════════════════════════════════════════
-- GASTROMAP — KG FINAL SCHEMA (единая "вечная" схема)
-- Дата: 2026-04-06
-- Принцип: AI prompt <-> sanitize() <-> DB columns — полная синхронизация
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- CUISINES
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE cuisines
  ADD COLUMN IF NOT EXISTS aliases          TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS typical_dishes   TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS key_ingredients  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flavor_profile   TEXT,
  ADD COLUMN IF NOT EXISTS region           TEXT,
  ADD COLUMN IF NOT EXISTS spice_level      TEXT CHECK (spice_level IN ('mild','medium','spicy','very_spicy') OR spice_level IS NULL),
  ADD COLUMN IF NOT EXISTS meal_structure   TEXT,
  ADD COLUMN IF NOT EXISTS cooking_methods  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dietary_notes    TEXT;

-- ───────────────────────────────────────────────────────────────────────────
-- DISHES
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS slug              TEXT,
  ADD COLUMN IF NOT EXISTS preparation_style TEXT,
  ADD COLUMN IF NOT EXISTS dietary_tags      TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flavor_notes      TEXT,
  ADD COLUMN IF NOT EXISTS best_pairing      TEXT,
  ADD COLUMN IF NOT EXISTS serving_temp      TEXT CHECK (serving_temp IN ('hot','warm','cold','room_temp') OR serving_temp IS NULL),
  ADD COLUMN IF NOT EXISTS course            TEXT CHECK (course IN ('appetizer','main','dessert','side','drink','snack','bread') OR course IS NULL),
  ADD COLUMN IF NOT EXISTS cook_time_min     INTEGER,
  ADD COLUMN IF NOT EXISTS difficulty        TEXT CHECK (difficulty IN ('easy','medium','hard') OR difficulty IS NULL),
  ADD COLUMN IF NOT EXISTS origin_city       TEXT,
  ADD COLUMN IF NOT EXISTS alternative_names TEXT[]  DEFAULT '{}';

UPDATE dishes
  SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
  WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS dishes_slug_idx ON dishes(slug) WHERE slug IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- INGREDIENTS
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS flavor_profile   TEXT,
  ADD COLUMN IF NOT EXISTS common_pairings  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dietary_info     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS origin_region    TEXT,
  ADD COLUMN IF NOT EXISTS health_notes     TEXT,
  ADD COLUMN IF NOT EXISTS substitutes      TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS storage_tip      TEXT;

-- ───────────────────────────────────────────────────────────────────────────
-- Индексы
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS dishes_course_idx          ON dishes(course);
CREATE INDEX IF NOT EXISTS dishes_dietary_tags_idx    ON dishes USING GIN(dietary_tags);
CREATE INDEX IF NOT EXISTS cuisines_region_idx        ON cuisines(region);
CREATE INDEX IF NOT EXISTS cuisines_flavor_idx        ON cuisines(flavor_profile);
CREATE INDEX IF NOT EXISTS ingredients_dietary_idx    ON ingredients USING GIN(dietary_info);
CREATE INDEX IF NOT EXISTS ingredients_pairings_idx   ON ingredients USING GIN(common_pairings);
