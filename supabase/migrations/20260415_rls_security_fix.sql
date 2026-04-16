-- ============================================
-- GastroMap Security Fix — April 2026 (FINAL)
-- Fixes: rls_disabled_in_public + sensitive_columns_exposed
-- Tables verified to exist in production
-- ============================================

-- 1. ENABLE RLS на всех таблицах
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_dietary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_configs ENABLE ROW LEVEL SECURITY;

-- 2. PAYMENTS — только владелец видит свои, admin управляет всеми
DROP POLICY IF EXISTS "Users see own payments" ON public.payments;
CREATE POLICY "Users see own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage all payments" ON public.payments;
CREATE POLICY "Admins manage all payments"
  ON public.payments FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- 3. SUBSCRIPTIONS — только владелец видит свои, admin управляет всеми
DROP POLICY IF EXISTS "Users see own subscriptions" ON public.subscriptions;
CREATE POLICY "Users see own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins manage all subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- 4. LOCATION_DIETARY — публичное чтение, admin/moderator управляет
DROP POLICY IF EXISTS "Public read location_dietary" ON public.location_dietary;
CREATE POLICY "Public read location_dietary"
  ON public.location_dietary FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage location_dietary" ON public.location_dietary;
CREATE POLICY "Admin manage location_dietary"
  ON public.location_dietary FOR ALL
  USING (public.get_my_role() IN ('admin', 'moderator'))
  WITH CHECK (public.get_my_role() IN ('admin', 'moderator'));

-- 5. LOCATION_DISHES — публичное чтение, admin/moderator управляет
DROP POLICY IF EXISTS "Public read location_dishes" ON public.location_dishes;
CREATE POLICY "Public read location_dishes"
  ON public.location_dishes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage location_dishes" ON public.location_dishes;
CREATE POLICY "Admin manage location_dishes"
  ON public.location_dishes FOR ALL
  USING (public.get_my_role() IN ('admin', 'moderator'))
  WITH CHECK (public.get_my_role() IN ('admin', 'moderator'));

-- 6. CONTRIBUTORS — публичное чтение (leaderboard), владелец и admin управляют
DROP POLICY IF EXISTS "Public read contributors" ON public.contributors;
CREATE POLICY "Public read contributors"
  ON public.contributors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own contributor profile" ON public.contributors;
CREATE POLICY "Users manage own contributor profile"
  ON public.contributors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin manage contributors" ON public.contributors;
CREATE POLICY "Admin manage contributors"
  ON public.contributors FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- 7. USER_PREFERENCES — только сам пользователь (private data)
DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;
CREATE POLICY "Users manage own preferences"
  ON public.user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin read all preferences" ON public.user_preferences;
CREATE POLICY "Admin read all preferences"
  ON public.user_preferences FOR SELECT
  USING (public.get_my_role() = 'admin');

-- 8. AI_AGENT_CONFIGS — только admin
DROP POLICY IF EXISTS "Admin only ai_agent_configs" ON public.ai_agent_configs;
CREATE POLICY "Admin only ai_agent_configs"
  ON public.ai_agent_configs FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');
