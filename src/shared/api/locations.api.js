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
// import { 
//     processLocationTranslations, 
//     saveTranslations,
//     getTranslations 
// } from './translation.api'
// import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
// import { getActiveAIConfig } from './ai-config.api'

const USE_SUPABASE = config.supabase.isConfigured
console.log('[locations.api] 🔌 Database Mode:', USE_SUPABASE ? 'SUPABASE' : 'MOCKS fall-back')
if (USE_SUPABASE) {
    console.log('[locations.api] 🌐 Supabase URL:', config.supabase.url)
}

// ─── Shape normaliser ──────────────────────────────────────────────────────
// Exposes BOTH API-canonical names (title, priceLevel, openingHours …)
// AND admin-form aliases (name, price_range, opening_hours, image_url, …)
// so neither the public Explore page nor AdminLocationsPage needs a remap.
function normalise(row) {
    if (!row) return null;

    const lat = Number(row.lat ?? 0)
    const lng = Number(row.lng ?? 0)

    // Schema: title, rating, price_level, cuisine (string), image, photos (array)
    const image      = row.image ?? ''
    const rating     = Number(row.rating ?? 0)
    const priceLevel = row.price_level ?? '$$'
    const cuisineRaw = row.cuisine ?? ''

    // Normalise legacy 'active' → 'approved' for UI consistency
    const status = row.status === 'active' ? 'approved' : (row.status ?? 'approved')

    return {
        id: row.id,
        title: row.title ?? '',
        name: row.title ?? '',

        description: row.description ?? '',
        address: row.address ?? '',
        city: row.city ?? '',
        country: row.country ?? '',

        coordinates: { lat, lng },
        lat,
        lng,

        category: row.category ?? 'other',
        type: row.category ?? 'other',

        cuisine: cuisineRaw,
        cuisine_types: cuisineRaw ? [cuisineRaw] : [],

        image,
        image_url: image,
        photos: row.photos ?? [],
        images: row.photos ?? [],

        rating,
        google_rating: rating,
        google_user_ratings_total: 0,

        price_level: priceLevel,
        priceLevel,
        price_range: priceLevel,

        opening_hours: row.opening_hours ?? '',
        openingHours: row.opening_hours ?? '',
        booking_url: row.booking_url ?? '',
        website: row.website ?? '',
        phone: row.phone ?? '',

        tags: row.tags ?? [],
        special_labels: row.special_labels ?? [],
        vibe: row.vibe ?? [],
        features: row.amenities ?? row.features ?? [],
        amenities: row.amenities ?? row.features ?? [],
        best_for: row.best_for ?? [],
        dietary: row.dietary_options ?? row.dietary ?? [],
        dietary_options: row.dietary_options ?? row.dietary ?? [],

        has_wifi: row.wifi_quality ? row.wifi_quality !== 'none' : (row.has_wifi ?? false),
        has_outdoor_seating: row.outdoor_seating ?? row.has_outdoor_seating ?? false,
        reservations_required: row.reservation_required ?? row.reservations_required ?? false,

        michelin_stars: row.michelin_stars ?? 0,
        michelin_bib: row.michelin_bib ?? false,

        insider_tip: row.insider_tip ?? '',
        what_to_try: typeof row.must_try === 'string'
            ? row.must_try.split(',').map(s => s.trim()).filter(Boolean)
            : (row.must_try ?? row.what_to_try ?? []),
        must_try: typeof row.must_try === 'string'
            ? row.must_try.split(',').map(s => s.trim()).filter(Boolean)
            : (row.must_try ?? row.what_to_try ?? []),

        ai_keywords: row.ai_keywords ?? [],
        ai_context: row.ai_context ?? '',
        embedding: row.embedding ?? null,

        ai_enrichment_status: row.ai_enrichment_status ?? 'pending',
        ai_enrichment_error: row.ai_enrichment_error ?? null,
        ai_enrichment_last_attempt: row.ai_enrichment_last_attempt ?? null,

        status,
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
        .order('rating', { ascending: false })
        .range(offset, offset + (limit - 1))

    // Admin can pass all=true or showAll=true to bypass status filter, or status='pending' etc.
    if (!bypassStatus) {
        q = q.eq('status', status ?? 'active')
    } else if (status) {
        // bypass requested + explicit status = filter by that specific status
        q = q.eq('status', status)
    }
    // bypass requested + no status = return everything regardless of status

    if (category && category !== 'All') q = q.eq('category', category)
    if (city)    q = q.ilike('city', city)
    if (country) q = q.ilike('country', country)
    if (minRating != null) q = q.gte('rating', minRating)
    if (priceLevel?.length) q = q.in('price_level', priceLevel)
    if (vibe?.length) q = q.overlaps('tags', vibe) // vibe maps to tags if not separate column

    // Search by title or city if query exists
    if (query) {
        q = q.or(`title.ilike.%${query}%,city.ilike.%${query}%`)
    }

    const { data, error, count } = await q

    if (error) {
        console.error('[locations.api] ❌ Supabase query FAILED — using mocks as fallback. Error:', error.message, error)
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
        console.error('[locations.api] ❌ Supabase query FAILED — using mocks as fallback. Error:', error.message, error)
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
/**
 * Enrich location with AI data using the new enrichment module.
 * This function is deprecated - use enrichLocationData from @/features/admin/components/LocationForm/enrichment.js
 * Kept for backward compatibility during migration.
 */
async function enrichLocationWithAI(locationData) {
    const { enrichLocationData } = await import('@/features/admin/components/LocationForm/enrichment')
    return enrichLocationData(locationData)
}

/**
 * Create location with automatic translation
 * @param {Object} data - Location data
 * @param {boolean} enableTranslation - Enable auto-translation (default: null)
 * @returns {Promise<Object>} Created location with translations
 */
export async function createLocation(data, enableTranslation = null) {
    if (!USE_SUPABASE) return _mockCreate(data)

    const { getActiveAIConfig } = await import('./ai-config.api')
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

        const { processLocationTranslations, saveTranslations } = await import('./translation.api')
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

    const { getActiveAIConfig } = await import('./ai-config.api')
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
                
                const { processLocationTranslations } = await import('./translation.api')
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
            const { saveTranslations } = await import('./translation.api')
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
    const { getTranslations } = await import('./translation.api')
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

    if (d.cuisine !== undefined)     row.cuisine = Array.isArray(d.cuisine) ? d.cuisine[0] ?? '' : (d.cuisine ?? '')
    if (d.cuisine_types !== undefined) row.cuisine = Array.isArray(d.cuisine_types) ? d.cuisine_types[0] ?? '' : (d.cuisine_types ?? '')

    // Images
    if (d.image_url !== undefined) row.image = d.image_url
    else if (d.image !== undefined) row.image = d.image

    if (d.google_photos !== undefined) row.photos = d.google_photos
    else if (d.photos !== undefined) row.photos = d.photos
    else if (d.images !== undefined) row.photos = d.images

    if (d.rating !== undefined)         row.rating = Number(d.rating)
    if (d.google_rating !== undefined)  row.rating = Number(d.google_rating)

    // Price
    if (d.price_range !== undefined)  row.price_level = d.price_range
    else if (d.price_level !== undefined) row.price_level = d.price_level
    else if (d.priceLevel !== undefined) row.price_level = d.priceLevel

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
