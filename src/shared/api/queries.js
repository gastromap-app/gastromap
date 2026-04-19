/**
 * React Query hooks — the only way components should fetch data.
 *
 * Naming convention:
 *   useLocations()          → list
 *   useLocation(id)         → single item
 *   useLocationsNearby()    → geo-filtered list
 *   useCategories()         → reference data
 *
 * Mutation hooks follow the pattern: use<Verb><Entity>Mutation
 */

// ─── Core Imports ──────────────────────────────────────────────────────────
import {
    useQuery,
    useMutation,
    useInfiniteQuery,
    useQueryClient,
} from '@tanstack/react-query'
// Removed static queryClient import to avoid circular dependency/initialization issues.
// Use useQueryClient() within hooks instead.

// ─── API Module Imports (Refactored to minimize top-level cycles) ────────────────
// Note: We use dynamic imports inside the hooks to prevent "ReferenceError: Cannot access before initialization" cycles.
// Essential shared types/utilities can remain static.

// ─── Query Keys (centralised to avoid string typos) ───────────────────────
export const queryKeys = {
    locations: {
        all: ['locations'],
        filtered: (filters) => ['locations', 'filtered', filters],
        detail: (id) => ['locations', 'detail', id],
        nearby: (coords) => ['locations', 'nearby', coords],
    },
    categories: ['categories'],
    ai: {
        query: (message) => ['ai', 'query', message],
    },
}

// ─── Location Queries ──────────────────────────────────────────────────────

/**
 * @deprecated Use useAdminLocationsQuery() for admin pages, or useLocationsStore for user-facing pages.
 * Fetch filtered locations list.
 * @param {import('./locations.api').LocationFilters} filters
 */
