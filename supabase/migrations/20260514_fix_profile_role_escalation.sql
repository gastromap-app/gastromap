-- Fix: Prevent users from escalating their own role
-- Previously: GRANT UPDATE ON profiles TO authenticated (all columns)
-- Now: Only allow updating safe columns

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, name, avatar_url, bio, preferences, onboarding_done) ON public.profiles TO authenticated;
