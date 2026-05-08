-- ============================================================
-- Dine With Me — Phase 1: Presence + Nearby Diners
-- ============================================================
-- Tables: dining_presence, diner_reports, dine_waves
-- Safety-first: venue-level location only, auto-expiring, reportable

-- ──────────────────────────────────────────────────────────────
-- 1. Dining presence (ephemeral, auto-expiring)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE dining_presence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
    lat             NUMERIC(10,7),   -- copied from locations.lat for query perf
    lng             NUMERIC(10,7),   -- copied from locations.lng for query perf
    status          TEXT DEFAULT 'looking' CHECK (status IN (
        'looking', 'eating', 'heading_to'
    )),
    message         TEXT CHECK (char_length(message) <= 200),
    contact_info    TEXT CHECK (char_length(contact_info) <= 200),
    cuisine_prefs   TEXT[] DEFAULT '{}',
    visibility      TEXT DEFAULT 'everyone' CHECK (visibility IN (
        'everyone', 'friends_only'
    )),
    party_size      INTEGER DEFAULT 1 CHECK (party_size BETWEEN 1 AND 10),
    arriving_at     TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(user_id)  -- one presence per user (upsert pattern)
);

-- Indexes
CREATE INDEX idx_dining_presence_expires ON dining_presence(expires_at);
CREATE INDEX idx_dining_presence_location ON dining_presence(location_id);
CREATE INDEX idx_dining_presence_lat_lng ON dining_presence(lat, lng);

-- RLS
ALTER TABLE dining_presence ENABLE ROW LEVEL SECURITY;

-- Anyone can read visible, non-expired presences
CREATE POLICY "dining_presence: read visible"
    ON dining_presence FOR SELECT
    USING (
        (visibility = 'everyone' AND expires_at > now())
        OR auth.uid() = user_id
    );

-- Users can insert/update/delete own presence
CREATE POLICY "dining_presence: upsert own"
    ON dining_presence FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 2. Dine waves (one-way interest signal)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE dine_waves (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    to_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    venue_name  TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index: quickly find waves sent to a user
CREATE INDEX idx_dine_waves_to ON dine_waves(to_id, created_at DESC);
-- Index: rate-limit check — waves sent by a user in the last hour
CREATE INDEX idx_dine_waves_from_recent ON dine_waves(from_id, created_at DESC);

ALTER TABLE dine_waves ENABLE ROW LEVEL SECURITY;

-- Users can read waves addressed to them
CREATE POLICY "dine_waves: read own"
    ON dine_waves FOR SELECT
    USING (auth.uid() = to_id);

-- Users can insert waves (from themselves only)
CREATE POLICY "dine_waves: insert own"
    ON dine_waves FOR INSERT
    WITH CHECK (auth.uid() = from_id);

-- ──────────────────────────────────────────────────────────────
-- 3. Diner reports (safety feature)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE diner_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reported_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason          TEXT NOT NULL CHECK (reason IN ('harassment', 'spam', 'inappropriate', 'other')),
    details         TEXT CHECK (char_length(details) <= 500),
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(reporter_id, reported_id)
);

ALTER TABLE diner_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diner_reports: insert own"
    ON diner_reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "diner_reports: admin read"
    ON diner_reports FOR SELECT
    USING (public.get_my_role() = 'admin');

-- ──────────────────────────────────────────────────────────────
-- 4. Auto-cleanup function (called by pg_cron or manually)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION clean_expired_presence()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM dining_presence WHERE expires_at < now();
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 5. Enable Realtime for dining_presence
-- ──────────────────────────────────────────────────────────────
-- Note: Realtime must also be enabled in the Supabase Dashboard
-- under Database > Replication. This ALTER is a hint but may not
-- be sufficient on its own for hosted Supabase.
ALTER PUBLICATION supabase_realtime ADD TABLE dining_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE dine_waves;