export function useLocations(filters = {}) {
    return useQuery({
        queryKey: queryKeys.locations.filtered(filters),
        queryFn: async () => {
            const { getLocations } = await import('./locations.api')
            return getLocations(filters)
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    })
}

/**
 * Admin-only: Fetch locations with fresh data (includes pending/rejected).
 * Does NOT sync to Zustand store — admin pages manage their own data.
 * @param {import('./locations.api').LocationFilters} filters
 */
export function useAdminLocationsQuery(filters = {}) {
    return useQuery({
        queryKey: queryKeys.locations.filtered({ ...filters, admin: true }),
        queryFn: async () => {
            const { getLocations } = await import('./locations.api')
            return getLocations(filters)
        },
        staleTime: 0,
        refetchOnWindowFocus: true,
    })
}

/**
 * Infinite scroll / pagination variant.
 * @param {import('./locations.api').LocationFilters} filters
 */
export function useInfiniteLocations(filters = {}) {
    return useInfiniteQuery({
        queryKey: [...queryKeys.locations.filtered(filters), 'infinite'],
        queryFn: async ({ pageParam = 0 }) => {
            const { getLocations } = await import('./locations.api')
            return getLocations({ ...filters, limit: 10, offset: pageParam })
        },
        getNextPageParam: (lastPage, pages) =>
            lastPage.hasMore ? pages.length * 10 : undefined,
        initialPageParam: 0,
    })
}

/**
 * Fetch a single location by ID.
 * @param {string|null} id
 */
export function useLocation(id) {
    return useQuery({
        queryKey: queryKeys.locations.detail(id),
        queryFn: async () => {
            const { getLocationById } = await import('./locations.api')
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
            const { getCategories } = await import('./locations.api')
            return getCategories()
        },
        staleTime: Infinity, // categories rarely change
    })
}

/**
 * Fetch locations near given coordinates.
 * @param {{ lat: number, lng: number }|null} coords
 * @param {number} radiusKm
 */
export function useLocationsNearby(coords, radiusKm = 2) {
    return useQuery({
        queryKey: queryKeys.locations.nearby(coords),
        queryFn: async () => {
            const { getLocationsNearby } = await import('./locations.api')
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
            const { createLocation } = await import('./locations.api')
            return createLocation(data)
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
            // Sync to Zustand store (user-facing pages)
            import('@/shared/store/useLocationsStore').then(({ useLocationsStore }) => {
                import('./locations.api').then(({ normalise }) => {
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
            const { updateLocation } = await import('./locations.api')
            return updateLocation(id, updates)
        },
        onSuccess: (data, { id }) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
            qc.invalidateQueries({ queryKey: queryKeys.locations.detail(id) })
            // Sync to Zustand store (user-facing pages)
            import('@/shared/store/useLocationsStore').then(({ useLocationsStore }) => {
                import('./locations.api').then(({ normalise }) => {
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
            const { deleteLocation } = await import('./locations.api')
            return deleteLocation(id)
        },
        onSuccess: (_data, id) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
            // Sync to Zustand store (user-facing pages)
            import('@/shared/store/useLocationsStore').then(({ useLocationsStore }) => {
                useLocationsStore.getState().deleteLocation(id)
            })
        },
    })
}

// ─── AI Query ─────────────────────────────────────────────────────────────

/**
 * One-shot AI query (not cached between sessions intentionally).
 */
export function useAIQueryMutation() {
    return useMutation({
        mutationFn: async ({ message, context }) => {
            const { analyzeQuery } = await import('./ai/analysis')
            return analyzeQuery(message, context)
        },
    })
}

export function useExtractLocationMutation() {
    return useMutation({
        mutationFn: async (query) => {
            const { extractLocationData } = await import('./ai/location')
            return extractLocationData(query)
        },
    })
}

// ─── AI Assistant (Semantic Indexing & Bulk Ops) ──────────────────────────

/**
 * Admin: Trigger deep semantic indexing for a single location.
 */
// ─── KG Sync mutations ────────────────────────────────────────────────────────

/**
 * Sync one location with Knowledge Graph.
 * Writes kg_cuisines, kg_dishes, kg_ingredients, kg_allergens.
 */
export function useSyncLocationKGMutation() {
    return useMutation({
        mutationFn: async (locationId) => {
            const { syncLocationWithKnowledgeGraph } = await import('./ai-assistant.service')
            return syncLocationWithKnowledgeGraph(locationId)
        },
    })
}

/**
 * Full enrichment: semantic + KG for one location.
 */
export function useEnrichLocationFullMutation() {
    return useMutation({
        mutationFn: async (locationId) => {
            const { enrichLocationFull } = await import('./ai-assistant.service')
            return enrichLocationFull(locationId)
        },
    })
}

/**
 * Bulk KG sync for all locations.
 */
export function useBulkSyncKGMutation() {
    return useMutation({
        mutationFn: async (limit = 50) => {
            const { bulkSyncKG } = await import('./ai-assistant.service')
            return bulkSyncKG(limit)
        },
    })
}

export function useReindexLocationSemanticMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { reindexLocationSemantic } = await import('./ai-assistant.service')
            return reindexLocationSemantic(id)
        },
        onSuccess: (_data, id) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.detail(id) })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

/**
 * Admin: Trigger bulk semantic re-indexing.
 */
export function useBulkReindexLocationsMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (config) => {
            const { bulkReindexLocations } = await import('./ai-assistant.service')
            return bulkReindexLocations(config)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

/**
 * Admin: Synchronize location with updated Knowledge Graph logic.
 */
export function useSyncLocationWithKGMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { syncLocationWithKnowledgeGraph } = await import('./ai-assistant.service')
            return syncLocationWithKnowledgeGraph(id)
        },
        onSuccess: (_data, id) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.detail(id) })
        },
    })
}

// ─── Admin Stats ───
export function useAdminStats() {
    return useQuery({ 
        queryKey: ['admin-stats'], 
        queryFn: async () => {
            const { getAdminStats } = await import('./admin.api')
            return getAdminStats()
        }, 
        staleTime: 0, // admin: always fresh
    })
}

export function useRecentLocations(limit = 5) {
    return useQuery({ 
        queryKey: ['recent-locations', limit], 
        queryFn: async () => {
            const { getRecentLocations } = await import('./admin.api')
            return getRecentLocations(limit)
        }, 
        staleTime: 60_000 
    })
}

export function useRecentActivity(limit = 10) {
    return useQuery({ 
        queryKey: ['recent-activity', limit], 
        queryFn: async () => {
            const { getRecentActivity } = await import('./admin.api')
            return getRecentActivity(limit)
        }, 
        staleTime: 0, // admin: always fresh
    })
}

