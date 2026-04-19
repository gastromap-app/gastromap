import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    // ── Auth check ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return Response.json({ error: 'Missing Authorization header' }, { status: 401, headers: CORS })
    }

    // Use service role client to bypass RLS for KG writes
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    // Verify the caller is an authenticated admin
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    )
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })
    }
    // Only admins can write to KG
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Admin role required' }, { status: 403, headers: CORS })
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const { type, data } = await req.json()
    if (!type || !data) {
      return Response.json({ error: 'Missing type or data' }, { status: 400, headers: CORS })
    }

    const TABLE_MAP: Record<string, string> = {
      cuisine:    'cuisines',
      cuisines:   'cuisines',
      dish:       'dishes',
      dishes:     'dishes',
      ingredient: 'ingredients',
      ingredients:'ingredients',
    }
    const table = TABLE_MAP[type]
    if (!table) {
      return Response.json({ error: `Unknown type: ${type}` }, { status: 400, headers: CORS })
    }

    // ── Check for duplicate by name ───────────────────────────────────────────
    const { data: existing } = await supabase
      .from(table)
      .select('id, name')
      .ilike('name', data.name.trim())
      .maybeSingle()

    if (existing) {
      return Response.json({ duplicate: true, data: existing }, { headers: CORS })
    }

    // ── Insert ────────────────────────────────────────────────────────────────
    const { data: saved, error: insertError } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single()

    if (insertError) {
      console.error(`[kg-save] Insert failed for ${table}:`, insertError)
      return Response.json(
        { error: insertError.message, details: insertError },
        { status: 400, headers: CORS }
      )
    }

    return Response.json({ duplicate: false, data: saved }, { headers: CORS })

  } catch (err) {
    console.error('[kg-save] Unexpected error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500, headers: CORS }
    )
  }
})
