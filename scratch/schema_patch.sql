-- ═══════════════════════════════════════════════════════════════════════════
-- GASTROMAP - COMPREHENSIVE SCHEMA PATCH
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add onboarding_completed to profiles
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='onboarding_completed') THEN
        ALTER TABLE public.profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Add missing columns to user_preferences
DO $$ 
BEGIN 
    -- onboarding_completed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='onboarding_completed') THEN
        ALTER TABLE public.user_preferences ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- favorite_cuisines
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='favorite_cuisines') THEN
        ALTER TABLE public.user_preferences ADD COLUMN favorite_cuisines TEXT[] DEFAULT '{}';
    END IF;
    
    -- vibe_preferences
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='vibe_preferences') THEN
        ALTER TABLE public.user_preferences ADD COLUMN vibe_preferences TEXT[] DEFAULT '{}';
    END IF;
    
    -- dietary_restrictions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='dietary_restrictions') THEN
        ALTER TABLE public.user_preferences ADD COLUMN dietary_restrictions TEXT[] DEFAULT '{}';
    END IF;
    
    -- price_range
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='price_range') THEN
        ALTER TABLE public.user_preferences ADD COLUMN price_range TEXT;
    END IF;

    -- last_updated
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='last_updated') THEN
        ALTER TABLE public.user_preferences ADD COLUMN last_updated TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 4. Enable vector and add embedding to cuisines
CREATE EXTENSION IF NOT EXISTS vector;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cuisines' AND column_name='embedding') THEN
        ALTER TABLE public.cuisines ADD COLUMN embedding vector(768);
    END IF;
END $$;

-- 5. ROW LEVEL SECURITY (RLS) POLICIES

-- 5.1. app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read app_settings" ON public.app_settings;
CREATE POLICY "Allow public read app_settings" ON public.app_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon upsert ai_config" ON public.app_settings;
CREATE POLICY "Allow anon upsert ai_config" ON public.app_settings
    FOR ALL 
    USING (key = 'ai_config')
    WITH CHECK (key = 'ai_config');

-- 5.2. user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage their own preferences" ON public.user_preferences
    FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5.3. cuisines
ALTER TABLE public.cuisines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read cuisines" ON public.cuisines;
CREATE POLICY "Allow public read cuisines" ON public.cuisines FOR SELECT USING (true);

-- 6. SEARCH FUNCTION COMPATIBILITY
-- Ensure search_cuisines_by_embedding is using 768 dimensions
CREATE OR REPLACE FUNCTION search_cuisines_by_embedding(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM cuisines c
    WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;
