-- Add last_enriched_at column to track when a location was last enriched/verified via Google Places
ALTER TABLE locations ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz;

-- Add to valid columns in schema-validator (done in code, not SQL)
COMMENT ON COLUMN locations.last_enriched_at IS 'Timestamp of last Google Places enrichment or freshness check';
