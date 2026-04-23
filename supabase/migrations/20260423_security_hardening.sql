-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY HARDENING — Исправление замечаний Supabase Linter (V3 - Final Signatures)
-- Date: 2026-04-23
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Создаем схему для расширений и переносим vector
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

-- 2. Исправляем search_path для всех SECURITY DEFINER функций (защита от Hijacking)

-- Аналитика и Статистика
ALTER FUNCTION get_location_stats() SET search_path = public;
ALTER FUNCTION get_user_stats() SET search_path = public;
ALTER FUNCTION get_engagement_stats() SET search_path = public;
ALTER FUNCTION get_payment_stats() SET search_path = public;
ALTER FUNCTION get_leaderboard() SET search_path = public;
ALTER FUNCTION get_top_locations(integer) SET search_path = public;

-- Системные и RPC
ALTER FUNCTION get_table_columns(text) SET search_path = public;
ALTER FUNCTION exec_sql(text) SET search_path = public;
ALTER FUNCTION get_my_role() SET search_path = public;

-- Триггеры и Автоматизация
ALTER FUNCTION handle_new_user() SET search_path = public;
ALTER FUNCTION handle_new_user_profile() SET search_path = public;
ALTER FUNCTION set_profile_updated_at() SET search_path = public;
ALTER FUNCTION set_updated_at() SET search_path = public;
ALTER FUNCTION handle_updated_at() SET search_path = public;
ALTER FUNCTION handle_translation_updated_at() SET search_path = public;
ALTER FUNCTION auto_translate_location() SET search_path = public;
ALTER FUNCTION locations_fts_update() SET search_path = public;

-- Поиск и Переводы
ALTER FUNCTION search_locations_fulltext(text, text, text, integer) SET search_path = public;
ALTER FUNCTION search_locations_hybrid(extensions.vector, text, text, text, integer, integer) SET search_path = public;
ALTER FUNCTION get_location_translated(uuid, character varying) SET search_path = public;

-- 3. Безопасность Storage (убираем возможность листинга в публичном бакете)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public read geo cover images" ON storage.objects;
    
    CREATE POLICY "Public read geo cover images" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'geo-covers');
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
