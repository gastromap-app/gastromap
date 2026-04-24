-- Phase 1: Final Synchronization of Search Functions
-- This script ensures the database RPC functions match the application's naming conventions perfectly.
-- Run this in Supabase SQL Editor.

-- 1. Drop existing functions to avoid "cannot change return type" error
DROP FUNCTION IF EXISTS public.search_locations_hybrid(vector, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.search_locations_hybrid(vector, text, text, text, numeric, numeric, integer, integer, integer);
DROP FUNCTION IF EXISTS public.search_locations_hybrid(vector, text, text, text, text, numeric, numeric, integer, integer, integer);
DROP FUNCTION IF EXISTS public.search_locations_fulltext(text, text, text, integer);
DROP FUNCTION IF EXISTS public.search_locations_fulltext(text, text, text, numeric, numeric, integer, integer);
DROP FUNCTION IF EXISTS public.search_locations_fulltext(text, text, text, text, numeric, numeric, integer, integer);

-- 2. Hybrid Search Function (RRF) with Geo-filtering
CREATE OR REPLACE FUNCTION public.search_locations_hybrid(
  query_embedding vector(768),
  query_text text,
  p_city text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_cuisine text DEFAULT NULL,
  p_price_range text DEFAULT NULL,
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL,
  p_radius_meters integer DEFAULT 5000,
  p_limit integer DEFAULT 10,
  rrf_k integer DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  city text,
  country text,
  address text,
  category text,
  cuisine text,
  google_rating numeric,
  image_url text,
  price_range text,
  tags text[],
  special_labels text[],
  vibe text[],
  kg_dishes text[],
  kg_cuisines text[],
  amenities text[],
  dietary_options text[],
  michelin_stars integer,
  michelin_bib boolean,
  lat numeric,
  lng numeric,
  rrf_score float,
  distance_meters float
) AS $$
BEGIN
    RETURN QUERY
    WITH semantic AS (
        SELECT
            l.id,
            ROW_NUMBER() OVER (ORDER BY l.embedding <=> query_embedding) AS rank_s
        FROM public.locations l
        WHERE l.status = 'approved'
          AND l.embedding IS NOT NULL
          AND (p_city IS NULL OR lower(l.city) = lower(p_city))
          AND (p_category IS NULL OR lower(l.category) = lower(p_category))
          AND (p_cuisine IS NULL OR l.kg_cuisines @> ARRAY[p_cuisine]::text[] OR l.cuisine ILIKE '%' || p_cuisine || '%')
          AND (p_price_range IS NULL OR l.price_range = p_price_range)
          AND (
            p_lat IS NULL OR p_lng IS NULL OR 
            (st_distance_sphere(st_point(l.lng, l.lat), st_point(p_lng, p_lat)) <= p_radius_meters)
          )
        ORDER BY l.embedding <=> query_embedding
        LIMIT 50
    ),
    fulltext AS (
        SELECT
            l.id,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(l.fts, query_parsed) DESC) AS rank_f
        FROM public.locations l,
             websearch_to_tsquery('english', query_text) AS query_parsed
        WHERE l.status = 'approved'
          AND l.fts @@ query_parsed
          AND (p_city IS NULL OR lower(l.city) = lower(p_city))
          AND (p_category IS NULL OR lower(l.category) = lower(p_category))
          AND (p_cuisine IS NULL OR l.kg_cuisines @> ARRAY[p_cuisine]::text[] OR l.cuisine ILIKE '%' || p_cuisine || '%')
          AND (p_price_range IS NULL OR l.price_range = p_price_range)
          AND (
            p_lat IS NULL OR p_lng IS NULL OR 
            (st_distance_sphere(st_point(l.lng, l.lat), st_point(p_lng, p_lat)) <= p_radius_meters)
          )
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
        l.address,
        l.category,
        l.cuisine,
        l.google_rating,
        l.image_url,
        l.price_range,
        l.tags,
        l.special_labels,
        COALESCE(l.vibe, '{}'::text[]) as vibe,
        l.kg_dishes,
        l.kg_cuisines,
        l.amenities,
        l.dietary_options,
        COALESCE(l.michelin_stars, 0) as michelin_stars,
        COALESCE(l.michelin_bib, false) as michelin_bib,
        l.lat,
        l.lng,
        fused.rrf_score::float,
        CASE 
            WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL 
            THEN st_distance_sphere(st_point(l.lng, l.lat), st_point(p_lng, p_lat))
            ELSE NULL 
        END as distance_meters
    FROM fused
    JOIN public.locations l ON l.id = fused.id
    ORDER BY fused.rrf_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 3. Full-text Search Fallback with Geo-filtering
CREATE OR REPLACE FUNCTION public.search_locations_fulltext(
  query_text text,
  p_city text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_cuisine text DEFAULT NULL,
  p_price_range text DEFAULT NULL,
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL,
  p_radius_meters integer DEFAULT 5000,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  city text,
  country text,
  address text,
  category text,
  cuisine text,
  google_rating numeric,
  image_url text,
  price_range text,
  tags text[],
  special_labels text[],
  vibe text[],
  kg_dishes text[],
  kg_cuisines text[],
  amenities text[],
  dietary_options text[],
  michelin_stars integer,
  michelin_bib boolean,
  lat numeric,
  lng numeric,
  rrf_score float,
  distance_meters float
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        l.title,
        l.description,
        l.city,
        l.country,
        l.address,
        l.category,
        l.cuisine,
        l.google_rating,
        l.image_url,
        l.price_range,
        l.tags,
        l.special_labels,
        COALESCE(l.vibe, '{}'::text[]) as vibe,
        l.kg_dishes,
        l.kg_cuisines,
        l.amenities,
        l.dietary_options,
        COALESCE(l.michelin_stars, 0) as michelin_stars,
        COALESCE(l.michelin_bib, false) as michelin_bib,
        l.lat,
        l.lng,
        ts_rank_cd(l.fts, websearch_to_tsquery('english', query_text))::float AS rrf_score,
        CASE 
            WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL 
            THEN st_distance_sphere(st_point(l.lng, l.lat), st_point(p_lng, p_lat))
            ELSE NULL 
        END as distance_meters
    FROM public.locations l
    WHERE l.status = 'approved'
      AND l.fts @@ websearch_to_tsquery('english', query_text)
      AND (p_city IS NULL OR lower(l.city) = lower(p_city))
      AND (p_category IS NULL OR lower(l.category) = lower(p_category))
      AND (p_cuisine IS NULL OR l.kg_cuisines @> ARRAY[p_cuisine]::text[] OR l.cuisine ILIKE '%' || p_cuisine || '%')
      AND (p_price_range IS NULL OR l.price_range = p_price_range)
      AND (
        p_lat IS NULL OR p_lng IS NULL OR 
        (st_distance_sphere(st_point(l.lng, l.lat), st_point(p_lng, p_lat)) <= p_radius_meters)
      )
    ORDER BY rrf_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
