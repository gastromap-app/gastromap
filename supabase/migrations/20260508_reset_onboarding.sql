-- ─────────────────────────────────────────────────────────────────────────────
-- 20260508_reset_onboarding.sql  —  Reset onboarding for all users
-- ─────────────────────────────────────────────────────────────────────────────

-- Reset onboarding flag in profiles table
UPDATE public.profiles
SET onboarding_completed = FALSE
WHERE onboarding_completed = TRUE;

-- Reset onboarding flag in user_preferences table
UPDATE public.user_preferences
SET onboarding_completed = FALSE
WHERE onboarding_completed = TRUE;

-- Optional: clear DNA/preferences data so users start completely fresh
-- Uncomment below if you want to wipe all preference data too:
-- UPDATE public.user_preferences
-- SET favorite_cuisines = ARRAY[]::TEXT[],
--     vibe_preferences = ARRAY[]::TEXT[],
--     dietary_restrictions = ARRAY[]::TEXT[],
--     price_range = NULL,
--     foodie_dna = '',
--     atmosphere_preference = NULL,
--     features = NULL;
