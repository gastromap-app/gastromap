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
        if (offData) {
            culinaryContext += `\nFOOD FACTS: Categories: ${offData.categories.join(', ')}, Allergens: ${offData.allergens.join(', ')}`
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
export async function extractLocationData(query) {
    if (!query?.trim()) throw new Error('Query cannot be empty')

    // Enhanced system prompt with comprehensive field extraction
    const systemPrompt = `You are GastroData Extractor AI - a precision-focused restaurant intelligence system.

Your task: Extract structured information about a restaurant/cafe/bar based ONLY on verifiable facts.
CRITICAL: DO NOT hallucinate or make up data. If you are not 100% sure about a specific field (like phone, website, or exact opening hours), leave it as NULL.
Accuracy is prioritized over completeness. It is better to return NULL than wrong data.

Return ONLY a valid JSON object:
{
    "title": "Full official name",
    "category": "Map any establishment to one of: restaurant, cafe, bar, bakery, street_food, fine_dining, casual_dining, fast_food, food_truck, market, other",
    "city": "City name",
    "country": "Country",
    "address": "Full official street address",
    "description": "Compelling 2-3 sentence description in Russian (based ONLY on factual data)",
    "cuisine_types": ["Italian", "Mediterranean"],
    "price_range": "$|$$|$$$|$$$$",
    "opening_hours": "Opening hours (e.g. '10:00-22:00')",
    "website": "Official website URL",
    "phone": "Phone number with country code",
    "booking_url": "Reservation URL (if known)",
    "insider_tip": "Expert local tip in Russian based on the venue's reputation (if known)",
    "must_try": ["Must-try dish 1", "Must-try dish 2"],
    "latitude": number or null,
    "longitude": number or null,
    "tags": ["tag1", "tag2"],
    "amenities": ["wifi", "outdoor_seating"],
    "dietary_options": ["vegetarian", "vegan"]
}

RULES:
1. TRUTHFULNESS: Never invent phone numbers, addresses, or URLs. If it's not in your certain knowledge base, return NULL for that field.
2. MISSING DATA: If data is missing or uncertain, return null.
3. LANGUAGES: "description" and "insider_tip" MUST be in Russian.
4. COORDINATES: Only provide if you have high confidence in the specific location.
5. NO HALLUCINATION: We are building a real-world map. Incorrect data ruins trust.
6. FIELD NAMES: Use EXACTLY these field names: cuisine_types (NOT cuisine), price_range (NOT price_level), tags (NOT vibe), amenities (NOT features), dietary_options (NOT dietary).`

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `EXTRACT FACTUAL DATA FOR: "${query}"

        Instructions:
        1. Only include information you are certain about.
        2. If you don't know a detail, return null for that field.
        3. DO NOT make educated guesses. If you haven't heard of this place, return a JSON with just the name you can infer and nulls for everything else.
        4. Focus on the most recent known state of this establishment.` },
    ]

    try {
        console.log('[ai.location] Extracting enhanced location data for:', query)

        const { response } = await fetchOpenRouter(messages, {
            stream: false,
            withTools: false,
            modelOverride: 'deepseek/deepseek-chat-v3-0324:free',
        })

        const data = await response.json()
        const text = data.choices?.[0]?.message?.content || '{}'

        const extracted = robustParseJSON(text)
        console.log('[ai.location] Successfully extracted:', extracted)

        return extracted
    } catch (err) {
        console.error('[ai.location] Failed to extract location data:', err)
        throw err
    }
}
