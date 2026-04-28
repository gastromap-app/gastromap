/**
 * Location-Specific AI Functions
 *
 * - generateLocationSemanticSummary: Create semantic identity for locations
 * - extractLocationData: Extract structured restaurant data from queries
 */

import { getActiveAIConfig } from '../ai-config.api'
import { fetchOpenRouter } from './openrouter'
import { robustParseJSON } from './utils'

/**
 * Generate a semantic summary and AI keywords for a location.
 * Enriches location with culinary context and creates a dense semantic identity
 * for improved AI search and recommendations.
 *
 * @param {Object} location - Location object with title, category, cuisine_types, etc.
 * @param {Object} [extraContext=null] - Additional context data to enhance summary
 * @returns {Promise<{ summary: string, keywords: Array<string> }>}
 */
export async function generateLocationSemanticSummary(location, extraContext = null) {
    const { apiKey } = getActiveAIConfig()
    if (!apiKey) return { summary: location.description || '', keywords: [] }

    // 1. Enrich with Culinary context (Spoonacular + OpenFoodFacts)
    // Both are optional — failures are non-blocking
    let culinaryContext = ''
    try {
        const { enrichCulinaryTerm, isSpoonacularAvailable } = await import('../spoonacular.api')
        const { getIngredientCulinaryContext } = await import('../openfoodfacts.api')

        const queryTerm = location.cuisine_types?.[0] || location.category
        
        // Only call Spoonacular if key is present and quota not exhausted
        const spoonPromise = isSpoonacularAvailable()
            ? enrichCulinaryTerm(queryTerm).catch(err => {
                console.warn('[ai.location] Spoonacular unavailable:', err.message)
                return null
              })
            : Promise.resolve(null)

        const [spoonData, offData] = await Promise.all([
            spoonPromise,
            getIngredientCulinaryContext(queryTerm).catch(() => null)
        ])

        if (spoonData?.data) {
            culinaryContext += `\nCULINARY DATA (Dishes/Ingredients): ${JSON.stringify(spoonData.data)}`
        }
        if (offData && offData.categories) {
            const categoriesStr = Array.isArray(offData.categories) ? offData.categories.join(', ') : String(offData.categories)
            const allergensStr = Array.isArray(offData.allergens) ? offData.allergens.join(', ') : (offData.allergens ? String(offData.allergens) : '')
            culinaryContext += `\nFOOD FACTS: Categories: ${categoriesStr}` + (allergensStr ? `, Allergens: ${allergensStr}` : '')
        }
    } catch (err) {
        // Culinary enrichment is optional — never block semantic summary generation
        console.warn('[ai.location] Culinary enrichment skipped:', err.message)
    }

    // Merge manual extra context if provided
    if (extraContext) {
        culinaryContext += `\nADDITIONAL INFO: ${JSON.stringify(extraContext)}`
    }

    const prompt = `
        You are a Michelin-level culinary critic and data scientist.
        Your task is to create a "Semantic Identity" for the following location:

        NAME: ${location.title}
        CATEGORY: ${location.category}
        CUISINE TYPES: ${(location.cuisine_types || []).join(', ')}
        DESCRIPTION: ${location.description}
        AMENITIES: ${(location.amenities || []).join(', ')}
        TAGS: ${(location.tags || []).join(', ')}
        BEST FOR: ${(location.best_for || []).join(', ')}

        ${culinaryContext ? `CULINARY ENRICHMENT CONTEXT:\n${culinaryContext}` : ''}

        INSTRUCTIONS:
        1. Create a "Semantic Summary" (ai_context): A dense, keyword-rich 2-3 paragraph description that captures the essence,
           flavor profile, target audience, and unique selling points. Use actual culinary terminology and mention potential signature dishes.
        2. Extract "AI Keywords" (ai_keywords): A list of 15-20 highly specific tags (e.g. "rare single origin coffee", "mibrasa charcoal oven", "secret dinner spot").
        3. If cuisine types include ${location.cuisine_types?.[0] || 'local'}, ensure you use terminology specific to that culture.
        4. Focus on SEMANTIC searchability - think about what a user might search for beyond just "Italian food".

        RETURN JSON ONLY:
        {
            "summary": "...",
            "keywords": ["...", "..."]
        }
    `

    try {
        const { response } = await fetchOpenRouter([
            { role: 'system', content: 'You are a culinary data expert. Respond in JSON.' },
            { role: 'user', content: prompt }
        ], { stream: false, withTools: false })

        const data = await response.json()
        const text = data.choices?.[0]?.message?.content || '{}'
        const parsed = robustParseJSON(text)

        return {
            summary: parsed.summary || location.description || '',
            keywords: parsed.keywords || []
        }
    } catch (err) {
        console.error('[ai.location] Failed to generate semantic summary:', err)
        return { summary: location.description || '', keywords: [] }
    }
}

/**
 * Admin helper to extract structured restaurant data from a name or description.
 * Useful for auto-filling the location form.
 *
 * @param {string} query - Restaurant name or "Name, City" or description
 * @returns {Promise<Object>} - Structured location data with validated fields
 */
/**
 * Admin helper to extract structured restaurant data from a name or description.
 * 
 * STRATEGY:
 *   1. Google Places API (via /api/places/search proxy) — real, verified data
 *   2. LLM fallback (OpenRouter) — only if Places returns nothing or fails
 *
 * @param {string} query - Restaurant name or "Name, City" or description
 * @returns {Promise<Object>} - Structured location data
 */
