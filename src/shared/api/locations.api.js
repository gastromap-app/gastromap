/**
 * Locations API — Supabase backend with auto-translation.
 *
 * Uses Supabase when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set,
 * otherwise falls back to mock data so development works offline.
 * 
 * Auto-translation: When creating/updating locations, data is automatically
 * translated to all supported languages (EN, PL, UK, RU).
 */

import { MOCK_LOCATIONS, MOCK_CATEGORIES } from '@/mocks/locations'
import { supabase, ApiError } from './client'
import { config } from '@/shared/config/env'
import { 
    processLocationTranslations, 
    saveTranslations,
    getTranslations 
} from './translation.api'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
import { getActiveAIConfig } from './ai-config.api'

const USE_SUPABASE = config.supabase.isConfigured

// ─── Shape normaliser ──────────────────────────────────────────────────────
// Exposes BOTH API-canonical names (title, priceLevel, openingHours …)
// AND admin-form aliases (name, price_range, opening_hours, image_url, …)
// so neither the public Explore page nor AdminLocationsPage needs a remap.
function normalise(row) {
    if (!row) return null;
    
    const lat = Number(row.lat ?? 0)
    const lng = Number(row.lng ?? 0)
    
    return {
        id: row.id,
        // Canonical name is title
        title: row.title ?? '',
        // UI-legacy fallback (can be phased out)
        name: row.title ?? '',

        // Textual
        description: row.description ?? '',
        address: row.address ?? '',
        city: row.city ?? '',
        country: row.country ?? '',

        // Coordinates (flat as well as nested for different UI components)
        coordinates: { lat, lng },
        lat,
        lng,

        // Canonical category
        category: row.category ?? 'other',
        // UI-legacy fallback
        type: row.category ?? 'other',
        
        cuisine: row.cuisine_types?.[0] ?? '', // Taking first from array
        cuisine_types: row.cuisine_types ?? [],

        // Media
        image: row.image_url ?? '',
        image_url: row.image_url ?? '',
        photos: row.google_photos ?? [],
        images: row.google_photos ?? [],

        // Core stats
        rating: Number(row.google_rating ?? 0),
        google_rating: Number(row.google_rating ?? 0),
        google_user_ratings_total: row.google_user_ratings_total ?? 0,
        
        price_level: row.price_range ?? '$$',
        priceLevel: row.price_range ?? '$$', 
        price_range: row.price_range ?? '$$',

        // Operational
        opening_hours: row.opening_hours ?? '',
        openingHours: row.opening_hours ?? '',
        booking_url: row.booking_url ?? '',
        website: row.website ?? '',
        phone: row.phone ?? '',

        // Arrays
        tags: row.tags ?? [],
        special_labels: row.special_labels ?? [],
        vibe: row.vibe ?? [], // Note: vibe is not in schema directly, might be part of tags or tags in code is vibe?
        features: row.amenities ?? [],
        amenities: row.amenities ?? [],
        best_for: row.best_for ?? [],
        dietary: row.dietary_options ?? [],
        dietary_options: row.dietary_options ?? [],

        // Booleans
        has_wifi: !!row.wifi_quality && row.wifi_quality !== 'none',
        has_outdoor_seating: row.outdoor_seating ?? false,
        reservations_required: row.reservation_required ?? false,

        // Expert notes
        insider_tip: row.insider_tip ?? '',
        what_to_try: typeof row.must_try === 'string' ? row.must_try.split(',').map(s => s.trim()).filter(Boolean) : (row.must_try ?? []),
        must_try: typeof row.must_try === 'string' ? row.must_try.split(',').map(s => s.trim()).filter(Boolean) : (row.must_try ?? []),

        // AI Metadata
        ai_keywords: row.ai_keywords ?? [],
        ai_context: row.ai_context ?? '',
        embedding: row.embedding ?? null,
        
        // Enrichment Status
        ai_enrichment_status: row.ai_enrichment_status ?? 'pending',
        ai_enrichment_error: row.ai_enrichment_error ?? null,
        ai_enrichment_last_attempt: row.ai_enrichment_last_attempt ?? null,

        // Meta
        status: row.status ?? 'pending',
        createdAt: row.created_at ?? '',
        updatedAt: row.updated_at ?? '',
    }
}


// ─── Read ──────────────────────────────────────────────────────────────────

