-- ═══════════════════════════════════════════════════════════════════════════
-- AI Bot Improvements v2 — Phase 1: Schema Migration
-- ═══════════════════════════════════════════════════════════════════════════
-- Creates new tables and adds columns for:
--   1. session_locations — tracks which locations the bot has shown per session
--   2. chat_sessions — adds rolling conversation summary columns
--   3. conversation_summaries — adds source message range + regen support
--   4. embedding_cache — LRU cache for embedding vectors
--   5. ai_guardrail_events — audit log for guardrail decisions
--
-- Idempotent: safe to re-run (uses IF NOT EXISTS / IF NOT EXISTS columns).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. session_locations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_locations (
    session_id   uuid        NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    location_id  uuid        NOT NULL REFERENCES public.locations(id)     ON DELETE CASCADE,
    user_id      uuid        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
    position     integer     NOT NULL DEFAULT 0,
    shown_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, location_id)
);

CREATE INDEX IF NOT EXISTS session_locations_session_idx
    ON public.session_locations (session_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS session_locations_user_idx
    ON public.session_locations (user_id);

ALTER TABLE public.session_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_locations_owner" ON public.session_locations;
CREATE POLICY "session_locations_owner"
    ON public.session_locations
    FOR ALL TO authenticated
    USING      (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ─── 2. chat_sessions: store the rolling Conversation Summary ────────────
ALTER TABLE public.chat_sessions
    ADD COLUMN IF NOT EXISTS summary               text,
    ADD COLUMN IF NOT EXISTS summary_updated_at    timestamptz,
    ADD COLUMN IF NOT EXISTS summary_messages_covered integer NOT NULL DEFAULT 0;

-- ─── 3. conversation_summaries: source range + regen support ─────────────
ALTER TABLE public.conversation_summaries
    ADD COLUMN IF NOT EXISTS source_from_message_id uuid,
    ADD COLUMN IF NOT EXISTS source_to_message_id   uuid,
    ADD COLUMN IF NOT EXISTS regen_count            integer NOT NULL DEFAULT 0;

-- ─── 4. embedding_cache ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.embedding_cache (
    query_hash    text        NOT NULL,
    provider      text        NOT NULL,
    model         text        NOT NULL,
    dimensions    integer     NOT NULL,
    embedding     vector(768),
    hit_count     integer     NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_used_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (query_hash, provider, model, dimensions)
);

CREATE INDEX IF NOT EXISTS embedding_cache_lru_idx
    ON public.embedding_cache (last_used_at DESC);

ALTER TABLE public.embedding_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embedding_cache_read_authn" ON public.embedding_cache;
CREATE POLICY "embedding_cache_read_authn"
    ON public.embedding_cache FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "embedding_cache_write_service" ON public.embedding_cache;
CREATE POLICY "embedding_cache_write_service"
    ON public.embedding_cache FOR ALL USING (auth.role() = 'service_role');

-- ─── 5. ai_guardrail_events (audit) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_guardrail_events (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id  uuid        REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    turn_id     text        NOT NULL,
    stage       text        NOT NULL CHECK (stage IN ('input', 'output')),
    verdict     text        NOT NULL CHECK (verdict IN ('rejected', 'modified', 'accepted')),
    reason      text,
    payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_guardrail_events_session_idx
    ON public.ai_guardrail_events (session_id, created_at DESC);

ALTER TABLE public.ai_guardrail_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guardrail_owner_read" ON public.ai_guardrail_events;
CREATE POLICY "guardrail_owner_read"
    ON public.ai_guardrail_events FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "guardrail_admin_read" ON public.ai_guardrail_events;
CREATE POLICY "guardrail_admin_read"
    ON public.ai_guardrail_events FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'superadmin')));

DROP POLICY IF EXISTS "guardrail_service_write" ON public.ai_guardrail_events;
CREATE POLICY "guardrail_service_write"
    ON public.ai_guardrail_events FOR INSERT WITH CHECK (true);
