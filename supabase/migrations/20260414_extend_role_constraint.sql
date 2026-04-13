-- Migration: extend profiles.role constraint to include 'premium' and 'supporter'
-- Fixes: AdminUsersPage shows premium users correctly

-- Drop old constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add extended constraint
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('user', 'admin', 'moderator', 'premium', 'supporter'));