// ─── Admin Users ───
export function useProfiles() {
    return useQuery({ 
        queryKey: ['profiles'], 
        queryFn: async () => {
            const { getProfiles } = await import('./admin.api')
            return getProfiles()
        }, 
        staleTime: 60_000 
    })
}

export function useUpdateProfileRoleMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ userId, role }) => {
            const { updateProfileRole } = await import('./admin.api')
            return updateProfileRole(userId, role)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
    })
}

// ─── Moderation ───
export function usePendingReviews() {
    return useQuery({ 
        queryKey: ['pending-reviews'], 
        queryFn: async () => {
            const { getPendingReviews } = await import('./admin.api')
            return getPendingReviews()
        }, 
        staleTime: 0, // admin: always fresh
    })
}

export function useUpdateReviewStatusMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ reviewId, status, comment }) => {
            const { updateReviewStatus } = await import('./admin.api')
            return updateReviewStatus(reviewId, status, comment)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['pending-reviews'] })
            qc.invalidateQueries({ queryKey: ['reviews'] })
        },
    })
}

export function usePendingLocations() {
    return useQuery({ 
        queryKey: ['pending-locations'], 
        queryFn: async () => {
            const { getPendingLocations } = await import('./admin.api')
            return getPendingLocations()
        }, 
        staleTime: 0, // admin: always fresh
    })
}

export function useUpdateLocationStatusMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, status }) => {
            const { updateLocation } = await import('./locations.api')
            return updateLocation(id, { status })
        },
        onSuccess: (data, { id, status }) => {
            qc.invalidateQueries({ queryKey: ['locations'] })
            qc.invalidateQueries({ queryKey: ['pending-locations'] })
            // Sync to Zustand store (user-facing pages)
            import('@/shared/store/useLocationsStore').then(({ useLocationsStore }) => {
                if (status === 'approved') {
                    import('./locations.api').then(({ normalise }) => {
                        const loc = normalise(data)
                        if (loc) useLocationsStore.getState().addLocation(loc)
                    })
                } else {
                    // Remove from user-facing store (rejected/revision_requested/pending)
                    useLocationsStore.getState().deleteLocation(id)
                }
            })
        },
    })
}

// ─── Admin Stats Page ───
// NOTE: All derived stat hooks share the SAME queryKey ['admin-stats'] as useAdminStats().
// React Query deduplicates the network call — only ONE request is sent regardless
// of how many of these hooks are mounted simultaneously.

export function useCategoryStats() {
    return useQuery({
        queryKey: ['category-stats'],
        queryFn: async () => {
            const { getCategoryStats } = await import('./admin.api')
            return getCategoryStats()
        },
        staleTime: 30_000, // 30s cache
        refetchOnMount: true,
    })
}

export function useTopLocations(limit = 5) {
    return useQuery({
        queryKey: ['top-locations', limit],
        queryFn: async () => {
            const { getTopLocations } = await import('./admin.api')
            return getTopLocations(limit)
        },
        staleTime: 30_000, // 30s cache
        refetchOnMount: true,
    })
}

export function useEngagementStats() {
    return useQuery({
        queryKey: ['detailed-engagement'],
        queryFn: async () => {
            const { getDetailedEngagement } = await import('./admin.api')
            return getDetailedEngagement()
        },
        staleTime: 30_000, // 30s cache
        refetchOnMount: true,
    })
}

export function usePaymentStats() {
    return useQuery({
        queryKey: ['payment-stats'],
        queryFn: async () => {
            const { getAdminStats } = await import('./admin.api')
            const stats = await getAdminStats()
            return stats?.payments || {}
        },
        staleTime: 30_000, // 30s cache
        refetchOnMount: true,
    })
}

// ─── Favorites ───
export function useUserFavorites(userId) {
    return useQuery({ 
        queryKey: ['favorites', userId], 
        queryFn: async () => {
            const { getUserFavorites } = await import('./favorites.api')
            return getUserFavorites(userId)
        }, 
        enabled: !!userId, 
        staleTime: 60_000 
    })
}

