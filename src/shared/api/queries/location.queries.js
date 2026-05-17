import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useSession } from '@/shared/auth/useSession'
import { adminQueryOptions } from '@/shared/config/queryClient'

// ─── Location Queries ──────────────────────────────────────────────────────

/**
 * Fetch filtered locations list.
 * @param {import('../locations.api').LocationFilters} filters
 */
export function useLocations(filters = {}) {
    const { status, isAuthed } = useSession()
    return useQuery({
        queryKey: queryKeys.locations.filtered(filters),
        queryFn: async () => {
            const { getLocations } = await import('../locations.api')
            return getLocations(filters, { isAuthed })
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        // Wait for auth to resolve (anon-OK; no isAuthed requirement).
        enabled: status !== 'pending',
    })
}

/**
 * Admin-only: Fetch locations with fresh data (includes pending/rejected).
 */
export function useAdminLocationsQuery(filters = {}) {
    const { status, isAuthed } = useSession()
    return useQuery({
        queryKey: ['admin', 'locations', filters],
        queryFn: async () => {
            const { getLocations } = await import('../locations.api')
            return getLocations(filters, { isAuthed })
        },
        ...adminQueryOptions,
        // Don't fetch until auth is fully resolved (not just authenticated)
        enabled: status !== 'pending' && isAuthed,
    })
}

/**
 * Infinite scroll / pagination variant.
 */
export function useInfiniteLocations(filters = {}) {
    const pageSize = filters.limit || 10
    const { status, isAuthed } = useSession()
    return useInfiniteQuery({
        queryKey: [...queryKeys.locations.filtered(filters), 'infinite'],
        queryFn: async ({ pageParam = 0 }) => {
            const { getLocations } = await import('../locations.api')
            return getLocations({ ...filters, limit: pageSize, offset: pageParam }, { isAuthed })
        },
        getNextPageParam: (lastPage, pages) =>
            lastPage.hasMore ? pages.length * pageSize : undefined,
        initialPageParam: 0,
        // Wait for auth to resolve before fetching (prevents RLS issues)
        enabled: status !== 'pending',
        // Cache for 2 minutes — prevents refetch on every navigation
        staleTime: 2 * 60 * 1000,
        // Keep data in cache for 5 minutes between route changes
        gcTime: 5 * 60 * 1000,
    })
}

/**
 * Fetch a single location by ID.
 */
export function useLocation(id) {
    const { status, isAuthed } = useSession()
    return useQuery({
        queryKey: queryKeys.locations.detail(id),
        queryFn: async () => {
            const { getLocationById } = await import('../locations.api')
            return getLocationById(id, { isAuthed })
        },
        enabled: Boolean(id) && status !== 'pending',
    })
}

/**
 * Fetch categories list.
 */
export function useCategories() {
    return useQuery({
        queryKey: queryKeys.categories,
        queryFn: async () => {
            const { getCategories } = await import('../locations.api')
            return getCategories()
        },
        staleTime: Infinity,
    })
}

/**
 * Fetch locations near given coordinates.
 */
export function useLocationsNearby(coords, radiusKm = 2) {
    return useQuery({
        queryKey: queryKeys.locations.nearby(coords),
        queryFn: async () => {
            const { getLocationsNearby } = await import('../locations.api')
            return getLocationsNearby(coords, radiusKm)
        },
        enabled: Boolean(coords?.lat && coords?.lng),
    })
}

/**
 * Fetch locations within a map viewport bounding box.
 * Used by MapTab to render clustered markers for the current viewport.
 * Debouncing of bounds changes is the caller's responsibility (600ms in MapTab).
 *
 * @param {{ sw: { lat: number, lng: number }, ne: { lat: number, lng: number } } | null} bounds
 * @param {object} filters - Canonical filter object from useLocationFilters().asAPIFilters()
 */
export function useLocationsInBounds(bounds, filters = {}) {
    const { status, isAuthed } = useSession()

    // Round bounds to 4 decimal places (≈ 11m) so micro-pan within a tile
    // reuses the cache instead of creating a new query entry (R8.5).
    const roundedBounds = bounds ? {
        sw: { lat: Math.round(bounds.sw.lat * 10000) / 10000, lng: Math.round(bounds.sw.lng * 10000) / 10000 },
        ne: { lat: Math.round(bounds.ne.lat * 10000) / 10000, lng: Math.round(bounds.ne.lng * 10000) / 10000 },
    } : null

    return useQuery({
        queryKey: queryKeys.locations.inBounds(roundedBounds, filters),
        queryFn: async () => {
            const { getLocationsInBounds } = await import('../locations.api')
            return getLocationsInBounds(roundedBounds, filters, { isAuthed })
        },
        enabled: status !== 'pending' && Boolean(roundedBounds),
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
        refetchOnWindowFocus: false,
    })
}

// ─── Location Mutations ────────────────────────────────────────────────────

export function useCreateLocationMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (data) => {
            const { createLocation } = await import('../locations.api')
            return createLocation(data)
        },
        onSuccess: (data) => {
            console.log('[location.queries] useCreateLocationMutation SUCCESS:', data)
            // Invalidate all location list queries — React Query refetches them.
            // No Zustand store sync needed (R5.2).
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

export function useUpdateLocationMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, updates }) => {
            const { updateLocation } = await import('../locations.api')
            return updateLocation(id, updates)
        },
        onSuccess: (data, { id }) => {
            console.log('[location.queries] useUpdateLocationMutation SUCCESS:', id, data)
            // Optimistic detail update + invalidate lists (R5.1).
            // No Zustand store sync needed (R5.2).
            if (data) {
                qc.setQueryData(queryKeys.locations.detail(id), (prev) =>
                    prev ? { ...prev, ...data } : data
                )
            }
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
            qc.invalidateQueries({ queryKey: queryKeys.locations.detail(id) })
            qc.invalidateQueries({ queryKey: queryKeys.admin.stats })
        },
    })
}

