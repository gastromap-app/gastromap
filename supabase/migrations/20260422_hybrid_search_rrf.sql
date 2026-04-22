-- ═══════════════════════════════════════════════════════════════════
-- Hybrid Search: pgvector (semantic) + Full-Text (keyword) via RRF
-- ═══════════════════════════════════════════════════════════════════

-- 1. Создаем IMMUTABLE обертку для array_to_string
CREATE OR REPLACE FUNCTION public.immutable_array_to_string(text[], text)
RETURNS text AS $$
    SELECT array_to_string($1, $2);
$$ LANGUAGE sql IMMUTABLE;

-- 2. Обновляем fts колонку (используем существующие колонки: cuisine_types, must_try)
ALTER TABLE public.locations DROP COLUMN IF EXISTS fts;
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
        coalesce(must_try, '')                               || ' ' ||
        coalesce(immutable_array_to_string(ai_keywords, ' '), '')      || ' ' ||
        coalesce(ai_context, '')
    )
) STORED;

CREATE INDEX IF NOT EXISTS locations_fts_gin ON public.locations USING gin(fts);

-- 3. Удаляем старые функции перед созданием новых (из-за возможных изменений в возвращаемых типах)
DROP FUNCTION IF EXISTS search_locations_hybrid(vector, text, text, text, int, int);
DROP FUNCTION IF EXISTS search_locations_fulltext(text, text, text, int);

-- 4. Hybrid Search RPC
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
        WHERE l.status = 'approved'
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
        WHERE l.status = 'approved'
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
        l.image_url as image,
        l.price_range as price_level,
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

-- 5. Full-Text Search RPC (Fallback)
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
        l.image_url as image,
        l.price_range as price_level,
        l.tags,
        l.special_labels,
        (SELECT COALESCE(array_agg(v.name), '{}'::text[]) FROM public.location_vibes lv JOIN public.vibes v ON lv.vibe_id = v.id WHERE lv.location_id = l.id) as vibe,
        l.kg_dishes,
        l.kg_cuisines,
        l.lat,
        l.lng,
        ts_rank_cd(l.fts, websearch_to_tsquery('english', query_text))::float AS rrf_score
    FROM public.locations l
    WHERE l.status = 'approved'
      AND l.fts @@ websearch_to_tsquery('english', query_text)
      AND (p_city IS NULL OR lower(l.city) LIKE '%' || lower(p_city) || '%')
      AND (p_category IS NULL OR lower(l.category) LIKE '%' || lower(p_category) || '%')
    ORDER BY rrf_score DESC
    LIMIT p_limit;
END;
$$;

-- 6. RLS: публичный доступ к RPC
GRANT EXECUTE ON FUNCTION search_locations_hybrid   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_locations_fulltext TO anon, authenticated;
