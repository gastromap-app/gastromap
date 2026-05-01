-- ═══════════════════════════════════════════════════════════════════════════════
-- GASTROMAP — Fix user_submissions schema & permissions
-- Date: 2026-05-03
-- Why: Align user_submissions table with the frontend Add Place form.
--      Adds missing columns and ensures RLS allows authenticated submissions.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Add missing columns ──────────────────────────────────────────────────
ALTER TABLE public.user_submissions 
  ADD COLUMN IF NOT EXISTS ai_photo_url       TEXT,
  ADD COLUMN IF NOT EXISTS country            TEXT,
  ADD COLUMN IF NOT EXISTS country_code       TEXT,
  ADD COLUMN IF NOT EXISTS outdoor_seating    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pet_friendly       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS submitter_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reviewed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_id         UUID,
  ADD COLUMN IF NOT EXISTS lat                 NUMERIC,
  ADD COLUMN IF NOT EXISTS lng                 NUMERIC,
  ADD COLUMN IF NOT EXISTS website_url         TEXT,
  ADD COLUMN IF NOT EXISTS insider_tip         TEXT;

-- ── 2. Fix RLS for submissions ───────────────────────────────────────────────
-- Ensure RLS is enabled
ALTER TABLE public.user_submissions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own submissions
DROP POLICY IF EXISTS "user_submissions_insert_own" ON public.user_submissions;
CREATE POLICY "user_submissions_insert_own" ON public.user_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow authenticated users to see their own submissions
DROP POLICY IF EXISTS "user_submissions_select_own" ON public.user_submissions;
CREATE POLICY "user_submissions_select_own" ON public.user_submissions
  FOR SELECT USING (auth.uid() = user_id);

-- ── 3. Add comments ────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.user_submissions.ai_photo_url IS 'URL of the AI-suggested photo if the user did not upload their own.';
COMMENT ON COLUMN public.user_submissions.location_id IS 'Reference to the created location after approval.';
