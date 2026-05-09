import { create } from 'zustand'
import { MOCK_LOCATIONS } from '@/mocks/locations'
import { supabase } from '@/shared/api/client'

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
    _initGen: 0,          // generation counter — discard stale fetch results
    _realtimeChannel: null, // Supabase Realtime channel for locations table
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

    setCategory: (cat) => {
        // 'All' means no category filter — use empty array (consistent with resetFilters)
        const updates = cat === 'All'
            ? { activeCategories: [], activeCategory: 'All' }
            : { activeCategories: [cat], activeCategory: cat };
        set(state => ({ ...updates, filteredLocations: applyAllFilters(state.locations, { ...state, ...updates }) }));
    },

    toggleCategory: (cat) => {
        const state = get();
        const next = state.activeCategories.includes(cat)
            ? state.activeCategories.filter(c => c !== cat)
            : [...state.activeCategories, cat];
        const nextActive = next.length > 0 ? next[0] : 'All';
        const updates = { activeCategories: next, activeCategory: nextActive };
        set(state => ({ ...updates, filteredLocations: applyAllFilters(state.locations, { ...state, ...updates }) }));
    },

    setIsOpenNow: (isOpenNow) => set(state => ({
        isOpenNow,
        filteredLocations: applyAllFilters(state.locations, { ...state, isOpenNow }),
    })),

    setSearchQuery: (query) => {
        if (get().searchQuery === query) return;
        const updates = { searchQuery: query };
        set(state => ({ ...updates, filteredLocations: applyAllFilters(state.locations, { ...state, ...updates }) }));
    },

    setPriceLevels: (activePriceLevels) => {
        const updates = { activePriceLevels };
        set(state => ({ ...updates, filteredLocations: applyAllFilters(state.locations, { ...state, ...updates }) }));
    },

    setMinRating: (minRating) => {
        const updates = { minRating };
        set(state => ({ ...updates, filteredLocations: applyAllFilters(state.locations, { ...state, ...updates }) }));
    },

    setVibes: (activeVibes) => {
        const updates = { activeVibes };
        set(state => ({ ...updates, filteredLocations: applyAllFilters(state.locations, { ...state, ...updates }) }));
    },

    toggleVibe: (vibe) => {
        const state = get();
        const next = state.activeVibes.includes(vibe)
            ? state.activeVibes.filter(v => v !== vibe)
            : [...state.activeVibes, vibe];
        const updates = { activeVibes: next };
        set(state => ({ ...updates, filteredLocations: applyAllFilters(state.locations, { ...state, ...updates }) }));
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

    setSortBy: (sortBy) => {
        const updates = { sortBy };
        set(state => ({ ...updates, filteredLocations: applyAllFilters(state.locations, { ...state, ...updates }) }));
    },

    setCity: (activeCity) => {
        const updates = { activeCity };
        set(state => ({ ...updates, filteredLocations: applyAllFilters(state.locations, { ...state, ...updates }) }));
    },

    setCountry: (activeCountry) => {
        const updates = { activeCountry };
        set(state => ({ ...updates, filteredLocations: applyAllFilters(state.locations, { ...state, ...updates }) }));
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
                next.activeCategory = updates.activeCategories.length > 0 ? updates.activeCategories[0] : 'All'
            }
            
            // Defensive check for the filtering utility function
            const filtered = (typeof applyAllFilters === 'function') 
                ? applyAllFilters(state.locations, next)
                : state.locations;

            return { 
                ...updates, 
                ...(updates.activeCategories ? { activeCategory: next.activeCategory } : {}),
                filteredLocations: filtered 
            }
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
        // NOTE: activeCity / activeCountry are route context (URL params), not
        // user-applied filters. Counting them here caused false "1 filter" badge
        // when navigating Dashboard → Country → City.
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
            const generateId = () => {
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    return crypto.randomUUID()
                }
                return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
            }
            const locations = [
                ...state.locations,
                { ...location, id: location.id || generateId() },
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
        // Skip no-op update: avoid re-render cascade when bounds haven't changed
        const prev = get().currentBounds
        if (prev &&
            prev.sw.lat === bounds.sw.lat && prev.sw.lng === bounds.sw.lng &&
            prev.ne.lat === bounds.ne.lat && prev.ne.lng === bounds.ne.lng) {
            return
        }
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

        // Skip if already initialized and not forced — prevents duplicate fetches
        // on route changes (Dashboard → Map → Dashboard).
        if (state.isInitialized && state.locations.length > 0 && !_customFilters.force) return;

        // If a fetch is already in-flight, don't start another — but do
        // increment a generation counter so the stale fetch result is discarded.
        const currentGen = (state._initGen || 0) + 1

        // Only clear if we don't have any locations yet to avoid flicker
        const shouldClear = state.locations.length === 0;
        
        set({ 
            isLoading: true, 
            _initGen: currentGen,
            currentPage: 0, 
            hasMore: true,
            ...(shouldClear ? { locations: [], filteredLocations: [] } : {})
        });
        
        try {
            const { getLocations } = await import('@/shared/api/locations.api');
            const freshState = get();
            // If another initialize() started after us, discard our result
            if (freshState._initGen !== currentGen) return;

            const filters = {
                category: freshState.activeCategory !== 'All' ? freshState.activeCategory : null,
                city: freshState.activeCity !== 'All' ? freshState.activeCity : null,
                country: freshState.activeCountry !== 'All' ? freshState.activeCountry : null,
                query: freshState.searchQuery,
                price_range: freshState.activePriceLevels,
                minRating: freshState.minRating,
                vibe: freshState.activeVibes,
                sortBy: freshState.sortBy,
                bounds: freshState.currentBounds,
                limit: freshState.pageSize,
                offset: 0
            };

            const result = await getLocations(filters);
            const data = result?.data ?? result;

            // Check again — a newer initialize() might have started
            if (get()._initGen !== currentGen) return;
            
            if (Array.isArray(data)) {
                set({
                    locations: data,
                    filteredLocations: applyAllFilters(data, get()),
                    mapMarkers: data, // Sync map markers on full init
                    isLoading: false,
                    isInitialized: true,
                    initError: null,
                    currentPage: 1,
                    hasMore: result?.hasMore ?? data.length >= freshState.pageSize,
                });
            } else {
                set({ isLoading: false, isInitialized: true, initError: null, hasMore: false });
            }
        } catch (err) {
            console.error('[useLocationsStore] initialize failed:', err.message);
            // Only set error if we're still the active generation
            if (get()._initGen === currentGen) {
                set({ isLoading: false, initError: err.message });
            }
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
        set({ isInitialized: false })
        await get().initialize({ force: true })
    },

    /**
     * Subscribe to Supabase Realtime for the locations table.
     * When admin adds/edits/removes a location, the Zustand store
     * updates automatically — no re-fetch needed.
     * Returns an unsubscribe function.
     */
    subscribeToRealtime: () => {
        if (!supabase) return () => {}

        // Clean up any existing subscription first
        const prev = get()._realtimeChannel
        if (prev) {
            try { supabase.removeChannel(prev) } catch { /* already removed */ }
        }

        const channel = supabase
            .channel('locations-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'locations' },
                (payload) => {
                    const state = get()
                    if (payload.eventType === 'INSERT') {
                        // Avoid duplicates (upsert from admin)
                        if (state.locations.some(l => l.id === payload.new.id)) return
                        const updated = [...state.locations, payload.new]
                        set({ locations: updated, filteredLocations: applyAllFilters(updated, state) })
                    } else if (payload.eventType === 'UPDATE') {
                        // REPLICA IDENTITY FULL ensures payload.new has all columns.
                        // If it wasn't set, payload.new.id may be missing —
                        // fall back to the primary key from payload.old.
                        const targetId = payload.new.id || payload.old?.id
                        if (!targetId) return
                        const updated = state.locations.map(l =>
                            l.id === targetId ? { ...l, ...payload.new } : l
                        )
                        set({ locations: updated, filteredLocations: applyAllFilters(updated, state) })
                    } else if (payload.eventType === 'DELETE') {
                        const targetId = payload.old?.id
                        if (!targetId) return
                        const updated = state.locations.filter(l => l.id !== targetId)
                        set({ locations: updated, filteredLocations: applyAllFilters(updated, state) })
                    }
                }
            )
            .subscribe()

        set({ _realtimeChannel: channel })

        // Return unsubscribe function
        return () => {
            try { supabase.removeChannel(channel) } catch { /* already removed */ }
            set({ _realtimeChannel: null })
        }
    },
}))
