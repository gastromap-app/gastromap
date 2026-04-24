import { create } from 'zustand'
import { MOCK_LOCATIONS } from '@/mocks/locations'

/**
 * useLocationsStore — Single Source of Truth for location data.
 *
 * Canonical location: @/shared/store/useLocationsStore
 *
 * This store is the ONLY source of location data for all user-facing pages
 * (Dashboard, Map, Explore, AI tools, etc.). Data is loaded once via
 * `initialize()` (called in App.jsx) and persists across route changes.
 *
 * Admin pages use their own React Query hook (useAdminLocationsQuery) for
 * independent fetching with `all: true` (includes pending/rejected locations).
 *
 * Filter state (category, search, price, vibes, etc.) is also managed here.
 * Changing any filter automatically recomputes `filteredLocations`.
 */

const DEFAULT_FILTERS = {
    activeCategory: 'All',
    searchQuery: '',
    activePriceLevels: [],
    minRating: null,
    activeVibes: [],
    activeBestTime: null,
    radius: 0,
    userLocation: null, // { lat, lng }
    sortBy: 'google_rating',
    activeCity: 'All',
    activeCountry: 'All',
}

/** Compare price levels for sort: $ < $$ < $$$ */
const PRICE_ORDER = { '$': 1, '$$': 2, '$$$': 3 }

// Best-time label groups for matching against location data
const BEST_TIME_LABELS = {
    morning:    ['Morning', 'Breakfast', 'Brunch', 'Cafe', 'Coffee', 'Завтрак', 'Утро'],
    day:        ['Lunch', 'Business lunch', 'Midday', 'Ланч', 'Обед', 'День'],
    evening:    ['Dinner', 'Evening', 'Date night', 'Bar', 'Fine Dining', 'Ужин', 'Вечер'],
    late_night: ['Night', 'Late night', 'Bar', 'Club', 'Nightlife', 'Ночь', 'Поздний ужин'],
}

