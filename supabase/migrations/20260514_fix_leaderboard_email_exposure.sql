-- Fix: Remove email from leaderboard function return
-- Previously exposed all user emails to any authenticated caller

CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  avatar_url TEXT,
  places_visited BIGINT,
  reviews_written BIGINT,
  places_saved BIGINT,
  total_points BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    COALESCE(p.full_name, p.name) AS name,
    p.avatar_url,
    COALESCE(v.places_visited, 0) AS places_visited,
    COALESCE(r.reviews_written, 0) AS reviews_written,
    COALESCE(f.places_saved, 0) AS places_saved,
    (COALESCE(v.places_visited, 0) * 10 +
     COALESCE(r.reviews_written, 0) * 25 +
     COALESCE(f.places_saved, 0) * 5) AS total_points
  FROM profiles p
  LEFT JOIN (SELECT user_id, COUNT(*) AS places_visited FROM user_visits GROUP BY user_id) v ON v.user_id = p.id
  LEFT JOIN (SELECT user_id, COUNT(*) AS reviews_written FROM reviews WHERE status IN ('approved','published') GROUP BY user_id) r ON r.user_id = p.id
  LEFT JOIN (SELECT user_id, COUNT(*) AS places_saved FROM user_favorites GROUP BY user_id) f ON f.user_id = p.id
  ORDER BY total_points DESC
  LIMIT 100;
END;
$$;
