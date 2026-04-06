-- 20260406_kg_admin_rls.sql
-- Enables admin users to insert, update, and delete entities in the Knowledge Graph tables directly.

DO $$
DECLARE
    ttext TEXT;
    table_names TEXT[] := ARRAY[
        'cuisines',
        'dishes',
        'ingredients',
        'location_cuisines',
        'location_dishes',
        'dish_ingredients',
        'cuisine_ingredients'
    ];
BEGIN
    FOREACH ttext IN ARRAY table_names
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admin insert %I" ON public.%I;', ttext, ttext);
        EXECUTE format('DROP POLICY IF EXISTS "Admin update %I" ON public.%I;', ttext, ttext);
        EXECUTE format('DROP POLICY IF EXISTS "Admin delete %I" ON public.%I;', ttext, ttext);

        -- Admins can insert
        EXECUTE format('CREATE POLICY "Admin insert %I" ON public.%I FOR INSERT WITH CHECK (public.get_my_role() = ''admin'');', ttext, ttext);
        
        -- Admins can update
        EXECUTE format('CREATE POLICY "Admin update %I" ON public.%I FOR UPDATE USING (public.get_my_role() = ''admin'') WITH CHECK (public.get_my_role() = ''admin'');', ttext, ttext);
        
        -- Admins can delete
        EXECUTE format('CREATE POLICY "Admin delete %I" ON public.%I FOR DELETE USING (public.get_my_role() = ''admin'');', ttext, ttext);
    END LOOP;
END
$$;
