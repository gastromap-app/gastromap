-- ═══════════════════════════════════════════════════════════════════════════
-- Chat History Storage: RLS Policies & Performance Indexes
-- ═══════════════════════════════════════════════════════════════════════════
-- Tables chat_sessions and chat_messages already exist with user-level RLS.
-- This migration ensures all required policies exist (idempotent):
--   1. User SELECT policy on chat_sessions (user_id = auth.uid())
--   2. User SELECT/INSERT policies on chat_messages (user_id = auth.uid())
--   3. Session ownership enforcement on chat_messages INSERT
--   4. Admin SELECT policies for debugging/quality monitoring
--   5. Performance indexes for pagination and search
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. User Data Isolation Policies ───────────────────────────────────────

-- User can only SELECT their own chat sessions
DROP POLICY IF EXISTS "chat_sessions_user_select" ON public.chat_sessions;
CREATE POLICY "chat_sessions_user_select"
    ON public.chat_sessions
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- User can only SELECT their own chat messages
DROP POLICY IF EXISTS "chat_messages_user_select" ON public.chat_messages;
CREATE POLICY "chat_messages_user_select"
    ON public.chat_messages
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- User can only INSERT messages with their own user_id
DROP POLICY IF EXISTS "chat_messages_user_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_user_insert"
    ON public.chat_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- ── 2. Session Ownership Check on INSERT ──────────────────────────────────
-- Ensures messages can only be inserted into sessions owned by the user.
DROP POLICY IF EXISTS "chat_messages_session_ownership_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_session_ownership_insert"
    ON public.chat_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.chat_sessions s
            WHERE s.id = chat_messages.session_id
              AND s.user_id = auth.uid()
        )
    );

-- ── 3. Admin RLS Policies ─────────────────────────────────────────────────

-- Admin can read all chat sessions (for debugging/quality monitoring)
DROP POLICY IF EXISTS "admin_read_all_sessions" ON public.chat_sessions;
CREATE POLICY "admin_read_all_sessions"
    ON public.chat_sessions
    FOR SELECT
    TO authenticated
    USING (public.get_my_role() = 'admin');

-- Admin can read all chat messages (for debugging/quality monitoring)
DROP POLICY IF EXISTS "admin_read_all_messages" ON public.chat_messages;
CREATE POLICY "admin_read_all_messages"
    ON public.chat_messages
    FOR SELECT
    TO authenticated
    USING (public.get_my_role() = 'admin');

-- ── 4. Performance Indexes ────────────────────────────────────────────────

-- Composite index for efficient admin user-session lookups and pagination
CREATE INDEX IF NOT EXISTS chat_sessions_user_created_idx
    ON public.chat_sessions (user_id, created_at DESC);

-- Composite index for efficient message pagination within a session
CREATE INDEX IF NOT EXISTS chat_messages_session_timestamp_idx
    ON public.chat_messages (session_id, timestamp DESC);

-- Enable pg_trgm extension for trigram-based full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on message content for admin full-text search
CREATE INDEX IF NOT EXISTS chat_messages_content_trgm_idx
    ON public.chat_messages USING GIN (content gin_trgm_ops);
