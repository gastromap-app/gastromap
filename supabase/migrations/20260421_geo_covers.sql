-- ═══════════════════════════════════════════════════════════════
-- Geo Covers table + Storage bucket for country/city cover images
-- ═══════════════════════════════════════════════════════════════

-- Table for storing geo cover image references
CREATE TABLE IF NOT EXISTS public.geo_covers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        text NOT NULL,
    geo_type    text NOT NULL CHECK (geo_type IN ('country', 'city')),
    name        text,
    image_url   text,
    created_at  timestamptz DEFAULT now(),
    UNIQUE(slug, geo_type)
);

-- Enable RLS
ALTER TABLE public.geo_covers ENABLE ROW LEVEL SECURITY;

-- Anyone can read geo covers (public images)
CREATE POLICY "Public read geo_covers"
    ON public.geo_covers FOR SELECT
    USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins manage geo_covers"
    ON public.geo_covers FOR ALL
    TO authenticated
    USING (public.get_my_role() = 'admin')
    WITH CHECK (public.get_my_role() = 'admin');

-- Create the storage bucket for geo cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('geo-covers', 'geo-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone can read
CREATE POLICY "Public read geo cover images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'geo-covers');

-- Storage policies: admins can upload/update/delete
CREATE POLICY "Admins upload geo covers"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'geo-covers' AND public.get_my_role() = 'admin');

CREATE POLICY "Admins update geo covers"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'geo-covers' AND public.get_my_role() = 'admin');

CREATE POLICY "Admins delete geo covers"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'geo-covers' AND public.get_my_role() = 'admin');
