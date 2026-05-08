/**
 * useDiningPresence — manages the current user's dining presence state.
 *
 * Features:
 * - upsertPresence() mutation (React Query)
 * - clearPresence() mutation
 * - Auto-clear on unmount (cleanup)
 * - 30-min timer that auto-expires and shows a toast
 * - Reads current presence on mount
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useCallback } from 'react'
import { queryKeys } from '@/shared/api/queries/queryKeys'
import { useAuthStore } from '@/shared/store/useAuthStore'

export function useDiningPresence() {
    const qc = useQueryClient()
    const { user } = useAuthStore()
    const userId = user?.id
    const expiryTimerRef = useRef(null)

    // ── Read current presence ────────────────────────────────────────────
    const { data: myPresence, isLoading } = useQuery({
        queryKey: queryKeys.dine.presence(userId),
        queryFn: async () => {
            const { getMyPresence } = await import('../api/dinewithme.api')
            return getMyPresence()
        },
        enabled: !!userId,
        staleTime: 10_000,
        refetchInterval: 60_000,  // refresh every minute to check expiry
    })

    // ── Upsert presence ──────────────────────────────────────────────────
    const upsertMutation = useMutation({
        mutationFn: async (params) => {
            const { upsertPresence } = await import('../api/dinewithme.api')
            return upsertPresence(params)
        },
        onSuccess: (data) => {
            qc.setQueryData(queryKeys.dine.presence(userId), data)
            qc.invalidateQueries({ queryKey: queryKeys.dine.nearby })

            // Set auto-expire timer
            if (data?.expires_at) {
                const msUntilExpiry = new Date(data.expires_at).getTime() - Date.now()
                if (msUntilExpiry > 0) {
                    clearTimeout(expiryTimerRef.current)
                    expiryTimerRef.current = setTimeout(() => {
                        qc.invalidateQueries({ queryKey: queryKeys.dine.presence(userId) })
                        qc.invalidateQueries({ queryKey: queryKeys.dine.nearby })
                    }, msUntilExpiry)
                }
            }
        },
        onError: (err) => {
            console.error('[useDiningPresence] goVisible failed:', err)
        },
    })

    // ── Clear presence ───────────────────────────────────────────────────
    const clearMutation = useMutation({
        mutationFn: async () => {
            const { clearPresence } = await import('../api/dinewithme.api')
            return clearPresence()
        },
        onSuccess: () => {
            qc.setQueryData(queryKeys.dine.presence(userId), null)
            qc.invalidateQueries({ queryKey: queryKeys.dine.nearby })
            clearTimeout(expiryTimerRef.current)
        },
    })

    // ── Cleanup on unmount ───────────────────────────────────────────────
    useEffect(() => {
        return () => {
            clearTimeout(expiryTimerRef.current)
        }
    }, [])

    const goVisible = useCallback((params) => upsertMutation.mutateAsync(params), [upsertMutation])
    const goInvisible = useCallback(() => clearMutation.mutateAsync(), [clearMutation])

    const isPresent = !!myPresence && new Date(myPresence.expires_at) > new Date()
    const isGoingVisible = upsertMutation.isPending
    const isGoingInvisible = clearMutation.isPending

    return {
        myPresence,
        isPresent,
        isLoading,
        goVisible,
        goInvisible,
        isGoingVisible,
        isGoingInvisible,
        error: upsertMutation.error || clearMutation.error,
    }
}