export function useDeleteLocationMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { deleteLocation } = await import('../locations.api')
            return deleteLocation(id)
        },
        onSuccess: (_data, id) => {
            // Remove detail entry + invalidate lists (R5.1).
            // No Zustand store sync needed (R5.2).
            qc.removeQueries({ queryKey: queryKeys.locations.detail(id) })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
            qc.invalidateQueries({ queryKey: ['admin', 'locations'] })
            qc.invalidateQueries({ queryKey: ['favorites'] })
            qc.invalidateQueries({ queryKey: queryKeys.admin.stats })
        },
    })
}

// ─── Geo Covers ───────────────────────────────────────────────────────────────

/** Fetch all covers for a given geo type ('country' | 'city'). */
export function useGeoCovers(geoType = 'country') {
    return useQuery({
        queryKey: queryKeys.geo.covers(geoType),
        queryFn: async () => {
            const { getGeoCovers } = await import('../geo.api')
            return getGeoCovers(geoType)
        },
        staleTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    })
}

/** Upload image + upsert the db record in one mutation. */
export function useUpsertGeoCoverMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ file, url, slug, geoType, name }) => {
            const { uploadGeoCoverImage, upsertGeoCover } = await import('../geo.api')
            const image_url = file
                ? await uploadGeoCoverImage(file, slug, geoType)
                : url
            await upsertGeoCover({ slug, geo_type: geoType, name, image_url })
            return image_url
        },
        onSuccess: (_data, { geoType }) => {
            qc.invalidateQueries({ queryKey: queryKeys.geo.covers(geoType) })
        },
    })
}

/** Delete a geo cover record. */
export function useDeleteGeoCoverMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ slug, geoType }) => {
            const { deleteGeoCover } = await import('../geo.api')
            return deleteGeoCover(slug, geoType)
        },
        onSuccess: (_data, { geoType }) => {
            qc.invalidateQueries({ queryKey: queryKeys.geo.covers(geoType) })
        },
    })
}
