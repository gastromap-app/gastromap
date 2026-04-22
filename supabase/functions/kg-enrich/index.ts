import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Location {
  id: string
  title: string
  status: string
  category?: string
  cuisine?: string
  city?: string
  country?: string
  description?: string
  ai_context?: string
  insider_tip?: string
  what_to_try?: string[]
  tags?: string[]
  vibe?: string[]
  best_for?: string[]
  dietary?: string[]
  special_labels?: string[]
  features?: string[]
  price_level?: string
  rating?: number
  michelin_stars?: number
  michelin_bib?: boolean
  has_wifi?: boolean
  has_outdoor_seating?: boolean
  kg_dishes?: string[]
  kg_ingredients?: string[]
  kg_profile?: KgProfile | null
  kg_enriched_at?: string
}

interface KgProfile {
  cuisines: string[]
  dishes: string[]
  ingredients: string[]
  allergens: string[]
  flavor_profile: string[]
  atmosphere: string[]
  dining_style: string[]
  occasion_tags: string[]
  price_context: string[]
  diet_friendly: string[]
  search_phrases: string[]
  what_makes_unique: string[]
  best_dishes: string[]
  local_context: string[]
}

interface EnrichResult {
  id: string
  title: string
  model?: string
  ok: boolean
  error?: string
}

// ─── AI Config ────────────────────────────────────────────────────────────────

const MODELS = [
  'google/gemma-3-27b-it:free',
  'openai/gpt-oss-120b:free',
  'arcee-ai/trinity-large-preview:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
]

const SYSTEM_PROMPT = `You are a gastronomy intelligence engine.
Analyze a restaurant/cafe data card and return a rich structured JSON profile.
Infer deeply from category, cuisine, city and any context clues provided.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
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
- 3–10 items per array (more = better search coverage)
- allergens from: gluten, dairy, soy, nuts, eggs, seafood, shellfish, pork
- search_phrases = natural language queries a user would type (e.g. "best pierogi krakow")
- Infer deeply: a Polish milk bar → communist nostalgia, cheap, cash-only, pierogi, żurek
- Return ONLY valid JSON`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLocationContext(loc: Location): string {
  const arr = (v?: string[]) => v?.length ? v.join(', ') : null
  const lines = [
    `Name: ${loc.title}`,
    loc.category        ? `Type: ${loc.category}` : null,
    loc.cuisine         ? `Cuisine: ${loc.cuisine}` : null,
    loc.city            ? `City: ${loc.city}${loc.country ? ', ' + loc.country : ''}` : null,
    loc.description     ? `Description: ${loc.description}` : null,
    loc.ai_context      ? `Expert note: ${loc.ai_context}` : null,
    loc.insider_tip     ? `Insider tip: ${loc.insider_tip}` : null,
    arr(loc.what_to_try)    ? `What to try: ${arr(loc.what_to_try)}` : null,
    arr(loc.tags)           ? `Tags: ${arr(loc.tags)}` : null,
    arr(loc.vibe)           ? `Vibe: ${arr(loc.vibe)}` : null,
    arr(loc.best_for)       ? `Best for: ${arr(loc.best_for)}` : null,
    arr(loc.dietary)        ? `Dietary: ${arr(loc.dietary)}` : null,
    arr(loc.special_labels) ? `Labels: ${arr(loc.special_labels)}` : null,
    arr(loc.features)       ? `Features: ${arr(loc.features)}` : null,
    loc.price_level         ? `Price level: ${loc.price_level}` : null,
    loc.rating              ? `Rating: ${loc.rating}/5` : null,
    loc.michelin_stars && loc.michelin_stars > 0
      ? `Michelin stars: ${loc.michelin_stars}` : null,
    loc.michelin_bib        ? `Michelin Bib Gourmand` : null,
    loc.has_wifi            ? `Has WiFi` : null,
    loc.has_outdoor_seating ? `Has outdoor seating` : null,
    arr(loc.kg_dishes)      ? `Known dishes: ${arr(loc.kg_dishes)}` : null,
    arr(loc.kg_ingredients) ? `Known ingredients: ${arr(loc.kg_ingredients)}` : null,
  ]
  return lines.filter(Boolean).join('\n')
}

