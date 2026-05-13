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