export async function getLocations(filters = {}) {
    if (!USE_SUPABASE) return _mockGetLocations(filters)

    const { 
        category, query, priceLevel, minRating, vibe, city, country, status, 
        all = false, showAll = false, 
        limit = 100, offset = 0 
    } = filters

    const bypassStatus = all || showAll

    let q = supabase
        .from('locations')
        .select('*', { count: 'exact' })
        .order('google_rating', { ascending: false })
        .range(offset, offset + (limit - 1))

    // Admin can pass all=true or showAll=true to bypass status filter, or status='pending' etc.
    if (!bypassStatus) {
        q = q.eq('status', status ?? 'approved')
    } else if (status) {
        // bypass requested + explicit status = filter by that specific status
        q = q.eq('status', status)
    }
    // bypass requested + no status = return everything regardless of status

    if (category && category !== 'All') q = q.eq('category', category)
    if (city)    q = q.ilike('city', city)
    if (country) q = q.ilike('country', country)
    if (minRating != null) q = q.gte('google_rating', minRating)
    if (priceLevel?.length) q = q.in('price_range', priceLevel)
    if (vibe?.length) q = q.overlaps('tags', vibe) // vibe maps to tags if not separate column

    // Search by title or city if query exists
    if (query) {
        q = q.or(`title.ilike.%${query}%,city.ilike.%${query}%`)
    }

    const { data, error, count } = await q

    if (error) {
        console.warn('[locations.api] Supabase query failed, using mocks:', error.message)
        return _mockGetLocations(filters)
    }

    return {
        data: (data ?? []).map(normalise),
        total: count ?? 0,
        hasMore: offset + limit < (count ?? 0),
    }
}

export async function getLocation(id, { adminMode = false } = {}) {
    if (!USE_SUPABASE) return _mockGetLocation(id)

    let q = supabase
        .from('locations')
        .select('*')
        .eq('id', id)

    // Public facing: only show active (approved) locations. Admin mode: show any status.
    if (!adminMode) {
        q = q.eq('status', 'approved')
    }

    const { data, error } = await q.single()

    if (error) {
        console.warn('[locations.api] Supabase query failed, using mocks:', error.message)
        return _mockGetLocation(id)
    }

    return normalise(data)
}

// ─── Create with Auto-Translation ──────────────────────────────────────────

/**
 * Enrich location with AI data:
 * 1. Generates ai_keywords based on location data
 * 2. Generates ai_context (brief expert summary)
 * 3. Generates vector embedding for semantic search
 */
async function enrichLocationWithAI(locationData) {
    const appCfg = useAppConfigStore.getState()
    const apiKey = appCfg.aiApiKey || config.ai.openRouterKey

    if (!apiKey) {
        console.warn('[locations.api] AI enrichment skipped: No API key found')
        return locationData
    }

    try {
        // Collect text for analysis
        const textForAI = [
            locationData.title,
            locationData.description,
            locationData.address,
            locationData.city,
            locationData.cuisine,
            locationData.category,
            ...(locationData.tags || []),
            ...(locationData.vibe || []),
            ...(locationData.best_for || []),
            locationData.insider_tip,
        ].filter(Boolean).join(', ')

        // Set attempt timestamp
        locationData.ai_enrichment_last_attempt = new Date().toISOString()

        // 1. Generate search keywords (using Step 3.5 Flash Free)
        const keywordResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://gastromap.app',
                'X-Title': 'GastroMap',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'stepfun/step-3.5-flash:free',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a gastronomy expert. Generate 10-15 search keywords for a location. Keywords should cover mood, occasion, food style, and specific features. Return ONLY a JSON array of strings.'
                    },
                    {
                        role: 'user',
                        content: `Generate keywords for this location:\n${textForAI}`
                    }
                ],
                max_tokens: 300,
            }),
        })

        if (keywordResponse.ok) {
            const kwData = await keywordResponse.json()
            const content = kwData.choices?.[0]?.message?.content || '[]'
            const match = content.match(/\[[\s\S]*\]/)
            if (match) {
                locationData.ai_keywords = JSON.parse(match[0])
            }
        }

        // 2. Generate expert summary (context)
        const contextResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://gastromap.app',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'stepfun/step-3.5-flash:free',
                messages: [
                    {
                        role: 'system',
                        content: 'Write a 2-sentence expert summary of this restaurant for an AI assistant. Focus on uniqueness and target audience.'
                    },
                    {
                        role: 'user',
                        content: textForAI
                    }
                ],
                max_tokens: 150,
            }),
        })

        if (contextResponse.ok) {
            const ctxData = await contextResponse.json()
            locationData.ai_context = ctxData.choices?.[0]?.message?.content || ''
        }

        // 3. Generate pgvector embedding
        const embeddingText = [
            locationData.title,
            locationData.description,
            locationData.category,
            ...(locationData.ai_keywords || []),
            locationData.ai_context
        ].filter(Boolean).join(' ')

        const embeddingResponse = await fetch('https://openrouter.ai/api/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://gastromap.app',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai/text-embedding-3-small',
                input: embeddingText,
            }),
        })

        if (embeddingResponse.ok) {
            const embData = await embeddingResponse.json()
            locationData.embedding = embData.data?.[0]?.embedding || null
        }

        // Mark as success if we got at least keywords or embedding
        if (locationData.ai_keywords?.length || locationData.embedding) {
            locationData.ai_enrichment_status = 'success'
            locationData.ai_enrichment_error = null
        } else {
            locationData.ai_enrichment_status = 'failed'
            locationData.ai_enrichment_error = 'No keywords or embedding generated'
        }

    } catch (error) {
        console.warn('[locations.api] AI enrichment failed (non-blocking):', error.message)
        locationData.ai_enrichment_status = 'failed'
        locationData.ai_enrichment_error = error.message
    }

    return locationData
}

