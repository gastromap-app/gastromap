-- ============================================================
-- GastroMap Analytics Functions — 2026-04-14
-- Run these in Supabase SQL Editor to enable Stats page
-- ============================================================

-- 1. Top locations by activity (reviews + visits)
CREATE OR REPLACE FUNCTION get_top_locations(p_limit integer DEFAULT 5)
RETURNS TABLE(
    id uuid,
    title text,
    city text,
    category text,
    rating numeric,
    review_count bigint,
    visit_count bigint,
    avg_review_rating numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT
        l.id,
        l.title,
        l.city,
        l.category,
        l.rating,
        COUNT(DISTINCT r.id)                   AS review_count,
        COUNT(DISTINCT v.id)                   AS visit_count,
        ROUND(AVG(r.rating)::numeric, 1)       AS avg_review_rating
    FROM locations l
    LEFT JOIN reviews r ON r.location_id = l.id
    LEFT JOIN user_visits v ON v.location_id = l.id
    WHERE l.status = 'active'
    GROUP BY l.id, l.title, l.city, l.category, l.rating
    ORDER BY (COUNT(DISTINCT r.id) + COUNT(DISTINCT v.id)) DESC, l.rating DESC
    LIMIT p_limit;
$$;

-- 2. Locations breakdown by category
CREATE OR REPLACE FUNCTION get_category_stats()
RETURNS TABLE(
    category text,
    total    bigint,
    active   bigint,
    avg_rating numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT
        category,
        COUNT(*)                                           AS total,
        COUNT(*) FILTER (WHERE status = 'active')          AS active,
        ROUND(AVG(rating)::numeric, 1)                     AS avg_rating
    FROM locations
    GROUP BY category
    ORDER BY total DESC;
$$;

-- 3. Locations breakdown by city
CREATE OR REPLACE FUNCTION get_city_stats()
RETURNS TABLE(
    city       text,
    country    text,
    total      bigint,
    avg_rating numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT
        city,
        country,
        COUNT(*)                               AS total,
        ROUND(AVG(rating)::numeric, 1)         AS avg_rating
    FROM locations
    WHERE status = 'active'
    GROUP BY city, country
    ORDER BY total DESC;
$$;

-- 4. Reviews stats over time (last 30 days daily breakdown)
CREATE OR REPLACE FUNCTION get_reviews_timeline(p_days integer DEFAULT 30)
RETURNS TABLE(
    day          date,
    review_count bigint,
    avg_rating   numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT
        DATE(created_at)                        AS day,
        COUNT(*)                                AS review_count,
        ROUND(AVG(rating)::numeric, 1)          AS avg_rating
    FROM reviews
    WHERE created_at >= NOW() - (p_days || ' days')::interval
    GROUP BY DATE(created_at)
    ORDER BY day ASC;
$$;

-- 5. User growth (last 30 days daily registrations)
CREATE OR REPLACE FUNCTION get_user_growth(p_days integer DEFAULT 30)
RETURNS TABLE(
    day        date,
    new_users  bigint,
    total_cumulative bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    WITH daily AS (
        SELECT DATE(created_at) AS day, COUNT(*) AS new_users
        FROM profiles
        WHERE created_at >= NOW() - (p_days || ' days')::interval
        GROUP BY DATE(created_at)
    )
    SELECT
        day,
        new_users,
        SUM(new_users) OVER (ORDER BY day ROWS UNBOUNDED PRECEDING) AS total_cumulative
    FROM daily
    ORDER BY day ASC;
$$;

-- 6. Extended engagement stats (replaces basic get_engagement_stats if needed)
CREATE OR REPLACE FUNCTION get_detailed_engagement()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT jsonb_build_object(
        'total_reviews',    (SELECT COUNT(*) FROM reviews),
        'approved_reviews', (SELECT COUNT(*) FROM reviews WHERE status = 'approved'),
        'pending_reviews',  (SELECT COUNT(*) FROM reviews WHERE status = 'pending'),
        'total_visits',     (SELECT COUNT(*) FROM user_visits),
        'unique_visitors',  (SELECT COUNT(DISTINCT user_id) FROM user_visits),
        'avg_rating',       (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE status = 'approved'),
        'total_locations',  (SELECT COUNT(*) FROM locations),
        'active_locations', (SELECT COUNT(*) FROM locations WHERE status = 'active'),
        'pending_locations',(SELECT COUNT(*) FROM locations WHERE status = 'pending'),
        'total_users',      (SELECT COUNT(*) FROM profiles),
        'admin_users',      (SELECT COUNT(*) FROM profiles WHERE role = 'admin'),
        'moderator_users',  (SELECT COUNT(*) FROM profiles WHERE role = 'moderator'),
        'regular_users',    (SELECT COUNT(*) FROM profiles WHERE role = 'user')
    );
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION get_top_locations(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_category_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_city_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_reviews_timeline(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_growth(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_detailed_engagement() TO anon, authenticated;
