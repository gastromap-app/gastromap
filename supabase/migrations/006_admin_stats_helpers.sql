-- Migration 006: Admin Statistics Helper Functions
-- Provides dashboard analytics and reporting data for admin panel

-- 1. Location stats: total, published, pending, rejected counts
CREATE OR REPLACE FUNCTION get_location_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM locations),
    'published', (SELECT COUNT(*) FROM locations WHERE status = 'active'),   -- schema uses 'active', not 'published'
    'pending',   (SELECT COUNT(*) FROM locations WHERE status = 'pending'),
    'rejected',  (SELECT COUNT(*) FROM locations WHERE status = 'rejected')
  ) INTO result;
  RETURN result;
END;
$$;

-- 2. User stats: total, this_month, this_week counts
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM profiles),
    'this_month', (SELECT COUNT(*) FROM profiles WHERE created_at >= date_trunc('month', NOW())),
    'this_week', (SELECT COUNT(*) FROM profiles WHERE created_at >= date_trunc('week', NOW()))
  ) INTO result;
  RETURN result;
END;
$$;

-- 3. Top locations by combined engagement
CREATE OR REPLACE FUNCTION get_top_locations(limit_count INT DEFAULT 10)
RETURNS TABLE (
  location_id UUID,
  title TEXT,
  category TEXT,
  visit_count BIGINT,
  review_count BIGINT,
  save_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id AS location_id,
    l.title,
    l.category,
    COALESCE(visits.visit_count, 0) AS visit_count,
    COALESCE(reviews.review_count, 0) AS review_count,
    COALESCE(favorites.save_count, 0) AS save_count
  FROM locations l
  LEFT JOIN (
    SELECT location_id, COUNT(*) AS visit_count
    FROM user_visits
    GROUP BY location_id
  ) visits ON visits.location_id = l.id
  LEFT JOIN (
    SELECT location_id, COUNT(*) AS review_count
    FROM reviews
    WHERE status = 'published'
    GROUP BY location_id
  ) reviews ON reviews.location_id = l.id
  LEFT JOIN (
    SELECT location_id, COUNT(*) AS save_count
    FROM user_favorites
    GROUP BY location_id
  ) favorites ON favorites.location_id = l.id
  ORDER BY (visits.visit_count + reviews.review_count + favorites.save_count) DESC
  LIMIT limit_count;
END;
$$;

-- 4. Engagement stats: visits, reviews, favorites, pending reviews
CREATE OR REPLACE FUNCTION get_engagement_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_visits', (SELECT COUNT(*) FROM user_visits),
    'total_reviews', (SELECT COUNT(*) FROM reviews),
    'total_favorites', (SELECT COUNT(*) FROM user_favorites),
    'pending_reviews', (SELECT COUNT(*) FROM reviews WHERE status = 'pending')
  ) INTO result;
  RETURN result;
END;
$$;

-- 5. Payment stats: total payments, revenue, active subscriptions, monthly revenue
CREATE OR REPLACE FUNCTION get_payment_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_payments', (SELECT COUNT(*) FROM payments),
    'total_revenue', COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'completed'), 0),
    'active_subscriptions', (SELECT COUNT(*) FROM subscriptions WHERE status = 'active'),
    'this_month_revenue', COALESCE((
      SELECT SUM(amount)
      FROM payments
      WHERE status = 'completed'
        AND created_at >= date_trunc('month', NOW())
    ), 0)
  ) INTO result;
  RETURN result;
END;
$$;
