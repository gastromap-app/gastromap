-- Seed default app_status row in app_settings.
-- Ensures the row exists for the first read without overwriting existing data.
-- Idempotent: safe to re-run.

INSERT INTO app_settings (key, value) VALUES
  ('app_status', '{
    "status": "active",
    "maintenanceMessage": "We are performing maintenance to improve your experience. The app will be back shortly!",
    "downMessage": "The app is temporarily unavailable. We will be back soon!",
    "updatedAt": null
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;