export async function extractLocationData(query) {
    if (!query?.trim()) throw new Error('Query cannot be empty')

    // ── Step 1: Try Google Places (real data, no hallucinations) ────────────
    try {
        console.log('[ai.location] Trying Google Places for:', query)
        const baseUrl = typeof window !== 'undefined'
            ? window.location.origin
            : 'https://gastromap-five.vercel.app'

        const res = await fetch(`${baseUrl}/api/places/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query.trim() }),
        })

        if (res.ok) {
            const { result, candidates } = await res.json()
            if (result?.title) {
                console.log('[ai.location] Google Places found:', result.title)

                // Enrich with LLM: translate description to Russian, add tags/tips
                const enriched = await enrichWithLLM(result, query)
                return { ...result, ...enriched, _source: 'google_places', _candidates: candidates }
            }
        }
        console.warn('[ai.location] Google Places returned no result, falling back to LLM')
    } catch (err) {
        console.warn('[ai.location] Google Places failed, using LLM fallback:', err.message)
    }

    // ── Step 2: LLM fallback (OpenRouter) ───────────────────────────────────
    return extractWithLLM(query)
}

/**
 * After Google Places returns core data, enrich it with LLM:
 * - Translate/expand description to Russian
 * - Generate insider_tip
 * - Suggest tags, best_for, what_to_try
 */
async function enrichWithLLM(placesData) {
    try {
        const { getActiveAIConfig } = await import('../ai-config.api')
        const { apiKey } = getActiveAIConfig()
        if (!apiKey) return {}

        const { fetchOpenRouter } = await import('./openrouter')
        const { robustParseJSON } = await import('./utils')

        const prompt = `You have verified Google Places data for a restaurant. Enhance it with culinary expertise.

VERIFIED DATA:
Name: ${placesData.title}
Category: ${placesData.category}
Address: ${placesData.address}
Cuisine type (inferred from tags/types): ${(placesData.tags || []).join(', ') || 'unknown'}
Rating: ${placesData.rating || 'N/A'}
Price level: ${placesData.price_level || 'N/A'}
Original description (English): ${placesData.description || 'N/A'}
Google types: ${(placesData._raw_types || []).join(', ')}

TASK: Return a JSON object with these fields (fill only what you can reasonably infer):
{
  "description": "2-3 sentence description in Russian, warm and inviting tone",
  "insider_tip": "One expert insider tip in Russian (e.g. best dish, best time to visit, hidden gem detail)",
  "tags": ["atmosphere/vibe tags in English, e.g. Romantic, Cozy, Trendy — max 5"],
  "best_for": ["occasions: date, family, business, solo, friends — pick 2-3 relevant"],
  "what_to_try": ["2-4 likely signature dishes based on cuisine type — in English"],
  "cuisine": "single cuisine type string (e.g. Italian, Polish, Japanese)",
  "dietary": ["dietary options if obvious from context: vegan, vegetarian, gluten-free"]
}

RULES: description and insider_tip MUST be in Russian. Other fields in English. No hallucinations — if unsure, omit.`

        const { response } = await fetchOpenRouter([
            { role: 'system', content: 'You are a culinary expert. Return valid JSON only.' },
            { role: 'user', content: prompt }
        ], { stream: false, withTools: false })

        const data = await response.json()
        const text = data.choices?.[0]?.message?.content || '{}'
        return robustParseJSON(text) || {}
    } catch (err) {
        console.warn('[ai.location] LLM enrichment failed:', err.message)
        return {}
    }
}

/**
 * Pure LLM extraction fallback (no Google Places available)
 */
async function extractWithLLM(query) {
    const { fetchOpenRouter } = await import('./openrouter')
    const { robustParseJSON } = await import('./utils')

    const systemPrompt = `You are GastroData Extractor AI. Extract structured restaurant information.
CRITICAL: DO NOT hallucinate. If unsure about a field (phone, website, exact address), return null.
Return ONLY valid JSON.`

    const userPrompt = `Extract factual data for: "${query}"

Return JSON with these exact fields:
{
  "title": "official name",
  "category": "Restaurant|Cafe|Bar|Bakery|Street Food|Fine Dining|Fast Food",
  "city": "city name",
  "country": "country",
  "address": "street address or null",
  "description": "2-3 sentences in Russian or null",
  "cuisine": "single cuisine type or null",
  "price_level": "$|$$|$$$|$$$$|null",
  "opening_hours": "hours string or null",
  "website": "URL or null",
  "phone": "phone with country code or null",
  "insider_tip": "expert tip in Russian or null",
  "what_to_try": ["dish1", "dish2"] or [],
  "tags": ["tag1", "tag2"] or [],
  "amenities": ["wifi", "outdoor_seating"] or [],
  "dietary": ["vegetarian", "vegan"] or [],
  "lat": number or null,
  "lng": number or null
}

Rules: description and insider_tip in Russian. Other fields in English. Null if uncertain.
_source field: set to "llm_fallback"`

    try {
        const { response } = await fetchOpenRouter([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], { stream: false, withTools: false })

        const data = await response.json()
        const text = data.choices?.[0]?.message?.content || '{}'
        const extracted = robustParseJSON(text)
        console.log('[ai.location] LLM fallback extracted:', extracted?.title)
        return { ...extracted, _source: 'llm_fallback' }
    } catch (err) {
        console.error('[ai.location] LLM extraction also failed:', err)
        throw err
    }
}
