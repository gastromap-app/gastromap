-- ============================================================
-- Enable Supabase Realtime for core app tables
-- ============================================================
-- Allows the frontend to subscribe to INSERT/UPDATE/DELETE events
-- and invalidate caches in real-time instead of polling.
-- Uses DO blocks to make the migration idempotent — safe to
-- re-run if a table is already in the publication.

-- Locations: admin adds/edits/removes → Zustand store auto-updates
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE locations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User favorites: changes from any device → React Query cache invalidated
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_favorites;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User visits: new visit recorded → React Query cache invalidated
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_visits;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────
-- REPLICA IDENTITY FULL ensures Realtime payloads contain the
-- complete row (not just changed columns). Without this,
-- payload.new on UPDATE would only include modified fields,
-- making it impossible to reliably update the Zustand store.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE locations REPLICA IDENTITY FULL;
