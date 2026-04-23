-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY HARDENING — Final Robust Fix (V4)
-- Date: 2026-04-23
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Исправляем search_path для всех функций (защита от Hijacking)
-- Мы используем точные сигнатуры, найденные в базе данных.

-- Аналитика и Статистика
ALTER FUNCTION public.get_location_stats() SET search_path = public;
ALTER FUNCTION public.get_user_stats() SET search_path = public;
ALTER FUNCTION public.get_engagement_stats() SET search_path = public;
ALTER FUNCTION public.get_payment_stats() SET search_path = public;
ALTER FUNCTION public.get_category_stats() SET search_path = public;
ALTER FUNCTION public.get_city_stats() SET search_path = public;
ALTER FUNCTION public.get_detailed_engagement() SET search_path = public;
ALTER FUNCTION public.get_reviews_timeline(integer) SET search_path = public;
ALTER FUNCTION public.get_user_growth(integer) SET search_path = public;
ALTER FUNCTION public.get_top_locations(integer) SET search_path = public;

-- Поиск и Векторы
ALTER FUNCTION public.search_locations_hybrid(vector, text, text, text, integer, integer) SET search_path = public;
ALTER FUNCTION public.search_locations_fulltext(text, text, text, integer) SET search_path = public;
ALTER FUNCTION public.search_locations_by_embedding(vector, double precision, integer) SET search_path = public;
ALTER FUNCTION public.match_locations_semantic(vector, double precision, integer) SET search_path = public;
ALTER FUNCTION public.search_cuisines_by_embedding(vector, double precision, integer) SET search_path = public;

-- Системные и Вспомогательные
ALTER FUNCTION public.is_admin(uuid) SET search_path = public;
ALTER FUNCTION public.get_my_role() SET search_path = public;
ALTER FUNCTION public.immutable_array_to_string(text[], text) SET search_path = public;

-- Триггеры
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.handle_translation_updated_at() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 2. Удаление опасных избыточных политик (защита от несанкционированного изменения данных)
DROP POLICY IF EXISTS "Public Access Cuisines" ON public.cuisines;
DROP POLICY IF EXISTS "Public Access Dishes" ON public.dishes;
DROP POLICY IF EXISTS "Public Access Ingredients" ON public.ingredients;

-- 3. Безопасность Storage (убираем возможность листинга)
-- Для публичных бакетов SELECT на storage.objects позволяет листинг всех файлов.
-- Для скачивания по публичной ссылке политика SELECT не требуется.

DROP POLICY IF EXISTS "geo_covers_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for submission photos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- ═══════════════════════════════════════════════════════════════════════════
