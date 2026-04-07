/**
 * Tool Executor for Function Calling
 *
 * Executes tool calls (search_locations, get_location_details) locally using
 * the Zustand locations store to avoid extra network requests.
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
            const { useLocationsStore } = await import('@/features/public/hooks/useLocationsStore')
            locations = useLocationsStore.getState().locations
        } catch (e) {
            console.warn('[ai.tools] Failed to dynamic import useLocationsStore', e)
        }
    }

    if (name === 'search_locations') {
        const {
            city, cuisine_types, tags, price_range, category,
            amenities, best_for, dietary_options, min_rating, keyword, michelin, limit = 5
        } = args

        let results = [...locations]

        if (city) {
            const c = city.toLowerCase()
            results = results.filter(l =>
                l.city?.toLowerCase().includes(c) ||
                l.address?.toLowerCase().includes(c)
            )
        }
        if (category) {
            results = results.filter(l => l.category?.toLowerCase() === category.toLowerCase())
        }
        if (cuisine_types?.length) {
            results = results.filter(l =>
                cuisine_types.some(c => l.cuisine_types?.some(ct => ct.toLowerCase().includes(c.toLowerCase())))
            )
        }
        if (tags?.length) {
            results = results.filter(l => {
                const locTags = Array.isArray(l.tags) ? l.tags : [l.tags]
                return tags.some(t =>
                    locTags.some(lt => lt?.toLowerCase().includes(t.toLowerCase()))
                )
            })
        }
        if (price_range?.length) {
            results = results.filter(l => price_range.includes(l.price_range))
        }
        if (min_rating) {
            results = results.filter(l => (l.google_rating ?? 0) >= min_rating)
        }
        if (amenities?.length) {
            results = results.filter(l => {
                const locAmenities = (l.amenities ?? []).map(f => f.toLowerCase())
                return amenities.some(f =>
                    locAmenities.some(lf => lf.includes(f.toLowerCase()))
                )
            })
        }
        if (best_for?.length) {
            results = results.filter(l => {
                const locBestFor = Array.isArray(l.best_for) ? l.best_for : []
                return best_for.some(b =>
                    locBestFor.some(lb => lb.toLowerCase().includes(b.toLowerCase()))
                )
            })
        }
        if (dietary_options?.length) {
            results = results.filter(l => {
                const locDietary = (l.dietary_options ?? []).map(d => d.toLowerCase())
                return dietary_options.some(d =>
                    locDietary.some(ld => ld.includes(d.toLowerCase()))
                )
            })
        }
        if (michelin) {
            results = results.filter(l => l.michelin_stars > 0 || l.michelin_bib)
        }
        if (keyword) {
            const kw = keyword.toLowerCase()
            // 1. Literal local search (includes AI keywords & context)
            const literalMatches = results.filter(l =>
                l.title?.toLowerCase().includes(kw) ||
                l.description?.toLowerCase().includes(kw) ||
                l.tags?.some(t => t.toLowerCase().includes(kw)) ||
                l.ai_keywords?.some(k => k.toLowerCase().includes(kw)) ||
                l.ai_context?.toLowerCase().includes(kw) ||
                l.insider_tip?.toLowerCase().includes(kw) ||
                l.must_try?.some(w => w.toLowerCase().includes(kw))
            )

            // 2. Semantic AI Search boost
            if (supabase) {
                try {
                    const semanticResults = await semanticSearch(keyword, limit * 2, null)
                    const semanticIds = new Set(semanticResults.map(r => r.id))

                    // We use ALL locations for semantic search, but keep only those that
                    // fit our other hard filters (city, cuisine, etc.)
                    // RESULTS here already contains locations filtered by city/cuisine/etc.

                    results.sort((a, b) => {
                        const aInSemantic = semanticIds.has(a.id) ? 1 : 0
                        const bInSemantic = semanticIds.has(b.id) ? 1 : 0

                        // Priority: 1. Semantic match, 2. Rating
                        if (aInSemantic !== bInSemantic) return bInSemantic - aInSemantic
                        return (b.google_rating ?? 0) - (a.google_rating ?? 0)
                    })
                } catch (err) {
                    console.warn('[ai.tools] Semantic search failed, using literal filter:', err)
                    results = literalMatches
                    results.sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0))
                }
            } else {
                results = literalMatches
                results.sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0))
            }
        } else {
            results.sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0))
        }

        results = results.slice(0, limit)

        return results.map(l => ({
            id: l.id,
            name: l.title,
            category: l.category,
            cuisine_types: l.cuisine_types ?? [],
            tags: l.tags ?? [],
            price_range: l.price_range,
            google_rating: l.google_rating,
            address: l.address,
            opening_hours: l.opening_hours,
            phone: l.phone ?? null,
            website: l.website ?? null,
            amenities: l.amenities ?? [],
            best_for: l.best_for ?? [],
            dietary_options: l.dietary_options ?? [],
            michelin_stars: l.michelin_stars ?? 0,
            michelin_bib: l.michelin_bib ?? false,
            description: l.description,
            // Expert data — included for AI context, NOT shown in raw UI
            insider_tip: l.insider_tip ?? null,
            must_try: l.must_try ?? [],
            ai_context: l.ai_context ?? null,
        }))
    }

    if (name === 'get_location_details') {
        const { location_id } = args
        const loc = locations.find(l => l.id === location_id)
        if (!loc) return { error: `Location ${location_id} not found` }
        return {
            id: loc.id,
            name: loc.title,
            category: loc.category,
            cuisine_types: loc.cuisine_types ?? [],
            tags: loc.tags ?? [],
            price_range: loc.price_range,
            google_rating: loc.google_rating,
            review_count: loc.review_count ?? 0,
            address: loc.address,
            opening_hours: loc.opening_hours ?? null,
            phone: loc.phone ?? null,
            website: loc.website ?? null,
            amenities: loc.amenities ?? [],
            dietary_options: loc.dietary_options ?? [],
            michelin_stars: loc.michelin_stars ?? 0,
            michelin_bib: loc.michelin_bib ?? false,
            description: loc.description,
            insider_tip: loc.insider_tip ?? null,
            must_try: loc.must_try ?? [],
            ai_context: loc.ai_context ?? null,
        }
    }

    return { error: `Unknown tool: ${name}` }
}
