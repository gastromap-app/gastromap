import { translate } from '@/utils/translation'

/** Compare price levels for sort: $ < $$ < $$$ */
const PRICE_ORDER = { '$': 1, '$$': 2, '$$$': 3 }

// Best-time label groups for matching against location data
const BEST_TIME_LABELS = {
    morning:    ['Morning', 'Breakfast', 'Brunch', 'Cafe', 'Coffee', 'Завтрак', 'Утро'],
    day:        ['Lunch', 'Business lunch', 'Midday', 'Ланч', 'Обед', 'День'],
    evening:    ['Dinner', 'Evening', 'Date night', 'Bar', 'Fine Dining', 'Ужин', 'Вечер'],
    late_night: ['Night', 'Late night', 'Bar', 'Club', 'Nightlife', 'Ночь', 'Поздний ужин'],
}

/** 
 * Helper to check if a location is currently open.
 * Supports format "HH:mm - HH:mm" or "HH:mm-HH:mm"
 */
export function isLocationOpen(openingHours) {
    if (!openingHours) return true 
    try {
        const now = new Date()
        const currentTime = now.getHours() * 60 + now.getMinutes()
        
        const parts = openingHours.split('-').map(p => p.trim())
        if (parts.length !== 2) return true

        const parseTime = (t) => {
            const [h, m] = t.split(':').map(Number)
            return h * 60 + m
        }

        const start = parseTime(parts[0])
        const end = parseTime(parts[1])

        if (end < start) {
            // Over midnight
            return currentTime >= start || currentTime <= end
        }
        return currentTime >= start && currentTime <= end
    } catch (err) {
        return true
    }
}

/** Haversine formula to calculate distance in km */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371 // Earth's radius
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

