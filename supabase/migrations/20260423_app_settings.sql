-- App Settings — persistent key/value store for admin-controlled config
-- Replaces localStorage-based useAppConfigStore for settings that must
-- survive redeployments and work across all devices/browsers.

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only admins can read/write
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_all" ON app_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Seed default AI config
INSERT INTO app_settings (key, value) VALUES
  ('ai_config', '{
    "aiPrimaryModel":   "openai/gpt-oss-120b:free",
    "aiFallbackModel":  "nvidia/nemotron-3-super-120b-a12b:free",
    "aiApiKey":         "",
    "aiGuideActive":    true,
    "aiAssistantActive": true,
    "aiGuideTemp":      0.7,
    "aiAssistantTemp":  0.4,
    "aiModelCascade":   [],
    "aiGuideMaxTokens": 1024,
    "aiAssistantMaxTokens": 1024,
    "aiGuideTone":      "friendly",
    "aiGuideSystemPrompt":     "",
    "aiAssistantSystemPrompt": "",
    "aiKGAgentSystemPrompt":   "",
    "braveSearchApiKey": ""
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;
