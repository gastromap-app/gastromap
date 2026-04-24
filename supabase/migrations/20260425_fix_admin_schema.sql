-- ═══════════════════════════════════════════════════════════════════
-- Migration: Fix Admin Schema — Add missing columns & unify statuses
-- Date: 2026-04-25
-- Description:
--   1. Adds columns that Admin UI code expects but DB schema lacks
--   2. Migrates existing data from old columns to new ones
--   3. Unifies status values: adds approved/pending/rejected support
--   4. Updates RLS policies and search functions
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Add missing columns (code expects these) ───────────────────

ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS price_range text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS cuisine_types text[] DEFAULT '{}';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS google_photos text[] DEFAULT '{}';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS amenities text[] DEFAULT '{}';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS dietary_options text[] DEFAULT '{}';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS wifi_quality text DEFAULT 'none';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS outdoor_seating boolean DEFAULT false;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS reservation_required boolean DEFAULT false;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS must_try text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS moderation_note text;

-- ─── 2. Migrate existing data from old columns ─────────────────────
-- Safe migration: only copy data if source column exists (handles schema drift)

DO $$
BEGIN
    -- image → image_url
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'image') THEN
        EXECUTE 'UPDATE public.locations SET image_url = image WHERE image_url IS NULL AND image IS NOT NULL';
    END IF;

    -- price_level → price_range
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'price_level') THEN
        EXECUTE 'UPDATE public.locations SET price_range = price_level WHERE price_range IS NULL AND price_level IS NOT NULL';
    END IF;

    -- cuisine (text) → cuisine_types (text[])
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'cuisine') THEN
        EXECUTE 'UPDATE public.locations SET cuisine_types = ARRAY[cuisine] WHERE cuisine IS NOT NULL AND cuisine <> '''' AND (cuisine_types IS NULL OR cuisine_types = ARRAY[]::text[])';
    END IF;

    -- photos → google_photos
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'photos') THEN
        EXECUTE 'UPDATE public.locations SET google_photos = photos WHERE google_photos IS NULL OR google_photos = ARRAY[]::text[]';
    END IF;

    -- features → amenities
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'features') THEN
        EXECUTE 'UPDATE public.locations SET amenities = features WHERE amenities IS NULL OR amenities = ARRAY[]::text[]';
    END IF;

    -- dietary → dietary_options
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'dietary') THEN
        EXECUTE 'UPDATE public.locations SET dietary_options = dietary WHERE dietary_options IS NULL OR dietary_options = ARRAY[]::text[]';
    END IF;

    -- has_wifi (boolean) → wifi_quality (text)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'has_wifi') THEN
        EXECUTE 'UPDATE public.locations SET wifi_quality = CASE WHEN has_wifi = true THEN ''high'' ELSE ''none'' END WHERE wifi_quality = ''none''';
    END IF;

    -- has_outdoor_seating → outdoor_seating
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'has_outdoor_seating') THEN
        EXECUTE 'UPDATE public.locations SET outdoor_seating = has_outdoor_seating WHERE outdoor_seating IS NULL';
    END IF;

    -- reservations_required → reservation_required
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'reservations_required') THEN
        EXECUTE 'UPDATE public.locations SET reservation_required = reservations_required WHERE reservation_required IS NULL';
    END IF;

    -- what_to_try (text[]) → must_try (text) for FTS compatibility
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'what_to_try') THEN
        EXECUTE 'UPDATE public.locations SET must_try = array_to_string(what_to_try, '', '') WHERE must_try IS NULL AND what_to_try IS NOT NULL AND what_to_try <> ARRAY[]::text[]';
    END IF;
END $$;

-- ─── 3. Set defaults for new columns ───────────────────────────────

ALTER TABLE public.locations ALTER COLUMN image_url SET DEFAULT '';
ALTER TABLE public.locations ALTER COLUMN price_range SET DEFAULT '$$';
ALTER TABLE public.locations ALTER COLUMN wifi_quality SET DEFAULT 'none';

-- ─── 4. Unify status values ────────────────────────────────────────

-- First: fix any invalid statuses before adding CHECK constraint
UPDATE public.locations
SET status = CASE
    WHEN status IS NULL OR status = '' THEN 'active'
    WHEN status = 'draft' THEN 'pending'
    WHEN status = 'published' THEN 'approved'
    WHEN status = 'banned' THEN 'rejected'
    WHEN status = 'inactive' THEN 'hidden'
    WHEN status IN ('active', 'approved', 'pending', 'rejected', 'revision_requested', 'hidden', 'coming_soon') THEN status
    ELSE 'active'
