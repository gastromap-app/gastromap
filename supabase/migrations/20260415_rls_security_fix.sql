-- ============================================
-- GastroMap Security Fix — April 2026
-- Fixes: rls_disabled_in_public + sensitive_columns_exposed
-- ============================================

-- 1. ENABLE RLS на всех таблицах без неё
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.location_dietary ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.location_dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_agents_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kg_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.knowledge_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kg_ontology ENABLE ROW LEVEL SECURITY;

-- 2. PAYMENTS — только владелец видит свои платежи, admin видит все
DROP POLICY IF EXISTS "Users see own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins manage all payments" ON public.payments;

CREATE POLICY "Users see own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all payments"
  ON public.payments FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- 3. SUBSCRIPTIONS — только владелец, admin видит все
DROP POLICY IF EXISTS "Users see own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins manage all subscriptions" ON public.subscriptions;

CREATE POLICY "Users see own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- 4. LOCATION_DIETARY — публичное чтение, admin управляет
DROP POLICY IF EXISTS "Public read location_dietary" ON public.location_dietary;
DROP POLICY IF EXISTS "Admin manage location_dietary" ON public.location_dietary;

CREATE POLICY "Public read location_dietary"
  ON public.location_dietary FOR SELECT
  USING (true);

CREATE POLICY "Admin manage location_dietary"
  ON public.location_dietary FOR ALL
  USING (public.get_my_role() IN ('admin', 'moderator'))
  WITH CHECK (public.get_my_role() IN ('admin', 'moderator'));

-- 5. LOCATION_DISHES — публичное чтение, admin управляет
DROP POLICY IF EXISTS "Public read location_dishes" ON public.location_dishes;
DROP POLICY IF EXISTS "Admin manage location_dishes" ON public.location_dishes;

CREATE POLICY "Public read location_dishes"
  ON public.location_dishes FOR SELECT
  USING (true);

CREATE POLICY "Admin manage location_dishes"
  ON public.location_dishes FOR ALL
  USING (public.get_my_role() IN ('admin', 'moderator'))
  WITH CHECK (public.get_my_role() IN ('admin', 'moderator'));

-- 6. AI_AGENTS_CONFIG — только admin
DROP POLICY IF EXISTS "Admin only ai_agents_config" ON public.ai_agents_config;

CREATE POLICY "Admin only ai_agents_config"
  ON public.ai_agents_config FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- 7. USER_PREFERENCES — только владелец
DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;

CREATE POLICY "Users manage own preferences"
  ON public.user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. KG_CACHE, KNOWLEDGE_GRAPH, KG_ONTOLOGY — публичное чтение, admin пишет
DROP POLICY IF EXISTS "Public read kg_cache" ON public.kg_cache;
DROP POLICY IF EXISTS "Admin manage kg_cache" ON public.kg_cache;
DROP POLICY IF EXISTS "Public read knowledge_graph" ON public.knowledge_graph;
DROP POLICY IF EXISTS "Admin manage knowledge_graph" ON public.knowledge_graph;
DROP POLICY IF EXISTS "Public read kg_ontology" ON public.kg_ontology;
DROP POLICY IF EXISTS "Admin manage kg_ontology" ON public.kg_ontology;

CREATE POLICY "Public read kg_cache" ON public.kg_cache FOR SELECT USING (true);
CREATE POLICY "Admin manage kg_cache" ON public.kg_cache FOR ALL
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Public read knowledge_graph" ON public.knowledge_graph FOR SELECT USING (true);
CREATE POLICY "Admin manage knowledge_graph" ON public.knowledge_graph FOR ALL
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Public read kg_ontology" ON public.kg_ontology FOR SELECT USING (true);
CREATE POLICY "Admin manage kg_ontology" ON public.kg_ontology FOR ALL
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

-- 9. CONTRIBUTORS — публичное чтение, владелец управляет своим
DROP POLICY IF EXISTS "Public read contributors" ON public.contributors;
DROP POLICY IF EXISTS "Users manage own contributions" ON public.contributors;
DROP POLICY IF EXISTS "Admin manage contributors" ON public.contributors;

CREATE POLICY "Public read contributors" ON public.contributors FOR SELECT USING (true);
CREATE POLICY "Users manage own contributions" ON public.contributors FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin manage contributors" ON public.contributors FOR ALL
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

