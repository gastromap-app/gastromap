import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

// ─── Location Queries ──────────────────────────────────────────────────────

/**
 * Fetch filtered locations list.
 * @param {import('../locations.api').LocationFilters} filters
 */
export function useLocations(filters = {}) {
    return useQuery({
        queryKey: queryKeys.locations.filtered(filters),
        queryFn: async () => {
            const { getLocations } = await import('../locations.api')
            return getLocations(filters)
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    })
}

/**
 * Admin-only: Fetch locations with fresh data (includes pending/rejected).
 */
export function useAdminLocationsQuery(filters = {}) {
    return useQuery({
        queryKey: queryKeys.locations.filtered({ ...filters, admin: true }),
        queryFn: async () => {
            const { getLocations } = await import('../locations.api')
            return getLocations(filters)
        },
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    })
}

/**
 * Infinite scroll / pagination variant.
 */
export function useInfiniteLocations(filters = {}) {
    return useInfiniteQuery({
        queryKey: [...queryKeys.locations.filtered(filters), 'infinite'],
        queryFn: async ({ pageParam = 0 }) => {
            const { getLocations } = await import('../locations.api')
            return getLocations({ ...filters, limit: 10, offset: pageParam })
        },
        getNextPageParam: (lastPage, pages) =>
            lastPage.hasMore ? pages.length * 10 : undefined,
        initialPageParam: 0,
    })
}

/**
 * Fetch a single location by ID.
 */
export function useLocation(id) {
    return useQuery({
        queryKey: queryKeys.locations.detail(id),
        queryFn: async () => {
            const { getLocationById } = await import('../locations.api')
            return getLocationById(id)
        },
        enabled: Boolean(id),
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

// ─── Location Mutations ────────────────────────────────────────────────────

export function useCreateLocationMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (data) => {
            const { createLocation } = await import('../locations.api')
            return createLocation(data)
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
            // Sync to Zustand store
            import('@/shared/store/useLocationsStore').then(({ useLocationsStore }) => {
                import('../locations.api').then(({ normalise }) => {
                    const loc = normalise(data)
                    if (loc) useLocationsStore.getState().addLocation(loc)
                })
            })
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
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
            qc.invalidateQueries({ queryKey: queryKeys.locations.detail(id) })
            // Sync to Zustand store
            import('@/shared/store/useLocationsStore').then(({ useLocationsStore }) => {
                import('../locations.api').then(({ normalise }) => {
                    const loc = normalise(data)
                    if (loc) useLocationsStore.getState().updateLocation(id, loc)
                })
            })
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
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
            qc.invalidateQueries({ queryKey: ['favorites'] })
            qc.invalidateQueries({ queryKey: queryKeys.admin.stats })
            // Sync to Zustand store
            import('@/shared/store/useLocationsStore').then(({ useLocationsStore }) => {
                useLocationsStore.getState().deleteLocation(id)
            })
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
