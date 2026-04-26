-- ═══════════════════════════════════════════════════════════════════════════
-- GastroGuide Memory v2
-- Adds structured persistence for attachments, intent, tool_calls,
-- long-term conversation summaries, PostGIS geo column and nearby RPC.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. chat_messages: extend with first-class columns ────────────────────
ALTER TABLE public.chat_messages
    ADD COLUMN IF NOT EXISTS metadata               jsonb  NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS attachments            jsonb  NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS tool_calls             jsonb,
    ADD COLUMN IF NOT EXISTS tool_call_id           text,
    ADD COLUMN IF NOT EXISTS intent                 text,
    ADD COLUMN IF NOT EXISTS language               text,
    ADD COLUMN IF NOT EXISTS mentioned_location_ids uuid[] DEFAULT '{}';

-- Migrate legacy `matches` column data into `attachments` where needed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'chat_messages'
          AND column_name  = 'matches'
    ) THEN
        EXECUTE $q$
            UPDATE public.chat_messages
               SET attachments = matches
             WHERE (attachments IS NULL OR attachments = '[]'::jsonb)
               AND matches IS NOT NULL
               AND jsonb_typeof(matches) = 'array'
               AND matches <> '[]'::jsonb
        $q$;
    END IF;
END $$;

-- Indexes for pagination & analytics
CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx
    ON public.chat_messages (session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx
    ON public.chat_messages (user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS chat_messages_intent_idx
    ON public.chat_messages (intent) WHERE intent IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_messages_mentioned_gin
    ON public.chat_messages USING GIN (mentioned_location_ids);

-- ─── 2. Long-term rolling summaries (one per session) ──────────────────────
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
    session_id        uuid        PRIMARY KEY REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    summary           text        NOT NULL,
    covers_up_to      timestamptz NOT NULL,
    messages_covered  integer     NOT NULL DEFAULT 0,
    last_intent       text,
    last_location_ids uuid[]      DEFAULT '{}',
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_summaries_user_idx
    ON public.conversation_summaries (user_id);

-- ─── 3. RLS (enable + per-user policies) ───────────────────────────────────
ALTER TABLE public.chat_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_sessions_select" ON public.chat_sessions;
CREATE POLICY "own_sessions_select" ON public.chat_sessions
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own_sessions_insert" ON public.chat_sessions;
CREATE POLICY "own_sessions_insert" ON public.chat_sessions
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_sessions_update" ON public.chat_sessions;
CREATE POLICY "own_sessions_update" ON public.chat_sessions
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own_sessions_delete" ON public.chat_sessions;
CREATE POLICY "own_sessions_delete" ON public.chat_sessions
    FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own_messages_select" ON public.chat_messages;
CREATE POLICY "own_messages_select" ON public.chat_messages
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.chat_sessions s
                WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "own_messages_insert" ON public.chat_messages;
CREATE POLICY "own_messages_insert" ON public.chat_messages
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.chat_sessions s
                WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "own_messages_delete" ON public.chat_messages;
CREATE POLICY "own_messages_delete" ON public.chat_messages
    FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM public.chat_sessions s
                WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "own_summaries" ON public.conversation_summaries;
CREATE POLICY "own_summaries" ON public.conversation_summaries
    FOR ALL TO authenticated
    USING      (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_all_summaries" ON public.conversation_summaries;
CREATE POLICY "service_role_all_summaries" ON public.conversation_summaries
    FOR ALL USING (auth.role() = 'service_role');

-- ─── 4. PostGIS + geography column + GIST index ────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'locations'
          AND column_name  = 'location_point'
    ) THEN
        EXECUTE $q$
            ALTER TABLE public.locations
              ADD COLUMN location_point geography(Point, 4326)
              GENERATED ALWAYS AS (
                CASE
                  WHEN lat IS NOT NULL AND lng IS NOT NULL
                  THEN ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)::geography
                  ELSE NULL
                END
              ) STORED
        $q$;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS locations_location_point_gix
    ON public.locations USING GIST (location_point);

-- ─── 5. search_locations_nearby RPC (PostGIS-backed) ───────────────────────
CREATE OR REPLACE FUNCTION public.search_locations_nearby(
    p_lat        double precision,
    p_lng        double precision,
    p_radius_m   integer DEFAULT 1500,
    p_category   text    DEFAULT NULL,
    p_cuisine    text    DEFAULT NULL,
    p_price_max  text    DEFAULT NULL,
    p_limit      integer DEFAULT 5
)
RETURNS TABLE (
    id           uuid,
    title        text,
    description  text,
    image        text,
    category     text,
    cuisine      text,
    rating       numeric,
    price_range  text,
    city         text,
    country      text,
    tags         text[],
    vibe         text[],
    insider_tip  text,
    what_to_try  text[],
    distance_m   double precision
)
LANGUAGE sql STABLE
AS $$
    SELECT
        l.id,
        l.title,
        l.description,
        COALESCE(l.image_url, l.image) AS image,
        l.category,
        COALESCE(
            CASE WHEN l.cuisine_types IS NOT NULL
                 THEN array_to_string(l.cuisine_types, ', ')
                 ELSE NULL END,
            l.cuisine
        ) AS cuisine,
        COALESCE(l.google_rating, l.rating) AS rating,
        COALESCE(l.price_range, l.price_level) AS price_range,
        l.city,
        l.country,
        l.tags,
        (
            SELECT COALESCE(array_agg(v.name), '{}'::text[])
              FROM public.location_vibes lv
              JOIN public.vibes v ON v.id = lv.vibe_id
             WHERE lv.location_id = l.id
        ) AS vibe,
        l.insider_tip,
        l.what_to_try,
        ST_Distance(
            l.location_point,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        ) AS distance_m
    FROM public.locations l
    WHERE l.status IN ('approved', 'active')
      AND l.location_point IS NOT NULL
      AND ST_DWithin(
              l.location_point,
              ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
              p_radius_m
          )
      AND (p_category  IS NULL OR lower(l.category) LIKE '%' || lower(p_category) || '%')
      AND (p_cuisine   IS NULL OR lower(COALESCE(l.cuisine, array_to_string(l.cuisine_types, ' '))) LIKE '%' || lower(p_cuisine) || '%')
      AND (
            p_price_max IS NULL
            OR CASE l.price_range
                   WHEN '$'    THEN 1
                   WHEN '$$'   THEN 2
                   WHEN '$$$'  THEN 3
                   WHEN '$$$$' THEN 4
                   ELSE 5
               END
               <=
               CASE p_price_max
                   WHEN '$'    THEN 1
                   WHEN '$$'   THEN 2
                   WHEN '$$$'  THEN 3
                   WHEN '$$$$' THEN 4
                   ELSE 5
               END
          )
    ORDER BY distance_m ASC
    LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.search_locations_nearby(
    double precision, double precision, integer, text, text, text, integer
) TO anon, authenticated, service_role;
