-- ═══════════════════════════════════════════════════════════════════
-- Add missing Google, Meta and AI columns to locations table
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Google Data
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS google_user_ratings_total integer DEFAULT 0;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS google_price_level integer;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS google_formatted_address text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS google_vicinity text;

-- 2. New Flags
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS is_hidden_gem boolean DEFAULT false;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- 3. Ambience & Logistics
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS best_time_to_visit text[] DEFAULT '{}';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS noise_level text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS pet_friendly boolean DEFAULT false;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS child_friendly boolean DEFAULT false;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS average_visit_duration integer;

-- 4. AI Status Flags
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS ai_enriched boolean DEFAULT false;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS ai_description_generated boolean DEFAULT false;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS ai_insider_tip_generated boolean DEFAULT false;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS ai_must_try_generated boolean DEFAULT false;

-- 5. Extra Metadata
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS city_slug text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS country_slug text;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_is_hidden_gem ON public.locations(is_hidden_gem) WHERE is_hidden_gem = true;
CREATE INDEX IF NOT EXISTS idx_locations_is_featured ON public.locations(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_locations_city_slug ON public.locations(city_slug);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload';

COMMIT;