export function applyAllFilters(locations, filters) {
    if (!locations || locations.length === 0) return []

    const {
        activeCategories,
        searchQuery,
        activePriceLevels,
        minRating,
        activeVibes,
        activeBestTime,
        radius,
        userLocation,
        sortBy,
        activeCity,
        activeCountry,
        isOpenNow,
    } = filters

    // ─── Pre-processing for Search ──────────────────────────────────────────
    const q = searchQuery?.toLowerCase().trim()
    const qEn = q ? translate(searchQuery).toLowerCase().trim() : null

    // ─── Pre-processing for Categories ──────────────────────────────────────
    const cats = (activeCategories && activeCategories.length > 0)
        ? activeCategories.map(c => String(c).toLowerCase().trim())
        : (filters.activeCategory && filters.activeCategory !== 'All' 
            ? [String(filters.activeCategory).toLowerCase().trim()] 
            : [])

    // ─── Pre-processing for Vibes ───────────────────────────────────────────
    const targetVibes = activeVibes?.length 
        ? activeVibes.map(v => translate(String(v || '').trim()).toLowerCase())
        : []

    // ─── Single Pass Filter ──────────────────────────────────────────────────
    let result = locations.filter(loc => {
        // 1. Categories
        if (cats.length > 0) {
            const locCat = String(loc.category || '').toLowerCase().trim()
            if (!cats.includes(locCat)) return false
        }

        // 2. Open Now
        if (isOpenNow && !isLocationOpen(loc.openingHours || loc.hours)) return false

        // 3. Country
        if (activeCountry && activeCountry !== 'All') {
            const targetCountry = activeCountry.toLowerCase().trim()
            if (!loc.country?.toLowerCase().trim().includes(targetCountry)) return false
        }

        // 4. City
        if (activeCity && activeCity !== 'All') {
            const targetCity = activeCity.toLowerCase().trim()
            const targetCityEn = translate(activeCity).toLowerCase().trim()
            const locCity = (loc.city || '').toLowerCase().trim()
            if (!locCity.includes(targetCity) && !locCity.includes(targetCityEn)) return false
        }

        // 5. Search (Title, Description, etc.)
        if (q) {
            const matches = (
                (loc.title?.toLowerCase().includes(q) || loc.title?.toLowerCase().includes(qEn)) ||
                (loc.description?.toLowerCase().includes(q) || loc.description?.toLowerCase().includes(qEn)) ||
                (loc.city?.toLowerCase().includes(q) || loc.city?.toLowerCase().includes(qEn)) ||
                (loc.address?.toLowerCase().includes(q) || loc.address?.toLowerCase().includes(qEn)) ||
                (loc.category?.toLowerCase().includes(q) || loc.category?.toLowerCase().includes(qEn)) ||
                (loc.kg_cuisines?.some(c => c?.toLowerCase().includes(q) || c?.toLowerCase().includes(qEn))) ||
                (loc.cuisine?.toLowerCase().includes(q) || loc.cuisine?.toLowerCase().includes(qEn)) ||
                (loc.tags?.some(tag => tag?.toLowerCase().includes(q) || tag?.toLowerCase().includes(qEn))) ||
                (loc.kg_dishes?.some(d => d?.toLowerCase().includes(q) || d?.toLowerCase().includes(qEn))) ||
                (loc.ai_keywords?.some(k => k?.toLowerCase().includes(q) || k?.toLowerCase().includes(qEn)))
            )
            if (!matches) return false
        }

        // 6. Price
        if (activePriceLevels?.length) {
            if (!activePriceLevels.includes(loc.price_range)) return false
        }

        // 7. Rating
        if (minRating != null) {
            if ((loc.rating ?? loc.google_rating ?? 0) < minRating) return false
        }

        // 8. Vibes (Expensive - only run if activeVibes present)
        if (targetVibes.length > 0) {
            const labels = [
                ...(Array.isArray(loc.special_labels) ? loc.special_labels : []),
                ...(Array.isArray(loc.features) ? loc.features : []),
                ...(Array.isArray(loc.vibe) ? loc.vibe : (loc.vibe ? [loc.vibe] : [])),
                ...(Array.isArray(loc.best_for) ? loc.best_for : []),
                ...(Array.isArray(loc.kg_cuisines) ? loc.kg_cuisines : []),
                ...(Array.isArray(loc.kg_dishes) ? loc.kg_dishes : []),
                ...(loc.cuisine ? [loc.cuisine] : []),
            ]
            const hasMatch = targetVibes.some(v => 
                labels.some(l => translate(String(l || '').trim()).toLowerCase() === v)
            )
            if (!hasMatch) return false
        }

        // 9. Best Time
        if (activeBestTime) {
            const timeLabels = BEST_TIME_LABELS[activeBestTime] ?? []
            const labels = [
                loc.category ?? '',
                ...(Array.isArray(loc.best_for) ? loc.best_for : []),
                ...(Array.isArray(loc.features) ? loc.features : []),
                ...(Array.isArray(loc.special_labels) ? loc.special_labels : []),
            ].map(l => String(l || '').toLowerCase().trim())

            const hasIdMatch = Array.isArray(loc.best_for) && loc.best_for.includes(activeBestTime)
            const hasKeywordMatch = timeLabels.some(tl =>
                labels.some(l => l.includes(tl.toLowerCase()))
            )
            if (!hasIdMatch && !hasKeywordMatch) return false
        }

        return true
    })

    // ─── Post-processing: Distance & Sorting ─────────────────────────────────
    // Only calculate distance if needed (radius filter or distance sorting)
    const needsDistance = (radius > 0) || sortBy === 'distance'
    
    if (needsDistance && userLocation?.lat && userLocation?.lng) {
        result = result.map(loc => {
            const lat = loc.lat ?? loc.latitude ?? loc.coordinates?.lat
            const lng = loc.lng ?? loc.longitude ?? loc.coordinates?.lng
            const distance = (lat != null && lng != null)
                ? calculateDistance(userLocation.lat, userLocation.lng, lat, lng)
                : Infinity
            return { ...loc, distance }
        })

        if (radius > 0) {
            result = result.filter(loc => loc.distance <= radius)
        }
    }

    // Sort
    switch (sortBy) {
        case 'distance':
            result.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity))
            break
        case 'rating':
        case 'google_rating':
            result.sort((a, b) => (b.rating ?? b.google_rating ?? 0) - (a.rating ?? a.google_rating ?? 0))
            break
        case 'price_asc':
            result.sort((a, b) => (PRICE_ORDER[a.price_range] ?? 0) - (PRICE_ORDER[b.price_range] ?? 0))
            break
        case 'price_desc':
            result.sort((a, b) => (PRICE_ORDER[b.price_range] ?? 0) - (PRICE_ORDER[a.price_range] ?? 0))
            break
        case 'name':
            result.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
            break
        case 'newest':
            result.sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0))
            break
        default:
            break
    }

    return result
}
