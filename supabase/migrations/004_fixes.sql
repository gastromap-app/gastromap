-- ─────────────────────────────────────────────────────────────────────────────
-- 004_fixes.sql  —  Critical fixes for locations FTS + profiles RLS
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 1: Add `fts` generated column to locations
-- locations.api.js calls .textSearch('fts', ...) which expects a real column.
-- The original migration only created a GIN index on an expression, not a column.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.locations
    ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(title, '') || ' ' ||
            coalesce(description, '') || ' ' ||
            coalesce(city, '') || ' ' ||
            coalesce(cuisine, '') || ' ' ||
            coalesce(array_to_string(tags, ' '), '') || ' ' ||
            coalesce(ai_context, '')
        )
    ) STORED;

-- Drop old expression index, replace with index on the column
DROP INDEX IF EXISTS locations_fts_idx;
CREATE INDEX IF NOT EXISTS locations_fts_gin ON public.locations USING gin(fts);


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 2: Helper function for role check (avoids RLS recursion)
-- SECURITY DEFINER bypasses RLS when checking the caller's own role.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 3: Profiles RLS — drop broken recursive policies, replace with clean ones
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop old broken policies
DROP POLICY IF EXISTS "profiles: own read"        ON public.profiles;
DROP POLICY IF EXISTS "profiles: own update"      ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin read all"  ON public.profiles;

-- Users can read their own profile
CREATE POLICY "profiles: own read"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Admins can read all profiles (uses SECURITY DEFINER function — no recursion)
CREATE POLICY "profiles: admin read all"
    ON public.profiles FOR SELECT
    USING (public.get_my_role() = 'admin');

-- Users can update their own name/avatar (role field is protected — only service_role can change it)
CREATE POLICY "profiles: own update"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Service role can do everything (for server-side admin operations)
DROP POLICY IF EXISTS "profiles: service role all" ON public.profiles;
CREATE POLICY "profiles: service role all"
    ON public.profiles FOR ALL
    USING (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 4: Locations RLS — allow admins to CREATE / UPDATE / DELETE locations
-- The original migration only allowed service_role to write. Admin users
-- (authenticated with role='admin' in profiles) need write access too.
-- ═══════════════════════════════════════════════════════════════════════════

-- Admins can read all locations including hidden/coming_soon ones
DROP POLICY IF EXISTS "Admin read all locations" ON public.locations;
CREATE POLICY "Admin read all locations"
    ON public.locations FOR SELECT
    USING (public.get_my_role() = 'admin');

-- Admins can insert new locations
DROP POLICY IF EXISTS "Admin insert locations" ON public.locations;
CREATE POLICY "Admin insert locations"
    ON public.locations FOR INSERT
    WITH CHECK (public.get_my_role() = 'admin');

-- Admins can update locations
DROP POLICY IF EXISTS "Admin update locations" ON public.locations;
CREATE POLICY "Admin update locations"
    ON public.locations FOR UPDATE
    USING (public.get_my_role() = 'admin')
    WITH CHECK (public.get_my_role() = 'admin');

-- Admins can delete locations
DROP POLICY IF EXISTS "Admin delete locations" ON public.locations;
CREATE POLICY "Admin delete locations"
    ON public.locations FOR DELETE
    USING (public.get_my_role() = 'admin');


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 5: Ensure existing Supabase Auth users get a profile row
-- If you ran 003_profiles.sql but had existing users before the trigger,
-- this backfills them.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.profiles (id, email, name, role)
SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    'user'
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- SET YOUR ADMIN (run this after the migration):
--
--   UPDATE public.profiles SET role = 'admin' WHERE email = 'alik2191@gmail.com';
--
-- ═══════════════════════════════════════════════════════════════════════════
