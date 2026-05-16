/**
 * useLocationsStore — DEPRECATED COMPATIBILITY SHIM.
 *
 * This file exists ONLY to satisfy dynamic imports in forbidden-path files
 * (src/shared/api/ai/*, src/shared/api/ai.api.js, src/hooks/useLocationsQuery.js)
 * that cannot be modified during the data-loading-architecture migration.
 *
 * All real functionality has been moved:
 *   - userLocation / setUserLocation / updateUserLocation → useGeoStore
 *   - server data (locations, filteredLocations, etc.) → React Query cache
 *   - filters → useLocationFilters (URL-driven)
 *   - realtime → locationsRealtime.js singleton
 *
 * This shim will be removed when the AI module is refactored to use
 * React Query directly.
 *
 * @deprecated Use useGeoStore for geolocation, React Query for server data.
 */
import { create } from 'zustand'

export const useLocationsStore = create(() => ({
    // Stub: AI files access `.getState().locations` — returns empty array
    locations: [],
    filteredLocations: [],
    mapMarkers: [],
}))
