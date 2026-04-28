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
import { enrichLocationData } from '@/features/admin/components/LocationForm/enrichment'
import { config } from '@/shared/config/env'
import { CATEGORIES_FULL } from '../constants/taxonomy'
import { sanitizePayload } from '../lib/schema-validator.js'
import { log as safeLog, warn as safeWarn, error as safeError } from '../lib/safe-console.js'
// import { 
//     processLocationTranslations, 
//     saveTranslations,
//     getTranslations 
// } from './translation.api'
// import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
// import { getActiveAIConfig } from './ai-config.api'

const USE_SUPABASE = config.supabase.isConfigured
safeLog('[locations.api] 🔌 Database Mode:', USE_SUPABASE ? 'SUPABASE' : 'MOCKS fall-back')
if (USE_SUPABASE) {
    safeLog('[locations.api] 🌐 Supabase URL:', config.supabase.url)
}

// ─── Shape normaliser ──────────────────────────────────────────────────────
// Exposes BOTH API-canonical names (title, priceLevel, openingHours …)
// AND admin-form aliases (name, price_range, opening_hours, image_url, …)
// so neither the public Explore page nor AdminLocationsPage needs a remap.

// ── Google CDN resize helper ────────────────────────────────────────────────
// Для Google Photos заменяем размерный суффикс =wXXX на =wW-h-k-no.
function resizeGoogleCdn(url, width = 800) {
    if (!url) return url
    if (/lh3\.googleusercontent\.com/.test(url)) {
        return url.replace(/=w\d+.*$/, '') + `=w${width}-h-k-no`
    }
    return url
}

