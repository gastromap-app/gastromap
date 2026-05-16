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
import { useUserPrefsStore } from '@/shared/store/useUserPrefsStore'
import { getAIContextForQuery } from '../knowledge-graph.api.js'
import { calculateDistance } from '@/lib/geo.js'
import { normalizeCityName } from '@/utils/normalizeCityName'

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
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    return calculateDistance(lat1, lon1, lat2, lon2, 'm')
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

/**
 * Build a flat AI-readable summary from a location's kg_profile (R15.1–R15.4).
 * Returns null when kg_profile is absent/empty so the field can be omitted.
 * Max 280 chars.
 */
function buildAiSummary(kgProfile) {
    if (!kgProfile || typeof kgProfile !== 'object') return null
    const parts = []
    if (kgProfile.atmosphere?.length) parts.push(`Atmosphere: ${kgProfile.atmosphere.slice(0, 3).join(', ')}`)
    if (kgProfile.best_dishes?.length) parts.push(`Try: ${kgProfile.best_dishes.slice(0, 4).join(', ')}`)
    if (kgProfile.occasion_tags?.length) parts.push(`Best for: ${kgProfile.occasion_tags.slice(0, 3).join(', ')}`)
    const summary = parts.join('; ')
    return summary ? summary.slice(0, 280) : null
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
        cuisine:        Array.isArray(l.cuisine_types) ? l.cuisine_types[0] : (typeof l.cuisine_types === 'string' ? l.cuisine_types : (Array.isArray(l.tags) ? l.tags[0] : null)),
        cuisine_types:  l.cuisine_types ?? [],
        tags:           l.tags ?? [],
        vibe:           vibes,
        price_range:    l.price_range,
        rating:         l.google_rating ?? l.rating ?? null,
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
        ai_summary:     buildAiSummary(l.kg_profile) ?? undefined,
        opening_hours:  l.opening_hours ?? null,
        amenities:      l.amenities ?? [],
        dietary:        l.dietary_options ?? l.dietary ?? [],
        michelin_stars: l.michelin_stars ?? 0,
        michelin_bib:   l.michelin_bib ?? false,
        distance:       l.distance_meters ?? null,
        created_at:     l.created_at ?? null,
    }
}

/**
 * Get current user preferences for personalization.
 */
function getUserPreferences() {
    try {
        return useUserPrefsStore.getState().prefs
    } catch {
        return null
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
async function _buildLocationQuery(selectColumns = '*') {
    return supabase.from('locations').select(selectColumns).eq('status', 'approved')
}

async function _applyFilters(query, { city, category, cuisine, price_range, min_rating, michelin }) {
    if (price_range?.length) query = query.in('price_range', price_range)
    if (min_rating) query = query.gte('google_rating', min_rating)
    if (michelin) query = query.or('michelin_stars.gt.0,michelin_bib.eq.true')
    if (city) {
        const cityPattern = city.replace(/[óòôõö]/g, '_').replace(/[aáàâãä]/g, '_')
        query = query.ilike('city', `%${cityPattern}%`)
    }
    if (category) query = query.ilike('category', `%${category}%`)
    if (cuisine) query = query.or(`cuisine.ilike.%${cuisine}%,kg_cuisines.cs.{${cuisine}}`)
    return query
}

async function querySupabase({ city, category, cuisine, price_range, min_rating, michelin, sort_by, fetchLimit = 200 }) {
    if (!supabase) return null

    try {
        console.log(`[ai.tools] Tier 1: Querying Supabase...`, { city, category })

        // Try with vibes join first; fall back to plain select if schema isn't ready
        let query = await _buildLocationQuery('*, vibes:location_vibes(vibe:vibes(name))')
        query = await _applyFilters(query, { city, category, cuisine, price_range, min_rating, michelin })

        let { data, error } = await query
            .order(sort_by === 'newest' ? 'created_at' : 'google_rating', { ascending: false, nullsFirst: false })
            .limit(fetchLimit)

        if (error) {
            console.warn('[ai.tools] Vibes join failed, falling back to plain select:', error.message)
            query = await _buildLocationQuery('*')
            query = await _applyFilters(query, { city, category, cuisine, price_range, min_rating, michelin })
            const fallback = await query
                .order(sort_by === 'newest' ? 'created_at' : 'google_rating', { ascending: false, nullsFirst: false })
                .limit(fetchLimit)
            data = fallback.data
            error = fallback.error
        }

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

async function applyKeywordSearch(results, keyword, limit, { city, category, sort_by } = {}) {
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
                
                if (sort_by === 'newest') {
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
                }
                
                return (bS + bL) - (aS + aL) || (b.google_rating ?? b.rating ?? 0) - (a.google_rating ?? a.rating ?? 0)
            })
            return combined
        }
    } catch {
        // pgvector not available or failed — use literal only
    }

    if (sort_by === 'newest') {
        return literalMatches.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    }
    return literalMatches.sort((a, b) => (b.google_rating ?? b.rating ?? 0) - (a.google_rating ?? a.rating ?? 0))
}

