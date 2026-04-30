import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

// ─── Favorites ──────────────────────────────────────────────────────────────

export function useUserFavorites(userId) {
    return useQuery({ 
        queryKey: queryKeys.favorites.all(userId), 
        queryFn: async () => {
            const { getUserFavorites } = await import('../favorites.api')
            return getUserFavorites(userId)
        }, 
        enabled: !!userId, 
        staleTime: 60_000 
    })
}

export function useUserFavoritesWithLocations(userId) {
    return useQuery({ 
        queryKey: queryKeys.favorites.withLocations(userId), 
        queryFn: async () => {
            const { getUserFavoritesWithLocations } = await import('../favorites.api')
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
            const { addFavorite } = await import('../favorites.api')
            return addFavorite(userId, locationId)
        },
        onMutate: async ({ userId, locationId }) => {
            await qc.cancelQueries({ queryKey: queryKeys.favorites.all(userId) })
            const prev = qc.getQueryData(queryKeys.favorites.all(userId))
            qc.setQueryData(queryKeys.favorites.all(userId), (old = []) =>
                old.some(f => f.location_id === locationId)
                    ? old
                    : [...old, { location_id: locationId, created_at: new Date().toISOString() }]
            )
            return { prev, userId }
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev !== undefined)
                qc.setQueryData(queryKeys.favorites.all(ctx.userId), ctx.prev)
        },
        onSuccess: (_, { userId }) => {
            qc.invalidateQueries({ queryKey: queryKeys.favorites.all(userId) })
            qc.invalidateQueries({ queryKey: queryKeys.favorites.withLocations(userId) })
        },
    })
}

export function useRemoveFavoriteMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ userId, locationId }) => {
            const { removeFavorite } = await import('../favorites.api')
            return removeFavorite(userId, locationId)
        },
        onMutate: async ({ userId, locationId }) => {
            await qc.cancelQueries({ queryKey: queryKeys.favorites.all(userId) })
            const prev = qc.getQueryData(queryKeys.favorites.all(userId))
            qc.setQueryData(queryKeys.favorites.all(userId), (old = []) =>
                old.filter(f => f.location_id !== locationId)
            )
            return { prev, userId }
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev !== undefined)
                qc.setQueryData(queryKeys.favorites.all(ctx.userId), ctx.prev)
        },
        onSuccess: (_, { userId }) => {
            qc.invalidateQueries({ queryKey: queryKeys.favorites.all(userId) })
            qc.invalidateQueries({ queryKey: queryKeys.favorites.withLocations(userId) })
        },
    })
}

// ─── Visits ─────────────────────────────────────────────────────────────────

export function useUserVisits(userId) {
    return useQuery({ 
        queryKey: queryKeys.visits.all(userId), 
        queryFn: async () => {
            const { getUserVisits } = await import('../visits.api')
            return getUserVisits(userId)
        }, 
        enabled: !!userId, 
        staleTime: 60_000 
    })
}

export function useUserVisitsWithLocations(userId) {
    return useQuery({ 
        queryKey: queryKeys.visits.withLocations(userId), 
        queryFn: async () => {
            const { getUserVisitsWithLocations } = await import('../visits.api')
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
            const { addVisit } = await import('../visits.api')
            return addVisit(userId, locationId, rating, reviewText)
        },
        onSuccess: (_, { userId }) => {
            qc.invalidateQueries({ queryKey: queryKeys.visits.all(userId) })
            qc.invalidateQueries({ queryKey: queryKeys.visits.withLocations(userId) })
        },
    })
}

export function useDeleteVisitMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ visitId, locationId: _locationId }) => {
            const { deleteVisit } = await import('../visits.api')
            return deleteVisit(visitId)
        },
        onSuccess: (_, { userId, locationId }) => {
            qc.invalidateQueries({ queryKey: queryKeys.visits.all(userId) })
            qc.invalidateQueries({ queryKey: queryKeys.visits.withLocations(userId) })
            if (locationId) {
                import('@/shared/store/useUserPrefsStore').then(({ useUserPrefsStore }) => {
                    useUserPrefsStore.getState().removeVisited(locationId)
                })
            }
        },
    })
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export function useLocationReviews(locationId) {
    return useQuery({
        queryKey: queryKeys.reviews.byLocation(locationId),
        queryFn: async () => {
            const { getLocationReviews } = await import('../reviews.api')
            return getLocationReviews(locationId)
        },
        enabled: !!locationId,
        staleTime: 60_000
    })
}

export function useUserReviews(userId) {
    return useQuery({ 
        queryKey: queryKeys.reviews.byUser(userId), 
        queryFn: async () => {
            const { getUserReviews } = await import('../reviews.api')
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
            const { createReview } = await import('../reviews.api')
            return createReview(userId, locationId, rating, reviewText)
        },
        onSuccess: (_, { locationId }) => {
            qc.invalidateQueries({ queryKey: queryKeys.reviews.byLocation(locationId) })
            qc.invalidateQueries({ queryKey: queryKeys.reviews.pending })
            qc.invalidateQueries({ queryKey: queryKeys.admin.stats })
        },
    })
}

// ─── Leaderboard ────────────────────────────────────────────────────────────

export function useLeaderboard(limit = 50) {
    return useQuery({ 
        queryKey: queryKeys.leaderboard, 
        queryFn: async () => {
            const { getLeaderboard } = await import('../leaderboard.api')
            return getLeaderboard(limit)
        }, 
        staleTime: 5 * 60_000 
    })
}

export function useUserRank(userId) {
    return useQuery({ 
        queryKey: queryKeys.userRank(userId), 
        queryFn: async () => {
            const { getUserRank } = await import('../leaderboard.api')
            return getUserRank(userId)
        }, 
        enabled: !!userId, 
        staleTime: 60_000 
    })
}