/**
 * Create location with automatic translation
 * @param {Object} data - Location data
 * @param {boolean} enableTranslation - Enable auto-translation (default: null)
 * @returns {Promise<Object>} Created location with translations
 */
export async function createLocation(data, enableTranslation = null) {
    if (!USE_SUPABASE) return _mockCreate(data)

    const isAiReady = getActiveAIConfig().isConfigured
    const shouldTranslate = enableTranslation ?? isAiReady

    let locationData = { ...data }

    // Enrich with AI keywords and embeddings if enabled
    if (isAiReady) {
        console.log('[locations.api] Enriching location with AI keywords + embedding...')
        locationData = await enrichLocationWithAI(locationData)
    }

    // Create location IMMEDIATELY (without waiting for translations)
    const row = _toRow(locationData)
    const { data: created, error } = await supabase
        .from('locations')
        .insert(row)
        .select()
        .single()

    if (error) throw new ApiError(error.message, 500, error.code)

    // Auto-translate IN BACKGROUND (non-blocking, fire-and-forget)
    // This allows the UI to return immediately while translations happen in the background
    if (shouldTranslate) {
        console.log('[locations.api] Starting background translation for location:', created.id)

        // Don't await this - let it run in the background
        processLocationTranslations(data, true)
            .then(result => {
                console.log('[locations.api] Auto-translation completed, saving translations...')
                return saveTranslations(created.id, result.translations)
            })
            .then(() => {
                console.log('[locations.api] Translations saved successfully')
            })
            .catch(error => {
                console.error('[locations.api] Background translation failed (non-blocking):', error)
                // Silently fail - translations are optional enhancement
            })
    }

    return normalise(created)
}

// ─── Update with Auto-Translation ──────────────────────────────────────────

/**
 * Update location with automatic translation
 * @param {string} id - Location ID
 * @param {Object} updates - Updated fields
 * @param {boolean} enableTranslation - Enable auto-translation (default: null)
 * @returns {Promise<Object>} Updated location
 */
export async function updateLocation(id, updates, enableTranslation = null) {
    if (!USE_SUPABASE) return _mockUpdate(id, updates)

    const isAiReady = getActiveAIConfig().isConfigured
    const shouldTranslate = enableTranslation ?? isAiReady

    let locationData = { ...updates }
    let translations = null
    
    // Auto-translate if translatable fields changed
    if (shouldTranslate) {
        const translatableFields = ['title', 'description', 'address', 'insider_tip', 'what_to_try', 'ai_context']
        const hasTranslatableField = translatableFields.some(field => updates[field] !== undefined)
        
        // Auto-enrich AI data if primary fields changed
        const aiTriggerFields = ['title', 'description', 'cuisine', 'tags', 'vibe']
        const shouldEnrichAI = aiTriggerFields.some(field => updates[field] !== undefined)

        if (shouldEnrichAI) {
            console.log('[locations.api] Re-enriching location with AI...')
            const current = await getLocation(id, { adminMode: true })
            const merged = { ...current, ...updates }
            const enriched = await enrichLocationWithAI(merged)
            
            // Extract AI fields into updates
            if (enriched.ai_keywords) locationData.ai_keywords = enriched.ai_keywords
            if (enriched.ai_context) locationData.ai_context = enriched.ai_context
            if (enriched.embedding) locationData.embedding = enriched.embedding
        }

        if (hasTranslatableField) {
            console.log('[locations.api] Auto-translating updated fields...')
            
            try {
                // Get current location first
                const current = await getLocation(id)
                const merged = { ...current, ...updates }
                
                const result = await processLocationTranslations(merged, true)
                locationData = result
                translations = result.translations
            } catch (error) {
                console.error('[locations.api] Auto-translation failed:', error)
                // Continue without translations
            }
        }
    }

    const row = _toRow(locationData)
    const { data: updated, error } = await supabase
        .from('locations')
        .update(row)
        .eq('id', id)
        .select()
        .single()

    if (error) throw new ApiError(error.message, 500, error.code)
    
    // Update translations
    if (translations) {
        try {
            await saveTranslations(updated.id, translations)
        } catch (error) {
            console.error('[locations.api] Failed to save translations:', error)
        }
    }
    
    return normalise(updated)
}

