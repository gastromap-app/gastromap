-- ═══════════════════════════════════════════════════════════════════════════════
-- GASTROMAP — Enable RLS on tables that were missing it
-- Date: 2026-04-29
-- Why: Supabase Advisor flagged rls_disabled_in_public for these tables.
--      All tables store user-specific data and must be row-level secured.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Enable RLS ─────────────────────────────────────────────────────────────
ALTER TABLE user_preferences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_configs     ENABLE ROW LEVEL SECURITY;

-- ── 2. user_preferences ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_preferences_select_own" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert_own" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences_update_own" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences_delete_own" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences_service_role" ON user_preferences;

CREATE POLICY "user_preferences_select_own"  ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_insert_own"  ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_update_own"  ON user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_delete_own"  ON user_preferences FOR DELETE USING (auth.uid() = user_id);

-- ── 3. chat_sessions ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chat_sessions_select_own" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_insert_own" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_update_own" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_delete_own" ON chat_sessions;

CREATE POLICY "chat_sessions_select_own" ON chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chat_sessions_insert_own" ON chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_sessions_update_own" ON chat_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "chat_sessions_delete_own" ON chat_sessions FOR DELETE USING (auth.uid() = user_id);

-- ── 4. chat_messages ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chat_messages_select_own" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert_own" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_delete_own" ON chat_messages;

CREATE POLICY "chat_messages_select_own" ON chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chat_messages_insert_own" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chat_messages_delete_own" ON chat_messages FOR DELETE USING (auth.uid() = user_id);

-- ── 5. contributors (leaderboard — readable by anyone, writable only by service) ──
DROP POLICY IF EXISTS "contributors_select_all"  ON contributors;
DROP POLICY IF EXISTS "contributors_insert_own"  ON contributors;
DROP POLICY IF EXISTS "contributors_update_own"  ON contributors;

CREATE POLICY "contributors_select_all" ON contributors FOR SELECT USING (true);
-- Insert/update done via service_role only (no user-facing policy needed)

-- ── 6. user_submissions ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "user_submissions_select_own"   ON user_submissions;
DROP POLICY IF EXISTS "user_submissions_insert_own"   ON user_submissions;
DROP POLICY IF EXISTS "user_submissions_update_own"   ON user_submissions;
DROP POLICY IF EXISTS "user_submissions_select_admin" ON user_submissions;

CREATE POLICY "user_submissions_select_own"   ON user_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_submissions_insert_own"   ON user_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_submissions_update_own"   ON user_submissions FOR UPDATE USING (auth.uid() = user_id);
-- Admins can see all submissions (via service_role in backend)

-- ── 7. ai_agent_configs (admin-only table) ────────────────────────────────────
DROP POLICY IF EXISTS "ai_agent_configs_admin_select" ON ai_agent_configs;

-- Only service_role / admin users can access — no public policies
-- Service_role bypasses RLS automatically, so this effectively locks it to admins
CREATE POLICY "ai_agent_configs_admin_select" ON ai_agent_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- ── Done ──────────────────────────────────────────────────────────────────────
-- Verify:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
