-- ═══════════════════════════════════════════════════════════════════════════
-- User Location History & Tracking
-- Enables "Welcome back to {City}" and AI location-aware personalization.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Table for storing visit history per city
CREATE TABLE IF NOT EXISTS public.user_location_history (
    id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    city              text         NOT NULL,
    country           text,
    visit_count       integer      NOT NULL DEFAULT 1,
    first_visited_at  timestamptz  NOT NULL DEFAULT now(),
    last_visited_at   timestamptz  NOT NULL DEFAULT now(),
    
    -- Ensure one record per user per city
    UNIQUE(user_id, city)
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS user_location_history_user_idx ON public.user_location_history(user_id);
CREATE INDEX IF NOT EXISTS user_location_history_last_visited_idx ON public.user_location_history(last_visited_at DESC);

-- 3. RLS (Enable Security)
ALTER TABLE public.user_location_history ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Users can see their own history
DROP POLICY IF EXISTS "Users can view own location history" ON public.user_location_history;
CREATE POLICY "Users can view own location history" 
    ON public.user_location_history FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

-- Admins can see everything (using the profiles role check)
DROP POLICY IF EXISTS "Admins can view all location history" ON public.user_location_history;
CREATE POLICY "Admins can view all location history" 
    ON public.user_location_history FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 5. Atomic Tracking Function (RPC)
-- Handles upsert logic: if city exists for user, increment visit_count and update last_visited_at.
-- Returns the updated row data.
CREATE OR REPLACE FUNCTION public.track_user_location(
    p_user_id uuid,
    p_city    text,
    p_country text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with high privileges to handle upserts
AS $$
DECLARE
    v_result record;
    v_is_new boolean;
BEGIN
    -- Check if it's a new city for this user
    v_is_new := NOT EXISTS (
        SELECT 1 FROM public.user_location_history 
        WHERE user_id = p_user_id AND city = p_city
    );

    INSERT INTO public.user_location_history (user_id, city, country, visit_count, last_visited_at)
    VALUES (p_user_id, p_city, p_country, 1, now())
    ON CONFLICT (user_id, city) 
    DO UPDATE SET 
        visit_count = user_location_history.visit_count + 1,
        last_visited_at = now(),
        country = COALESCE(p_country, user_location_history.country)
    RETURNING visit_count, last_visited_at INTO v_result;

    RETURN jsonb_build_object(
        'is_new_city', v_is_new,
        'visit_count', v_result.visit_count,
        'last_visited_at', v_result.last_visited_at
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.track_user_location(uuid, text, text) TO authenticated;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload';
