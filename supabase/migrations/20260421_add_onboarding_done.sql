-- ─────────────────────────────────────────────────────────────────────────────
-- 20260421_add_onboarding_done.sql  —  Add onboarding_done to user_preferences
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE;