// ─── Delete ────────────────────────────────────────────────────────────────

export async function deleteLocation(id) {
    if (!USE_SUPABASE) return _mockDelete(id)

    const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', id)

    if (error) throw new ApiError(error.message, 500, error.code)
}

// ─── Get with Translation ──────────────────────────────────────────────────

/**
 * Get location with translations for specific language
 * @param {string} id - Location ID
 * @param {string} lang - Language code (en, pl, uk, ru)
 * @returns {Promise<Object>} Location with translated fields
 */
export async function getLocationTranslated(id, lang = 'en') {
    if (!USE_SUPABASE) {
        return _mockGetLocation(id)
    }

    // Get location
    const location = await getLocation(id)
    if (!location) return null

    // Get translations
    const translations = await getTranslations(id)
    
    if (translations && translations[lang]) {
        // Merge translations with original data
        return {
            ...location,
            ...translations[lang],
            isTranslated: true,
            translatedTo: lang
        }
    }
    
    return location
}

// ─── Shape converter (app → DB) ────────────────────────────────────────────

function _toRow(d) {
    const row = {}

    // Required or core fields
    row.title = d.title || d.name || 'Untitled'
    row.category = (d.category || d.type || 'other').toLowerCase()
    row.city = d.city || ''
    row.country = d.country || ''

    if (d.description !== undefined) row.description = d.description
    if (d.address !== undefined)     row.address = d.address

    // Coordinates (lat, lng are canonical)
    if (d.lat !== undefined) row.lat = Number(d.lat)
    else if (d.latitude !== undefined) row.lat = Number(d.latitude)

    if (d.lng !== undefined) row.lng = Number(d.lng)
    else if (d.longitude !== undefined) row.lng = Number(d.longitude)

    // Category
    if (d.category !== undefined) row.category = d.category
    else if (d.type !== undefined) row.category = d.type

    if (d.cuisine !== undefined)     row.cuisine_types = Array.isArray(d.cuisine) ? d.cuisine : [d.cuisine].filter(Boolean)
    if (d.cuisine_types !== undefined) row.cuisine_types = d.cuisine_types

    // Images
    if (d.image_url !== undefined) row.image_url = d.image_url
    else if (d.image !== undefined) row.image_url = d.image

    if (d.google_photos !== undefined) row.google_photos = d.google_photos
    else if (d.photos !== undefined) row.google_photos = d.photos
    else if (d.images !== undefined) row.google_photos = d.images

    if (d.rating !== undefined)         row.google_rating = Number(d.rating)
    if (d.google_rating !== undefined)  row.google_rating = Number(d.google_rating)

    // Price
    if (d.price_range !== undefined)  row.price_range = d.price_range
    else if (d.price_level !== undefined) row.price_range = d.price_level
    else if (d.priceLevel !== undefined) row.price_range = d.priceLevel

    // Hours
    if (d.opening_hours !== undefined) row.opening_hours = d.opening_hours
    else if (d.openingHours !== undefined) row.opening_hours = d.openingHours

    if (d.website !== undefined)     row.website = d.website
    if (d.phone !== undefined)       row.phone = d.phone
    if (d.booking_url !== undefined) row.booking_url = d.booking_url

    if (d.tags !== undefined)        row.tags = d.tags
    // if (d.vibe !== undefined)     // vibe not in schema, use tags?
    
    if (d.amenities !== undefined)   row.amenities = d.amenities
    else if (d.features !== undefined) row.amenities = d.features

    if (d.best_for !== undefined)    row.best_for = d.best_for
    
    if (d.dietary_options !== undefined) row.dietary_options = d.dietary_options
    else if (d.dietary !== undefined)    row.dietary_options = d.dietary

    if (d.special_labels !== undefined) row.special_labels = d.special_labels
    
    if (d.has_wifi !== undefined)    row.wifi_quality = d.has_wifi ? 'high' : 'none'
    
    if (d.has_outdoor_seating !== undefined) row.outdoor_seating = d.has_outdoor_seating
    else if (d.outdoor_seating !== undefined) row.outdoor_seating = d.outdoor_seating

    if (d.reservations_required !== undefined) row.reservation_required = d.reservations_required
    else if (d.reservation_required !== undefined) row.reservation_required = d.reservation_required

    if (d.insider_tip !== undefined)    row.insider_tip = d.insider_tip

    // What to try (stored as text in DB, but treated as list in UI)
    const whatToTry = d.must_try ?? d.what_to_try
    if (whatToTry !== undefined) {
        row.must_try = Array.isArray(whatToTry)
            ? whatToTry.join(', ')
            : String(whatToTry)
    }

    if (d.ai_keywords !== undefined)  row.ai_keywords = d.ai_keywords
    if (d.ai_context !== undefined)   row.ai_context = d.ai_context
    if (d.embedding !== undefined)    row.embedding = d.embedding
    if (d.status !== undefined)       row.status = d.status
    
    // AI Enrichment status
    if (d.ai_enrichment_status !== undefined) row.ai_enrichment_status = d.ai_enrichment_status
    if (d.ai_enrichment_error !== undefined)  row.ai_enrichment_error = d.ai_enrichment_error
    if (d.ai_enrichment_last_attempt !== undefined) row.ai_enrichment_last_attempt = d.ai_enrichment_last_attempt

    return row
}


