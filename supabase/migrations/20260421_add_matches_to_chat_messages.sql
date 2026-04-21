ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS matches JSONB DEFAULT '[]'::jsonb;
