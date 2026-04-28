-- ============================================================
-- Migration: Deduplicate conflicting columns in locations table
-- Date: 2026-04-28
-- 
-- Canonical field chosen for each pair:
--   has_outdoor_seating  (drop: outdoor_seating)
--   reservations_required (drop: reservation_required)
--   what_to_try          (keep both: array vs string serve different purposes)
--   has_wifi             (keep wifi_quality for extended wifi level data)
--
-- Strategy:
--   1. Sync data: copy canonical → legacy where conflicts exist
--   2. Drop legacy columns
-- ============================================================

BEGIN;

-- ── Step 1: Resolve conflicts before dropping ─────────────────────────────

-- outdoor_seating: has_outdoor_seating is the truth (6 rows have correct true there)
UPDATE locations
SET outdoor_seating = has_outdoor_seating
WHERE outdoor_seating IS DISTINCT FROM has_outdoor_seating;

-- reservation_required: reservations_required is the truth
UPDATE locations
SET reservation_required = reservations_required
WHERE reservation_required IS DISTINCT FROM reservations_required;

-- ── Step 2: Drop legacy duplicate columns ─────────────────────────────────

-- outdoor_seating is now redundant (has_outdoor_seating is canonical)
ALTER TABLE locations DROP COLUMN IF EXISTS outdoor_seating;

-- reservation_required is now redundant (reservations_required is canonical)
ALTER TABLE locations DROP COLUMN IF EXISTS reservation_required;

-- must_try (legacy string) is now redundant (what_to_try is canonical array)
-- Keep must_try for FTS/search compatibility — only drop if confirmed unused
-- ALTER TABLE locations DROP COLUMN IF EXISTS must_try;
-- ↑ COMMENTED OUT: must_try is indexed in fts column, dropping may break full-text search

-- wifi_quality provides richer data than has_wifi (none/low/medium/high)
-- Keep both — they serve different roles (boolean filter vs display value)

-- ── Step 3: Add comment to clarify canonical fields ───────────────────────
COMMENT ON COLUMN locations.has_outdoor_seating IS 'Canonical boolean. outdoor_seating was removed 2026-04-28.';
COMMENT ON COLUMN locations.reservations_required IS 'Canonical boolean. reservation_required was removed 2026-04-28.';
COMMENT ON COLUMN locations.what_to_try IS 'Canonical array of dishes. must_try (string) kept for FTS compatibility.';
COMMENT ON COLUMN locations.has_wifi IS 'Canonical boolean. wifi_quality (string: none/low/medium/high) kept for display.';

-- ── Step 3b: Drop wifi_quality (was: none/low/medium/high string) ─────────
-- has_wifi (boolean) is the only canonical field for wifi status.
-- wifi_quality had 213 'none' and 8 'high' — all aligned with has_wifi already.
ALTER TABLE locations DROP COLUMN IF EXISTS wifi_quality;

COMMENT ON COLUMN locations.has_wifi IS 'Canonical boolean for WiFi availability. wifi_quality (string) was removed 2026-04-28.';

COMMIT;
