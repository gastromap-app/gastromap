-- ═══════════════════════════════════════════════════════════════
-- Create 'locations' storage bucket for location photos
-- This bucket was referenced in code but never created in migrations
-- ═══════════════════════════════════════════════════════════════

-- 1. Create the bucket (public = true so images are accessible via URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('locations', 'locations', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Anyone can view location images (they're public)
DROP POLICY IF EXISTS "Public read location images" ON storage.objects;
CREATE POLICY "Public read location images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'locations');

-- 3. Authenticated admins can upload images
DROP POLICY IF EXISTS "Admins upload location images" ON storage.objects;
CREATE POLICY "Admins upload location images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'locations' AND public.get_my_role() = 'admin');

-- 4. Authenticated admins can update/replace images
DROP POLICY IF EXISTS "Admins update location images" ON storage.objects;
CREATE POLICY "Admins update location images"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'locations' AND public.get_my_role() = 'admin');

-- 5. Authenticated admins can delete images
DROP POLICY IF EXISTS "Admins delete location images" ON storage.objects;
CREATE POLICY "Admins delete location images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'locations' AND public.get_my_role() = 'admin');

-- ═══════════════════════════════════════════════════════════════
-- Create 'submissions' storage bucket for user-submitted photos
-- Used by the Add Place form (public users)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view submission images
DROP POLICY IF EXISTS "Public read submission images" ON storage.objects;
CREATE POLICY "Public read submission images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'submissions');

-- Authenticated users can upload their own photos
DROP POLICY IF EXISTS "Users upload submission images" ON storage.objects;
CREATE POLICY "Users upload submission images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'submissions');

-- Admins can delete submission images
DROP POLICY IF EXISTS "Admins delete submission images" ON storage.objects;
CREATE POLICY "Admins delete submission images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'submissions' AND public.get_my_role() = 'admin');
