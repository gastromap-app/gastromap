-- Add visibility management columns to geo_covers
-- is_visible: when false, country/city is hidden from the public app entirely
-- is_coming_soon: when true, card is shown but not clickable (badge "Coming Soon")

ALTER TABLE public.geo_covers
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_coming_soon BOOLEAN DEFAULT false;
