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

import { semanticSearch } from './search.js'
import { supabase } from '../client.js'

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
    return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** Calculate distance in meters between two points using Haversine formula. */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
}

/** Check if a location's city matches a normalized city query. */
function cityMatch(loc, cityQuery) {
    const q = norm(cityQuery)
    if (!q) return true
    
    const fields = [loc.city, loc.city_name, loc.address, loc.country].filter(Boolean).map(norm)
    const matched = fields.some(f => f.includes(q))
    
    /* 
    if (!matched && fields.length > 0) {
        // Log mismatch once to help debug (commented out for production-like feel)
        // console.log(`[ai.tools] cityMatch MISMATCH: query="${q}" vs fields=[${fields.join(', ')}] for "${loc.title}"`)
    }
    */
    
    return matched
}

/** Map a raw DB / store row to the rich format the AI understands. */
function mapLocation(l) {
    // Handle vibes join result: vibes: [{ vibe: { name: 'Cozy' } }] -> ['Cozy']
    const vibes = Array.isArray(l.vibes) 
        ? l.vibes.map(v => v.vibe?.name).filter(Boolean)
        : (Array.isArray(l.vibe) ? l.vibe : [])

    return {
        id:             l.id,
        name:           l.title,     // for internal AI logic
        title:          l.title,     // for UI consistency
        image:          l.image_url, // for UI cards
        category:       l.category,
        city:           l.city,
        country:        l.country ?? null,
        address:        l.address,
        cuisine:        l.cuisine_types?.[0] || l.tags?.[0] || null,
        cuisine_types:  l.cuisine_types ?? [],
        tags:           l.tags ?? [],
        vibe:           vibes,
        price_range:    l.price_range,
        rating:         l.google_rating ?? null,
        google_rating:  l.google_rating ?? null,
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
        dietary:        l.dietary_options ?? l.dietary ?? [],
        michelin_stars: l.michelin_stars ?? 0,
        michelin_bib:   l.michelin_bib ?? false,
        distance:       l.distance_meters ?? null,
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
async function querySupabase({ city, category, price_range, min_rating, michelin, fetchLimit = 200, lat, lng }) {
    if (!supabase) return null

    try {
        console.log(`[ai.tools] Tier 1: Querying Supabase...`, { city, category, hasLatLng: !!lat })
        
        let query = supabase
            .from('locations')
            .select('*, vibes:location_vibes(vibe:vibes(name))')
            .eq('status', 'approved')

        // SQL-safe filters
        if (price_range?.length) {
            // In DB it is called price_range
            query = query.in('price_range', price_range)
        }
        if (min_rating) {
            // In DB it is called google_rating
            query = query.gte('google_rating', min_rating)
        }
        if (michelin) {
            query = query.or('michelin_stars.gt.0,michelin_bib.eq.true')
        }

        // ADDED: SQL-side city and category filtering for efficiency
        if (city) {
            // Flexible matching for cities (e.g. Krakow vs Kraków)
            const cityPattern = city.replace(/[óòôõö]/g, '_').replace(/[aáàâãä]/g, '_')
            query = query.ilike('city', `%${cityPattern}%`)
        }
        if (category) {
            query = query.ilike('category', `%${category}%`)
        }

        const { data, error } = await query
            .order('google_rating', { ascending: false, nullsFirst: false })
            .limit(fetchLimit)

        if (error) {
            console.warn('[ai.tools] Supabase query error:', error.message)
            return null
        }
        
        // console.log(`[ai.tools] Tier 1: Fetched ${data?.length || 0} rows`)
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
        const countBefore = results.length
        results = results.filter(l => cityMatch(l, city))
        // console.log(`[ai.tools] applyTextFilters (city: ${city}): ${countBefore} -> ${results.length}`)
    }
    if (category) {
        const countBefore = results.length
        const cat = norm(category)
        results = results.filter(l => norm(l.category).includes(cat))
        // console.log(`[ai.tools] applyTextFilters (category: ${category}): ${countBefore} -> ${results.length}`)
    }
    if (cuisine_types?.length) {
        results = results.filter(l => {
            const locCuisines = (l.cuisine_types || []).map(norm)
            const locTags = [...(l.tags || []), ...(l.kg_cuisines || [])].map(norm)
            return cuisine_types.some(c => {
                const cl = norm(c)
                return locCuisines.some(lc => lc.includes(cl)) || locTags.some(t => t.includes(cl))
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

async function applyKeywordSearch(results, keyword, limit, { city, category } = {}) {
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
        (l.cuisine_types || []).some(c => norm(c).includes(kw)) ||
        l.tags?.some(t => norm(t).includes(kw)) ||
        l.vibe?.some(v => norm(v).includes(kw)) ||
        l.ai_keywords?.some(k => norm(k).includes(kw)) ||
        l.what_to_try?.some(w => norm(w).includes(kw)) ||
        l.kg_dishes?.some(d => norm(d).includes(kw)) ||
        kgProfileMatch(l)
    )

    // Semantic boost via pgvector (finds contextually related items even without exact match)
    try {
        const semanticResults = await semanticSearch(keyword, limit * 3, null, { city, category })
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

    return literalMatches.sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0))
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

        console.log(`[ai.tools] 🔎 Executing search_locations:`, { 
            city, category, keyword, 
            lat: args.lat, lng: args.lng, radius: args.radius,
            price_range, min_rating 
        })

        // ── Case A: Keyword/Semantic Search (Hybrid-first) ──────────────────
        let pool = []
        if (keyword) {
            // Call semanticSearch (Hybrid RPC) which handles city/category/geo server-side
            const semanticResults = await semanticSearch(keyword, limit * 5, null, { 
                city, 
                category,
                lat: args.lat,
                lng: args.lng,
                radius: args.radius
            })
            
            if (semanticResults?.length) {
                // Hydrate semantic results with full data from the store to ensure 
                // the AI has access to all metadata (kg_profile, insider_tips, etc.)
                let activeLocations = locations
                if (!activeLocations?.length) {
                    try {
                        const { useLocationsStore } = await import('@/shared/store/useLocationsStore')
                        activeLocations = useLocationsStore.getState().locations
                    } catch { activeLocations = [] }
                }

                pool = semanticResults.map(sr => {
                    const full = activeLocations.find(l => l.id === sr.id)
                    // If we found the full record in the store, use it. 
                    // Otherwise fall back to the RPC result fields.
                    return full ? { ...full, rrf_score: sr.rrf_score } : sr
                })
                
                // Apply remaining structured filters that RPC doesn't handle
                if (price_range?.length) pool = pool.filter(l => price_range.includes(l.price_range))
                if (min_rating)          pool = pool.filter(l => (l.google_rating ?? 0) >= min_rating)
                if (michelin)            pool = pool.filter(l => l.michelin_stars > 0 || l.michelin_bib)
                
                // Apply advanced text filters (amenities, dietary, etc.)
                pool = applyTextFilters(pool, { amenities, best_for, dietary_options, tags, cuisine_types })
            }
        }

        // ── Case B: Structured Browse (if no keyword OR if hybrid failed/empty) ──
        if (!pool.length) {
            // Tier 1: Supabase query (primary, always fresh)
            const dbRows = await querySupabase({ 
                city, 
                category, 
                price_range, 
                min_rating, 
                michelin,
                lat: args.lat,
                lng: args.lng
            })
            if (dbRows?.length) {
                pool = dbRows
            } else {
                // Tier 3 Fallback: in-memory Zustand store
                // console.log('[ai.tools] No DB results or DB error — using in-memory fallback')
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
                if (price_range?.length) pool = pool.filter(l => price_range.includes(l.price_range))
                if (min_rating)          pool = pool.filter(l => (l.google_rating ?? 0) >= min_rating)
                if (michelin)            pool = pool.filter(l => l.michelin_stars > 0 || l.michelin_bib)
            }

            // Tier 2: Client-side text filters (diacritics-safe via norm())
            pool = applyTextFilters(pool, { city, category, cuisine_types, tags, amenities, best_for, dietary_options })
            
            // Tier 2.5: Geolocation filtering (if coordinates provided)
            if (args.lat && args.lng) {
                const radius = args.radius || 5000 // 5km default
                const countBefore = pool.length
                pool = pool.filter(l => {
                    // Try different lat/lng field names from DB
                    const lat = l.lat ?? l.latitude
                    const lng = l.lng ?? l.longitude
                    if (!lat || !lng) return false
                    const dist = calculateDistance(args.lat, args.lng, lat, lng)
                    l.distance_meters = dist // Store for AI context
                    return dist <= radius
                })
                // console.log(`[ai.tools] Geo-filter (${radius}m): ${countBefore} -> ${pool.length}`)
            }
            
            // If keyword exists but hybrid failed, do a literal fallback
            if (keyword) {
                pool = await applyKeywordSearch(pool, keyword, limit, { city, category })
            } else {
                pool.sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0))
            }
        }

        const results = pool.slice(0, limit)
        console.log(`[ai.tools] ✅ Search complete. Found ${pool.length} matches, returning top ${results.length}.`)

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
