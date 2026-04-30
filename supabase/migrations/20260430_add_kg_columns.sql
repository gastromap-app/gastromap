-- Migration: Add Knowledge Graph columns to locations table
-- Created at: 2026-04-30

-- 1. Добавляем колонки для структурированных данных Knowledge Graph
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS kg_cuisines text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS kg_dishes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS kg_ingredients text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS kg_allergens text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS kg_enriched_at timestamptz;

-- 2. Обновляем существующие записи (если они есть) пустыми массивами вместо NULL
UPDATE public.locations SET kg_cuisines = '{}' WHERE kg_cuisines IS NULL;
UPDATE public.locations SET kg_dishes = '{}' WHERE kg_dishes IS NULL;
UPDATE public.locations SET kg_ingredients = '{}' WHERE kg_ingredients IS NULL;
UPDATE public.locations SET kg_allergens = '{}' WHERE kg_allergens IS NULL;

-- 3. Обновляем функцию генерации Full-Text Search вектора
-- Мы пересоздаем колонку fts, чтобы она включала новые KG данные для поиска
ALTER TABLE public.locations DROP COLUMN IF EXISTS fts;

-- Создаем IMMUTABLE обертку если её еще нет (на всякий случай)
CREATE OR REPLACE FUNCTION public.immutable_array_to_string(text[], text)
RETURNS text AS $$
    SELECT array_to_string($1, $2);
$$ LANGUAGE sql IMMUTABLE;

ALTER TABLE public.locations ADD COLUMN fts tsvector
GENERATED ALWAYS AS (
    to_tsvector('english',
        coalesce(title, '')                                  || ' ' ||
        coalesce(description, '')                            || ' ' ||
        coalesce(city, '')                                   || ' ' ||
        coalesce(country, '')                                || ' ' ||
        coalesce(immutable_array_to_string(cuisine_types, ' '), '')    || ' ' ||
        coalesce(category, '')                               || ' ' ||
        coalesce(immutable_array_to_string(tags, ' '), '')             || ' ' ||
        coalesce(immutable_array_to_string(kg_dishes, ' '), '')        || ' ' ||
        coalesce(immutable_array_to_string(kg_cuisines, ' '), '')      || ' ' ||
        coalesce(immutable_array_to_string(kg_ingredients, ' '), '')   || ' ' ||
        coalesce(must_try, '')                               || ' ' ||
        coalesce(immutable_array_to_string(ai_keywords, ' '), '')      || ' ' ||
        coalesce(ai_context, '')
    )
) STORED;

-- 4. Пересоздаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS locations_fts_gin ON public.locations USING gin(fts);

-- 5. Индексы для фильтрации по массивам (GIST/GIN)
CREATE INDEX IF NOT EXISTS idx_locations_kg_cuisines ON public.locations USING gin(kg_cuisines);
CREATE INDEX IF NOT EXISTS idx_locations_kg_dishes ON public.locations USING gin(kg_dishes);
CREATE INDEX IF NOT EXISTS idx_locations_kg_ingredients ON public.locations USING gin(kg_ingredients);
