-- ============================================================
-- GastroMap Analytics Columns & RPC Functions — 2026-05-05
-- Adds missing analytics columns to locations table and creates increment_location_view RPC function
-- ============================================================

-- 1. Add missing analytics columns to locations table
ALTER TABLE public.locations 
    ADD COLUMN IF NOT EXISTS views_count     integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS saves_count     integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS visits_count    integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS comments_count  integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trending_score  float4  DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trending_at     timestamptz,
    ADD COLUMN IF NOT EXISTS city_slug       text,
    ADD COLUMN IF NOT EXISTS country_slug    text;

-- 2. Create increment_location_view RPC function
-- This function increments the views_count for a given location_id
CREATE OR REPLACE FUNCTION increment_location_view(location_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE locations 
    SET views_count = views_count + 1 
    WHERE id = location_id;
END;
$$;

-- 3. Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION increment_location_view(uuid) TO anon, authenticated;

-- 4. Create index for trending_score (for performance)
CREATE INDEX IF NOT EXISTS idx_locations_trending
    ON locations(trending_score DESC) WHERE status = 'approved';

-- 5. Create trigger for saves_count (to keep it in sync with user_favorites)
CREATE OR REPLACE FUNCTION _update_saves_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE locations SET saves_count = saves_count + 1 WHERE id = NEW.location_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE locations SET saves_count = GREATEST(0, saves_count - 1) WHERE id = OLD.location_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_saves ON user_favorites;
CREATE TRIGGER trg_saves AFTER INSERT OR DELETE ON user_favorites
    FOR EACH ROW EXECUTE FUNCTION _update_saves_count();

-- 6. Create trigger for visits_count (to keep it in sync with user_visits)
CREATE OR REPLACE FUNCTION _update_visits_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE locations SET visits_count = visits_count + 1 WHERE id = NEW.location_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_visits ON user_visits;
CREATE TRIGGER trg_visits AFTER INSERT ON user_visits
    FOR EACH ROW EXECUTE FUNCTION _update_visits_count();