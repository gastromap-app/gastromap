-- Migration: enforce canonical roles — only 'user', 'moderator', 'admin'
-- Removes 'premium' and 'supporter' which are not used in this system.
-- Registration assigns 'user'. Admin can promote to 'moderator' or 'admin'.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('user', 'moderator', 'admin'));

-- Safety: reset any stale premium/supporter rows to 'user'
UPDATE public.profiles
SET role = 'user'
WHERE role NOT IN ('user', 'moderator', 'admin');
