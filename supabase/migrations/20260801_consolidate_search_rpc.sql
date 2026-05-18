-- ═══════════════════════════════════════════════════════════════════════════
-- Consolidate Search RPC: Replace all overloads with a single function
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration:
--   1. Drops both overloads of search_locations_hybrid (6-param and 10-param)
--   2. Drops both overloads of search_locations_fulltext
--   3. Creates a single public.search_locations() with RRF-fused CTE
--   4. Grants EXECUTE to anon and authenticated
--
-- Does NOT alter any chat_messages or chat_sessions tables.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Drop all existing overloads ─────────────────────────────────────

DROP FUNCTION IF EXISTS public.search_locations_hybrid(vector, text, text, text, int, int);
DROP FUNCTION IF EXISTS public.search_locations_hybrid(vector, text, text, text, text, text, double precision, double precision, double precision, int, int);
DROP FUNCTION IF EXISTS public.search_locations_fulltext(text, text, text, int);
DROP FUNCTION IF EXISTS public.search_locations_fulltext(text, text, text, text, text, double precision, double precision, double precision, int);

-- ─── 2. Create the single consolidated search function ──────────────────

CREATE OR REPLACE FUNCTION public.search_locations(
    query             text        DEFAULT NULL,
    query_embedding   vector(768) DEFAULT NULL,
    city_filter       text        DEFAULT NULL,
    category_filter   text        DEFAULT NULL,
    cuisine_filter    text        DEFAULT NULL,
    result_limit      int         DEFAULT 10
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
    score           float
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH semantic AS (
    SELECT l.id, ROW_NUMBER() OVER (ORDER BY l.embedding <=> query_embedding) AS rs
    FROM   public.locations l
    WHERE  query_embedding IS NOT NULL
      AND  l.status IN ('approved', 'active')
      AND  l.embedding IS NOT NULL
      AND  (city_filter     IS NULL OR lower(l.city)     LIKE '%' || lower(city_filter)     || '%')
      AND  (category_filter IS NULL OR lower(l.category) LIKE '%' || lower(category_filter) || '%')
      AND  (cuisine_filter  IS NULL OR
             lower(coalesce(array_to_string(l.cuisine_types, ' '), '')) LIKE '%' || lower(cuisine_filter) || '%')
    ORDER  BY l.embedding <=> query_embedding
    LIMIT  50
  ),
  fulltext AS (
    SELECT l.id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(l.fts, q) DESC) AS rf
    FROM   public.locations l, websearch_to_tsquery('simple', coalesce(query, '')) AS q
    WHERE  query IS NOT NULL AND length(trim(query)) > 0
      AND  l.fts @@ q
      AND  l.status IN ('approved', 'active')
      AND  (city_filter     IS NULL OR lower(l.city)     LIKE '%' || lower(city_filter)     || '%')
      AND  (category_filter IS NULL OR lower(l.category) LIKE '%' || lower(category_filter) || '%')
      AND  (cuisine_filter  IS NULL OR
             lower(coalesce(array_to_string(l.cuisine_types, ' '), '')) LIKE '%' || lower(cuisine_filter) || '%')
    ORDER  BY ts_rank_cd(l.fts, q) DESC
    LIMIT  50
  ),
  filter_only AS (
    SELECT l.id, ROW_NUMBER() OVER (ORDER BY l.google_rating DESC NULLS LAST) AS rk
    FROM   public.locations l
    WHERE  query IS NULL AND query_embedding IS NULL
      AND  l.status IN ('approved', 'active')
      AND  (city_filter     IS NULL OR lower(l.city)     LIKE '%' || lower(city_filter)     || '%')
      AND  (category_filter IS NULL OR lower(l.category) LIKE '%' || lower(category_filter) || '%')
      AND  (cuisine_filter  IS NULL OR
             lower(coalesce(array_to_string(l.cuisine_types, ' '), '')) LIKE '%' || lower(cuisine_filter) || '%')
  ),
  fused AS (
    SELECT
      coalesce(s.id, f.id, fo.id) AS id,
      coalesce(1.0/(60 + s.rs), 0.0)
        + coalesce(1.0/(60 + f.rf), 0.0)
        + coalesce(1.0/(60 + fo.rk), 0.0) AS score
    FROM semantic s
    FULL OUTER JOIN fulltext f       ON s.id  = f.id
    FULL OUTER JOIN filter_only fo   ON coalesce(s.id, f.id) = fo.id
  )
  SELECT
    l.id, l.title, l.description, l.city, l.country, l.category,
    array_to_string(l.cuisine_types, ', ')             AS cuisine,
    l.google_rating                                    AS rating,
    coalesce(l.image_url, l.image)                     AS image,
    coalesce(l.price_range, l.price_level)             AS price_level,
    l.tags, l.special_labels,
    (SELECT coalesce(array_agg(v.name), '{}'::text[])
       FROM public.location_vibes lv
       JOIN public.vibes v ON lv.vibe_id = v.id
      WHERE lv.location_id = l.id)                     AS vibe,
    l.kg_dishes, l.kg_cuisines, l.lat, l.lng,
    fused.score::float
  FROM   fused
  JOIN   public.locations l ON l.id = fused.id
  ORDER  BY fused.score DESC
  LIMIT  greatest(1, least(coalesce(result_limit, 10), 25));
END;
$$;

-- ─── 3. Grant access ────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.search_locations(text, vector, text, text, text, int)
  TO anon, authenticated;
