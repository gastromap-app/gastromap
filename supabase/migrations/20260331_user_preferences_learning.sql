-- ═══════════════════════════════════════════════════════
-- GASTROMAP V2 - USER PREFERENCES & LEARNING
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  favorite_cuisines TEXT[] DEFAULT '{}',
  disliked_cuisines TEXT[] DEFAULT '{}',
  vibe_preferences TEXT[] DEFAULT '{}',
  price_range TEXT,
  dietary_restrictions TEXT[] DEFAULT '{}',
  implicit_preferences JSONB DEFAULT '{}',
  context_preferences JSONB DEFAULT '{}',
  preference_confidence FLOAT DEFAULT 0.5,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  total_interactions INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INT DEFAULT 0,
  intent_summary TEXT,
  locations_mentioned UUID[],
  final_recommendation UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  tokens_used INT,
  model_used TEXT,
  feedback_score INT,
  feedback_text TEXT,
  extracted_preferences JSONB
);

CREATE TABLE IF NOT EXISTS contributors (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  full_name TEXT,
  submissions_count INT DEFAULT 0,
  approved_count INT DEFAULT 0,
  rejected_count INT DEFAULT 0,
  total_score FLOAT DEFAULT 0,
  rank INT,
  is_top_10 BOOLEAN DEFAULT FALSE,
  lifetime_subscription BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_submission_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  category TEXT NOT NULL,
  insider_tip TEXT NOT NULL,
  must_try TEXT[] NOT NULL,
  description TEXT,
  cuisine TEXT[],
  vibe TEXT[],
  price_level TEXT,
  features TEXT[],
  images TEXT[],
  website TEXT,
  phone TEXT,
  opening_hours TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  moderated_by UUID,
  moderated_at TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE TABLE IF NOT EXISTS ai_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL UNIQUE,
  model_provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  system_prompt TEXT,
  temperature FLOAT DEFAULT 0.7,
  max_tokens INT DEFAULT 1024,
  tone TEXT,
  data_sources TEXT[] DEFAULT '{}',
  learning_enabled BOOLEAN DEFAULT TRUE,
  personalization_depth TEXT DEFAULT 'medium',
  auto_approve BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_preferences IS 'User preference profile for GastroGuide AI';
COMMENT ON TABLE contributors IS 'Contributor leaderboard (Top-10 lifetime subscription)';
COMMENT ON TABLE ai_agent_configs IS 'Configuration for AI agents (Administrator, Guide, Verification, Moderation)';