export function useUserFavoritesWithLocations(userId) {
    return useQuery({ 
        queryKey: ['favorites-with-locations', userId], 
        queryFn: async () => {
            const { getUserFavoritesWithLocations } = await import('./favorites.api')
            return getUserFavoritesWithLocations(userId)
        }, 
        enabled: !!userId, 
        staleTime: 60_000 
    })
}

export function useAddFavoriteMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ userId, locationId }) => {
            const { addFavorite } = await import('./favorites.api')
            return addFavorite(userId, locationId)
        },
        onMutate: async ({ userId, locationId }) => {
            await qc.cancelQueries({ queryKey: ['favorites', userId] })
            const prev = qc.getQueryData(['favorites', userId])
            qc.setQueryData(['favorites', userId], (old = []) =>
                old.some(f => f.location_id === locationId)
                    ? old
                    : [...old, { location_id: locationId, created_at: new Date().toISOString() }]
            )
            return { prev, userId }
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev !== undefined)
                qc.setQueryData(['favorites', ctx.userId], ctx.prev)
        },
        onSuccess: (_, { userId }) => {
            qc.invalidateQueries({ queryKey: ['favorites', userId] })
            qc.invalidateQueries({ queryKey: ['favorites-with-locations', userId] })
        },
    })
}

export function useRemoveFavoriteMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ userId, locationId }) => {
            const { removeFavorite } = await import('./favorites.api')
            return removeFavorite(userId, locationId)
        },
        onMutate: async ({ userId, locationId }) => {
            await qc.cancelQueries({ queryKey: ['favorites', userId] })
            const prev = qc.getQueryData(['favorites', userId])
            qc.setQueryData(['favorites', userId], (old = []) =>
                old.filter(f => f.location_id !== locationId)
            )
            return { prev, userId }
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev !== undefined)
                qc.setQueryData(['favorites', ctx.userId], ctx.prev)
        },
        onSuccess: (_, { userId }) => {
            qc.invalidateQueries({ queryKey: ['favorites', userId] })
            qc.invalidateQueries({ queryKey: ['favorites-with-locations', userId] })
        },
    })
}

// ─── Visits ───
export function useUserVisits(userId) {
    return useQuery({ 
        queryKey: ['visits', userId], 
        queryFn: async () => {
            const { getUserVisits } = await import('./visits.api')
            return getUserVisits(userId)
        }, 
        enabled: !!userId, 
        staleTime: 60_000 
    })
}

export function useUserVisitsWithLocations(userId) {
    return useQuery({ 
        queryKey: ['visits-with-locations', userId], 
        queryFn: async () => {
            const { getUserVisitsWithLocations } = await import('./visits.api')
            return getUserVisitsWithLocations(userId)
        }, 
        enabled: !!userId, 
        staleTime: 60_000 
    })
}

export function useAddVisitMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ userId, locationId, rating, reviewText }) => {
            const { addVisit } = await import('./visits.api')
            return addVisit(userId, locationId, rating, reviewText)
        },
        onSuccess: (_, { userId }) => {
            qc.invalidateQueries({ queryKey: ['visits', userId] })
            qc.invalidateQueries({ queryKey: ['visits-with-locations', userId] })
        },
    })
}

export function useDeleteVisitMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ visitId, userId }) => {
            const { deleteVisit } = await import('./visits.api')
            return deleteVisit(visitId)
        },
        onSuccess: (_, { userId }) => {
            qc.invalidateQueries({ queryKey: ['visits', userId] })
            qc.invalidateQueries({ queryKey: ['visits-with-locations', userId] })
        },
    })
}

// ─── Reviews ───
export function useLocationReviews(locationId) {
    return useQuery({ 
        queryKey: ['reviews', locationId], 
        queryFn: async () => {
            const { getLocationReviews } = await import('./reviews.api')
            return getLocationReviews(locationId)
        }, 
        staleTime: 60_000 
    })
}

export function useUserReviews(userId) {
    return useQuery({ 
        queryKey: ['user-reviews', userId], 
        queryFn: async () => {
            const { getUserReviews } = await import('./reviews.api')
            return getUserReviews(userId)
        }, 
        enabled: !!userId, 
        staleTime: 60_000 
    })
}

