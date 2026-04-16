-- ============================================================
-- 20260414_fix_rls_recursion.sql
-- Fix: infinite recursion in user_roles RLS policies
-- Root cause: policies on user_roles/reviews/user_visits checked
--   EXISTS (SELECT 1 FROM user_roles WHERE ...) — recursive!
-- Fix: replace all such checks with public.get_my_role()
--   which uses SECURITY DEFINER and reads profiles.role directly
-- ============================================================

-- ── 1. user_roles table ────────────────────────────────────────────────────
-- Drop the recursive policy "Admins can manage roles"
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Re-create using get_my_role() — no recursion
CREATE POLICY "Admins can manage roles"
    ON public.user_roles
    FOR ALL
    USING (public.get_my_role() = 'admin')
    WITH CHECK (public.get_my_role() = 'admin');

-- ── 2. reviews table ───────────────────────────────────────────────────────
-- Drop the recursive admin policy from 005_visits_and_reviews.sql
DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.reviews;

-- Re-create with get_my_role()
CREATE POLICY "Admins can manage all reviews"
    ON public.reviews
    FOR ALL
    USING (public.get_my_role() = 'admin')
    WITH CHECK (public.get_my_role() = 'admin');

-- Also ensure anon/unauthenticated can read approved/active reviews
DROP POLICY IF EXISTS "Anyone can view published reviews" ON public.reviews;
CREATE POLICY "Anyone can view published reviews"
    ON public.reviews
    FOR SELECT
    USING (status IN ('approved', 'published'));

-- ── 3. user_visits table ───────────────────────────────────────────────────
-- Admin access to all visits (for stats page)
DROP POLICY IF EXISTS "Admins can manage all visits" ON public.user_visits;
DROP POLICY IF EXISTS "Admin read all user_visits" ON public.user_visits;

CREATE POLICY "Admins can manage all visits"
    ON public.user_visits
    FOR ALL
    USING (public.get_my_role() = 'admin')
    WITH CHECK (public.get_my_role() = 'admin');

-- ── 4. locations table ─────────────────────────────────────────────────────
-- Drop any recursive policies on locations
DROP POLICY IF EXISTS "Admins can manage all locations" ON public.locations;

-- Ensure admin has full access
DROP POLICY IF EXISTS "Admin read all locations"   ON public.locations;
DROP POLICY IF EXISTS "Admin insert locations"     ON public.locations;
DROP POLICY IF EXISTS "Admin update locations"     ON public.locations;
DROP POLICY IF EXISTS "Admin delete locations"     ON public.locations;

CREATE POLICY "Admin read all locations"
    ON public.locations FOR SELECT
    USING (public.get_my_role() = 'admin');

CREATE POLICY "Admin insert locations"
    ON public.locations FOR INSERT
    WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Admin update locations"
    ON public.locations FOR UPDATE
    USING (public.get_my_role() = 'admin')
    WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Admin delete locations"
    ON public.locations FOR DELETE
    USING (public.get_my_role() = 'admin');

-- ── 5. profiles table ──────────────────────────────────────────────────────
-- Ensure anon can read basic profiles (needed for reviews join)
DROP POLICY IF EXISTS "profiles: admin read all" ON public.profiles;
CREATE POLICY "profiles: admin read all"
    ON public.profiles FOR SELECT
    USING (public.get_my_role() = 'admin');

-- ── 6. Ensure get_my_role is up to date ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, anon, service_role;

-- ── 7. Grant anon read on key tables (for public-facing queries) ──────────
GRANT SELECT ON public.locations TO anon;
GRANT SELECT ON public.reviews   TO anon;
GRANT SELECT ON public.profiles  TO anon;
GRANT SELECT ON public.user_visits TO anon;
