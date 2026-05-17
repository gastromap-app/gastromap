-- Migration: Add structured opening hours (JSONB by day of week)
-- Format: {"monday": "09:00-22:00", "tuesday": "09:00-22:00", ..., "sunday": "closed"}
-- This enables accurate "Hours Today" display on the frontend.

ALTER TABLE locations
ADD COLUMN IF NOT EXISTS opening_hours_structured JSONB DEFAULT NULL;

-- Add a comment explaining the format
COMMENT ON COLUMN locations.opening_hours_structured IS 'Structured hours by day: {"monday":"09:00-22:00","tuesday":"09:00-22:00",...}. Values: "HH:MM-HH:MM", "closed", or null (unknown).';

-- Index for querying locations that need hours migration
CREATE INDEX IF NOT EXISTS idx_locations_hours_structured_null
ON locations (id)
WHERE opening_hours IS NOT NULL AND opening_hours_structured IS NULL;
