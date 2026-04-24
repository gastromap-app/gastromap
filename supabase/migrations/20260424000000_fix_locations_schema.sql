
-- Migration: Add missing vibe and what_to_try columns to locations table
-- Description: Synchronize schema with Admin UI logic and update FTS generated column

-- 1. Add columns
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS vibe text[] DEFAULT '{}';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS what_to_try text[] DEFAULT '{}';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS michelin_stars smallint DEFAULT 0;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS michelin_bib boolean DEFAULT false;

-- 2. Update FTS generated column
-- Drop and recreate to update the expression
ALTER TABLE public.locations DROP COLUMN IF EXISTS fts;

ALTER TABLE public.locations ADD COLUMN fts tsvector GENERATED ALWAYS AS (
    to_tsvector('english', 
        COALESCE(title, '') || ' ' || 
        COALESCE(description, '') || ' ' || 
        COALESCE(city, '') || ' ' || 
        COALESCE(country, '') || ' ' || 
        COALESCE(category, '') || ' ' || 
        COALESCE(must_try, '') || ' ' || 
        COALESCE(ai_context, '') || ' ' ||
        COALESCE(immutable_array_to_string(cuisine_types, ' '), '') || ' ' || 
        COALESCE(immutable_array_to_string(tags, ' '), '') || ' ' || 
        COALESCE(immutable_array_to_string(kg_dishes, ' '), '') || ' ' || 
        COALESCE(immutable_array_to_string(kg_cuisines, ' '), '') || ' ' || 
        COALESCE(immutable_array_to_string(ai_keywords, ' '), '') || ' ' ||
        COALESCE(immutable_array_to_string(vibe, ' '), '') || ' ' ||
        COALESCE(immutable_array_to_string(what_to_try, ' '), '')
    )
) STORED;

-- 3. Recreate index for FTS
CREATE INDEX IF NOT EXISTS locations_fts_idx ON public.locations USING gin(fts);

-- 4. Comment on columns for documentation
COMMENT ON COLUMN public.locations.vibe IS 'Array of atmosphere types (e.g., Romantic, Energetic)';
COMMENT ON COLUMN public.locations.what_to_try IS 'Array of specific dish recommendations';
COMMENT ON COLUMN public.locations.michelin_stars IS 'Number of Michelin stars (0-3)';
COMMENT ON COLUMN public.locations.michelin_bib IS 'Whether the location has a Michelin Bib Gourmand award';
