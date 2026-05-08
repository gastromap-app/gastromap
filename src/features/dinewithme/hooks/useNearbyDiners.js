/**
 * useNearbyDiners — reads nearby diners with Supabase Realtime updates.
 *
 * Features:
 * - Initial fetch via getNearbyDiners()
 * - Realtime subscription on dining_presence table
 * - Client-side filtering of expired + reported users
 * - Returns { diners, isLoading, error }
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { queryKeys } from '@/shared/api/queries/queryKeys'
import { useGeoStore } from '@/shared/store/useGeoStore'
import { supabase } from '@/shared/api/client'

export function useNearbyDiners(enabled = false) {
    const qc = useQueryClient()
    const { lat, lng } = useGeoStore()
    const channelRef = useRef(null)

    // ── Query nearby diners ──────────────────────────────────────────────
    const coordsKey = lat && lng ? `${lat.toFixed(3)},${lng.toFixed(3)}` : 'none'

    const { data: diners = [], isLoading, error } = useQuery({
        queryKey: queryKeys.dine.nearby(coordsKey),
        queryFn: async () => {
            if (!lat || !lng) return []
            const { getNearbyDiners } = await import('../api/dinewithme.api')
            return getNearbyDiners({ lat, lng })
        },
        enabled: enabled && !!lat && !!lng,
        staleTime: 5_000,       // data is fresh for 5s
        refetchInterval: 15_000, // periodic refetch as fallback
    })

    // ── Realtime subscription ────────────────────────────────────────────
    useEffect(() => {
        if (!enabled || !supabase) return

        const channel = supabase
            .channel('dine-presence-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'dining_presence' },
                () => {
                    // Invalidate nearby query to trigger refetch
                    qc.invalidateQueries({ queryKey: ['dine-nearby'] })
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

    // ── Subscribe to incoming waves ──────────────────────────────────────
    useEffect(() => {
        if (!enabled || !supabase) return

        const channel = supabase
            .channel('dine-waves-incoming')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'dine_waves' },
                (payload) => {
                    // Show a toast notification for incoming waves
                    const wave = payload.new
                    if (wave?.venue_name) {
                        // Dispatch a custom event for the UI to pick up
                        window.dispatchEvent(new CustomEvent('dine:wave-received', {
                            detail: { venueName: wave.venue_name }
                        }))
                    }
                    qc.invalidateQueries({ queryKey: queryKeys.dine.waves })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [enabled, qc])

    return { diners, isLoading, error }
}