export function applyAllFilters(locations, filters) {
    const {
        activeCategory,
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
    } = filters

    let result = [...locations]

    // ─── Category ────────────────────────────────────────────────────────────
    if (activeCategory && activeCategory !== 'All') {
        result = result.filter(loc => loc.category === activeCategory)
    }

    // ─── Country ─────────────────────────────────────────────────────────────
    if (activeCountry && activeCountry !== 'All') {
        result = result.filter(loc => loc.country === activeCountry)
    }

    // ─── City ────────────────────────────────────────────────────────────────
    if (activeCity && activeCity !== 'All') {
        result = result.filter(loc => loc.city === activeCity)
    }

    // ─── Search ───────────────────────────────────────────────────────────────
    // FIX: safe null-checks + correct field names (cuisine_types → kg_cuisines/cuisine)
    if (searchQuery) {
        const q = searchQuery.toLowerCase()
        result = result.filter(loc =>
            (loc.title?.toLowerCase().includes(q)) ||
            (loc.description?.toLowerCase().includes(q)) ||
            (loc.kg_cuisines?.some(c => c?.toLowerCase().includes(q))) ||
            (loc.cuisine?.toLowerCase().includes(q)) ||
            (loc.tags?.some(tag => tag?.toLowerCase().includes(q))) ||
            (loc.kg_dishes?.some(d => d?.toLowerCase().includes(q)))
        )
    }

    // ─── Price ───────────────────────────────────────────────────────────────
    if (activePriceLevels?.length) {
        result = result.filter(loc =>
            activePriceLevels.includes(loc.price_range) ||
            activePriceLevels.includes(loc.price_level) ||
            activePriceLevels.includes(loc.priceLevel)
        )
    }

    // ─── Rating ──────────────────────────────────────────────────────────────
    if (minRating != null) {
        result = result.filter(loc => (loc.rating ?? loc.google_rating ?? 0) >= minRating)
    }

    // ─── Vibes / Labels ──────────────────────────────────────────────────────
    if (activeVibes?.length) {
        result = result.filter(loc => {
            const labels = [
                ...(Array.isArray(loc.special_labels) ? loc.special_labels : []),
                ...(Array.isArray(loc.features) ? loc.features : []),
                ...(Array.isArray(loc.vibe) ? loc.vibe : (loc.vibe ? [loc.vibe] : [])),
                ...(Array.isArray(loc.best_for) ? loc.best_for : []),
                ...(Array.isArray(loc.kg_cuisines) ? loc.kg_cuisines : []),
                ...(Array.isArray(loc.kg_dishes) ? loc.kg_dishes : []),
                ...(loc.cuisine ? [loc.cuisine] : []),
            ].map(l => String(l || '').toLowerCase().trim())

            return activeVibes.some(v => {
                const searchVal = String(v || '').toLowerCase().trim()
                return labels.includes(searchVal)
            })
        })
    }

    // ─── Best Time ───────────────────────────────────────────────────────────
    if (activeBestTime) {
        const timeLabels = BEST_TIME_LABELS[activeBestTime] ?? []
        result = result.filter(loc => {
            const labels = [
                loc.category ?? '',
                ...(Array.isArray(loc.best_for) ? loc.best_for : []),
                ...(Array.isArray(loc.features) ? loc.features : []),
                ...(Array.isArray(loc.special_labels) ? loc.special_labels : []),
            ].map(l => String(l || '').toLowerCase().trim())

            // Match by ID directly in best_for or by associated keywords
            const hasIdMatch = Array.isArray(loc.best_for) && loc.best_for.includes(activeBestTime)
            const hasKeywordMatch = timeLabels.some(tl =>
                labels.some(l => l.includes(tl.toLowerCase()))
            )
            return hasIdMatch || hasKeywordMatch
        })
    }

    // ─── Radius (Distance) ──────────────────────────────────────────────────
    if (radius > 0 && userLocation?.lat && userLocation?.lng) {
        result = result.filter(loc => {
            const lat = loc.latitude ?? loc.coordinates?.lat
            const lng = loc.longitude ?? loc.coordinates?.lng
            if (!lat || !lng) return false
            const d = calculateDistance(userLocation.lat, userLocation.lng, lat, lng)
            return d <= radius
        })
    }

    // ─── Sort ────────────────────────────────────────────────────────────────
    switch (sortBy) {
        case 'rating': // Prioritize internal rating
        case 'google_rating':
            result.sort((a, b) => (b.rating ?? b.google_rating ?? 0) - (a.rating ?? a.google_rating ?? 0))
            break
        case 'price_asc':
            result.sort(
                (a, b) => (PRICE_ORDER[a.price_range ?? a.price_level] ?? 0) -
                           (PRICE_ORDER[b.price_range ?? b.price_level] ?? 0)
            )
            break
        case 'price_desc':
            result.sort(
                (a, b) => (PRICE_ORDER[b.price_range ?? b.price_level] ?? 0) -
                           (PRICE_ORDER[a.price_range ?? a.price_level] ?? 0)
            )
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

/** Haversine formula to calculate distance in km */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371 // Earth's radius
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// FIX ARCH-2: Do NOT seed with mocks in production — causes stale data flash
const isDev = import.meta.env.DEV
const INITIAL_LOCATIONS = isDev ? MOCK_LOCATIONS : []

export const useLocationsStore = create((set, get) => ({
    locations: INITIAL_LOCATIONS,
    isInitialized: false, // true after first successful full fetch (no city/country filter)
    initError: null,      // error message if last init failed (allows retry)
    filteredLocations: INITIAL_LOCATIONS,
    isLoading: false,

    ...DEFAULT_FILTERS,

    // ─── Filter setters ───────────────────────────────────────────────────

    setCategory: (activeCategory) =>
        set(state => ({
            activeCategory,
            filteredLocations: applyAllFilters(state.locations, { ...state, activeCategory }),
        })),

    setSearchQuery: (searchQuery) =>
        set(state => ({
            searchQuery,
            filteredLocations: applyAllFilters(state.locations, { ...state, searchQuery }),
        })),

    setPriceLevels: (activePriceLevels) =>
        set(state => ({
            activePriceLevels,
            filteredLocations: applyAllFilters(state.locations, { ...state, activePriceLevels }),
        })),

    setMinRating: (minRating) =>
        set(state => ({
            minRating,
            filteredLocations: applyAllFilters(state.locations, { ...state, minRating }),
        })),

    setVibes: (activeVibes) =>
        set(state => ({
            activeVibes,
            filteredLocations: applyAllFilters(state.locations, { ...state, activeVibes }),
        })),

    // FIX BUG-6: Best Time setter (was missing)
    setBestTime: (activeBestTime) =>
        set(state => ({
            activeBestTime,
            filteredLocations: applyAllFilters(state.locations, { ...state, activeBestTime }),
        })),

    // Set radius and re-filter
    setRadius: (radius) =>
        set(state => ({
            radius,
            filteredLocations: applyAllFilters(state.locations, { ...state, radius }),
        })),

    // Set user location and re-filter
    setUserLocation: (userLocation) =>
        set(state => ({
            userLocation,
            filteredLocations: applyAllFilters(state.locations, { ...state, userLocation }),
        })),

    setSortBy: (sortBy) =>
        set(state => ({
            sortBy,
            filteredLocations: applyAllFilters(state.locations, { ...state, sortBy }),
        })),

    setCity: (activeCity) =>
        set(state => ({
            activeCity,
            filteredLocations: applyAllFilters(state.locations, { ...state, activeCity }),
        })),

    setCountry: (activeCountry) =>
        set(state => ({
            activeCountry,
            filteredLocations: applyAllFilters(state.locations, { ...state, activeCountry }),
        })),

    /**
     * Apply multiple filter changes at once — single set() call, one re-render.
     * @param {Partial<LocationFiltersState>} updates
     */
    applyFilters: (updates = {}) =>
        set(state => {
            const next = { ...state, ...updates }
            return { ...updates, filteredLocations: applyAllFilters(state.locations, next) }
        }),

    /** Reset all filters to defaults — single re-render */
    resetFilters: () =>
        set(state => ({
            ...DEFAULT_FILTERS,
            filteredLocations: state.locations,
        })),

    getActiveFiltersCount: () => {
        const state = get()
        let count = 0
        if (state.activeCategory !== 'All') count++
        if (state.searchQuery) count++
        if (state.activePriceLevels?.length > 0) count++
        if (state.minRating !== null) count++
        if (state.activeVibes?.length > 0) count++
        if (state.activeBestTime !== null) count++
        if (state.radius > 0) count++
        if (state.activeCity !== 'All') count++
        if (state.activeCountry !== 'All') count++
        return count
    },

    // ─── Data mutations ──────────────────────────────────────────────────

    setLocations: (locations) =>
        set((state) => ({
            locations,
            filteredLocations: applyAllFilters(locations, state),
        })),

    addLocation: (location) =>
        set((state) => {
            const locations = [
                ...state.locations,
                { ...location, id: location.id || Math.random().toString(36).slice(2, 11) },
            ]
            return { locations, filteredLocations: applyAllFilters(locations, state) }
        }),

    updateLocation: (id, updates) =>
        set((state) => {
            const locations = state.locations.map(loc =>
                loc.id === id ? { ...loc, ...updates } : loc
            )
            return { locations, filteredLocations: applyAllFilters(locations, state) }
        }),

    deleteLocation: (id) =>
        set((state) => {
            const locations = state.locations.filter(loc => loc.id !== id)
            return { locations, filteredLocations: applyAllFilters(locations, state) }
        }),

    /** Load all locations from Supabase and populate the store. */
    initialize: async () => {
        // Skip only if: currently fetching OR already loaded with actual data
        // Allow retry if initialized but empty (network fail / status mismatch)
        if (get().isLoading) return
        if (get().isInitialized && get().locations.length > 0) return
        set({ isLoading: true })
        try {
            const { getLocations } = await import('@/shared/api/locations.api')
            const result = await getLocations({ limit: 500 })
            const data = result?.data ?? result
            if (Array.isArray(data) && data.length > 0) {
                set((state) => ({
                    locations: data,
                    filteredLocations: applyAllFilters(data, state),
                    isLoading: false,
                    isInitialized: true,
                    initError: null,
                }))
            } else {
                // Empty response is still a successful init — DB may have no data yet
                set({ isLoading: false, isInitialized: true, initError: null })
            }
        } catch (err) {
            // On error: do NOT set isInitialized=true — allow retry on next mount
            console.error('[useLocationsStore] initialize failed:', err.message)
            set({ isLoading: false, initError: err.message })
        }
    },

    /** Force re-fetch locations from Supabase (pull-to-refresh, admin action). */
    reinitialize: async () => {
        set({ isLoading: false, isInitialized: false })
        await get().initialize()
    },
}))
