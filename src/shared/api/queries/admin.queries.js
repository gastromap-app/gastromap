import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

// ─── Admin Dashboard Stats ──────────────────────────────────────────────────

export function useAdminStats() {
    return useQuery({ 
        queryKey: queryKeys.admin.stats, 
        queryFn: async () => {
            const { getAdminStats } = await import('../admin.api')
            return getAdminStats()
        }, 
        staleTime: 30_000,
    })
}

export function useRecentLocations(limit = 5) {
    return useQuery({ 
        queryKey: queryKeys.locations.recent(limit), 
        queryFn: async () => {
            const { getRecentLocations } = await import('../admin.api')
            return getRecentLocations(limit)
        }, 
        staleTime: 30_000,
    })
}

export function useRecentActivity(limit = 10) {
    return useQuery({ 
        queryKey: queryKeys.admin.activity(limit), 
        queryFn: async () => {
            const { getRecentActivity } = await import('../admin.api')
            return getRecentActivity(limit)
        }, 
        staleTime: 30_000,
    })
}

// ─── Admin Users & Profiles ─────────────────────────────────────────────────

export function useProfiles() {
    return useQuery({ 
        queryKey: queryKeys.admin.profiles, 
        queryFn: async () => {
            const { getProfiles } = await import('../admin.api')
            return getProfiles()
        }, 
        staleTime: 30_000,
    })
}

export function useUpdateProfileRoleMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ userId, role }) => {
            const { updateProfileRole } = await import('../admin.api')
            return updateProfileRole(userId, role)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.profiles }),
    })
}

export function useUpdateUserStatusMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ userId, status }) => {
            const { updateUserStatus } = await import('../admin.api')
            return updateUserStatus(userId, status)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.admin.profiles }),
    })
}

export function useUserDetails(userId) {
    return useQuery({
        queryKey: queryKeys.admin.userDetails(userId),
        queryFn: async () => {
            const { getUserDetails } = await import('../admin.api')
            return getUserDetails(userId)
        },
        enabled: !!userId,
        staleTime: 30_000,
    })
}

// ─── Moderation ─────────────────────────────────────────────────────────────

export function usePendingReviews() {
    return useQuery({ 
        queryKey: queryKeys.reviews.pending, 
        queryFn: async () => {
            const { getPendingReviews } = await import('../admin.api')
            return getPendingReviews()
        }, 
        staleTime: 30_000,
    })
}

export function useUpdateReviewStatusMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ reviewId, status, comment }) => {
            const { updateReviewStatus } = await import('../admin.api')
            return updateReviewStatus(reviewId, status, comment)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.reviews.pending })
            qc.invalidateQueries({ queryKey: ['reviews'] })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
            qc.invalidateQueries({ queryKey: queryKeys.admin.stats })
        },
    })
}

export function usePendingLocations() {
    return useQuery({ 
        queryKey: queryKeys.locations.pending, 
        queryFn: async () => {
            const { getPendingLocations } = await import('../admin.api')
            return getPendingLocations()
        }, 
        staleTime: 30_000,
    })
}

export function useUpdateLocationStatusMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, status, moderationNote, source, itemData }) => {
            if (source === 'submission') {
                const { approveSubmission, rejectSubmission } = await import('../submissions.api')
                if (status === 'approved') {
                    // Promote submission to location
                    // Filter out UI-only and internal fields
                    const { 
                        id: _id, user_id: _uid, submitted_at: _sat, status: _s, 
                        source: _src, queueType: _qt, name: _n, type: _t, date: _d, 
                        insiderTip: _it, mustTry: _mt, adminComment: _ac,
                        ...locationData 
                    } = itemData
                    
                    return approveSubmission(id, locationData)
                } else {
                    return rejectSubmission(id, moderationNote || 'Changes requested')
                }
            }

            const { updateLocation } = await import('../locations.api')
            const payload = { status }
            if (moderationNote !== undefined) payload.moderation_note = moderationNote
            return updateLocation(id, payload)
        },
        onSuccess: (data, { id, status, source }) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
            qc.invalidateQueries({ queryKey: queryKeys.locations.pending })
            qc.invalidateQueries({ queryKey: queryKeys.admin.stats })
            qc.invalidateQueries({ queryKey: queryKeys.admin.categoryStats })
            qc.invalidateQueries({ queryKey: queryKeys.locations.top(5) })
            qc.invalidateQueries({ queryKey: queryKeys.admin.cityStats })
            
            // Sync to Zustand store if approved
            if (status === 'approved' || status === 'active') {
                import('@/shared/store/useLocationsStore').then(({ useLocationsStore }) => {
                    import('../locations.api').then(({ normalise }) => {
                        const loc = normalise(data)
                        if (loc) useLocationsStore.getState().addLocation(loc)
                    })
                })
            } else if (source !== 'submission') {
                // For direct location deletions/rejections
                import('@/shared/store/useLocationsStore').then(({ useLocationsStore }) => {
                    useLocationsStore.getState().deleteLocation(id)
                })
            }
        },
    })
}

// ─── Detailed Admin Stats ───────────────────────────────────────────────────

export function useCategoryStats() {
    return useQuery({
        queryKey: queryKeys.admin.categoryStats,
        queryFn: async () => {
            const { getCategoryStats } = await import('../admin.api')
            return getCategoryStats()
        },
        staleTime: 30_000,
        refetchOnMount: true,
    })
}

export function useTopLocations(limit = 5) {
    return useQuery({
        queryKey: queryKeys.locations.top(limit),
        queryFn: async () => {
            const { getTopLocations } = await import('../admin.api')
            return getTopLocations(limit)
        },
        staleTime: 30_000,
        refetchOnMount: true,
    })
}

export function useEngagementStats() {
    return useQuery({
        queryKey: queryKeys.admin.engagement,
        queryFn: async () => {
            const { getDetailedEngagement } = await import('../admin.api')
            return getDetailedEngagement()
        },
        staleTime: 30_000,
        refetchOnMount: true,
    })
}

export function usePaymentStats() {
    return useQuery({
        queryKey: ['payment-stats'], // Special case, usually part of admin stats
        queryFn: async () => {
            const { getAdminStats } = await import('../admin.api')
            const stats = await getAdminStats()
            return stats?.payments || {}
        },
        staleTime: 30_000,
        refetchOnMount: true,
    })
}

export function useCityStats() {
    return useQuery({
        queryKey: queryKeys.admin.cityStats,
        queryFn: async () => {
            const { getCityStats } = await import('../admin.api')
            return getCityStats()
        },
        staleTime: 30_000,
        refetchOnMount: true,
    })
}

export function useReviewsTimeline(days = 30) {
    return useQuery({
        queryKey: queryKeys.admin.reviewsTimeline(days),
        queryFn: async () => {
            const { getReviewsTimeline } = await import('../admin.api')
            return getReviewsTimeline(days)
        },
        staleTime: 30_000,
        refetchOnMount: true,
    })
}

export function useUserGrowth(days = 30) {
    return useQuery({
        queryKey: queryKeys.admin.userGrowth(days),
        queryFn: async () => {
            const { getUserGrowth } = await import('../admin.api')
            return getUserGrowth(days)
        },
        staleTime: 30_000,
        refetchOnMount: true,
    })
}
