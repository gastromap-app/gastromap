/**
 * Tool Executor for AI Function Calling
 *
 * Architecture (3-tier search):
 *
 *  1. SUPABASE QUERY  — primary source, always fresh data.
 *     Structured filters (price, rating, michelin, category) applied in SQL.
 *     Fetches a broad set, then refines client-side for text fields.
 *
 *  2. PGVECTOR SEMANTIC SEARCH — used for keyword/description queries.
 *     Converts keyword to an embedding and finds similar locations via cosine similarity.
 *
 *  3. IN-MEMORY FALLBACK — used when Supabase is unavailable.
 *     Filters the Zustand locations store using norm() for diacritics-safe matching.
 *
 * The LLM (via OpenRouter) handles all language understanding:
 *   user: "кафе у кракові" → model calls search_locations({ city: "Krakow", category: "Cafe" })
 *   user: "przytulna restauracja w Krakowie" → model calls search_locations({ city: "Krakow", tags: ["Cozy"] })
 *
 * We don't need to understand the user's language — the model does that.
 * Our job is to execute the structured search correctly against the DB.
 */

import { semanticSearch } from './search'
import { supabase } from '@/shared/api/client'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize a string for fuzzy comparison:
 * - Remove diacritics: é→e, ó→o, ą→a, ę→e, ś→s, ź→z, ü→u etc.
 * - Lowercase + trim
 *
 * Kraków → krakow  |  Wrocław → wroclaw  |  Poznań → poznan
 * Kraków matches "krakow" query from LLM ✓
 */
