-- ============================================================
-- 20260511_anon_column_grant.sql
-- Column-level GRANT on locations for anon users
-- ============================================================
-- Problem: GRANT SELECT ON locations TO anon gave anon users
-- access to ALL columns (insider_tip, booking_url, phone, etc.)
-- Even if the frontend hides them, DevTools/Network reveals them.
--
-- Solution: Revoke broad anon SELECT, grant only public columns.
-- PostgreSQL column-level GRANT enforces this at the DB level:
-- - select('*') from anon → only public columns returned
-- - select('insider_tip') from anon → 403 Forbidden
-- - authenticated users keep full access via their own GRANT
-- ============================================================

-- 1. Revoke broad SELECT from anon on locations
REVOKE SELECT ON public.locations FROM anon;

-- 2. Grant column-specific SELECT to anon — public preview only
-- Public: enough to identify the place and get interested
-- Protected: contact info, expert tips, AI data, analytics
GRANT SELECT (
    id,
    title,
    description,
    address,
    city,
    country,
    lat,
    lng,
    category,
    image_url,
    google_photos,
    google_rating,
    price_range,
    opening_hours,
    cuisine_types,
    status,
    created_at,
    updated_at
) ON public.locations TO anon;

-- 3. Ensure authenticated role still has full SELECT
-- (This was already granted in 003_profiles.sql but let's be explicit)
GRANT SELECT ON public.locations TO authenticated;

-- 4. Reviews: anon can only see published reviews (RLS already handles this)
-- but let's also restrict columns for anon on reviews
REVOKE SELECT ON public.reviews FROM anon;

GRANT SELECT (
    id,
    location_id,
    rating,
    status,
    created_at
    -- review_text is PROTECTED — only for authenticated users
) ON public.reviews TO anon;

-- 5. Ensure anon can still read location_translations (anyone can view)
-- This was already granted, no change needed