export function useCreateReviewMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ userId, locationId, rating, reviewText }) => {
            const { createReview } = await import('./reviews.api')
            return createReview(userId, locationId, rating, reviewText)
        },
        onSuccess: (_, { locationId }) => {
            qc.invalidateQueries({ queryKey: ['reviews', locationId] })
        },
    })
}

// ─── Leaderboard ───
export function useLeaderboard(limit = 50) {
    return useQuery({ 
        queryKey: ['leaderboard'], 
        queryFn: async () => {
            const { getLeaderboard } = await import('./leaderboard.api')
            return getLeaderboard(limit)
        }, 
        staleTime: 5 * 60_000 
    })
}

export function useUserRank(userId) {
    return useQuery({ 
        queryKey: ['user-rank', userId], 
        queryFn: async () => {
            const { getUserRank } = await import('./leaderboard.api')
            return getUserRank(userId)
        }, 
        enabled: !!userId, 
        staleTime: 60_000 
    })
}

// ─── Preferences ───
export function useUserPreferences(userId) {
    return useQuery({ 
        queryKey: ['user-preferences', userId], 
        queryFn: async () => {
            const { getUserPreferences } = await import('./preferences.api')
            return getUserPreferences(userId)
        }, 
        enabled: !!userId, 
        staleTime: 60_000 
    })
}

export function useUpdatePreferencesMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ userId, preferences }) => {
            const { updateUserPreferences } = await import('./preferences.api')
            return updateUserPreferences(userId, preferences)
        },
        onSuccess: (_, { userId }) => {
            qc.invalidateQueries({ queryKey: ['user-preferences', userId] })
        },
    })
}

// ─── Knowledge Graph hooks ────────────────────────────────────────────────────
// staleTime: Infinity  → React Query never considers KG data stale in-memory.
//   Read functions (getCuisines etc.) already check a localStorage cache (TTL=24h)
//   so every mount either returns from localStorage instantly OR fetches Supabase once.
//   React Query's job is simply to hold the result in-memory for the tab's lifetime.
//
// gcTime: Infinity → data is never evicted from the in-memory React Query store while
//   the tab is open. This eliminates the "cache cleared after 10 min" window that
//   previously caused fresh fetches on return-visits.
//
// retry: 2 → on actual failure try twice more before surfacing an error.
//
// invalidation on mutation: mutations call `qc.invalidateQueries` which marks the
//   in-memory entry stale + triggers an immediate background re-fetch. The API layer
//   also calls `invalidateCacheGroup(...)` to wipe the localStorage cache so the
//   next getCuisines() call goes all the way to Supabase and refreshes L2.

export function useCuisines() {
    return useQuery({
        queryKey: ['knowledge-cuisines'],
        queryFn: async () => {
            const { getCuisines } = await import('./knowledge-graph.api')
            return getCuisines()
        },
        staleTime: 30_000,   // 30s — allows invalidateQueries to trigger refetch
        gcTime: 5 * 60_000,
        retry: 2,
    })
}

export function useCuisine(id) {
    return useQuery({
        queryKey: ['knowledge-cuisine', id],
        queryFn: async () => {
            const { getCuisineById } = await import('./knowledge-graph.api')
            return getCuisineById(id)
        },
        enabled: !!id,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
    })
}

export function useCreateCuisineMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (cuisine) => {
            const { createCuisine } = await import('./knowledge-graph.api')
            return createCuisine(cuisine)
        },
        // API already called invalidateCacheGroup('cuisines'); now bust React Query too
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-cuisines'] }),
    })
}

export function useUpdateCuisineMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, updates }) => {
            const { updateCuisine } = await import('./knowledge-graph.api')
            return updateCuisine(id, updates)
        },
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: ['knowledge-cuisines'] })
            qc.invalidateQueries({ queryKey: ['knowledge-cuisine', id] })
        },
    })
}

export function useDeleteCuisineMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { deleteCuisine } = await import('./knowledge-graph.api')
            return deleteCuisine(id)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-cuisines'] }),
    })
}

export function useDishes(cuisineId = null) {
    return useQuery({
        queryKey: ['knowledge-dishes', cuisineId],
        queryFn: async () => {
            const { getDishes } = await import('./knowledge-graph.api')
            return getDishes(cuisineId)
        },
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
    })
}