END
WHERE status NOT IN ('active', 'approved', 'pending', 'rejected', 'revision_requested', 'hidden', 'coming_soon')
   OR status IS NULL
   OR status = '';

-- Add CHECK constraint for valid statuses (drop first if exists to be safe)
ALTER TABLE public.locations DROP CONSTRAINT IF EXISTS locations_status_check;
ALTER TABLE public.locations ADD CONSTRAINT locations_status_check CHECK (status IN ('active', 'approved', 'pending', 'rejected', 'revision_requested', 'hidden', 'coming_soon'));

-- Migrate existing statuses for consistency:
-- 'active' stays as-is for backward compatibility, but new code uses 'approved'
-- No data migration needed since CHECK allows both

-- ─── 5. Update RLS policies ────────────────────────────────────────

-- Drop old policies that reference 'active' only
DROP POLICY IF EXISTS "Public read active locations" ON public.locations;

-- Recreate policy to allow both 'active' and 'approved' for public read
CREATE POLICY "Public read active locations"
    ON public.locations FOR SELECT
    USING (status IN ('active', 'approved'));

-- Ensure service role policy exists
DROP POLICY IF EXISTS "Service role full access" ON public.locations;
CREATE POLICY "Service role full access"
    ON public.locations FOR ALL
    USING (auth.role() = 'service_role');

-- ─── 6. Update hybrid search functions ─────────────────────────────

-- Fix status filter to accept both 'active' and 'approved'
CREATE OR REPLACE FUNCTION search_locations_hybrid(
    query_embedding  vector(768),
    query_text       text,
    p_city           text    DEFAULT NULL,
    p_category       text    DEFAULT NULL,
    p_limit          int     DEFAULT 10,
    rrf_k            int     DEFAULT 60
)
RETURNS TABLE (
    id              uuid,
    title           text,
    description     text,
    city            text,
    country         text,
    category        text,
    cuisine         text,
    rating          numeric,
    image           text,
    price_level     text,
    tags            text[],
    special_labels  text[],
    vibe            text[],
    kg_dishes       text[],
    kg_cuisines     text[],
    lat             numeric,
    lng             numeric,
    rrf_score       float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH semantic AS (
        SELECT
            l.id,
            ROW_NUMBER() OVER (ORDER BY l.embedding <=> query_embedding) AS rank_s
        FROM public.locations l
        WHERE l.status IN ('approved', 'active')
          AND l.embedding IS NOT NULL
          AND (p_city IS NULL OR lower(l.city) LIKE '%' || lower(p_city) || '%')
          AND (p_category IS NULL OR lower(l.category) LIKE '%' || lower(p_category) || '%')
        ORDER BY l.embedding <=> query_embedding
        LIMIT 50
    ),
    fulltext AS (
        SELECT
            l.id,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(l.fts, query_parsed) DESC) AS rank_f
        FROM public.locations l,
             websearch_to_tsquery('english', query_text) AS query_parsed
        WHERE l.status IN ('approved', 'active')
          AND l.fts @@ query_parsed
          AND (p_city IS NULL OR lower(l.city) LIKE '%' || lower(p_city) || '%')
          AND (p_category IS NULL OR lower(l.category) LIKE '%' || lower(p_category) || '%')
        ORDER BY ts_rank_cd(l.fts, query_parsed) DESC
        LIMIT 50
    ),
    fused AS (
        SELECT
            COALESCE(s.id, f.id) AS id,
            COALESCE(1.0 / (rrf_k + s.rank_s), 0.0) +
            COALESCE(1.0 / (rrf_k + f.rank_f), 0.0) AS rrf_score
        FROM semantic s
        FULL OUTER JOIN fulltext f ON s.id = f.id
    )
    SELECT
        l.id,
        l.title,
        l.description,
        l.city,
        l.country,
        l.category,
        array_to_string(l.cuisine_types, ', ') as cuisine,
        l.google_rating as rating,
        COALESCE(l.image_url, l.image) as image,
        COALESCE(l.price_range, l.price_level) as price_level,
        l.tags,
        l.special_labels,
        (SELECT COALESCE(array_agg(v.name), '{}'::text[]) FROM public.location_vibes lv JOIN public.vibes v ON lv.vibe_id = v.id WHERE lv.location_id = l.id) as vibe,
        l.kg_dishes,
        l.kg_cuisines,
        l.lat,
        l.lng,
        fused.rrf_score::float
    FROM fused
    JOIN public.locations l ON l.id = fused.id
    ORDER BY fused.rrf_score DESC
    LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION search_locations_fulltext(
    query_text       text,
    p_city           text  DEFAULT NULL,
    p_category       text  DEFAULT NULL,
    p_limit          int   DEFAULT 10
)
RETURNS TABLE (
    id              uuid,
    title           text,
    description     text,
    city            text,
    country         text,
    category        text,
    cuisine         text,
    rating          numeric,
    image           text,
    price_level     text,
    tags            text[],
    special_labels  text[],
    vibe            text[],
    kg_dishes       text[],
    kg_cuisines     text[],
    lat             numeric,
    lng             numeric,
    rrf_score       float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        l.title,
        l.description,
        l.city,
        l.country,
        l.category,
        array_to_string(l.cuisine_types, ', ') as cuisine,
        l.google_rating as rating,
        COALESCE(l.image_url, l.image) as image,
        COALESCE(l.price_range, l.price_level) as price_level,
        l.tags,
        l.special_labels,
        (SELECT COALESCE(array_agg(v.name), '{}'::text[]) FROM public.location_vibes lv JOIN public.vibes v ON lv.vibe_id = v.id WHERE lv.location_id = l.id) as vibe,
        l.kg_dishes,
        l.kg_cuisines,
        l.lat,
        l.lng,
        ts_rank_cd(l.fts, websearch_to_tsquery('english', query_text))::float AS rrf_score
    FROM public.locations l
    WHERE l.status IN ('approved', 'active')
      AND l.fts @@ websearch_to_tsquery('english', query_text)
      AND (p_city IS NULL OR lower(l.city) LIKE '%' || lower(p_city) || '%')
      AND (p_category IS NULL OR lower(l.category) LIKE '%' || lower(p_category) || '%')
    ORDER BY rrf_score DESC
    LIMIT p_limit;
END;
$$;

-- ─── 7. Recreate FTS generated column with new columns ─────────────

-- Drop old FTS column
ALTER TABLE public.locations DROP COLUMN IF EXISTS fts;

-- Recreate with updated expression including new columns
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
        COALESCE(immutable_array_to_string(what_to_try, ' '), '') || ' ' ||
        COALESCE(immutable_array_to_string(amenities, ' '), '') || ' ' ||
        COALESCE(immutable_array_to_string(dietary_options, ' '), '')
    )
) STORED;

