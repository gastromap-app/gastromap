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

const USE_SUPABASE = config.supabase.isConfigured
const AUTO_TRANSLATE = config.ai.isOpenRouterConfigured

// ─── Shape normaliser ──────────────────────────────────────────────────────
// Exposes BOTH API-canonical names (title, priceLevel, openingHours …)
// AND admin-form aliases (name, price_range, opening_hours, image_url, …)
// so neither the public Explore page nor AdminLocationsPage needs a remap.
function normalise(row) {
    const lat = Number(row.lat ?? 0)
    const lng = Number(row.lng ?? 0)
    return {
        id: row.id,
        // ── Title ────────────────────────────────────────────────────────
        title: row.title ?? '',
        name: row.title ?? '',           // alias used by AdminLocationsPage list

        // ── Text ─────────────────────────────────────────────────────────
        description: row.description ?? '',
        address: row.address ?? '',
        city: row.city ?? '',
        country: row.country ?? '',

        // ── Geo ──────────────────────────────────────────────────────────
        coordinates: { lat, lng },
        lat,                             // direct access for admin map
        lng,

        // ── Category / Cuisine ───────────────────────────────────────────
        category: row.category ?? 'Other',
        cuisine: row.cuisine ?? '',

        // ── Images ───────────────────────────────────────────────────────
        image: row.image ?? '',
        image_url: row.image ?? '',      // alias for admin form
        photos: row.photos ?? [],
        images: row.photos ?? [],        // alias for admin form

        // ── Ratings & Pricing ────────────────────────────────────────────
        rating: Number(row.rating ?? 0),
        priceLevel: row.price_level ?? '$$',
        price_range: row.price_level ?? '$$',  // alias for admin form

        // ── Hours ────────────────────────────────────────────────────────
        openingHours: row.opening_hours ?? '',
        opening_hours: row.opening_hours ?? '',  // alias for admin form

        // ── Arrays ───────────────────────────────────────────────────────
        tags: row.tags ?? [],
        special_labels: row.special_labels ?? [],
        vibe: row.vibe ?? [],
        features: row.features ?? [],
        best_for: row.best_for ?? [],
        dietary: row.dietary ?? [],

        // ── Booleans ─────────────────────────────────────────────────────
        has_wifi: row.has_wifi ?? false,
        has_outdoor_seating: row.has_outdoor_seating ?? false,
        reservations_required: row.reservations_required ?? false,

        // ── Michelin ─────────────────────────────────────────────────────
        michelin_stars: row.michelin_stars ?? 0,
        michelin_bib: row.michelin_bib ?? false,

        // ── AI / Expert ──────────────────────────────────────────────────
        insider_tip: row.insider_tip ?? '',
        what_to_try: row.what_to_try ?? [],
        ai_keywords: row.ai_keywords ?? [],
        ai_context: row.ai_context ?? '',

        // ── Status / Meta ────────────────────────────────────────────────
        status: row.status ?? 'active',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

// ─── Read ──────────────────────────────────────────────────────────────────

export async function getLocations(filters = {}) {
    if (!USE_SUPABASE) return _mockGetLocations(filters)

    const { category, query, priceLevel, minRating, vibe, city, country, status, showAll = false, limit = 100, offset = 0 } = filters

    let q = supabase
        .from('locations')
        .select('*', { count: 'exact' })
        .order('rating', { ascending: false })
        .range(offset, offset + (limit - 1))

    // Admin can pass showAll=true to bypass status filter, or status='pending' etc.
    if (!showAll) {
        q = q.eq('status', status ?? 'active')
    } else if (status) {
        // showAll + explicit status = filter by that specific status
        q = q.eq('status', status)
    }
    // showAll + no status = return everything regardless of status

    if (category && category !== 'All') q = q.eq('category', category)
    if (city)    q = q.ilike('city', city)
    if (country) q = q.ilike('country', country)
    if (minRating != null) q = q.gte('rating', minRating)
    if (priceLevel?.length) q = q.in('price_level', priceLevel)
    if (vibe?.length) q = q.overlaps('vibe', vibe)

    if (query) {
        q = q.textSearch('fts', query, { config: 'english', type: 'websearch' })
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

    // Public facing: only show active locations. Admin mode: show any status.
    if (!adminMode) {
        q = q.eq('status', 'active')
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
 * Create location with automatic translation
 * @param {Object} data - Location data
 * @param {boolean} enableTranslation - Enable auto-translation (default: true if AI configured)
 * @returns {Promise<Object>} Created location with translations
 */
export async function createLocation(data, enableTranslation = AUTO_TRANSLATE) {
    if (!USE_SUPABASE) return _mockCreate(data)

    let locationData = { ...data }
    let translations = null
    
    // Auto-translate before saving
    if (enableTranslation && config.ai.isOpenRouterConfigured) {
        console.log('[locations.api] Auto-translating location...')
        
        try {
            const result = await processLocationTranslations(data, true)
            locationData = result
            translations = result.translations
        } catch (error) {
            console.error('[locations.api] Auto-translation failed, saving without translations:', error)
            // Continue without translations (non-blocking)
        }
    }

    const row = _toRow(locationData)
    const { data: created, error } = await supabase
        .from('locations')
        .insert(row)
        .select()
        .single()

    if (error) throw new ApiError(error.message, 500, error.code)
    
    // Save translations separately
    if (translations) {
        try {
            await saveTranslations(created.id, translations)
        } catch (error) {
            console.error('[locations.api] Failed to save translations:', error)
            // Non-blocking, continue
        }
    }
    
    return normalise(created)
}

// ─── Update with Auto-Translation ──────────────────────────────────────────

/**
 * Update location with automatic translation
 * @param {string} id - Location ID
 * @param {Object} updates - Updated fields
 * @param {boolean} enableTranslation - Enable auto-translation (default: true if AI configured)
 * @returns {Promise<Object>} Updated location
 */
export async function updateLocation(id, updates, enableTranslation = AUTO_TRANSLATE) {
    if (!USE_SUPABASE) return _mockUpdate(id, updates)

    let locationData = { ...updates }
    let translations = null
    
    // Auto-translate if translatable fields changed
    if (enableTranslation && config.ai.isOpenRouterConfigured) {
        const translatableFields = ['title', 'description', 'address', 'insider_tip', 'what_to_try', 'ai_context']
        const hasTranslatableField = translatableFields.some(field => updates[field] !== undefined)
        
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

    // ── Title: accepts 'title' (API canonical) or 'name' (admin form alias) ──
    const title = d.title ?? d.name
    if (title !== undefined)          row.title = title

    if (d.description !== undefined)  row.description = d.description
    if (d.address !== undefined)      row.address = d.address
    if (d.city !== undefined)         row.city = d.city
    if (d.country !== undefined)      row.country = d.country

    // ── Coordinates: accepts lat/lng (canonical) or latitude/longitude (alias) ──
    const lat = d.lat ?? d.latitude
    const lng = d.lng ?? d.longitude
    if (lat !== undefined)            row.lat = Number(lat)
    if (lng !== undefined)            row.lng = Number(lng)

    if (d.category !== undefined)     row.category = d.category
    if (d.cuisine !== undefined)      row.cuisine = d.cuisine

    // ── Image: accepts 'image' (canonical) or 'image_url' (admin form alias) ──
    const image = d.image ?? d.image_url
    if (image !== undefined)          row.image = image

    // ── Photos: accepts 'photos' (canonical) or 'images' (admin form alias) ──
    const photos = d.photos ?? d.images
    if (photos !== undefined)         row.photos = photos

    if (d.rating !== undefined)       row.rating = Number(d.rating)

    // ── Price: accepts 'priceLevel' (canonical) or 'price_range' (admin form alias) ──
    const priceLevel = d.priceLevel ?? d.price_range
    if (priceLevel !== undefined)     row.price_level = priceLevel

    // ── Hours: accepts 'openingHours' (canonical) or 'opening_hours' (admin form alias) ──
    const openingHours = d.openingHours ?? d.opening_hours
    if (openingHours !== undefined)   row.opening_hours = openingHours

    if (d.tags !== undefined)         row.tags = d.tags
    if (d.vibe !== undefined)         row.vibe = d.vibe
    if (d.features !== undefined)     row.features = d.features
    if (d.best_for !== undefined)     row.best_for = d.best_for
    if (d.dietary !== undefined)      row.dietary = d.dietary
    if (d.special_labels !== undefined) row.special_labels = d.special_labels
    if (d.has_wifi !== undefined)     row.has_wifi = d.has_wifi
    if (d.has_outdoor_seating !== undefined) row.has_outdoor_seating = d.has_outdoor_seating
    if (d.reservations_required !== undefined) row.reservations_required = d.reservations_required
    if (d.michelin_stars !== undefined) row.michelin_stars = d.michelin_stars
    if (d.michelin_bib !== undefined) row.michelin_bib = d.michelin_bib
    if (d.insider_tip !== undefined)  row.insider_tip = d.insider_tip

    // ── What to try: accepts 'what_to_try' array OR 'must_try' comma-separated string ──
    const whatToTry = d.what_to_try ?? d.must_try
    if (whatToTry !== undefined) {
        row.what_to_try = Array.isArray(whatToTry)
            ? whatToTry
            : String(whatToTry).split(',').map(s => s.trim()).filter(Boolean)
    }

    if (d.ai_keywords !== undefined)  row.ai_keywords = d.ai_keywords
    if (d.ai_context !== undefined)   row.ai_context = d.ai_context
    if (d.status !== undefined)       row.status = d.status
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
        .eq('status', 'active')

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