async function generateKgProfile(
  context: string,
  openrouterKey: string,
): Promise<{ profile: KgProfile; model: string }> {
  let lastError = 'No models tried'

  for (const model of MODELS) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://gastromap.app',
          'X-Title': 'GastroMap KG Enrichment',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Analyze and generate kg_profile for:\n\n${context}` },
          ],
          max_tokens: 1200,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(28_000),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        lastError = `${model}: HTTP ${response.status} — ${body.slice(0, 120)}`
        await delay(800)
        continue
      }

      const data = await response.json()
      const content: string = data?.choices?.[0]?.message?.content ?? ''

      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        lastError = `${model}: response contained no JSON`
        continue
      }

      const profile = JSON.parse(jsonMatch[0]) as KgProfile

      const isValid =
        Array.isArray(profile.search_phrases) ||
        Array.isArray(profile.dishes) ||
        Array.isArray(profile.cuisines)

      if (!isValid) {
        lastError = `${model}: JSON missing required arrays`
        continue
      }

      return { profile, model }
    } catch (err) {
      lastError = `${model}: ${(err as Error).message}`
      await delay(800)
    }
  }

  throw new Error(`All models failed. Last error: ${lastError}`)
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!openrouterKey) {
      return Response.json(
        { error: 'OPENROUTER_API_KEY is not set in Supabase project secrets' },
        { status: 500, headers: CORS_HEADERS },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const { mode = 'single', id, force = false } = await req.json()

    // ── Single location ───────────────────────────────────────────────────────
    if (mode === 'single') {
      if (!id) {
        return Response.json(
          { error: '`id` is required when mode is "single"' },
          { status: 400, headers: CORS_HEADERS },
        )
      }

      const { data: loc, error: fetchErr } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single<Location>()

      if (fetchErr || !loc) {
        return Response.json(
          { error: 'Location not found', detail: fetchErr?.message },
          { status: 404, headers: CORS_HEADERS },
        )
      }

      if (!force && loc.kg_profile) {
        return Response.json(
          { skipped: true, id: loc.id, title: loc.title },
          { headers: CORS_HEADERS },
        )
      }

      const context = buildLocationContext(loc)
      const { profile, model } = await generateKgProfile(context, openrouterKey)

      const { error: updateErr } = await supabase
        .from('locations')
        .update({ kg_profile: profile, kg_enriched_at: new Date().toISOString() })
        .eq('id', id)

      if (updateErr) {
        return Response.json(
          { error: updateErr.message },
          { status: 500, headers: CORS_HEADERS },
        )
      }

      return Response.json(
        { success: true, id: loc.id, title: loc.title, model, kg_profile: profile },
        { headers: CORS_HEADERS },
      )
    }

    // ── Batch ─────────────────────────────────────────────────────────────────
    if (mode === 'batch') {
      let query = supabase
        .from('locations')
        .select('*')
        .eq('status', 'approved')
        .order('rating', { ascending: false })

      if (!force) {
        query = query.is('kg_profile', null)
      }

      const { data: locations, error: listErr } = await query.returns<Location[]>()

      if (listErr) {
        return Response.json(
          { error: listErr.message },
          { status: 500, headers: CORS_HEADERS },
        )
      }

      if (!locations?.length) {
        return Response.json(
          { success: true, message: 'Nothing to enrich', enriched: 0, skipped: 0, failed: 0, total: 0 },
          { headers: CORS_HEADERS },
        )
      }

      const results: EnrichResult[] = []
      let enriched = 0
      let failed = 0

      for (const loc of locations) {
        try {
          const context = buildLocationContext(loc)
          const { profile, model } = await generateKgProfile(context, openrouterKey)

          const { error: updateErr } = await supabase
            .from('locations')
            .update({ kg_profile: profile, kg_enriched_at: new Date().toISOString() })
            .eq('id', loc.id)

          if (updateErr) throw new Error(updateErr.message)

          results.push({ id: loc.id, title: loc.title, model, ok: true })
          enriched++
        } catch (err) {
          results.push({ id: loc.id, title: loc.title, ok: false, error: (err as Error).message })
          failed++
        }

        // Respectful rate-limit pause between requests
        await delay(900)
      }

      return Response.json(
        {
          success: true,
          total: locations.length,
          enriched,
          failed,
          results,
        },
        { headers: CORS_HEADERS },
      )
    }

    return Response.json(
      { error: 'Invalid mode. Accepted values: "single" | "batch"' },
      { status: 400, headers: CORS_HEADERS },
    )
  } catch (err) {
    console.error('[kg-enrich]', err)
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: CORS_HEADERS },
    )
  }
})

// Wed Apr 22 14:55:06 UTC 2026
