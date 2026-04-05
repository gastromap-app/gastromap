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

import { getOpenFoodFactsContext, getIngredientCulinaryContext } from './openfoodfacts.api'
import {
    useQuery,
    useMutation,
    useInfiniteQuery,
    useQueryClient,
} from '@tanstack/react-query'
import { queryClient } from '@/shared/config/queryClient'

import {
    getLocations,
    getLocationById,
    getCategories,
    getLocationsNearby,
    createLocation,
    updateLocation,
    deleteLocation,
} from './locations.api'

import { analyzeQuery, extractLocationData } from './ai.api'
import * as aiAssistant from './ai-assistant.service'

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
 * Fetch filtered locations list.
 * @param {import('./locations.api').LocationFilters} filters
 */
export function useLocations(filters = {}) {
    return useQuery({
        queryKey: queryKeys.locations.filtered(filters),
        queryFn: () => getLocations(filters),
    })
}

/**
 * Infinite scroll / pagination variant.
 * @param {import('./locations.api').LocationFilters} filters
 */
export function useInfiniteLocations(filters = {}) {
    return useInfiniteQuery({
        queryKey: [...queryKeys.locations.filtered(filters), 'infinite'],
        queryFn: ({ pageParam = 0 }) =>
            getLocations({ ...filters, limit: 10, offset: pageParam }),
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
        queryFn: () => getLocationById(id),
        enabled: Boolean(id),
    })
}

/**
 * Fetch categories list.
 */
export function useCategories() {
    return useQuery({
        queryKey: queryKeys.categories,
        queryFn: getCategories,
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
        queryFn: () => getLocationsNearby(coords, radiusKm),
        enabled: Boolean(coords?.lat && coords?.lng),
    })
}

// ─── Location Mutations ────────────────────────────────────────────────────

export function useCreateLocationMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: createLocation,
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.locations.all }),
    })
}

export function useUpdateLocationMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, updates }) => updateLocation(id, updates),
        onSuccess: (_data, { id }) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
            qc.invalidateQueries({ queryKey: queryKeys.locations.detail(id) })
        },
    })
}

export function useDeleteLocationMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: deleteLocation,
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.locations.all }),
    })
}

// ─── AI Query ─────────────────────────────────────────────────────────────

/**
 * One-shot AI query (not cached between sessions intentionally).
 */
export function useAIQueryMutation() {
    return useMutation({
        mutationFn: ({ message, context }) => analyzeQuery(message, context),
    })
}

export function useExtractLocationMutation() {
    return useMutation({
        mutationFn: (query) => extractLocationData(query),
    })
}

// ─── AI Assistant (Semantic Indexing & Bulk Ops) ──────────────────────────

/**
 * Admin: Trigger deep semantic indexing for a single location.
 */
export function useReindexLocationSemanticMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id) => aiAssistant.reindexLocationSemantic(id),
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
        mutationFn: (config) => aiAssistant.bulkReindexLocations(config),
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
        mutationFn: (id) => aiAssistant.syncLocationWithKnowledgeGraph(id),
        onSuccess: (_data, id) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.detail(id) })
        },
    })
}

// ─── Admin Stats ───
import { getAdminStats, getRecentLocations, getRecentActivity, getProfiles, updateProfileRole, getPendingReviews, updateReviewStatus, getPendingLocations } from './admin.api'

export function useAdminStats() {
    return useQuery({ queryKey: ['admin-stats'], queryFn: getAdminStats, staleTime: 60_000 })
}

export function useRecentLocations(limit = 5) {
    return useQuery({ queryKey: ['recent-locations', limit], queryFn: () => getRecentLocations(limit), staleTime: 60_000 })
}

export function useRecentActivity(limit = 10) {
    return useQuery({ queryKey: ['recent-activity', limit], queryFn: () => getRecentActivity(limit), staleTime: 30_000 })
}

// ─── Admin Users ───
export function useProfiles() {
    return useQuery({ queryKey: ['profiles'], queryFn: getProfiles, staleTime: 60_000 })
}

export function useUpdateProfileRoleMutation() {
    return useMutation({
        mutationFn: ({ userId, role }) => updateProfileRole(userId, role),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
    })
}

// ─── Moderation ───
export function usePendingReviews() {
    return useQuery({ queryKey: ['pending-reviews'], queryFn: getPendingReviews, staleTime: 30_000 })
}

