-- ═══════════════════════════════════════════════════════════════════════════
-- RLS Policies for dining_presence and user_submissions
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. dining_presence ────────────────────────────────────────────────────────
-- Users can only manage their own presence records.
-- Everyone can READ all presence (needed for nearby diners feature).

ALTER TABLE public.dining_presence ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see all active presence (needed for map layer)
DROP POLICY IF EXISTS "dining_presence_select_all" ON public.dining_presence;
CREATE POLICY "dining_presence_select_all"
    ON public.dining_presence
    FOR SELECT
    TO authenticated
    USING (true);

-- Users can only insert their own presence
DROP POLICY IF EXISTS "dining_presence_insert_own" ON public.dining_presence;
CREATE POLICY "dining_presence_insert_own"
    ON public.dining_presence
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can only update their own presence
DROP POLICY IF EXISTS "dining_presence_update_own" ON public.dining_presence;
CREATE POLICY "dining_presence_update_own"
    ON public.dining_presence
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own presence
DROP POLICY IF EXISTS "dining_presence_delete_own" ON public.dining_presence;
CREATE POLICY "dining_presence_delete_own"
    ON public.dining_presence
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ── 2. user_submissions ──────────────────────────────────────────────────────
-- Users can see and manage only their own submissions.
-- Admins can see all submissions (for moderation).

ALTER TABLE public.user_submissions ENABLE ROW LEVEL SECURITY;

-- Users can see their own submissions
DROP POLICY IF EXISTS "user_submissions_select_own" ON public.user_submissions;
CREATE POLICY "user_submissions_select_own"
    ON public.user_submissions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Admins can see all submissions
DROP POLICY IF EXISTS "user_submissions_select_admin" ON public.user_submissions;
CREATE POLICY "user_submissions_select_admin"
    ON public.user_submissions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can insert their own submissions
DROP POLICY IF EXISTS "user_submissions_insert_own" ON public.user_submissions;
CREATE POLICY "user_submissions_insert_own"
    ON public.user_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending submissions
DROP POLICY IF EXISTS "user_submissions_update_own" ON public.user_submissions;
CREATE POLICY "user_submissions_update_own"
    ON public.user_submissions
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own pending submissions
DROP POLICY IF EXISTS "user_submissions_delete_own" ON public.user_submissions;
CREATE POLICY "user_submissions_delete_own"
    ON public.user_submissions
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id AND status = 'pending');

-- Admins can update any submission (for moderation: approve/reject)
DROP POLICY IF EXISTS "user_submissions_update_admin" ON public.user_submissions;
CREATE POLICY "user_submissions_update_admin"
    ON public.user_submissions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
