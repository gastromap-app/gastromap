-- ═══════════════════════════════════════════════════════════════════
-- Hybrid Search: pgvector (semantic) + Full-Text (keyword) via RRF
-- https://dev.to/lpossamai/building-hybrid-search-for-rag-combining-pgvector-and-full-text-search-with-reciprocal-rank-fusion-6nk
--
-- RRF Score = 1/(k + rank_semantic) + 1/(k + rank_fulltext)
-- k=60 — стандарт RRF (Cormack et al., 2009)
-- ═══════════════════════════════════════════════════════════════════

-- Обновляем fts колонку: добавляем kg_dishes и kg_cuisines (если ещё не включены)
-- Пересоздаём как STORED с расширенным контентом
ALTER TABLE public.locations
  DROP COLUMN IF EXISTS fts;

ALTER TABLE public.locations
  ADD COLUMN fts tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(title, '')                                  || ' ' ||
            coalesce(description, '')                            || ' ' ||
            coalesce(city, '')                                   || ' ' ||
            coalesce(country, '')                                || ' ' ||
            coalesce(cuisine, '')                                || ' ' ||
            coalesce(category, '')                               || ' ' ||
            coalesce(array_to_string(tags, ' '), '')             || ' ' ||
            coalesce(array_to_string(kg_dishes, ' '), '')        || ' ' ||
            coalesce(array_to_string(kg_cuisines, ' '), '')      || ' ' ||
            coalesce(array_to_string(what_to_try, ' '), '')      || ' ' ||
            coalesce(array_to_string(ai_keywords, ' '), '')      || ' ' ||
            coalesce(ai_context, '')
        )
    ) STORED;

-- Пересоздаём GIN индекс
DROP INDEX IF EXISTS locations_fts_gin;
CREATE INDEX locations_fts_gin ON public.locations USING gin(fts);

-- ── Основная RPC: Hybrid Search ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_locations_hybrid(
    query_embedding  vector(768),   -- embedding запроса (передаётся с клиента)
    query_text       text,          -- оригинальный текст запроса для FTS
    city_filter      text    DEFAULT NULL,
    category_filter  text    DEFAULT NULL,
    match_count      int     DEFAULT 10,
    rrf_k            int     DEFAULT 60  -- RRF константа
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
LANGUAGE sql STABLE
AS $$
WITH
-- ── 1. Semantic search results ─────────────────────────────────────────────
semantic AS (
    SELECT
        l.id,
        ROW_NUMBER() OVER (ORDER BY l.embedding <=> query_embedding) AS rank_s
    FROM public.locations l
    WHERE l.status = 'active'
      AND l.embedding IS NOT NULL
      AND (city_filter     IS NULL OR lower(l.city)     LIKE '%' || lower(city_filter) || '%')
      AND (category_filter IS NULL OR lower(l.category) LIKE '%' || lower(category_filter) || '%')
    ORDER BY l.embedding <=> query_embedding
    LIMIT 50
),

-- ── 2. Full-text search results ────────────────────────────────────────────
fulltext AS (
    SELECT
        l.id,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(l.fts, query_parsed) DESC) AS rank_f
    FROM public.locations l,
         to_tsquery('english', regexp_replace(trim(query_text), '\s+', ':* & ', 'g') || ':*') AS query_parsed
    WHERE l.status = 'active'
      AND l.fts @@ query_parsed
      AND (city_filter     IS NULL OR lower(l.city)     LIKE '%' || lower(city_filter) || '%')
      AND (category_filter IS NULL OR lower(l.category) LIKE '%' || lower(category_filter) || '%')
    ORDER BY ts_rank_cd(l.fts, query_parsed) DESC
    LIMIT 50
),

-- ── 3. RRF fusion ──────────────────────────────────────────────────────────
fused AS (
    SELECT
        COALESCE(s.id, f.id) AS id,
        COALESCE(1.0 / (rrf_k + s.rank_s), 0.0) +
        COALESCE(1.0 / (rrf_k + f.rank_f), 0.0) AS rrf_score
    FROM semantic s
    FULL OUTER JOIN fulltext f ON s.id = f.id
)

-- ── 4. Join с полными данными ──────────────────────────────────────────────
SELECT
    l.id,
    l.title,
    l.description,
    l.city,
    l.country,
    l.category,
    l.cuisine,
    l.rating,
    l.image,
    l.price_level,
    l.tags,
    l.special_labels,
    l.vibe,
    l.kg_dishes,
    l.kg_cuisines,
    l.lat,
    l.lng,
    fused.rrf_score
FROM fused
JOIN public.locations l ON l.id = fused.id
ORDER BY fused.rrf_score DESC
LIMIT match_count;
$$;

-- ── Fallback RPC: только Full-Text (когда нет embedding) ───────────────────
CREATE OR REPLACE FUNCTION search_locations_fulltext(
    query_text       text,
    city_filter      text  DEFAULT NULL,
    category_filter  text  DEFAULT NULL,
    match_count      int   DEFAULT 10
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
LANGUAGE sql STABLE
AS $$
SELECT
    l.id,
    l.title,
    l.description,
    l.city,
    l.country,
    l.category,
    l.cuisine,
    l.rating,
    l.image,
    l.price_level,
    l.tags,
    l.special_labels,
    l.vibe,
    l.kg_dishes,
    l.kg_cuisines,
    l.lat,
    l.lng,
    ts_rank_cd(l.fts,
        to_tsquery('english', regexp_replace(trim(query_text), '\s+', ':* & ', 'g') || ':*')
    )::float AS rrf_score
FROM public.locations l
WHERE l.status = 'active'
  AND l.fts @@ to_tsquery('english', regexp_replace(trim(query_text), '\s+', ':* & ', 'g') || ':*')
  AND (city_filter     IS NULL OR lower(l.city)     LIKE '%' || lower(city_filter) || '%')
  AND (category_filter IS NULL OR lower(l.category) LIKE '%' || lower(category_filter) || '%')
ORDER BY rrf_score DESC
LIMIT match_count;
$$;

-- RLS: публичный доступ к RPC
GRANT EXECUTE ON FUNCTION search_locations_hybrid   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_locations_fulltext TO anon, authenticated;
