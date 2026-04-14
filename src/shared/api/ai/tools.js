/**
 * Tool Executor for Function Calling
 *
 * Executes tool calls (search_locations, get_location_details) locally using
 * the Zustand locations store to avoid extra network requests.
 *
 * Field mapping (Supabase → tools):
 *   rating        — основной рейтинг (не google_rating!)
 *   cuisine       — тип кухни (строка, не массив)
 *   tags          — теги/атмосфера (используется как "vibe" + tags)
 *   price_level   — уровень цены ("$$" etc.)
 *   dietary       — диет. опции
 *   what_to_try   — блюда которые стоит попробовать
 */

import { semanticSearch } from './search'
import { supabase } from '@/shared/api/client'

/**
 * Execute a tool call locally using the Zustand locations store.
 * This avoids any extra network request — data is already in memory.
 *
 * @param {string} name   - Tool name ('search_locations' or 'get_location_details')
 * @param {Object} args   - Parsed JSON arguments from the model
 * @param {Array} [locations=[]] - Available locations (will fetch from store if not provided)
 * @returns {Promise<Object>} - Tool result to send back to the model
 */
export async function executeTool(name, args, locations = []) {
    if (!locations?.length) {
        try {
            const { useLocationsStore } = await import('@/shared/store/useLocationsStore')
            locations = useLocationsStore.getState().locations
        } catch (e) {
            console.warn('[ai.tools] Failed to import useLocationsStore', e)
        }
    }

    if (name === 'search_locations') {
        const {
            city, cuisine_types, tags, price_range, category,
            amenities, best_for, dietary_options, min_rating, keyword, michelin, limit = 5
        } = args

        let results = [...locations]

        // City filter
        if (city) {
            const c = city.toLowerCase()
            results = results.filter(l =>
                l.city?.toLowerCase().includes(c) ||
                l.address?.toLowerCase().includes(c)
            )
        }
        // Category filter
        if (category) {
            results = results.filter(l => l.category?.toLowerCase() === category.toLowerCase())
        }
        // Cuisine filter — DB field is 'cuisine' (string), not 'cuisine_types' (array)
        if (cuisine_types?.length) {
            results = results.filter(l => {
                const locCuisine = l.cuisine?.toLowerCase() || ''
                const locTags = (l.tags || []).map(t => t.toLowerCase())
                return cuisine_types.some(c => {
                    const cl = c.toLowerCase()
                    return locCuisine.includes(cl) || locTags.some(t => t.includes(cl))
                })
            })
        }
        // Tags / vibe filter — DB fields: tags[], vibe[]
        if (tags?.length) {
            results = results.filter(l => {
                const locTags = [...(l.tags || []), ...(l.vibe || [])].map(t => t.toLowerCase())
                return tags.some(t => locTags.some(lt => lt.includes(t.toLowerCase())))
            })
        }
        // Price filter — DB field: price_level
        if (price_range?.length) {
            results = results.filter(l => price_range.includes(l.price_level))
        }
        // Rating filter — DB field: rating (not google_rating)
        if (min_rating) {
            results = results.filter(l => (l.rating ?? 0) >= min_rating)
        }
        // Amenities filter
        if (amenities?.length) {
            results = results.filter(l => {
                const locAmenities = (l.amenities ?? []).map(f => f.toLowerCase())
                return amenities.some(f => locAmenities.some(lf => lf.includes(f.toLowerCase())))
            })
        }
        // Best for filter
        if (best_for?.length) {
            results = results.filter(l => {
                const locBestFor = (l.best_for || []).map(b => b.toLowerCase())
                return best_for.some(b => locBestFor.some(lb => lb.includes(b.toLowerCase())))
            })
        }
        // Dietary filter — DB field: dietary
        if (dietary_options?.length) {
            results = results.filter(l => {
                const locDietary = (l.dietary || []).map(d => d.toLowerCase())
                return dietary_options.some(d => locDietary.some(ld => ld.includes(d.toLowerCase())))
            })
        }
        // Michelin filter
        if (michelin) {
            results = results.filter(l => l.michelin_stars > 0 || l.michelin_bib)
        }
        // Keyword: literal + semantic boost
        if (keyword) {
            const kw = keyword.toLowerCase()
            const literalMatches = results.filter(l =>
                l.title?.toLowerCase().includes(kw) ||
                l.description?.toLowerCase().includes(kw) ||
                l.tags?.some(t => t.toLowerCase().includes(kw)) ||
                l.vibe?.some(v => v.toLowerCase().includes(kw)) ||
                l.ai_keywords?.some(k => k.toLowerCase().includes(kw)) ||
                l.ai_context?.toLowerCase().includes(kw) ||
                l.insider_tip?.toLowerCase().includes(kw) ||
                l.what_to_try?.some(w => w.toLowerCase().includes(kw)) ||
                l.cuisine?.toLowerCase().includes(kw)
            )

            if (supabase) {
                try {
                    const semanticResults = await semanticSearch(keyword, limit * 2, null)
                    const semanticIds = new Set(semanticResults.map(r => r.id))
                    // Sort: semantic matches first, then by rating
                    results.sort((a, b) => {
                        const aS = semanticIds.has(a.id) ? 1 : 0
                        const bS = semanticIds.has(b.id) ? 1 : 0
                        if (aS !== bS) return bS - aS
                        return (b.rating ?? 0) - (a.rating ?? 0)
                    })
                } catch {
                    results = literalMatches
                    results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
                }
            } else {
                results = literalMatches
                results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
            }
        } else {
            // Default sort: by rating DESC
            results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        }

        results = results.slice(0, limit)

        // Return rich data so AI can give detailed answers
        return results.map(l => ({
            id: l.id,
            name: l.title,
            category: l.category,
            city: l.city,
            address: l.address,
            // Cuisine — primary field + tags fallback
            cuisine: l.cuisine || l.tags?.[0] || null,
            // Tags & vibe for atmosphere
            tags: l.tags ?? [],
            vibe: l.vibe ?? [],
            // Price & rating — correct field names
            price_level: l.price_level,
            rating: l.rating ?? null,
            // Rich content fields — AI uses these for recommendations
            description: l.description,
            insider_tip: l.insider_tip ?? null,
            what_to_try: l.what_to_try ?? [],
            best_for: l.best_for ?? [],
            special_labels: l.special_labels ?? [],
            // AI context for deeper understanding
            ai_context: l.ai_context ?? null,
            ai_keywords: l.ai_keywords?.slice(0, 10) ?? [],
            // KG enrichment — structured culinary data
            kg_cuisines:    l.kg_cuisines    ?? [],
            kg_dishes:      l.kg_dishes      ?? [],
            kg_ingredients: l.kg_ingredients ?? [],
            kg_allergens:   l.kg_allergens   ?? [],
            // Practical info
            opening_hours: l.opening_hours ?? null,
            amenities: l.amenities ?? [],
            dietary: l.dietary ?? [],
            michelin_stars: l.michelin_stars ?? 0,
            michelin_bib: l.michelin_bib ?? false,
        }))
    }

    if (name === 'get_location_details') {
        const { location_id } = args
        if (!location_id) return { error: 'location_id is required' }

        let loc = locations.find(l => l.id === location_id)

        // If not in store, try Supabase directly
        if (!loc && supabase) {
            try {
                const { data } = await supabase
                    .from('locations')
                    .select('*')
                    .eq('id', location_id)
                    .single()
                loc = data
            } catch (e) {
                console.warn('[ai.tools] get_location_details Supabase fallback failed:', e.message)
            }
        }

        if (!loc) return { error: `Location ${location_id} not found` }

        // Full detail — everything AI needs for a rich response
        return {
            id: loc.id,
            name: loc.title,
            category: loc.category,
            city: loc.city,
            address: loc.address,
            cuisine: loc.cuisine || null,
            tags: loc.tags ?? [],
            vibe: loc.vibe ?? [],
            price_level: loc.price_level,
            rating: loc.rating ?? null,
            description: loc.description,
            insider_tip: loc.insider_tip ?? null,
            what_to_try: loc.what_to_try ?? [],
            best_for: loc.best_for ?? [],
            special_labels: loc.special_labels ?? [],
            amenities: loc.amenities ?? [],
            dietary: loc.dietary ?? [],
            opening_hours: loc.opening_hours ?? null,
            phone: loc.phone ?? null,
            website: loc.website ?? null,
            booking_url: loc.booking_url ?? null,
            michelin_stars: loc.michelin_stars ?? 0,
            michelin_bib: loc.michelin_bib ?? false,
            ai_context: loc.ai_context ?? null,
            ai_keywords: loc.ai_keywords ?? [],
            // KG enrichment — full structured culinary data
            kg_cuisines:    loc.kg_cuisines    ?? [],
            kg_dishes:      loc.kg_dishes      ?? [],
            kg_ingredients: loc.kg_ingredients ?? [],
            kg_allergens:   loc.kg_allergens   ?? [],
        }
    }

    return { error: `Unknown tool: ${name}` }
}
