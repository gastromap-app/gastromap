-- Add kg_profile column for KG enrichment edge function
ALTER TABLE locations ADD COLUMN IF NOT EXISTS kg_profile JSONB;

-- Add index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_locations_kg_profile ON locations USING GIN (kg_profile);
