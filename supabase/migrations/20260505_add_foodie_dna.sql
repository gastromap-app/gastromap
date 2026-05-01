-- ─────────────────────────────────────────────────────────────────────────────
-- 20260505_add_foodie_dna.sql  —  Add foodie_dna to user_preferences
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_preferences
    ADD COLUMN IF NOT EXISTS foodie_dna TEXT;

COMMENT ON COLUMN public.user_preferences.foodie_dna IS 'AI-extracted persona/preferences from chat history';
