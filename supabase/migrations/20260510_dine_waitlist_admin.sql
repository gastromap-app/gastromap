-- ============================================================
-- Dine With Me — Waitlist table + admin read policies
-- ============================================================
-- Enables admin to see who signed up for early access
-- and allows persisting waitlist entries in Supabase
-- (not just localStorage).

-- ──────────────────────────────────────────────────────────────
-- 1. Waitlist table
-- ──────────────────────────────────────────────────────────────
CREATE TABLE dine_waitlist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message     TEXT CHECK (char_length(message) <= 500),
    status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),

    UNIQUE(user_id)  -- one entry per user
);

CREATE INDEX idx_dine_waitlist_status ON dine_waitlist(status);
CREATE INDEX idx_dine_waitlist_created ON dine_waitlist(created_at DESC);

ALTER TABLE dine_waitlist ENABLE ROW LEVEL SECURITY;

-- Users can insert themselves into the waitlist
CREATE POLICY "dine_waitlist: insert own"
    ON dine_waitlist FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can read their own entry
CREATE POLICY "dine_waitlist: read own"
    ON dine_waitlist FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can read all waitlist entries
CREATE POLICY "dine_waitlist: admin read"
    ON dine_waitlist FOR SELECT
    USING (public.get_my_role() IN ('admin', 'moderator'));

-- Admins can update waitlist status (approve/reject)
CREATE POLICY "dine_waitlist: admin update"
    ON dine_waitlist FOR UPDATE
    USING (public.get_my_role() IN ('admin', 'moderator'));

-- Admins can delete waitlist entries
CREATE POLICY "dine_waitlist: admin delete"
    ON dine_waitlist FOR DELETE
    USING (public.get_my_role() IN ('admin', 'moderator'));

-- ──────────────────────────────────────────────────────────────
-- 2. Admin read policies for existing Dine With Me tables
-- ──────────────────────────────────────────────────────────────

-- Admin can read ALL dining presences (including expired + friends_only)
CREATE POLICY "dining_presence: admin read"
    ON dining_presence FOR SELECT
    USING (public.get_my_role() IN ('admin', 'moderator'));

-- Admin can read ALL dine waves
CREATE POLICY "dine_waves: admin read"
    ON dine_waves FOR SELECT
    USING (public.get_my_role() IN ('admin', 'moderator'));

-- Admin can delete any dining presence (e.g. remove abusive user)
CREATE POLICY "dining_presence: admin delete"
    ON dining_presence FOR DELETE
    USING (public.get_my_role() IN ('admin', 'moderator'));

-- Admin can delete any dine wave
CREATE POLICY "dine_waves: admin delete"
    ON dine_waves FOR DELETE
    USING (public.get_my_role() IN ('admin', 'moderator'));

-- Admin can update diner reports (mark as resolved etc.)
CREATE POLICY "diner_reports: admin update"
    ON diner_reports FOR UPDATE
    USING (public.get_my_role() IN ('admin', 'moderator'));

-- ──────────────────────────────────────────────────────────────
-- 3. Add resolved_at column to diner_reports
-- ──────────────────────────────────────────────────────────────
ALTER TABLE diner_reports
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed'));