export function useUpdateReviewStatusMutation() {
    return useMutation({
        mutationFn: ({ reviewId, status, comment }) => updateReviewStatus(reviewId, status, comment),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-reviews'] })
            queryClient.invalidateQueries({ queryKey: ['reviews'] })
        },
    })
}

export function usePendingLocations() {
    return useQuery({ queryKey: ['pending-locations'], queryFn: getPendingLocations, staleTime: 30_000 })
}

export function useUpdateLocationStatusMutation() {
    return useMutation({
        mutationFn: ({ id, status }) => updateLocation(id, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['locations'] })
            queryClient.invalidateQueries({ queryKey: ['pending-locations'] })
        },
    })
}

// ─── Admin Stats Page ───
// NOTE: All derived stat hooks share the SAME queryKey ['admin-stats'] as useAdminStats().
// React Query deduplicates the network call — only ONE request is sent regardless
// of how many of these hooks are mounted simultaneously.

export function useCategoryStats() {
    return useQuery({
        queryKey: ['admin-stats'],          // ← same key as useAdminStats()
        queryFn: getAdminStats,
        staleTime: 60_000,
        select: (data) => data?.locations || {},
    })
}

export function useTopLocations(limit = 5) {
    return useQuery({
        queryKey: ['admin-stats'],          // ← same key — deduped, no extra request
        queryFn: getAdminStats,
        staleTime: 60_000,
        select: (data) => (data?.top_locations || []).slice(0, limit),
    })
}

export function useEngagementStats() {
    return useQuery({
        queryKey: ['admin-stats'],          // ← same key — deduped
        queryFn: getAdminStats,
        staleTime: 30_000,
        select: (data) => data?.engagement || {},
    })
}

export function usePaymentStats() {
    return useQuery({
        queryKey: ['admin-stats'],          // ← same key — deduped
        queryFn: getAdminStats,
        staleTime: 60_000,
        select: (data) => data?.payments || {},
    })
}

// ─── Favorites ───
import { getUserFavorites, getUserFavoritesWithLocations, addFavorite, removeFavorite, isFavorite } from './favorites.api'

export function useUserFavorites(userId) {
    return useQuery({ queryKey: ['favorites', userId], queryFn: () => getUserFavorites(userId), enabled: !!userId, staleTime: 60_000 })
}

export function useUserFavoritesWithLocations(userId) {
    return useQuery({ queryKey: ['favorites-with-locations', userId], queryFn: () => getUserFavoritesWithLocations(userId), enabled: !!userId, staleTime: 60_000 })
}

export function useAddFavoriteMutation() {
    return useMutation({
        mutationFn: ({ userId, locationId }) => addFavorite(userId, locationId),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: ['favorites', userId] })
            queryClient.invalidateQueries({ queryKey: ['favorites-with-locations', userId] })
        },
    })
}

export function useRemoveFavoriteMutation() {
    return useMutation({
        mutationFn: ({ userId, locationId }) => removeFavorite(userId, locationId),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: ['favorites', userId] })
            queryClient.invalidateQueries({ queryKey: ['favorites-with-locations', userId] })
        },
    })
}

// ─── Visits ───
import { getUserVisits, getUserVisitsWithLocations, addVisit, deleteVisit, hasVisited } from './visits.api'

export function useUserVisits(userId) {
    return useQuery({ queryKey: ['visits', userId], queryFn: () => getUserVisits(userId), enabled: !!userId, staleTime: 60_000 })
}

export function useUserVisitsWithLocations(userId) {
    return useQuery({ queryKey: ['visits-with-locations', userId], queryFn: () => getUserVisitsWithLocations(userId), enabled: !!userId, staleTime: 60_000 })
}

export function useAddVisitMutation() {
    return useMutation({
        mutationFn: ({ userId, locationId, rating, reviewText }) => addVisit(userId, locationId, rating, reviewText),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: ['visits', userId] })
            queryClient.invalidateQueries({ queryKey: ['visits-with-locations', userId] })
        },
    })
}

export function useDeleteVisitMutation() {
    return useMutation({
        mutationFn: ({ visitId, userId }) => deleteVisit(visitId),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: ['visits', userId] })
            queryClient.invalidateQueries({ queryKey: ['visits-with-locations', userId] })
        },
    })
}

// ─── Reviews ───
import { getLocationReviews, getUserReviews, createReview } from './reviews.api'

export function useLocationReviews(locationId) {
    return useQuery({ queryKey: ['reviews', locationId], queryFn: () => getLocationReviews(locationId), staleTime: 60_000 })
}

