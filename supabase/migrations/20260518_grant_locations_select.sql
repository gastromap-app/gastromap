-- ═══════════════════════════════════════════════════════════════════════════
-- Grant SELECT on locations to authenticated and anon roles
-- ═══════════════════════════════════════════════════════════════════════════
-- Problem: executeTool in the AI chat runs on the client side with the
-- authenticated Supabase client. Without explicit GRANT, PostgREST returns
-- "permission denied for table locations" even though RLS policies exist.
-- RLS controls WHICH rows are visible; GRANT controls WHETHER the table
-- can be accessed at all.

GRANT SELECT ON public.locations TO anon;
GRANT SELECT ON public.locations TO authenticated;

-- Also grant on related tables used in joins
GRANT SELECT ON public.location_vibes TO anon;
GRANT SELECT ON public.location_vibes TO authenticated;
GRANT SELECT ON public.vibes TO anon;
GRANT SELECT ON public.vibes TO authenticated;
