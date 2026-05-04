-- ═══════════════════════════════════════════════════════════════════════════════
-- GASTROMAP — Consolidated Audit Fixes
-- Date: 2026-05-02
-- Fixes critical schema mismatches and RLS issues identified in code audit.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. profiles: add missing columns that code expects ────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Backfill full_name from existing name column
UPDATE public.profiles SET full_name = name WHERE full_name IS NULL;

-- Backfill status for existing rows
UPDATE public.profiles SET status = 'active' WHERE status IS NULL;


-- ── 2. ai_agent_configs: fix recursive RLS policy ────────────────────────────
-- The old policy queried user_roles directly, causing infinite recursion.
-- Replace with get_my_role() which is SECURITY DEFINER.

DROP POLICY IF EXISTS "ai_agent_configs_admin_select" ON public.ai_agent_configs;

CREATE POLICY "ai_agent_configs_admin_select"
    ON public.ai_agent_configs FOR SELECT
    USING (public.get_my_role() = 'admin');


-- ── 3. reviews: align CHECK constraint with code usage ────────────────────────
-- Code queries status = 'approved' but CHECK only allowed pending/published/rejected.

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_status_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_status_check
    CHECK (status IN ('pending', 'published', 'rejected', 'approved'));


-- ── 4. locations: add CHECK constraint for valid status values ────────────────
-- Code uses 'approved', 'pending', 'rejected' extensively alongside original values.

ALTER TABLE public.locations DROP CONSTRAINT IF EXISTS locations_status_check;
ALTER TABLE public.locations ADD CONSTRAINT locations_status_check
    CHECK (status IN ('active', 'approved', 'pending', 'rejected', 'hidden', 'coming_soon'));

-- Migrate legacy statuses: treat 'active' locations as 'approved' for moderation
UPDATE public.locations SET status = 'approved' WHERE status = 'active';


-- ── 5. user_submissions: fix RLS regression ───────────────────────────────────
-- The 2026-05-03 migration allowed user_id IS NULL, which bypasses ownership.
-- Revert to strict owner-only insert.

DROP POLICY IF EXISTS "user_submissions_insert_own" ON public.user_submissions;
CREATE POLICY "user_submissions_insert_own" ON public.user_submissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ── 6. leaderboard function: fix column reference ─────────────────────────────
-- get_leaderboard() referenced p.full_name which did not exist.

CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  places_visited BIGINT,
  reviews_written BIGINT,
  places_saved BIGINT,
  total_points BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    COALESCE(p.full_name, p.name) AS name,
    p.email,
    p.avatar_url,
    COALESCE(v.places_visited, 0) AS places_visited,
    COALESCE(r.reviews_written, 0) AS reviews_written,
    COALESCE(f.places_saved, 0) AS places_saved,
    (
      COALESCE(v.places_visited, 0) * 10 +
      COALESCE(r.reviews_written, 0) * 25 +
      COALESCE(f.places_saved, 0) * 5
    ) AS total_points
  FROM profiles p
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS places_visited
    FROM user_visits
    GROUP BY user_id
  ) v ON v.user_id = p.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS reviews_written
    FROM reviews
    WHERE status IN ('approved', 'published')
    GROUP BY user_id
  ) r ON r.user_id = p.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS places_saved
    FROM user_favorites
    GROUP BY user_id
  ) f ON f.user_id = p.id
  ORDER BY total_points DESC;
END;
$$;


-- ── 7. google_rating: set default to avoid NULL sort issues ───────────────────

UPDATE public.locations
SET google_rating = 0
WHERE google_rating IS NULL;

ALTER TABLE public.locations ALTER COLUMN google_rating SET DEFAULT 0;
