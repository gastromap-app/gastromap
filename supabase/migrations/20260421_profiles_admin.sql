-- ─────────────────────────────────────────────────────────────────────────────
-- 20260421_profiles_admin.sql  —  Extend profiles with status & last_active_at
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Add `status` column (active / suspended / banned)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'banned'));


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Add `last_active_at` column
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Index on status for admin queries
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RLS policy — only admins can update user status
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admins can update user status" ON public.profiles;

CREATE POLICY "Admins can update user status" ON public.profiles
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