export function useCreateDishMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (dish) => {
            const { createDish } = await import('./knowledge-graph.api')
            return createDish(dish)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-dishes'] }),
    })
}

export function useUpdateDishMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, updates }) => {
            const { updateDish } = await import('./knowledge-graph.api')
            return updateDish(id, updates)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-dishes'] }),
    })
}

export function useDeleteDishMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { deleteDish } = await import('./knowledge-graph.api')
            return deleteDish(id)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-dishes'] }),
    })
}

export function useIngredients(category = null) {
    return useQuery({
        queryKey: ['knowledge-ingredients', category],
        queryFn: async () => {
            const { getIngredients } = await import('./knowledge-graph.api')
            return getIngredients(category)
        },
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
    })
}

export function useCreateIngredientMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (ingredient) => {
            const { createIngredient } = await import('./knowledge-graph.api')
            return createIngredient(ingredient)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-ingredients'] }),
    })
}

export function useUpdateIngredientMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, updates }) => {
            const { updateIngredient } = await import('./knowledge-graph.api')
            return updateIngredient(id, updates)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-ingredients'] }),
    })
}

export function useDeleteIngredientMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { deleteIngredient } = await import('./knowledge-graph.api')
            return deleteIngredient(id)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-ingredients'] }),
    })
}

export function useKnowledgeStats() {
    return useQuery({ 
        queryKey: ['knowledge-stats'], 
        queryFn: async () => {
            const { getKnowledgeStats } = await import('./knowledge-graph.api')
            return getKnowledgeStats()
        }, 
        staleTime: 60_000 
    })
}

/**
 * Admin: Synchronize entire Knowledge Graph with all locations.
 */
export function useSyncKGToLocationsMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (onProgress) => {
            const { syncKGToLocations } = await import('./knowledge-graph.api')
            return syncKGToLocations(onProgress)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['locations'] })
        },
    })
}

/**
 * Admin: Spoonacular search for culinary enrichment.
 */
export function useSpoonacularSearchMutation() {
    return useMutation({
        mutationFn: async ({ query, type = 'any' }) => {
            const { searchDishes, searchIngredients } = await import('@/shared/api/spoonacular.api')
            
            if (type === 'dish') return searchDishes(query)
            if (type === 'ingredient') return searchIngredients(query)
            
            // Default: try both (simplistic for now)
            const [dishes, ingredients] = await Promise.all([
                searchDishes(query, 3),
                searchIngredients(query, 3)
            ])
            
            return { dishes, ingredients }
        }
    })
}

export function useSearchCuisinesSemantic(query, enabled = true) {
    return useQuery({
        queryKey: ['knowledge-cuisines-semantic', query],
        queryFn: async () => {
            const { searchCuisinesSemantic } = await import('./knowledge-graph.api')
            return searchCuisinesSemantic(query)
        },
        enabled: enabled && !!query,
        staleTime: 5 * 60_000,
    })
}

// ─── Culinary & Ingredient Context ───

export function useCulinaryContextMutation() {
    return useMutation({
        mutationFn: async ({ searchTerm }) => {
            const { getIngredientCulinaryContext } = await import('./openfoodfacts.api')
            return getIngredientCulinaryContext(searchTerm)
        },
    })
}

// ─── Stats page — Timeline & Growth ────────────────────────────────────────

export function useCityStats() {
    return useQuery({
        queryKey: ['city-stats'],
        queryFn: async () => {
            const { getCityStats } = await import('./admin.api')
            return getCityStats()
        },
        staleTime: 30_000, // 30s cache
        refetchOnMount: true,
    })
}

export function useReviewsTimeline(days = 30) {
    return useQuery({
        queryKey: ['reviews-timeline', days],
        queryFn: async () => {
            const { getReviewsTimeline } = await import('./admin.api')
            return getReviewsTimeline(days)
        },
        staleTime: 30_000, // 30s cache
        refetchOnMount: true,
    })
}

export function useUserGrowth(days = 30) {
    return useQuery({
        queryKey: ['user-growth', days],
        queryFn: async () => {
            const { getUserGrowth } = await import('./admin.api')
            return getUserGrowth(days)
        },
        staleTime: 30_000, // 30s cache
        refetchOnMount: true,
    })
}
