-- Migration 005: User Visits, Reviews, and Profile Preferences
-- Tracks user visits to locations, reviews, and user preferences

-- Create user_visits table
CREATE TABLE IF NOT EXISTS user_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);

-- Enable RLS on user_visits
ALTER TABLE user_visits ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users CRUD own visits
CREATE POLICY "Users can view own visits"
  ON user_visits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add own visits"
  ON user_visits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own visits"
  ON user_visits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own visits"
  ON user_visits FOR DELETE
  USING (auth.uid() = user_id);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies: anyone can SELECT published, users can SELECT own, users INSERT/UPDATE own, admins manage all
CREATE POLICY "Anyone can view published reviews"
  ON reviews FOR SELECT
  USING (status = 'published');

CREATE POLICY "Users can view own reviews"
  ON reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all reviews"
  ON reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_location_id ON reviews(location_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

-- Add preferences column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Leaderboard function
CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  places_visited BIGINT,
  reviews_written BIGINT,
  places_saved BIGINT,
  total_points BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.full_name AS name,
    p.email,
    p.avatar_url,
    COALESCE(v.places_visited, 0) AS places_visited,
    COALESCE(r.reviews_written, 0) AS reviews_written,
    COALESCE(f.places_saved, 0) AS places_saved,
    (
      COALESCE(v.places_visited, 0) * 10 +
      COALESCE(r.reviews_written, 0) * 25 +
      COALESCE(f.places_saved, 0) * 5
    ) AS total_points
  FROM profiles p
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS places_visited
    FROM user_visits
    GROUP BY user_id
  ) v ON v.user_id = p.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS reviews_written
    FROM reviews
    WHERE status = 'published'
    GROUP BY user_id
  ) r ON r.user_id = p.id
  LEFT JOIN (
    SELECT user_id, COUNT(*) AS places_saved
    FROM user_favorites
    GROUP BY user_id
  ) f ON f.user_id = p.id
  ORDER BY total_points DESC;
END;
$$;
