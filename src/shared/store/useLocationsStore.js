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
    sortBy: 'rating',
}

/** Compare price levels for sort: $ < $$ < $$$ */
const PRICE_ORDER = { '$': 1, '$$': 2, '$$$': 3 }

// Best-time label groups for matching against location data
const BEST_TIME_LABELS = {
    morning: ['Morning', 'Breakfast', 'Brunch', 'Cafe', 'Coffee'],
    lunch:   ['Lunch', 'Business lunch', 'Midday'],
    evening: ['Dinner', 'Evening', 'Date night', 'Bar', 'Fine Dining'],
}

function applyAllFilters(locations, filters) {
    const {
        activeCategory,
        searchQuery,
        activePriceLevels,
        minRating,
        activeVibes,
        activeBestTime,
        sortBy,
    } = filters

    let result = [...locations]

    // ─── Category ────────────────────────────────────────────────────────────
    if (activeCategory && activeCategory !== 'All') {
        result = result.filter(loc => loc.category === activeCategory)
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
        result = result.filter(loc => (loc.rating ?? 0) >= minRating)
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
            ]
            return activeVibes.some(v => labels.includes(v))
        })
    }

    // ─── Best Time ───────────────────────────────────────────────────────────
    // FIX: now actually applied (was UI-only before)
    if (activeBestTime) {
        const timeLabels = BEST_TIME_LABELS[activeBestTime] ?? []
        result = result.filter(loc => {
            const labels = [
                loc.category ?? '',
                ...(Array.isArray(loc.best_for) ? loc.best_for : []),
                ...(Array.isArray(loc.features) ? loc.features : []),
                ...(Array.isArray(loc.special_labels) ? loc.special_labels : []),
            ]
            return timeLabels.some(tl =>
                labels.some(l => l?.toLowerCase().includes(tl.toLowerCase()))
            )
        })
    }

    // ─── Sort ────────────────────────────────────────────────────────────────
    switch (sortBy) {
        case 'rating':
            result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
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
        default:
            break
    }

    return result
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

    // FIX BUG-4: Radius setter — also re-apply filters to trigger UI update
    setRadius: (radius) =>
        set(state => ({
            radius,
            filteredLocations: applyAllFilters(state.locations, { ...state, radius }),
        })),

    setSortBy: (sortBy) =>
        set(state => ({
            sortBy,
            filteredLocations: applyAllFilters(state.locations, { ...state, sortBy }),
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
        if (get().isInitialized || get().isLoading) {
            return
        }
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

    /** Force re-fetch locations from Supabase (resets isLoading guard first). */
    reinitialize: async () => {
        set({ isLoading: false })
        await get().initialize()
    },
}))
