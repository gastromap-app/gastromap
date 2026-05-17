-- Allow all authenticated users to READ app_settings.
-- Admin-only policy remains for INSERT/UPDATE/DELETE.
-- This ensures AI config (model, mode, cascade) reaches all logged-in users.

DROP POLICY IF EXISTS "anyone_can_read" ON app_settings;
CREATE POLICY "anyone_can_read" ON app_settings
  FOR SELECT
  TO authenticated
  USING (true);
