/**
 * useAllDiners — reads ALL active diners across the platform with Supabase Realtime updates.
 *
 * Features:
 * - Initial fetch via getAllActiveDiners() (no radius filter, includes current user)
 * - Realtime subscription on dining_presence table
 * - Returns { diners, isLoading, error }
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useId } from 'react'
import { supabase } from '@/shared/api/client'

export function useAllDiners(enabled = false) {
    const qc = useQueryClient()
    const channelRef = useRef(null)
    const hookId = useId()

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
    // Use a unique channel name per hook instance to avoid conflicts when
    // multiple components call useAllDiners simultaneously (e.g. MapPage + MapTab).
    useEffect(() => {
        if (!enabled || !supabase) return

        const channelName = `dine-all-presence-changes-${hookId}`
        const channel = supabase
            .channel(channelName)
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
    }, [enabled, qc, hookId])

    return { diners, isLoading, error }
}
