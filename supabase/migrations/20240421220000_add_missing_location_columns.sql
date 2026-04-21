
-- Migration: Add missing AI enrichment, Knowledge Graph, and social columns to locations table
-- Reason: Fixes "schema cache" error when saving locations in Admin UI

-- 1. AI Enrichment columns
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS ai_enrichment_status text DEFAULT 'pending';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS ai_enrichment_error text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS ai_enrichment_last_attempt timestamptz;

-- 2. Knowledge Graph columns
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS kg_cuisines text[] DEFAULT '{}';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS kg_dishes text[] DEFAULT '{}';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS kg_ingredients text[] DEFAULT '{}';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS kg_allergens text[] DEFAULT '{}';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS kg_enriched_at timestamptz;

-- 3. Social and contact columns
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS social_instagram text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS social_facebook text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS google_maps_url text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS booking_url text;

-- 4. Ensure amenities/features mapping is consistent
-- (The DB uses 'features', the code sometimes looks for 'amenities')
-- We already have 'features' in 001_locations.sql, adding 'amenities' as an alias if needed
-- but better to stick to 'features' as canonical.