// ─── Mock fallbacks ────────────────────────────────────────────────────────

function _mockGetLocations(filters = {}) {
    let filtered = [...MOCK_LOCATIONS]
    if (filters.category && filters.category !== 'All') {
        filtered = filtered.filter(l => l.category === filters.category)
    }
    if (filters.city) {
        filtered = filtered.filter(l => l.city.toLowerCase().includes(filters.city.toLowerCase()))
    }
    if (filters.country) {
        filtered = filtered.filter(l => l.country.toLowerCase().includes(filters.country.toLowerCase()))
    }
    if (filters.minRating != null) {
        filtered = filtered.filter(l => l.rating >= filters.minRating)
    }
    if (filters.priceLevel?.length) {
        filtered = filtered.filter(l => filters.priceLevel.includes(l.priceLevel))
    }
    return {
        data: filtered,
        total: filtered.length,
        hasMore: false,
    }
}

function _mockGetLocation(id) {
    return MOCK_LOCATIONS.find(l => l.id === id) || null
}

function _mockCreate(data) {
    const newLocation = {
        ...data,
        id: `mock_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }
    MOCK_LOCATIONS.push(newLocation)
    return newLocation
}

function _mockUpdate(id, updates) {
    const index = MOCK_LOCATIONS.findIndex(l => l.id === id)
    if (index === -1) return null
    MOCK_LOCATIONS[index] = { ...MOCK_LOCATIONS[index], ...updates, updatedAt: new Date().toISOString() }
    return MOCK_LOCATIONS[index]
}

function _mockDelete(id) {
    const index = MOCK_LOCATIONS.findIndex(l => l.id === id)
    if (index !== -1) MOCK_LOCATIONS.splice(index, 1)
}

// ─── Aliases & derived queries ──────────────────────────────────────────────

/** Alias for getLocation — used by useLocation(id) hook via queries.js */
export const getLocationById = getLocation

/** Distinct categories list (for filter dropdowns). */
export async function getCategories() {
    if (!USE_SUPABASE) return MOCK_CATEGORIES

    const { data, error } = await supabase
        .from('locations')
        .select('category')
        .eq('status', 'approved')

    if (error) {
        console.warn('[locations.api] Failed to fetch categories, using mocks:', error.message)
        return MOCK_CATEGORIES
    }

    const unique = [...new Set((data ?? []).map(r => r.category).filter(Boolean))]
    return ['All', ...unique.sort()]
}

/** Locations within radiusKm of given coordinates (Haversine filter). */
export async function getLocationsNearby(coords, radiusKm = 2) {
    if (!coords?.lat || !coords?.lng) return { data: [], total: 0, hasMore: false }

    const { data: all } = await getLocations({ limit: 500 })

    const R = 6371 // Earth radius in km
    const filtered = (all ?? []).filter(loc => {
        const dLat = (loc.coordinates.lat - coords.lat) * Math.PI / 180
        const dLng = (loc.coordinates.lng - coords.lng) * Math.PI / 180
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(coords.lat * Math.PI / 180) *
            Math.cos(loc.coordinates.lat * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2
        const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return d <= radiusKm
    })

    return { data: filtered, total: filtered.length, hasMore: false }
}

export default {
    getLocations,
    getLocation,
    getLocationById,
    getLocationTranslated,
    getCategories,
    getLocationsNearby,
    createLocation,
    updateLocation,
    deleteLocation,
}