function norm(str) {
    if (!str) return ''
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** Check if a location's city matches a normalized city query. */
function cityMatch(loc, cityQuery) {
    const q = norm(cityQuery)
    return (
        norm(loc.city).includes(q) ||
        norm(loc.city_name).includes(q) ||
        norm(loc.address).includes(q) ||
        norm(loc.country).includes(q)
    )
}

/** Map a raw DB / store row to the rich format the AI understands. */
function mapLocation(l) {
    return {
        id:             l.id,
        name:           l.title,
        category:       l.category,
        city:           l.city,
        country:        l.country ?? null,
        address:        l.address,
        cuisine:        l.cuisine || l.tags?.[0] || null,
        tags:           l.tags ?? [],
        vibe:           l.vibe ?? [],
        price_level:    l.price_level,
        rating:         l.rating ?? null,
        description:    l.description,
        insider_tip:    l.insider_tip ?? null,
        what_to_try:    l.what_to_try ?? [],
        best_for:       l.best_for ?? [],
        special_labels: l.special_labels ?? [],
        ai_context:     l.ai_context ?? null,
        ai_keywords:    l.ai_keywords?.slice(0, 10) ?? [],
        kg_cuisines:    l.kg_cuisines    ?? [],
        kg_dishes:      l.kg_dishes      ?? [],
        kg_ingredients: l.kg_ingredients ?? [],
        kg_allergens:   l.kg_allergens   ?? [],
        kg_profile:     l.kg_profile     ?? null,
        opening_hours:  l.opening_hours ?? null,
        amenities:      l.amenities ?? [],
        dietary:        l.dietary ?? [],
        michelin_stars: l.michelin_stars ?? 0,
        michelin_bib:   l.michelin_bib ?? false,
    }
}

// ─── Tier 1: Supabase structured query ───────────────────────────────────────

/**
 * Query Supabase with structured filters.
 * Handles things SQL is great at: price ranges, ratings, boolean flags.
 * Text-based filters (city, cuisine) are applied client-side using norm()
 * so diacritics are handled correctly regardless of DB collation.
 *
 * Returns raw rows (for client-side post-filtering).
 */
async function querySupabase({ price_range, min_rating, michelin, fetchLimit = 200 }) {
    if (!supabase) return null

    try {
        let q = supabase
            .from('locations')
            .select('*')

        // SQL-safe filters (no text matching issues)
        if (price_range?.length) {
            q = q.in('price_level', price_range)
        }
        if (min_rating) {
            q = q.gte('rating', min_rating)
        }
        if (michelin) {
            q = q.or('michelin_stars.gt.0,michelin_bib.eq.true')
        }

        const { data, error } = await q
            .order('rating', { ascending: false, nullsFirst: false })
            .limit(fetchLimit)

        if (error) {
            console.warn('[ai.tools] Supabase query error:', error.message)
            return null
        }
        return data || []
    } catch (err) {
        console.warn('[ai.tools] Supabase query failed:', err.message)
        return null
    }
}

// ─── Tier 2: Client-side text filters (diacritics-safe) ──────────────────────

function applyTextFilters(locations, { city, category, cuisine_types, tags, amenities, best_for, dietary_options }) {
    let results = locations

    if (city) {
        results = results.filter(l => cityMatch(l, city))
    }
    if (category) {
        const cat = norm(category)
        results = results.filter(l => norm(l.category).includes(cat))
    }
    if (cuisine_types?.length) {
        results = results.filter(l => {
            const locCuisine = norm(l.cuisine)
            const locTags = [...(l.tags || []), ...(l.kg_cuisines || [])].map(norm)
            return cuisine_types.some(c => {
                const cl = norm(c)
                return locCuisine.includes(cl) || locTags.some(t => t.includes(cl))
            })
        })
    }
    if (tags?.length) {
        results = results.filter(l => {
            const locTags = [...(l.tags || []), ...(l.vibe || [])].map(norm)
            return tags.some(t => locTags.some(lt => lt.includes(norm(t))))
        })
    }
    if (amenities?.length) {
        results = results.filter(l => {
            const locAmenities = (l.amenities ?? []).map(norm)
            return amenities.some(f => locAmenities.some(lf => lf.includes(norm(f))))
        })
    }
    if (best_for?.length) {
        results = results.filter(l => {
            const locBestFor = (l.best_for || []).map(norm)
            return best_for.some(b => locBestFor.some(lb => lb.includes(norm(b))))
        })
    }
    if (dietary_options?.length) {
        results = results.filter(l => {
            const locDietary = (l.dietary || []).map(norm)
            return dietary_options.some(d => locDietary.some(ld => ld.includes(norm(d))))
        })
    }

    return results
}

// ─── Tier 3: Keyword search (pgvector semantic + literal fallback) ────────────

async function applyKeywordSearch(results, keyword, limit) {
    const kw = norm(keyword)

    // Helper: search inside all kg_profile array fields
    const kgProfileMatch = (l) => {
        const p = l.kg_profile
        if (!p) return false
        const arrays = ['cuisines','dishes','ingredients','allergens','flavor_profile',
            'atmosphere','dining_style','occasion_tags','price_context','diet_friendly',
            'search_phrases','what_makes_unique','best_dishes','local_context']
        return arrays.some(field =>
            Array.isArray(p[field]) && p[field].some(v => norm(v).includes(kw))
        )
    }

    // Literal text match (includes all kg_profile fields)
    const literalMatches = results.filter(l =>
        norm(l.title).includes(kw) ||
        norm(l.description).includes(kw) ||
        norm(l.ai_context).includes(kw) ||
        norm(l.insider_tip).includes(kw) ||
        norm(l.cuisine).includes(kw) ||
        l.tags?.some(t => norm(t).includes(kw)) ||
        l.vibe?.some(v => norm(v).includes(kw)) ||
        l.ai_keywords?.some(k => norm(k).includes(kw)) ||
        l.what_to_try?.some(w => norm(w).includes(kw)) ||
        l.kg_dishes?.some(d => norm(d).includes(kw)) ||
        kgProfileMatch(l)
    )

    // Semantic boost via pgvector (finds contextually related items even without exact match)
    try {
        const semanticResults = await semanticSearch(keyword, limit * 3, null)
        if (semanticResults?.length) {
            const semanticIds = new Set(semanticResults.map(r => r.id))
            // Union: literal matches + semantically similar locations not in literal set
            const semanticOnly = results.filter(l => semanticIds.has(l.id) && !literalMatches.find(m => m.id === l.id))
            const combined = [...literalMatches, ...semanticOnly]
            // Sort: semantic matches get a boost, then by rating
            combined.sort((a, b) => {
                const aS = semanticIds.has(a.id) ? 2 : 0
                const bS = semanticIds.has(b.id) ? 2 : 0
                const aL = literalMatches.find(m => m.id === a.id) ? 1 : 0
                const bL = literalMatches.find(m => m.id === b.id) ? 1 : 0
                return (bS + bL) - (aS + aL) || (b.rating ?? 0) - (a.rating ?? 0)
            })
            return combined
        }
    } catch {
        // pgvector not available or failed — use literal only
    }

    return literalMatches.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
}

// ─── Main executor ────────────────────────────────────────────────────────────

/**
 * Execute a tool call from the AI agent.
 *
 * @param {string} name   - 'search_locations' | 'get_location_details'
 * @param {Object} args   - Arguments extracted by the LLM
 * @param {Array}  [locations=[]] - Optional pre-loaded locations (passed by agent loop)
 */
export async function executeTool(name, args, locations = []) {

    // ── search_locations ────────────────────────────────────────────────────
    if (name === 'search_locations') {
        const {
            city, cuisine_types, tags, price_range, category,
            amenities, best_for, dietary_options, min_rating,
            keyword, michelin, limit = 5,
        } = args

        let pool = []

        // ── Tier 1: Supabase query (primary, always fresh) ──────────────────
        const dbRows = await querySupabase({ price_range, min_rating, michelin })
        if (dbRows?.length) {
            pool = dbRows
        } else {
            // ── Tier 3 Fallback: in-memory Zustand store ─────────────────────
            console.warn('[ai.tools] Supabase unavailable — using in-memory store')
            if (!locations?.length) {
                try {
                    const { useLocationsStore } = await import('@/shared/store/useLocationsStore')
                    locations = useLocationsStore.getState().locations
                } catch (e) {
                    console.warn('[ai.tools] Could not load store:', e.message)
                }
            }
            pool = [...(locations || [])]

            // Apply SQL-equivalent filters in memory when DB is unavailable
            if (price_range?.length) pool = pool.filter(l => price_range.includes(l.price_level))
            if (min_rating)          pool = pool.filter(l => (l.rating ?? 0) >= min_rating)
            if (michelin)            pool = pool.filter(l => l.michelin_stars > 0 || l.michelin_bib)
        }

        // ── Tier 2: Client-side text filters (diacritics-safe via norm()) ───
        pool = applyTextFilters(pool, { city, category, cuisine_types, tags, amenities, best_for, dietary_options })

        // ── Keyword: pgvector semantic + literal ─────────────────────────────
        if (keyword) {
            pool = await applyKeywordSearch(pool, keyword, limit)
        } else {
            pool.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        }

        const results = pool.slice(0, limit)

        if (!results.length) {
            // Return helpful empty result so LLM can respond gracefully
            return {
                found: 0,
                message: `No locations found matching the search criteria (city: ${city ?? 'any'}, category: ${category ?? 'any'}).`,
                results: [],
            }
        }

        return results.map(mapLocation)
    }

    // ── get_location_details ────────────────────────────────────────────────
    if (name === 'get_location_details') {
        const { location_id } = args
        if (!location_id) return { error: 'location_id is required' }

        // Try in-memory first (fastest, zero latency)
        let loc = locations.find(l => String(l.id) === String(location_id))

        // Fallback: Supabase direct query
        if (!loc && supabase) {
            try {
                const { data } = await supabase
                    .from('locations')
                    .select('*')
                    .eq('id', location_id)
                    .single()
                loc = data
            } catch (e) {
                console.warn('[ai.tools] get_location_details fallback failed:', e.message)
            }
        }

        // Fallback: Zustand store
        if (!loc) {
            try {
                const { useLocationsStore } = await import('@/shared/store/useLocationsStore')
                loc = useLocationsStore.getState().locations.find(l => String(l.id) === String(location_id))
            } catch { /* intentionally empty */ }
        }

        if (!loc) return { error: `Location ${location_id} not found` }

        return {
            ...mapLocation(loc),
            // Extra fields only in detail view
            phone:       loc.phone ?? null,
            website:     loc.website ?? null,
            booking_url: loc.booking_url ?? null,
        }
    }

    return { error: `Unknown tool: ${name}` }
}
