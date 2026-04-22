/**
 * kg-enrich — Edge Function for AI-powered KG Profile enrichment.
 *
 * Reads ALL fields of a location card, sends to LLM, saves structured
 * kg_profile back to locations table.
 *
 * POST /functions/v1/kg-enrich
 * Body: { mode: "single", id: "<location_id>" }
 *    or { mode: "batch", force: false }   ← enrich all without kg_profile
 *    or { mode: "batch", force: true  }   ← re-enrich all
 *
 * Auth: Bearer <service_role_key> or admin user JWT
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── KG Profile prompt ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a gastronomy intelligence engine.
Analyze a restaurant/cafe card and produce a rich structured JSON profile.
Go BEYOND what is literally written — infer from category, cuisine, city context, dishes.

Return ONLY a valid JSON object:
{
  "cuisines": [],
  "dishes": [],
  "ingredients": [],
  "allergens": [],
  "flavor_profile": [],
  "atmosphere": [],
  "dining_style": [],
  "occasion_tags": [],
  "price_context": [],
  "diet_friendly": [],
  "search_phrases": [],
  "what_makes_unique": [],
  "best_dishes": [],
  "local_context": []
}

Rules:
- 3-10 items per array (more = better search coverage)
- allergens from: gluten, dairy, soy, nuts, eggs, seafood, shellfish, pork
- search_phrases = natural language queries a user would type (e.g. "best pierogi krakow")
- Infer deeply: a Polish milk bar implies communist-era nostalgia, cheap, cash only, self-service, pierogi, żurek
- Return ONLY valid JSON, no markdown`

const MODELS = [
  'google/gemma-3-27b-it:free',
  'openai/gpt-oss-120b:free',
  'arcee-ai/trinity-large-preview:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildContext(loc: Record<string, unknown>): string {
  const arr = (v: unknown) => Array.isArray(v) ? (v as string[]).join(', ') : ''
  const parts = [
    `Name: ${loc.title}`,
    loc.category    ? `Type: ${loc.category}` : null,
    loc.cuisine     ? `Cuisine: ${loc.cuisine}` : null,
    loc.city        ? `City: ${loc.city}, ${loc.country ?? ''}` : null,
    loc.description ? `Description: ${loc.description}` : null,
    loc.ai_context  ? `Expert note: ${loc.ai_context}` : null,
    loc.insider_tip ? `Insider tip: ${loc.insider_tip}` : null,
    arr(loc.what_to_try)    ? `What to try: ${arr(loc.what_to_try)}` : null,
    arr(loc.tags)           ? `Tags: ${arr(loc.tags)}` : null,
    arr(loc.vibe)           ? `Vibe: ${arr(loc.vibe)}` : null,
    arr(loc.best_for)       ? `Best for: ${arr(loc.best_for)}` : null,
    arr(loc.dietary)        ? `Dietary: ${arr(loc.dietary)}` : null,
    arr(loc.special_labels) ? `Labels: ${arr(loc.special_labels)}` : null,
    arr(loc.features)       ? `Features: ${arr(loc.features)}` : null,
    loc.price_level         ? `Price: ${loc.price_level}` : null,
    loc.rating              ? `Rating: ${loc.rating}/5` : null,
    loc.michelin_stars && Number(loc.michelin_stars) > 0 ? `Michelin stars: ${loc.michelin_stars}` : null,
    loc.michelin_bib        ? `Michelin Bib Gourmand` : null,
    loc.has_wifi            ? `Has WiFi` : null,
    loc.has_outdoor_seating ? `Outdoor seating` : null,
    arr(loc.kg_dishes)      ? `Known dishes: ${arr(loc.kg_dishes)}` : null,
    arr(loc.kg_ingredients) ? `Known ingredients: ${arr(loc.kg_ingredients)}` : null,
  ].filter(Boolean)
  return parts.join('\n')
}

async function callAI(context: string, apiKey: string): Promise<{ profile: Record<string, unknown>, model: string }> {
  let lastErr = ''
  for (const model of MODELS) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://gastromap.app',
          'X-Title': 'GastroMap KG',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Analyze and generate kg_profile:\n\n${context}` },
          ],
          max_tokens: 1200,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(25000),
      })

      if (!resp.ok) {
        lastErr = `${model}: HTTP ${resp.status}`
        await new Promise(r => setTimeout(r, 500))
        continue
      }

      const data = await resp.json()
      const content: string = data?.choices?.[0]?.message?.content ?? ''
      const match = content.match(/\{[\s\S]*\}/)
      if (!match) { lastErr = `${model}: no JSON`; continue }

      const profile = JSON.parse(match[0])
      if (!profile.search_phrases && !profile.dishes && !profile.cuisines) {
        lastErr = `${model}: incomplete`
        continue
      }
      return { profile, model }
    } catch (e) {
      lastErr = `${model}: ${(e as Error).message}`
      await new Promise(r => setTimeout(r, 500))
    }
  }
  throw new Error(`All models failed. Last: ${lastErr}`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!openrouterKey) {
      return Response.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500, headers: CORS })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    const body = await req.json()
    const { mode = 'single', id, force = false } = body

    // ── Single location ───────────────────────────────────────────────────────
    if (mode === 'single') {
      if (!id) return Response.json({ error: 'id required for mode=single' }, { status: 400, headers: CORS })

      const { data: loc, error: fetchErr } = await supabase
        .from('locations').select('*').eq('id', id).single()
      if (fetchErr || !loc) {
        return Response.json({ error: 'Location not found' }, { status: 404, headers: CORS })
      }

      if (!force && loc.kg_profile) {
        return Response.json({ skipped: true, id, title: loc.title }, { headers: CORS })
      }

      const context = buildContext(loc)
      const { profile, model } = await callAI(context, openrouterKey)

      const { error: upErr } = await supabase.from('locations').update({
        kg_profile,
        kg_enriched_at: new Date().toISOString(),
      }).eq('id', id)

      if (upErr) return Response.json({ error: upErr.message }, { status: 500, headers: CORS })

      return Response.json({ success: true, id, title: loc.title, model, kg_profile: profile }, { headers: CORS })
    }

    // ── Batch mode ────────────────────────────────────────────────────────────
    if (mode === 'batch') {
      let query = supabase.from('locations').select('*').eq('status', 'approved')
      if (!force) query = query.is('kg_profile', null)

      const { data: locations, error } = await query.order('rating', { ascending: false })
      if (error) return Response.json({ error: error.message }, { status: 500, headers: CORS })
      if (!locations?.length) {
        return Response.json({ success: true, message: 'Nothing to enrich', enriched: 0 }, { headers: CORS })
      }

      const results: unknown[] = []
      let enriched = 0, skipped = 0, failed = 0

      for (const loc of locations) {
        if (!force && loc.kg_profile) { skipped++; continue }

        try {
          const context = buildContext(loc)
          const { profile, model } = await callAI(context, openrouterKey)

          const { error: upErr } = await supabase.from('locations').update({
            kg_profile: profile,
            kg_enriched_at: new Date().toISOString(),
          }).eq('id', loc.id)

          if (upErr) throw new Error(upErr.message)

          results.push({ id: loc.id, title: loc.title, model, ok: true })
          enriched++
        } catch (e) {
          results.push({ id: loc.id, title: loc.title, error: (e as Error).message, ok: false })
          failed++
        }

        // Rate limit buffer between requests
        await new Promise(r => setTimeout(r, 900))
      }

      return Response.json({ success: true, enriched, skipped, failed, total: locations.length, results }, { headers: CORS })
    }

    return Response.json({ error: 'Invalid mode. Use single or batch.' }, { status: 400, headers: CORS })

  } catch (err) {
    console.error('[kg-enrich]', err)
    return Response.json({ error: (err as Error).message }, { status: 500, headers: CORS })
  }
})
