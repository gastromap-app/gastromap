/**
 * KG Profile Enrichment — AI-powered deep analysis of a location card.
 *
 * Reads ALL fields of a location and asks an LLM to produce a rich
 * structured `kg_profile` object that covers:
 *   - cuisines, dishes, ingredients, allergens (verified / inferred)
 *   - flavor_profile, atmosphere, dining_style, occasion_tags
 *   - price_context, diet_friendly, search_phrases
 *
 * The result is stored in locations.kg_profile (jsonb) and is used by:
 *   1. FTS trigger — text fields from kg_profile are indexed into `fts`
 *   2. ai/tools.js  — AI Guide reads kg_profile when answering queries
 *   3. SmartSearchBar — in-memory suggestions also check kg_profile
 */

import { supabase } from '@/shared/api/client'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
import { config } from '@/shared/config/env'

// ─── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a gastronomy intelligence engine. 
Your job is to analyze a restaurant/cafe card and produce a rich structured JSON profile.

You will receive ALL available fields from the location card.
Your task: infer as much useful information as possible — go BEYOND what is literally written.

Return ONLY a valid JSON object with these fields:

{
  "cuisines": [],          // cuisine types, e.g. ["Japanese", "Asian Fusion"]
  "dishes": [],            // specific dishes present or typical for this place
  "ingredients": [],       // key ingredients used in their dishes
  "allergens": [],         // common allergens based on dishes/ingredients: gluten, dairy, soy, nuts, eggs, seafood, shellfish, pork
  "flavor_profile": [],    // taste descriptors: umami, rich, spicy, delicate, smoky, sweet, tangy, hearty, creamy, fresh
  "atmosphere": [],        // vibe words: cozy, noisy, romantic, minimalist, rustic, trendy, hipster, traditional, lively
  "dining_style": [],      // counter seating, tasting menu, self-service, table service, open kitchen, food hall
  "occasion_tags": [],     // when to go: date night, solo lunch, rainy day meal, business lunch, late night, hangover cure
  "price_context": [],     // budget-friendly, affordable, mid-range, splurge-worthy, cash only, great value
  "diet_friendly": [],     // vegan-friendly, vegetarian options, gluten-free options, halal, kosher, dairy-free
  "search_phrases": [],    // 5-10 natural search queries a user might type to find this place, e.g. "best ramen in krakow"
  "what_makes_unique": [], // 2-4 short phrases about what makes this place stand out
  "best_dishes": [],       // top 3-5 dishes to order (from what_to_try or inferred from category/cuisine)
  "local_context": []      // neighbourhood info, local reputation, insider knowledge
}