function normalise(row) {
    if (!row) return null;

    const lat = Number(row.lat ?? 0)
    const lng = Number(row.lng ?? 0)

    // Schema: title, rating, google_rating, price_range, cuisine_types (array), image_url, google_photos (array)
    const image         = resizeGoogleCdn(row.image_url ?? '', 800)
    const rating        = Number(row.rating ?? 0)
    const googleRating  = Number(row.google_rating ?? 0)
    const priceRange    = row.price_range ?? '$$'
    const cuisineTypes  = Array.isArray(row.cuisine_types) ? row.cuisine_types : []

    const status = row.status ?? 'approved'

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

        category: CATEGORIES_FULL.find(c => c.toLowerCase() === (row.category || '').toLowerCase()) || row.category || 'Other',
        type: row.category ?? 'other',

        cuisine: cuisineTypes[0] || '',
        cuisine_types: cuisineTypes,

        image,
        image_url: image,
        photos: Array.isArray(row.google_photos) ? row.google_photos : [],
        images: Array.isArray(row.google_photos) ? row.google_photos : [],

        rating,
        google_rating: googleRating,
        google_user_ratings_total: row.google_user_ratings_total ?? 0,

        price_level: priceRange,
        priceLevel: priceRange,
        price_range: priceRange,

        opening_hours: row.opening_hours ?? '',
        openingHours: row.opening_hours ?? '',
        booking_url: row.booking_url ?? '',
        website: row.website ?? '',
        phone: row.phone ?? '',

        tags: row.tags ?? [],
        special_labels: row.special_labels ?? [],
        vibe: row.vibe ?? [],
        features: row.amenities ?? [],
        amenities: row.amenities ?? [],
        best_for: row.best_for ?? [],
        dietary: row.dietary_options ?? [],
        dietary_options: row.dietary_options ?? [],

        has_wifi: row.wifi_quality ? row.wifi_quality !== 'none' : false,
        has_outdoor_seating: row.outdoor_seating ?? false,
        reservations_required: row.reservation_required ?? false,

        michelin_stars: row.michelin_stars ?? 0,
        michelin_bib: row.michelin_bib ?? false,

        insider_tip: row.insider_tip ?? '',
        what_to_try: Array.isArray(row.what_to_try) ? row.what_to_try : (row.must_try ? [row.must_try] : []),
        must_try: row.must_try ?? (Array.isArray(row.what_to_try) ? row.what_to_try[0] : ''),

        ai_keywords: row.ai_keywords ?? [],
        ai_context: row.ai_context ?? '',
        embedding: row.embedding ?? null,

        ai_enrichment_status: row.ai_enrichment_status ?? 'pending',
        ai_enrichment_error: row.ai_enrichment_error ?? null,
        ai_enrichment_last_attempt: row.ai_enrichment_last_attempt ?? null,

        // Knowledge Graph fields
        kg_cuisines:   row.kg_cuisines   ?? [],
        kg_dishes:     row.kg_dishes     ?? [],
        kg_ingredients: row.kg_ingredients ?? [],
        kg_allergens:  row.kg_allergens  ?? [],
        kg_enriched_at: row.kg_enriched_at ?? null,

        // Social / Google
        social_instagram: row.social_instagram ?? '',
        social_facebook:  row.social_facebook  ?? '',
        google_place_id:  row.google_place_id  ?? null,
        google_maps_url:  row.google_maps_url  ?? null,

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

    safeLog('[locations.api] 🚀 Fetching locations with filters:', filters)

    let q = supabase
        .from('locations')
        .select('*', { count: 'exact' })

    // Try sorting by google_rating, fall back to no sort if column missing
    q = q.order('google_rating', { ascending: false })
    
    q = q.range(offset, offset + (limit - 1))

    // Admin can pass all=true or showAll=true to bypass status filter, or status='pending' etc.
    // FIX: Accept both 'approved' and 'active' — DB migration may not have run yet
    if (!bypassStatus) {
        const statusVal = status ?? 'approved'
        q = statusVal === 'approved'
            ? q.in('status', ['approved', 'active'])
            : q.eq('status', statusVal)
    } else if (status) {
        q = q.eq('status', status)
    }

    if (category && category !== 'All') q = q.eq('category', category)
    if (city)    q = q.ilike('city', `%${city}%`)
    if (country) q = q.ilike('country', `%${country}%`)
    
    // Use google_rating for filtering if present
    if (minRating != null) q = q.gte('google_rating', minRating)
    
    if (priceLevel?.length) q = q.in('price_range', priceLevel)
    if (vibe?.length) q = q.overlaps('vibe', vibe)

    if (query) {
        q = q.or(`title.ilike.%${query}%,city.ilike.%${query}%`)
    }

    const { data, error, count } = await q

    if (error) {
        safeError('[locations.api] ❌ Supabase query FAILED:', error.message)
        safeError('[locations.api] 📉 Hard fallback to mocks.')
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
    // FIX: Accept both 'approved' and 'active' — DB migration may not have run yet
    if (!adminMode) {
        q = q.in('status', ['approved', 'active'])
    }

    const { data, error } = await q.single()

    if (error) {
        safeError('[locations.api] ❌ Supabase query FAILED — using mocks as fallback. Error:', error.message, error)
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
    try {
        return await enrichLocationData(locationData)
    } catch (err) {
        safeWarn('[locations.api] AI enrichment failed, continuing without it:', err.message)
        return locationData
    }
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
        safeLog('[locations.api] Enriching location with AI keywords + embedding...')
        locationData = await enrichLocationWithAI(locationData)
    }

    // Create location IMMEDIATELY (without waiting for translations)
    let row = _toRow(locationData)
        
    // Note: 'rating' column does not exist in DB - only google_rating exists.
    // sanitizePayload() in _smartSave filters out any 'rating' field.
        
    const { data: created, error } = await _smartSave('locations', null, row)

    if (error) throw new ApiError(error.message, 500, error.code)

    // Auto-translate IN BACKGROUND (non-blocking, fire-and-forget)
    // This allows the UI to return immediately while translations happen in the background
    if (shouldTranslate) {
        safeLog('[locations.api] Starting background translation for location:', created.id)

        const { processLocationTranslations, saveTranslations } = await import('./translation.api')
        // Don't await this - let it run in the background
        processLocationTranslations(data, true)
            .then(result => {
                safeLog('[locations.api] Auto-translation completed, saving translations...')
                return saveTranslations(created.id, result.translations)
            })
            .then(() => {
                safeLog('[locations.api] Translations saved successfully')
            })
            .catch(error => {
                safeError('[locations.api] Background translation failed (non-blocking):', error)
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

    const row = _toRow(updates)
    const { data: updated, error } = await _smartSave('locations', id, row)

    if (error) throw new ApiError(error.message, 500, error.code)
    
    // ─── Background Tasks (Non-blocking) ──────────────────────────────────────
    
    // 1. AI Enrichment & Translation
    if (shouldTranslate) {
        safeLog('[locations.api] Starting background enrichment/translation for updated location:', id)
        
        // Use a self-executing async function for background work
        (async () => {
            const dispatchStatus = (type, status) => {
                window.dispatchEvent(new CustomEvent('bg-task-status', { 
                    detail: { id, type, status } 
                }))
            }

            try {
                // Get fresh state of the location
                const current = await getLocation(id, { adminMode: true })
                if (!current) return

                const translatableFields = ['title', 'description', 'address', 'insider_tip', 'what_to_try', 'ai_context']
                const hasTranslatableField = translatableFields.some(field => 
                    updates[field] !== undefined && 
                    JSON.stringify(updates[field]) !== JSON.stringify(current[field])
                )
                
                const aiTriggerFields = ['title', 'description', 'cuisine_types', 'tags', 'vibe']
                const shouldEnrichAI = aiTriggerFields.some(field => 
                    updates[field] !== undefined && 
                    JSON.stringify(updates[field]) !== JSON.stringify(current[field])
                )

                let bgUpdates = {}

                // A. Background AI Enrichment
                if (shouldEnrichAI) {
                    dispatchStatus('ai-enrichment', 'running')
                    try {
                        const enriched = await enrichLocationData(current)
                        if (enriched.ai_enrichment_status === 'success') {
                            if (enriched.ai_keywords) bgUpdates.ai_keywords = enriched.ai_keywords
                            if (enriched.ai_context)  bgUpdates.ai_context  = enriched.ai_context
                            if (enriched.embedding)   bgUpdates.embedding   = enriched.embedding
                            
                            // Taxonomy fields
                            const aiFields = ['cuisine_types', 'price_range', 'tags', 'vibe', 'best_for', 'dietary_options']
                            aiFields.forEach(field => {
                                if (enriched[field] && updates[field] === undefined) {
                                    bgUpdates[field] = enriched[field]
                                }
                            })
                            dispatchStatus('ai-enrichment', 'success')
                        } else {
                            dispatchStatus('ai-enrichment', 'error')
                        }
                    } catch (aiErr) {
                        safeWarn('[locations.api] Background AI enrichment failed:', aiErr.message)
                        dispatchStatus('ai-enrichment', 'error')
                    }
                }

                // B. Background Translation
                if (shouldTranslate && (hasTranslatableField || Object.keys(bgUpdates).length > 0)) {
                    dispatchStatus('translation', 'running')
                    try {
                        const { processLocationTranslations, saveTranslations } = await import('./translation.api')
                        const merged = { ...current, ...bgUpdates }
                        const result = await processLocationTranslations(merged, true)
                        
                        if (result && result.translations) {
                            await saveTranslations(id, result.translations)
                            dispatchStatus('translation', 'success')
                        }
                    } catch (transErr) {
                        safeWarn('[locations.api] Background translation failed:', transErr.message)
                        dispatchStatus('translation', 'error')
                    }
                }

                // C. Save any background-generated improvements
                if (Object.keys(bgUpdates).length > 0) {
                    const bgRow = _toRow(bgUpdates)
                    await _smartSave('locations', id, bgRow)
                    safeLog('[locations.api] Background updates saved for:', id)
                }
            } catch (err) {
                safeError('[locations.api] Critical failure in background tasks:', err.message)
            }
        })()
    }

    // 2. Knowledge Graph Sync
    const kgTriggerFields = ['title', 'cuisine', 'description', 'tags', 'vibe', 'what_to_try']
    const shouldSyncKG = kgTriggerFields.some(f => updates[f] !== undefined)
    if (shouldSyncKG) {
        window.dispatchEvent(new CustomEvent('bg-task-status', { 
            detail: { id: updated.id, type: 'kg-sync', status: 'running' } 
        }))
        import('./knowledge-graph.api').then(({ syncKGForLocation }) => {
            syncKGForLocation(updated.id)
                .then(() => {
                    window.dispatchEvent(new CustomEvent('bg-task-status', { 
                        detail: { id: updated.id, type: 'kg-sync', status: 'success' } 
                    }))
                })
                .catch(e => {
                    safeWarn('[locations.api] Background KG sync failed:', e.message)
                    window.dispatchEvent(new CustomEvent('bg-task-status', { 
                        detail: { id: updated.id, type: 'kg-sync', status: 'error' } 
                    }))
                })
        })
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

// ─── Smart Sanitizer ───────────────────────────────────────────────────────
/**
 * Executes a save (insert or update).
 * Previously this silently stripped missing columns, causing data loss.
 * Now it fails fast with a clear error so developers know to fix the schema.
 */
async function _smartSave(table, id, row) {
    const payload = sanitizePayload({ ...row });
    
    const req = id
        ? supabase.from(table).update(payload).eq('id', id).select().single()
        : supabase.from(table).insert(payload).select().single()

    const { data, error } = await req

    if (error) {
        // Detect missing column error (PostgREST PGRST200) and surface a clear message
        if (error.code === 'PGRST200' && error.message.includes('Could not find the') && error.message.includes('column')) {
            const match = error.message.match(/find the '([^']+)' column/)
            const missingCol = match?.[1] || 'unknown'
            safeError(`[smartSave] CRITICAL: Column '${missingCol}' is missing in DB table '${table}'.`)
            safeError(`[smartSave] Data was NOT saved. Run the missing migration or add the column manually.`)
            return {
                data: null,
                error: {
                    ...error,
                    message: `Database schema mismatch: column '${missingCol}' does not exist in table '${table}'. Please run migrations or contact admin.`,
                }
            }
        }
        return { data: null, error }
    }

    return { data, error: null }
}

// ─── Shape converter (app → DB) ────────────────────────────────────────────

function _toRow(d) {
    const row = {}

    // Required or core fields
    if (d.title !== undefined) row.title = d.title || 'Untitled'
    else if (d.name !== undefined) row.title = d.name || 'Untitled'

    if (d.category !== undefined) row.category = (d.category || 'other').toLowerCase()
    else if (d.type !== undefined) row.category = (d.type || 'other').toLowerCase()

    if (d.city !== undefined) row.city = d.city || ''
    if (d.country !== undefined) row.country = d.country || ''

    if (d.description !== undefined) row.description = d.description
    if (d.address !== undefined)     row.address = d.address

    // Coordinates (lat, lng are canonical)
    if (d.lat !== undefined) row.lat = Number(d.lat)
    else if (d.latitude !== undefined) row.lat = Number(d.latitude)

    if (d.lng !== undefined) row.lng = Number(d.lng)
    else if (d.longitude !== undefined) row.lng = Number(d.longitude)

    // Cuisine
    if (d.cuisine_types !== undefined) row.cuisine_types = d.cuisine_types
    else if (d.cuisine !== undefined) row.cuisine_types = Array.isArray(d.cuisine) ? d.cuisine : [d.cuisine]

    // Images
    if (d.image_url !== undefined) row.image_url = d.image_url
    else if (d.image !== undefined) row.image_url = d.image

    if (d.google_photos !== undefined) row.google_photos = d.google_photos
    else if (d.photos !== undefined) row.google_photos = d.photos
    else if (d.images !== undefined) row.google_photos = d.images

    // Rating (only google_rating exists in DB, no 'rating' column)
    if (d.google_rating !== undefined) row.google_rating = Number(d.google_rating)

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
    if (d.vibe !== undefined)        row.vibe = d.vibe
    
    if (d.amenities !== undefined)   row.amenities = d.amenities
    else if (d.features !== undefined) row.amenities = d.features

    if (d.best_for !== undefined)    row.best_for = d.best_for
    
    if (d.dietary_options !== undefined) row.dietary_options = d.dietary_options
    else if (d.dietary !== undefined)    row.dietary_options = d.dietary

    if (d.special_labels !== undefined) row.special_labels = d.special_labels
    
    if (d.wifi_quality !== undefined)    row.wifi_quality = d.wifi_quality
    else if (d.has_wifi !== undefined)   row.wifi_quality = d.has_wifi ? 'high' : 'none'
    
    if (d.outdoor_seating !== undefined) row.outdoor_seating = d.outdoor_seating
    else if (d.has_outdoor_seating !== undefined) row.outdoor_seating = d.has_outdoor_seating

    if (d.reservation_required !== undefined) row.reservation_required = d.reservation_required
    else if (d.reservations_required !== undefined) row.reservation_required = d.reservations_required

    if (d.insider_tip !== undefined)    row.insider_tip = d.insider_tip

    // What to try
    if (d.what_to_try !== undefined) row.what_to_try = d.what_to_try
    if (d.must_try !== undefined) row.must_try = d.must_try

    if (d.ai_keywords !== undefined)  row.ai_keywords = d.ai_keywords
    if (d.ai_context !== undefined)   row.ai_context = d.ai_context
    if (d.embedding !== undefined)    row.embedding = d.embedding
    if (d.status !== undefined)       row.status = d.status
    if (d.moderation_note !== undefined) row.moderation_note = d.moderation_note

    // AI Enrichment status
    if (d.ai_enrichment_status !== undefined) row.ai_enrichment_status = d.ai_enrichment_status
    if (d.ai_enrichment_error !== undefined)  row.ai_enrichment_error = d.ai_enrichment_error
    if (d.ai_enrichment_last_attempt !== undefined) row.ai_enrichment_last_attempt = d.ai_enrichment_last_attempt

    // Michelin
    if (d.michelin_stars !== undefined) row.michelin_stars = d.michelin_stars
    if (d.michelin_bib !== undefined) row.michelin_bib = d.michelin_bib

    // KG fields
    if (d.kg_cuisines !== undefined)   row.kg_cuisines = d.kg_cuisines
    if (d.kg_dishes !== undefined)     row.kg_dishes = d.kg_dishes
    if (d.kg_ingredients !== undefined) row.kg_ingredients = d.kg_ingredients
    if (d.kg_allergens !== undefined)  row.kg_allergens = d.kg_allergens
    if (d.kg_enriched_at !== undefined) row.kg_enriched_at = d.kg_enriched_at

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
        .in('status', ['approved', 'active'])

    if (error) {
        safeWarn('[locations.api] Failed to fetch categories, using mocks:', error.message)
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

// ─── Menu persistence ──────────────────────────────────────────────────────

export async function getLocationMenu(locationId) {
    if (!supabase) {
        safeWarn('[locations.api] Supabase not configured, returning empty menu')
    }

    const { data, error } = await supabase
        .from('location_dishes')
        .select('*, dishes(*)')
        .eq('location_id', locationId)

    if (error) {
        safeWarn('[locations.api] Failed to fetch menu:', error.message)
        return []
    }

    return (data ?? []).map(ld => {
        const dish = ld.dishes || {}
        return {
            id: dish.id,
            name: dish.name,
            description: dish.description,
            price: ld.price,
            category: dish.category,
            is_signature: ld.is_signature,
            available: ld.available,
            vegetarian: dish.vegetarian,
            vegan: dish.vegan,
            gluten_free: dish.gluten_free,
        }
    })
}

export async function saveScannedMenu(locationId, dishes) {
    if (!supabase) {
        safeWarn('[locations.api] Supabase not configured, cannot save scanned menu')
    }

    const CATEGORY_MAP = {
        appetizer: 'appetizer',
        starters: 'appetizer',
        starter: 'appetizer',
        main: 'main',
        mains: 'main',
        'main course': 'main',
        'main courses': 'main',
        entree: 'main',
        entrees: 'main',
        dessert: 'dessert',
        desserts: 'dessert',
        drink: 'drink',
        drinks: 'drink',
        beverage: 'drink',
        beverages: 'drink',
        snack: 'snack',
        snacks: 'snack',
    }

    let saved = 0
    let duplicates = 0

    try {
        for (const dish of dishes) {
            const rawCategory = (dish.category || '').toLowerCase().trim()
            const category = CATEGORY_MAP[rawCategory] || 'main'
            const dishName = (dish.name || '').trim()

            if (!dishName) continue

            // Try to find existing dish by name (case-insensitive)
            const { data: existing, error: findError } = await supabase
                .from('dishes')
                .select('id')
                .ilike('name', dishName)
                .maybeSingle()

            if (findError) {
                safeWarn('[locations.api] Error finding dish:', findError.message)
                continue
            }

            let dishId
            if (existing?.id) {
                dishId = existing.id
                duplicates++
            } else {
                const { data: inserted, error: insertError } = await supabase
                    .from('dishes')
                    .insert({
                        name: dishName,
                        description: dish.description || '',
                        category,
                    })
                    .select('id')
                    .single()

                if (insertError) {
                    safeWarn('[locations.api] Error inserting dish:', insertError.message)
                    continue
                }
                dishId = inserted.id
                saved++
            }

            // Upsert into location_dishes
            const { error: linkError } = await supabase
                .from('location_dishes')
                .upsert({
                    location_id: locationId,
                    dish_id: dishId,
                    price: dish.price || '',
                }, { onConflict: 'location_id,dish_id' })

            if (linkError) {
                safeWarn('[locations.api] Error linking dish to location:', linkError.message)
            }
        }
    } catch (err) {
        safeWarn('[locations.api] saveScannedMenu failed:', err.message)
    }

    return { saved, duplicates }
}

export async function deleteLocationDish(locationId, dishId) {
    if (!supabase) {
        safeWarn('[locations.api] Supabase not configured, cannot delete location dish')
        return { success: false }
    }

    const { error } = await supabase
        .from('location_dishes')
        .delete()
        .eq('location_id', locationId)
        .eq('dish_id', dishId)

    if (error) {
        safeWarn('[locations.api] Failed to delete location dish:', error.message)
        return { success: false }
    }

    return { success: true }
}

export async function updateLocationDish(locationId, dishId, updates) {
    if (!supabase) {
        safeWarn('[locations.api] Supabase not configured, cannot update location dish')
        return { success: false }
    }

    const payload = {}
    if (updates.price !== undefined) payload.price = updates.price
    if (updates.is_signature !== undefined) payload.is_signature = updates.is_signature
    if (updates.available !== undefined) payload.available = updates.available

    if (Object.keys(payload).length === 0) {
        return { success: true }
    }

    const { error } = await supabase
        .from('location_dishes')
        .update(payload)
        .eq('location_id', locationId)
        .eq('dish_id', dishId)

    if (error) {
        safeWarn('[locations.api] Failed to update location dish:', error.message)
        return { success: false }
    }

    return { success: true }
}

export { normalise }

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
    getLocationMenu,
    saveScannedMenu,
    deleteLocationDish,
    updateLocationDish,
}
