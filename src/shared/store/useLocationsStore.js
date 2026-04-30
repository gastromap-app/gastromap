import { create } from 'zustand'
import { MOCK_LOCATIONS } from '@/mocks/locations'

import { applyAllFilters } from '@/shared/utils/locationFilters'

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
    activeCategories: [],
    activeCategory: 'All', // Added for backward compatibility with components using singular selection
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
    isOpenNow: false,
}

// FIX ARCH-2: Do NOT seed with mocks in production — causes stale data flash
const isDev = import.meta.env.DEV
const INITIAL_LOCATIONS = isDev ? MOCK_LOCATIONS : []

export const useLocationsStore = create((set, get) => ({
    locations: INITIAL_LOCATIONS,
    isInitialized: false, // true after first successful full fetch (no city/country filter)
    initError: null,      // error message if last init failed (allows retry)
    filteredLocations: INITIAL_LOCATIONS,
    mapMarkers: [],       // New: Specific locations currently visible/relevant to the map view
    isLoading: false,
    // FIX: Pagination state — load in pages to avoid huge payloads
    currentPage: 0,
    pageSize: 200,
    hasMore: true,
    isLoadingMore: false,

    ...DEFAULT_FILTERS,

    // ─── Filter setters ───────────────────────────────────────────────────

    setCategory: async (cat) => {
        set({ activeCategories: [cat], activeCategory: cat, isInitialized: false });
        await get().initialize();
    },

    toggleCategory: async (cat) => {
        const state = get();
        const next = state.activeCategories.includes(cat)
            ? state.activeCategories.filter(c => c !== cat)
            : [...state.activeCategories, cat];
        const nextActive = next.length > 0 ? next[0] : 'All';
        
        set({ activeCategories: next, activeCategory: nextActive, isInitialized: false });
        await get().initialize();
    },

    setIsOpenNow: (isOpenNow) => set(state => ({
        isOpenNow,
        filteredLocations: applyAllFilters(state.locations, { ...state, isOpenNow }),
    })),

    setSearchQuery: async (query) => {
        if (get().searchQuery === query) return;
        set({ searchQuery: query, isInitialized: false });
        await get().initialize();
    },

    setPriceLevels: async (activePriceLevels) => {
        set({ activePriceLevels, isInitialized: false });
        await get().initialize();
    },

    setMinRating: async (minRating) => {
        set({ minRating, isInitialized: false });
        await get().initialize();
    },

    setVibes: async (activeVibes) => {
        set({ activeVibes, isInitialized: false });
        await get().initialize();
    },

    toggleVibe: async (vibe) => {
        const state = get();
        const next = state.activeVibes.includes(vibe)
            ? state.activeVibes.filter(v => v !== vibe)
            : [...state.activeVibes, vibe];
        
        set({ activeVibes: next, isInitialized: false });
        await get().initialize();
    },

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

    setSortBy: async (sortBy) => {
        set({ sortBy, isInitialized: false });
        await get().initialize();
    },

    setCity: async (activeCity) => {
        set({ activeCity, isInitialized: false });
        await get().initialize();
    },

    setCountry: async (activeCountry) => {
        set({ activeCountry, isInitialized: false });
        await get().initialize();
    },

    /**
     * Apply multiple filter changes at once — single set() call, one re-render.
     * @param {Partial<LocationFiltersState>} updates
     */
    applyFilters: (updates = {}) =>
        set(state => {
            const next = { ...state, ...updates }
            // Sync activeCategory if activeCategories was updated
            if (updates.activeCategories) {
                updates.activeCategory = updates.activeCategories.length > 0 ? updates.activeCategories[0] : 'All'
            }
            
            // Defensive check for the filtering utility function
            const filtered = (typeof applyAllFilters === 'function') 
                ? applyAllFilters(state.locations, next)
                : state.locations;

            return { ...updates, filteredLocations: filtered }
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
        if (state.activeCategories?.length > 0) count++
        if (state.searchQuery) count++
        if (state.activePriceLevels?.length > 0) count++
        if (state.minRating !== null) count++
        if (state.activeVibes?.length > 0) count++
        if (state.activeBestTime !== null) count++
        if (state.radius > 0) count++
        if (state.activeCity !== 'All') count++
        if (state.activeCountry !== 'All') count++
        if (state.isOpenNow) count++
        return count
    },

    updateUserLocation: async () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'))
                return
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude
                    const lng = pos.coords.longitude
                    get().setUserLocation({ lat, lng })
                    resolve({ lat, lng })
                },
                (err) => {
                    reject(err)
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            )
        })
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

    setBounds: (bounds) => {
        set({ currentBounds: bounds });
    },

    fetchInBounds: async (bounds) => {
        const state = get();
        if (!state.isInitialized) return;

        set({ isLoading: true });
        try {
            const { getLocations } = await import('@/shared/api/locations.api');
            const result = await getLocations({
                category: state.activeCategory !== 'All' ? state.activeCategory : null,
                city: state.activeCity !== 'All' ? state.activeCity : null,
                country: state.activeCountry !== 'All' ? state.activeCountry : null,
                query: state.searchQuery,
                price_range: state.activePriceLevels,
                minRating: state.minRating,
                vibe: state.activeVibes,
                sortBy: state.sortBy,
                bounds,
                limit: 500
            });

            const data = result?.data ?? result;

            if (Array.isArray(data)) {
                // Best Practice: Enrich global cache, but only update specific mapMarkers
                const existingLocations = get().locations;
                const locationsMap = new Map(existingLocations.map(loc => [loc.id, loc]));
                data.forEach(loc => locationsMap.set(loc.id, loc));

                const mergedLocations = Array.from(locationsMap.values());
                
                set({ 
                    locations: mergedLocations,
                    filteredLocations: applyAllFilters(mergedLocations, get()),
                    mapMarkers: data, // Map only shows what was returned for these bounds
                    isLoading: false 
                });
            } else {
                set({ isLoading: false });
            }
        } catch (error) {
            console.error('[useLocationsStore] fetchInBounds failed:', error.message);
            set({ isLoading: false });
        }
    },

    initialize: async (_customFilters = {}) => {
        const state = get();
        if (state.isLoading) return;
        
        // Only clear if we don't have any locations yet to avoid flicker
        const shouldClear = state.locations.length === 0;
        
        set({ 
            isLoading: true, 
            currentPage: 0, 
            hasMore: true,
            ...(shouldClear ? { locations: [], filteredLocations: [] } : {})
        });
        
        try {
            const { getLocations } = await import('@/shared/api/locations.api');
            const filters = {
                category: state.activeCategory !== 'All' ? state.activeCategory : null,
                city: state.activeCity !== 'All' ? state.activeCity : null,
                country: state.activeCountry !== 'All' ? state.activeCountry : null,
                query: state.searchQuery,
                price_range: state.activePriceLevels,
                minRating: state.minRating,
                vibe: state.activeVibes,
                sortBy: state.sortBy,
                bounds: state.currentBounds,
                limit: state.pageSize,
                offset: 0
            };

            const result = await getLocations(filters);
            const data = result?.data ?? result;
            
            if (Array.isArray(data)) {
                set({
                    locations: data,
                    filteredLocations: applyAllFilters(data, get()),
                    mapMarkers: data, // Sync map markers on full init
                    isLoading: false,
                    isInitialized: true,
                    initError: null,
                    currentPage: 1,
                    hasMore: result?.hasMore ?? data.length >= state.pageSize,
                });
            } else {
                set({ isLoading: false, isInitialized: true, initError: null, hasMore: false });
            }
        } catch (err) {
            console.error('[useLocationsStore] initialize failed:', err.message);
            set({ isLoading: false, initError: err.message });
        }
    },

    loadMore: async () => {
        const state = get();
        if (state.isLoadingMore || !state.hasMore) return;
        
        set({ isLoadingMore: true });
        
        try {
            const { getLocations } = await import('@/shared/api/locations.api');
            const offset = state.currentPage * state.pageSize;
            const filters = {
                category: state.activeCategory !== 'All' ? state.activeCategory : null,
                city: state.activeCity !== 'All' ? state.activeCity : null,
                country: state.activeCountry !== 'All' ? state.activeCountry : null,
                query: state.searchQuery,
                price_range: state.activePriceLevels,
                minRating: state.minRating,
                vibe: state.activeVibes,
                sortBy: state.sortBy,
                bounds: state.currentBounds,
                limit: state.pageSize,
                offset
            };

            const result = await getLocations(filters);
            const data = result?.data ?? result;
            
            if (Array.isArray(data) && data.length > 0) {
                const merged = [...state.locations, ...data];
                set({
                    locations: merged,
                    filteredLocations: applyAllFilters(merged, get()),
                    currentPage: state.currentPage + 1,
                    hasMore: result?.hasMore ?? data.length >= state.pageSize,
                    isLoadingMore: false,
                });
            } else {
                set({ hasMore: false, isLoadingMore: false });
            }
        } catch (err) {
            console.error('[useLocationsStore] loadMore failed:', err.message);
            set({ isLoadingMore: false });
        }
    },

    /** Force re-fetch locations from Supabase (pull-to-refresh, admin action). */
    reinitialize: async () => {
        set({ isLoading: false, isInitialized: false })
        await get().initialize()
    },
}))
