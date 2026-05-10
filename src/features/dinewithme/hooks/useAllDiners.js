/**
 * useAllDiners — reads ALL active diners across the platform with Supabase Realtime updates.
 *
 * Features:
 * - Initial fetch via getAllActiveDiners() (no radius filter, includes current user)
 * - Realtime subscription on dining_presence table
 * - Returns { diners, isLoading, error }
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { supabase } from '@/shared/api/client'

export function useAllDiners(enabled = false) {
    const qc = useQueryClient()
    const channelRef = useRef(null)

    // ── Query all active diners ──────────────────────────────────────────
    const { data: diners = [], isLoading, error } = useQuery({
        queryKey: ['dine-all'],
        queryFn: async () => {
            const { getAllActiveDiners } = await import('../api/dinewithme.api')
            return getAllActiveDiners()
        },
        enabled,
        staleTime: 5_000,
        refetchInterval: 15_000,
    })

    // ── Realtime subscription ────────────────────────────────────────────
    useEffect(() => {
        if (!enabled || !supabase) return

        const channel = supabase
            .channel('dine-all-presence-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'dining_presence' },
                () => {
                    qc.invalidateQueries({ queryKey: ['dine-all'] })
                }
            )
            .subscribe()

        channelRef.current = channel

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
                channelRef.current = null
            }
        }
    }, [enabled, qc])

    return { diners, isLoading, error }
}
