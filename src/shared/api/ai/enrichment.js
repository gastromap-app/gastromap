/**
 * Location enrichment — uses AI to fill metadata fields for a submitted place.
 *
 * Given name + address + city + category, returns a structured object with:
 * description, cuisine_types, tags, dietary_options, amenities, best_for,
 * price_range, has_outdoor_seating, pet_friendly.
 *
 * Does NOT fill: must_try, insider_tip — those are user-only fields.
 */

import { fetchOpenRouter } from './openrouter'

const ENRICHMENT_SYSTEM_PROMPT = `You are a gastronomy expert assistant that helps fill restaurant/cafe database entries.
Given a place name, address, city, and category, return a JSON object with the following fields:
- description: string (2-3 engaging sentences about the place, based on the type and location)
- cuisine_types: array of strings (likely cuisine styles, max 3)
- tags: array of strings (descriptive tags like "cozy", "romantic", "business lunch", max 5)
- dietary_options: array of strings from: vegetarian, vegan, gluten_free, halal, kosher, dairy_free
- amenities: array of strings from: wifi, outdoor_seating, pet_friendly, parking, reservations, takeaway, delivery
- best_for: array of strings from: date, family, friends, business, solo, groups
- price_range: one of: $, $$, $$$, $$$$
- has_outdoor_seating: boolean
- pet_friendly: boolean

Return ONLY a valid JSON object, no markdown, no explanation.`

/**
 * @param {{ name: string, address: string, city: string, category: string }} params
 * @returns {Promise<Object>} — enriched fields (never includes must_try or insider_tip)
 */
export async function enrichLocation({ name, address, city, category }) {
    const userMessage = `Place: "${name}", Address: "${address}", City: "${city}", Category: "${category}"`

    try {
        const { response } = await fetchOpenRouter(
            [
                { role: 'system', content: ENRICHMENT_SYSTEM_PROMPT },
                { role: 'user',   content: userMessage },
            ],
            { withTools: false, modelOverride: 'meta-llama/llama-3.3-70b-instruct:free' }
        )

        const text = await response.text()
        // Parse the streamed or non-streamed response
        let content = ''

        // Handle non-stream JSON response from OpenRouter
        try {
            const json = JSON.parse(text)
            content = json.choices?.[0]?.message?.content || text
        } catch {
            content = text
        }

        // Extract JSON from content
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('AI returned invalid JSON')

        const result = JSON.parse(jsonMatch[0])

        // Ensure must_try / insider_tip are never overwritten
        const { must_try: _mt, insider_tip: _it, ...safe } = result
        return safe
    } catch (err) {
        console.error('[enrichLocation] Error:', err)
        throw err
    }
}
