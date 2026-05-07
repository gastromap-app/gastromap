-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Enforce unique emails in profiles table
-- Date: 2026-05-09
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Deduplicate: keep only the oldest profile per email
WITH ranked AS (
    SELECT id,
           email,
           ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at ASC) AS rn
    FROM public.profiles
    WHERE email IS NOT NULL
)
DELETE FROM public.profiles
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Add UNIQUE constraint on email (case-insensitive via expression index)
--    We use an expression index on LOWER(email) to enforce case-insensitive uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
    ON public.profiles (LOWER(email))
    WHERE email IS NOT NULL;

-- 3. Add regular index for fast lookups (check-email endpoint, admin queries)
CREATE INDEX IF NOT EXISTS idx_profiles_email
    ON public.profiles (email);

-- 3b. Add onboarding_completed column if missing (referenced by useUserPrefsStore)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- 4. Update trigger function to handle duplicate email gracefully.
--    If the profile already exists (same id), skip insert.
--    Auth-level duplicate check is the primary guard; this prevents trigger blow-up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'user'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;
