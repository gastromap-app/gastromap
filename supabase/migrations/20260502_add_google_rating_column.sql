-- ═══════════════════════════════════════════════════════════════════
-- Add missing google_rating column to locations table
-- ═══════════════════════════════════════════════════════════════════
-- This column was referenced in code but never added to the schema

ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS google_rating numeric(3,1);

-- Copy data from legacy rating column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'locations' AND column_name = 'rating') THEN
        UPDATE public.locations 
        SET google_rating = rating 
        WHERE google_rating IS NULL AND rating IS NOT NULL;
    END IF;
END $$;

-- Set sensible default
ALTER TABLE public.locations ALTER COLUMN google_rating SET DEFAULT 0;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload';