// ─── Main executor ────────────────────────────────────────────────────────────

/**
 * Execute a tool call from the AI agent.
 *
 * @param {string} name - One of: search_locations | search_nearby | get_location_details | compare_locations | ask_clarification
 * @param {Object} args - Arguments extracted by the LLM
 * @param {Object|Array} [ctx] - Execution context: { locations, geo, userId }.
 *                               For backwards compatibility, an array is treated as ctx.locations.
 */
export async function executeTool(name, args, ctx = {}) {
    // Backwards-compat: callers used to pass `locations` array as 3rd arg.
    if (Array.isArray(ctx)) ctx = { locations: ctx }
    const { locations = [], geo = null, userId = null } = ctx || {}
    void userId // reserved for per-user personalization hooks

    // ── search_locations ────────────────────────────────────────────────────
    if (name === 'search_locations') {
        let {
            city, cuisine_types, tags, price_range, category,
            amenities, best_for, dietary_options, min_rating,
            keyword, michelin, limit = 5, sort_by,
        } = args

        // Normalize city name: "Краков"/"Кракове"/"Kraków" → "Krakow"
        if (city) {
            city = normalizeCityName(city) || city
        }

        console.log(`[ai.tools] 🔎 Executing search_locations:`, {
            city, category, keyword,
            price_range, min_rating, sort_by
        })

        // ── Case A: Keyword/Semantic Search (Hybrid-first) ──────────────────
        let pool = []

        // Personalization: Merge user preferences if not explicitly overridden by search
        const userPrefs = getUserPreferences()
        
        // Use full preference arrays for better personalization
        const effectiveCuisines = (cuisine_types?.length) ? cuisine_types : (userPrefs?.favoriteCuisines || [])
        const effectivePrices = (price_range?.length) ? price_range : (userPrefs?.priceRange || [])
        
        // Dietary soft filter (R11.4) — from context if available
        const dietaryFromCtx = ctx?.dietary || []
        const effectiveDietary = (dietary_options?.length) ? dietary_options : dietaryFromCtx

        // Atmosphere and features as additional context (if applicable)
        const _preferredAtmosphere = userPrefs?.atmospherePreference || null
        const _preferredFeatures = userPrefs?.features || []


        if (keyword) {
            // Call semanticSearch (Hybrid RPC) which handles city/category/cuisine server-side.
            // Geo-aware queries must go through search_nearby instead; this path is filter-only.
            const semanticResults = await semanticSearch(keyword, limit * 5, null, {
                city,
                category,
                cuisine: effectiveCuisines?.[0], // RPC currently takes one, but we'll use the primary one
                price_range: effectivePrices?.[0],
            })


            if (semanticResults?.length) {
                // Hydrate semantic results with full data from the store to ensure
                // the AI has access to all metadata (kg_profile, insider_tips, etc.)
                let activeLocations = locations

                pool = semanticResults.map(sr => {
                    const full = activeLocations.find(l => l.id === sr.id)
                    return full ? { ...full, rrf_score: sr.rrf_score } : sr
                })

                // Apply remaining structured filters that RPC doesn't handle
                if (price_range?.length) pool = pool.filter(l => price_range.includes(l.price_range))
                if (min_rating)          pool = pool.filter(l => (l.google_rating ?? l.rating ?? 0) >= min_rating)
                if (michelin)            pool = pool.filter(l => l.michelin_stars > 0 || l.michelin_bib)

                // Apply advanced text filters (amenities, dietary, etc.)
                pool = applyTextFilters(pool, { amenities, best_for, dietary_options: effectiveDietary, tags, cuisine_types })
            }
        }

        // ── Case B: Structured Browse (if no keyword OR if hybrid failed/empty) ──
        if (!pool.length) {
            // Tier 1: Supabase query (primary, always fresh)
            const dbRows = await querySupabase({
                city,
                category,
                cuisine: effectiveCuisines?.[0], 
                price_range: effectivePrices,
                min_rating,
                michelin,
                sort_by,
            })

            if (dbRows?.length) {
                pool = dbRows
            } else {
                // Tier 3 Fallback: in-memory Zustand store
                let activeLocations = locations
                pool = [...(activeLocations || [])]

                // Apply SQL-equivalent filters in memory when DB is unavailable
                if (price_range?.length) pool = pool.filter(l => price_range.includes(l.price_range))
                if (min_rating)          pool = pool.filter(l => (l.google_rating ?? l.rating ?? 0) >= min_rating)
                if (michelin)            pool = pool.filter(l => l.michelin_stars > 0 || l.michelin_bib)
            }

            // Tier 2: Client-side text filters (diacritics-safe via norm())
            pool = applyTextFilters(pool, { city, category, cuisine_types, tags, amenities, best_for, dietary_options: effectiveDietary })

            // If keyword exists but hybrid failed, do a literal fallback
            if (keyword) {
                pool = await applyKeywordSearch(pool, keyword, limit, { city, category, sort_by })
            } else {
                pool.sort((a, b) => {
                    if (sort_by === 'newest') {
                        return new Date(b.created_at || 0) - new Date(a.created_at || 0)
                    }
                    return (b.google_rating ?? b.rating ?? 0) - (a.google_rating ?? a.rating ?? 0)
                })
            }
        }

        // --- KG ENHANCEMENT (TDD) ---
        // Fetch culinary context in parallel to avoid adding latency.
        // We use the most descriptive field available as the query for KG.
        const kgSearchQuery = keyword || category || (cuisine_types && cuisine_types[0]) || city || ''
        const kgContextPromise = getAIContextForQuery(kgSearchQuery).catch(err => {
            console.warn('[ai.tools] KG context fetch failed:', err.message)
            return null
        })

        const [poolResults, culinaryContext] = await Promise.all([
            Promise.resolve(pool),
            kgContextPromise
        ])

        const results = poolResults.slice(0, limit).map(mapLocation)
        
        console.log(`[ai.tools] ✅ Search complete. Found ${pool.length} matches, returning top ${results.length}. KG Context: ${culinaryContext ? 'Yes' : 'No'}`)

        // Persist shown locations to session_locations (R3.1)
        if (ctx?.sessionId && ctx?.userId && results.length) {
            import('./session-locations.js').then(({ recordSessionLocations }) => {
                recordSessionLocations(ctx.sessionId, results, ctx.userId).catch(() => {})
            }).catch(() => {})
        }

        // Return object format for better extensibility
        return {
            results,
            culinaryContext,
            userPreferences: userPrefs, // Providing full context to the AI for aware personalization
            found: pool.length,
            message: results.length ? null : `No locations found matching the search criteria.`
        }

    }

    // ── search_nearby ───────────────────────────────────────────────────────
    if (name === 'search_nearby') {
        const { radius_m = 1500, category, cuisine, price_max, limit = 5 } = args

        // Hard requirement: live geolocation. Signal the control layer to prompt the user.
        if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') {
            return {
                needs_geo: true,
                message: 'Geolocation is required to answer "near me" queries. The UI will prompt the user to grant location access.',
            }
        }

        const clampedRadius = Math.max(200, Math.min(20000, Number(radius_m) || 1500))
        const clampedLimit = Math.max(1, Math.min(10, Number(limit) || 5))

        console.log('[ai.tools] 📍 Executing search_nearby:', { geo, radius_m: clampedRadius, category, cuisine, price_max, limit: clampedLimit })

        // Try the PostGIS RPC first (fast, server-side ST_DWithin).
        let rpcRows = null
        if (supabase) {
            try {
                const { data, error } = await supabase.rpc('search_locations_nearby', {
                    p_lat:       geo.lat,
                    p_lng:       geo.lng,
                    p_radius_m:  clampedRadius,
                    p_category:  category ?? null,
                    p_cuisine:   cuisine ?? null,
                    p_price_max: price_max ?? null,
                    p_limit:     clampedLimit,
                })
                if (error) {
                    console.warn('[ai.tools] search_locations_nearby RPC error:', error.message)
                } else {
                    rpcRows = data
                }
            } catch (err) {
                console.warn('[ai.tools] search_locations_nearby RPC failed:', err.message)
            }
        }

        if (rpcRows?.length) {
            // Hydrate with full store rows when available for richer LLM context.
            let activeLocations = locations
            const hydrated = rpcRows.map(row => {
                const full = activeLocations.find(l => l.id === row.id)
                return full
                    ? { ...full, distance_meters: row.distance_m }
                    : { ...row, distance_meters: row.distance_m }
            })
            return hydrated.map(mapLocation)
        }

        // JS Haversine fallback — needed until the migration runs against the DB.
        let activeLocations = locations

        let pool = (activeLocations || []).filter(l => {
            const lat = l.lat ?? l.latitude
            const lng = l.lng ?? l.longitude
            if (lat == null || lng == null) return false
            const dist = calculateDistanceMeters(geo.lat, geo.lng, lat, lng)
            if (dist > clampedRadius) return false
            l.distance_meters = dist
            return true
        })

        if (category) {
            const cat = norm(category)
            pool = pool.filter(l => norm(l.category).includes(cat))
        }
        if (cuisine) {
            const cu = norm(cuisine)
            pool = pool.filter(l =>
                norm(l.cuisine).includes(cu) ||
                (l.cuisine_types || []).some(c => norm(c).includes(cu)) ||
                (l.kg_cuisines || []).some(c => norm(c).includes(cu))
            )
        }
        if (price_max) {
            const rank = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 }
            const cap = rank[price_max] || 4
            pool = pool.filter(l => (rank[l.price_range] || 0) <= cap)
        }

        pool.sort((a, b) => (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity))
        const poolResults = pool.slice(0, clampedLimit)

        // --- KG ENHANCEMENT (TDD) ---
        const kgSearchQuery = cuisine || category || ''
        const culinaryContext = kgSearchQuery ? await getAIContextForQuery(kgSearchQuery).catch(() => null) : null

        const results = poolResults.map(mapLocation)

        console.log(`[ai.tools] ✅ Nearby search complete. Found ${pool.length} matches. KG Context: ${culinaryContext ? 'Yes' : 'No'}`)

        // Persist shown locations to session_locations (R3.1)
        if (ctx?.sessionId && ctx?.userId && results.length) {
            import('./session-locations.js').then(({ recordSessionLocations }) => {
                recordSessionLocations(ctx.sessionId, results, ctx.userId).catch(() => {})
            }).catch(() => {})
        }

        return {
            results,
            culinaryContext,
            found: pool.length,
            message: results.length ? null : `No places within ${clampedRadius}m match the criteria.`
        }
    }

    // ── get_location_details ────────────────────────────────────────────────
    if (name === 'get_location_details') {
        const { location_id } = args
        if (!location_id) return { error: 'location_id is required' }

        let loc = locations.find(l => String(l.id) === String(location_id))

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

        if (!loc) return { error: `Location ${location_id} not found` }

        // Persist shown location to session_locations (R3.1)
        if (ctx?.sessionId && ctx?.userId) {
            import('./session-locations.js').then(({ recordSessionLocations }) => {
                recordSessionLocations(ctx.sessionId, [{ id: loc.id }], ctx.userId).catch(() => {})
            }).catch(() => {})
        }

        return {
            ...mapLocation(loc),
            phone:       loc.phone ?? null,
            website:     loc.website ?? null,
            booking_url: loc.booking_url ?? null,
        }
    }

    // ── compare_locations ──────────────────────────────────────────────────
    // Fetches the full rich profile for 2-4 locations so the LLM can author a
    // side-by-side answer. Phase 3.3 will layer structured comparison dimensions
    // on top of this, but the raw data path is ready now.
    if (name === 'compare_locations') {
        const ids = Array.isArray(args.location_ids) ? args.location_ids.slice(0, 4) : []
        if (ids.length < 2) {
            return { error: 'compare_locations requires at least 2 location_ids' }
        }

        const dimensions = Array.isArray(args.dimensions) ? args.dimensions : []

        // Batch fetch from Supabase (R12.1)
        let dbItems = []
        if (supabase) {
            try {
                const { data } = await supabase.from('locations').select('*').in('id', ids)
                dbItems = data || []
            } catch { dbItems = [] }
        }

        // Also check in-memory locations for any not found in DB
        const dbIds = new Set(dbItems.map(d => String(d.id)))
        const fromMemory = locations.filter(l => ids.includes(String(l.id)) && !dbIds.has(String(l.id)))
        const allFound = [...dbItems, ...fromMemory]

        // Resolve missing against session_locations (R3.4)
        const foundIds = new Set(allFound.map(l => String(l.id)))
        const notFound = ids.filter(id => !foundIds.has(id))

        // Preserve input order (R12.4)
        const items = ids
            .map(id => allFound.find(l => String(l.id) === id))
            .filter(Boolean)
            .map(mapLocation)

        if (items.length < 2) {
            return {
                error: 'Could not find enough locations to compare',
                requested: ids,
                found: items.length,
                not_found: notFound,
            }
        }

        // Persist shown IDs into session_locations (R3.1)
        if (ctx?.sessionId && ctx?.userId && items.length) {
            import('./session-locations.js').then(({ recordSessionLocations }) => {
                recordSessionLocations(ctx.sessionId, items, ctx.userId).catch(() => {})
            }).catch(() => {})
        }

        return {
            compared: items.length,
            dimensions,
            items,
            not_found: notFound,
        }
    }

    // ── ask_clarification ──────────────────────────────────────────────────
    // Short-circuit tool: the agent loop will surface this back to the user
    // and stop generating further tool calls for this turn.
    if (name === 'ask_clarification') {
        return {
            ask_clarification: true,
            question: args.question || '',
            suggestions: Array.isArray(args.suggestions) ? args.suggestions.slice(0, 4) : [],
        }
    }

    return { error: `Unknown tool: ${name}` }
}
