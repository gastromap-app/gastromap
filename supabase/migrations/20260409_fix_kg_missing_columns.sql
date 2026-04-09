-- ═══════════════════════════════════════════════════════════════════════════
-- GASTROMAP — FIX KG MISSING COLUMNS
-- Дата: 2026-04-09
-- Описание: Добавляет отсутствующие колонки в таблицы Knowledge Graph, 
--           которые необходимы для работы KG AI Agent.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Исправляем таблицу ингредиентов
ALTER TABLE ingredients 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS flavor_profile TEXT,
  ADD COLUMN IF NOT EXISTS common_pairings TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dietary_info TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS season_label TEXT,
  ADD COLUMN IF NOT EXISTS origin_region TEXT,
  ADD COLUMN IF NOT EXISTS health_notes TEXT,
  ADD COLUMN IF NOT EXISTS substitutes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS storage_tip TEXT,
  ADD COLUMN IF NOT EXISTS is_allergen BOOLEAN DEFAULT false;

-- 2. Исправляем таблицу блюд
ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS preparation_style TEXT,
  ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flavor_notes TEXT,
  ADD COLUMN IF NOT EXISTS best_pairing TEXT,
  ADD COLUMN IF NOT EXISTS serving_temp TEXT CHECK (serving_temp IN ('hot','warm','cold','room_temp') OR serving_temp IS NULL),
  ADD COLUMN IF NOT EXISTS course TEXT CHECK (course IN ('appetizer','main','dessert','side','drink','snack','bread') OR course IS NULL),
  ADD COLUMN IF NOT EXISTS cook_time_min INTEGER,
  ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('easy','medium','hard') OR difficulty IS NULL),
  ADD COLUMN IF NOT EXISTS origin_city TEXT,
  ADD COLUMN IF NOT EXISTS alternative_names TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS spicy_level INTEGER,
  ADD COLUMN IF NOT EXISTS is_signature BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vegetarian BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vegan BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gluten_free BOOLEAN DEFAULT false;

-- 3. Исправляем таблицу кухонь
ALTER TABLE cuisines
  ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS typical_dishes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS key_ingredients TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS flavor_profile TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS spice_level TEXT CHECK (spice_level IN ('mild','medium','spicy','very_spicy') OR spice_level IS NULL),
  ADD COLUMN IF NOT EXISTS meal_structure TEXT,
  ADD COLUMN IF NOT EXISTS cooking_methods TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dietary_notes TEXT;

-- 4. Перезагружаем кэш схемы
NOTIFY pgrst, 'reload schema';
