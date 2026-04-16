-- Migration: Add KG (Knowledge Graph) columns to locations table
-- Date: 2026-04-14
-- Author: GastroMap AI Agent
-- 
-- Run in Supabase Dashboard → SQL Editor:
-- https://app.supabase.com/project/myyzguendoruefiiufop/sql/new

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS kg_cuisines    text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kg_dishes      text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kg_ingredients text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kg_allergens   text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kg_enriched_at timestamptz;

COMMENT ON COLUMN public.locations.kg_cuisines    IS 'KG Agent: matched cuisine names from cuisines table';
COMMENT ON COLUMN public.locations.kg_dishes      IS 'KG Agent: matched dish names from dishes table';
COMMENT ON COLUMN public.locations.kg_ingredients IS 'KG Agent: matched ingredient names from ingredients table';
COMMENT ON COLUMN public.locations.kg_allergens   IS 'KG Agent: allergen flags derived from ingredients';
COMMENT ON COLUMN public.locations.kg_enriched_at IS 'KG Agent: last enrichment timestamp';

-- Verify:
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'locations'
  AND column_name LIKE 'kg_%'
ORDER BY column_name;