export function useUserReviews(userId) {
    return useQuery({ queryKey: ['user-reviews', userId], queryFn: () => getUserReviews(userId), enabled: !!userId, staleTime: 60_000 })
}

export function useCreateReviewMutation() {
    return useMutation({
        mutationFn: ({ userId, locationId, rating, reviewText }) => createReview(userId, locationId, rating, reviewText),
        onSuccess: (_, { locationId }) => {
            queryClient.invalidateQueries({ queryKey: ['reviews', locationId] })
        },
    })
}

// ─── Leaderboard ───
import { getLeaderboard, getUserRank } from './leaderboard.api'

export function useLeaderboard(limit = 50) {
    return useQuery({ queryKey: ['leaderboard'], queryFn: () => getLeaderboard(limit), staleTime: 5 * 60_000 })
}

export function useUserRank(userId) {
    return useQuery({ queryKey: ['user-rank', userId], queryFn: () => getUserRank(userId), enabled: !!userId, staleTime: 60_000 })
}

// ─── Preferences ───
import { getUserPreferences, updateUserPreferences } from './preferences.api'

export function useUserPreferences(userId) {
    return useQuery({ queryKey: ['user-preferences', userId], queryFn: () => getUserPreferences(userId), enabled: !!userId, staleTime: 60_000 })
}

export function useUpdatePreferencesMutation() {
    return useMutation({
        mutationFn: ({ userId, preferences }) => updateUserPreferences(userId, preferences),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: ['user-preferences', userId] })
        },
    })
}

// ─── Knowledge Graph ───
import {
    getCuisines, getCuisineById, createCuisine, updateCuisine, deleteCuisine,
    getDishes, createDish, updateDish, deleteDish,
    getIngredients, createIngredient, updateIngredient, deleteIngredient,
    getKnowledgeStats, searchCuisinesSemantic, getAIContextForQuery,
    syncKGToLocations,
} from './knowledge-graph.api'

export function useCuisines() {
    return useQuery({ queryKey: ['knowledge-cuisines'], queryFn: getCuisines, staleTime: 0, retry: 2 })
}

export function useCuisine(id) {
    return useQuery({ queryKey: ['knowledge-cuisine', id], queryFn: () => getCuisineById(id), enabled: !!id, staleTime: 5 * 60_000 })
}

export function useCreateCuisineMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: createCuisine,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-cuisines'] }),
    })
}

export function useUpdateCuisineMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, updates }) => updateCuisine(id, updates),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: ['knowledge-cuisines'] })
            qc.invalidateQueries({ queryKey: ['knowledge-cuisine', id] })
        },
    })
}

export function useDeleteCuisineMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: deleteCuisine,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-cuisines'] }),
    })
}

export function useDishes(cuisineId = null) {
    return useQuery({ queryKey: ['knowledge-dishes', cuisineId], queryFn: () => getDishes(cuisineId), staleTime: 0, retry: 2 })
}

export function useCreateDishMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: createDish,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-dishes'] }),
    })
}

export function useUpdateDishMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, updates }) => updateDish(id, updates),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-dishes'] }),
    })
}

export function useDeleteDishMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: deleteDish,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-dishes'] }),
    })
}

export function useIngredients(category = null) {
    return useQuery({ queryKey: ['knowledge-ingredients', category], queryFn: () => getIngredients(category), staleTime: 0, retry: 2 })
}

export function useCreateIngredientMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: createIngredient,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-ingredients'] }),
    })
}

export function useUpdateIngredientMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, updates }) => updateIngredient(id, updates),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-ingredients'] }),
    })
}

export function useDeleteIngredientMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: deleteIngredient,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-ingredients'] }),
    })
}

export function useKnowledgeStats() {
    return useQuery({ queryKey: ['knowledge-stats'], queryFn: getKnowledgeStats, staleTime: 60_000 })
}

/**
 * Admin: Synchronize entire Knowledge Graph with all locations.
 */
export function useSyncKGToLocationsMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (onProgress) => syncKGToLocations(onProgress),
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
        queryFn: () => searchCuisinesSemantic(query),
        enabled: enabled && !!query,
        staleTime: 5 * 60_000,
    })
}

export { getAIContextForQuery }

// ─── Culinary & Ingredient Context ───

export function useCulinaryContextMutation() {
    return useMutation({
        mutationFn: ({ searchTerm }) => getIngredientCulinaryContext(searchTerm),
    })
}
