import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

// ─── User Preferences ───────────────────────────────────────────────────────

export function useUserPreferences(userId) {
    return useQuery({ 
        queryKey: queryKeys.user.preferences(userId), 
        queryFn: async () => {
            const { getUserPreferences } = await import('../preferences.api')
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
            const { updateUserPreferences } = await import('../preferences.api')
            return updateUserPreferences(userId, preferences)
        },
        onSuccess: (_, { userId }) => {
            qc.invalidateQueries({ queryKey: queryKeys.user.preferences(userId) })
        },
    })
}