-- Recreate index
CREATE INDEX IF NOT EXISTS locations_fts_idx ON public.locations USING gin(fts);

-- ─── 8. Comments for documentation ─────────────────────────────────

COMMENT ON COLUMN public.locations.image_url IS 'Primary image URL (canonical); old "image" column kept for compatibility';
COMMENT ON COLUMN public.locations.price_range IS 'Price range e.g. $, $$, $$$ (canonical); old "price_level" kept for compatibility';
COMMENT ON COLUMN public.locations.cuisine_types IS 'Array of cuisine types (canonical); old "cuisine" text kept for compatibility';
COMMENT ON COLUMN public.locations.google_photos IS 'Array of Google Photos URLs (canonical); old "photos" kept for compatibility';
COMMENT ON COLUMN public.locations.amenities IS 'Array of amenity features (canonical); old "features" kept for compatibility';
COMMENT ON COLUMN public.locations.dietary_options IS 'Array of dietary options (canonical); old "dietary" kept for compatibility';
COMMENT ON COLUMN public.locations.wifi_quality IS 'WiFi quality: none, low, medium, high (canonical); old "has_wifi" boolean kept for compatibility';
COMMENT ON COLUMN public.locations.outdoor_seating IS 'Has outdoor seating (canonical); old "has_outdoor_seating" kept for compatibility';
COMMENT ON COLUMN public.locations.reservation_required IS 'Reservations required (canonical); old "reservations_required" kept for compatibility';
COMMENT ON COLUMN public.locations.must_try IS 'Text version of what_to_try for FTS search compatibility';
COMMENT ON COLUMN public.locations.moderation_note IS 'Admin moderation comment / revision request note';