Rules:
- Arrays should have 3-10 items each (more is better for search coverage)
- Be specific: "pork bone broth ramen" is better than just "ramen"
- search_phrases must be natural language queries, not keywords
- Infer from context: a Polish milk bar (bar mleczny) implies cheap, nostalgic, communist-era food, self-service, cash only, pierogi, żurek, etc.
- Return ONLY valid JSON, no markdown, no explanation`

// ─── Models cascade ──────────────────────────────────────────────────────────

const MODELS = [
    'google/gemma-3-27b-it:free',
    'openai/gpt-oss-120b:free',
    'arcee-ai/trinity-large-preview:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
]

// ─── Core enrichment ─────────────────────────────────────────────────────────

/**
 * Build a comprehensive text description of the location for the AI.
 */
function buildLocationContext(loc) {
    const parts = [
        `Name: ${loc.title}`,
        loc.category ? `Type: ${loc.category}` : null,
        loc.cuisine  ? `Cuisine: ${loc.cuisine}` : null,
        loc.city     ? `City: ${loc.city}, ${loc.country || ''}` : null,
        loc.description ? `Description: ${loc.description}` : null,
        loc.ai_context  ? `Expert note: ${loc.ai_context}` : null,
        loc.insider_tip ? `Insider tip: ${loc.insider_tip}` : null,
        loc.what_to_try?.length  ? `What to try: ${loc.what_to_try.join(', ')}` : null,
        loc.tags?.length         ? `Tags: ${loc.tags.join(', ')}` : null,
        loc.vibe?.length         ? `Vibe: ${loc.vibe.join(', ')}` : null,
        loc.best_for?.length     ? `Best for: ${loc.best_for.join(', ')}` : null,
        loc.dietary?.length      ? `Dietary: ${loc.dietary.join(', ')}` : null,
        loc.special_labels?.length ? `Labels: ${loc.special_labels.join(', ')}` : null,
        loc.features?.length     ? `Features: ${loc.features.join(', ')}` : null,
        loc.price_level          ? `Price: ${loc.price_level}` : null,
        loc.rating               ? `Rating: ${loc.rating}/5` : null,
        loc.michelin_stars > 0   ? `Michelin stars: ${loc.michelin_stars}` : null,
        loc.michelin_bib         ? `Michelin Bib Gourmand` : null,
        loc.has_wifi             ? `Has WiFi` : null,
        loc.has_outdoor_seating  ? `Has outdoor seating` : null,
        // Existing KG data as hints
        loc.kg_dishes?.length    ? `Known dishes: ${loc.kg_dishes.join(', ')}` : null,
        loc.kg_cuisines?.length  ? `KG cuisines: ${loc.kg_cuisines.join(', ')}` : null,
        loc.kg_ingredients?.length ? `Known ingredients: ${loc.kg_ingredients.join(', ')}` : null,
        loc.ai_keywords?.length  ? `Keywords: ${loc.ai_keywords.slice(0, 10).join(', ')}` : null,
    ].filter(Boolean)

    return parts.join('\n')
}

/**
 * Call OpenRouter LLM to generate kg_profile for a location.
 */
async function callAI(locationContext, apiKey) {
    let lastErr = null

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
                        { role: 'user',   content: `Analyze this location and generate a kg_profile:\n\n${locationContext}` },
                    ],
                    max_tokens: 1200,
                    temperature: 0.3,
                }),
            })

            if (!resp.ok) {
                lastErr = `${model}: HTTP ${resp.status}`
                continue
            }

            const data = await resp.json()
            const content = data.choices?.[0]?.message?.content || ''

            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (!jsonMatch) {
                lastErr = `${model}: no JSON in response`
                continue
            }

            const profile = JSON.parse(jsonMatch[0])

            // Basic validation
            if (!profile.cuisines && !profile.dishes && !profile.search_phrases) {
                lastErr = `${model}: incomplete profile`
                continue
            }

            return { profile, model }
        } catch (err) {
            lastErr = `${model}: ${err.message}`
            continue
        }
    }

    throw new Error(`All models failed. Last: ${lastErr}`)
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Generate and save kg_profile for a single location.
 *
 * @param {string|Object} locationOrId — location ID or full location object
 * @param {Object} options
 * @param {boolean} options.force — regenerate even if kg_profile already exists
 * @param {string}  options.apiKey — override API key
 * @returns {Promise<{ id, title, kg_profile, model }>}
 */
export async function enrichLocationKGProfile(locationOrId, { force = false, apiKey = null } = {}) {
    // Resolve API key
    if (!apiKey) {
        const appCfg = useAppConfigStore.getState()
        apiKey = appCfg.aiApiKey || config.ai?.openRouterKey
    }
    if (!apiKey) throw new Error('No API key configured')
    if (!supabase) throw new Error('Supabase not available')

    // Fetch location if only ID given
    let loc
    if (typeof locationOrId === 'string') {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('id', locationOrId)
            .single()
        if (error || !data) throw new Error(`Location not found: ${locationOrId}`)
        loc = data
    } else {
        loc = locationOrId
    }

    // Skip if already enriched (unless forced)
    if (!force && loc.kg_profile) {
        return { id: loc.id, title: loc.title, kg_profile: loc.kg_profile, skipped: true }
    }

    // Build context and call AI
    const context = buildLocationContext(loc)
    const { profile, model } = await callAI(context, apiKey)

    // Save to DB
    const { error: upErr } = await supabase
        .from('locations')
        .update({
            kg_profile: profile,
            kg_enriched_at: new Date().toISOString(),
        })
        .eq('id', loc.id)

    if (upErr) throw new Error(`Failed to save kg_profile: ${upErr.message}`)

    console.log(`[kg-enrichment] ✓ ${loc.title} (${model})`)
    return { id: loc.id, title: loc.title, kg_profile: profile, model }
}

/**
 * Enrich all locations that don't have kg_profile yet.
 * Processes sequentially to avoid rate limits.
 *
 * @param {Object} options
 * @param {boolean} options.force — re-enrich all, even if kg_profile exists
 * @param {Function} options.onProgress — callback(done, total, result)
 * @returns {Promise<{ enriched: number, skipped: number, failed: number }>}
 */
export async function enrichAllLocationsKGProfile({ force = false, onProgress = null, apiKey = null } = {}) {
    if (!supabase) throw new Error('Supabase not available')

    const { data: locations, error } = await supabase
        .from('locations')
        .select('*')
        .eq('status', 'approved')
        .order('google_rating', { ascending: false, nullsFirst: false })

    if (error) throw new Error(`Failed to fetch locations: ${error.message}`)

    let enriched = 0, skipped = 0, failed = 0

    for (let i = 0; i < locations.length; i++) {
        const loc = locations[i]
        try {
            const result = await enrichLocationKGProfile(loc, { force, apiKey })
            if (result.skipped) {
                skipped++
            } else {
                enriched++
            }
            onProgress?.(i + 1, locations.length, result)
        } catch (err) {
            console.error(`[kg-enrichment] ✗ ${loc.title}:`, err.message)
            failed++
            onProgress?.(i + 1, locations.length, { id: loc.id, title: loc.title, error: err.message })
        }

        // Small delay between requests to avoid rate limiting
        if (i < locations.length - 1) {
            await new Promise(r => setTimeout(r, 800))
        }
    }

    return { enriched, skipped, failed, total: locations.length }
}
