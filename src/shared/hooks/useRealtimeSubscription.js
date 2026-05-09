import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queries/queryKeys'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { _fetchProfile } from '@/shared/api/auth.api'

/**
 * useRealtimeSubscription — subscribes to Supabase Realtime for
 * user-specific tables (favorites, visits, profiles) and invalidates
 * the corresponding React Query caches when data changes.
 *
 * Also includes a fallback profile poll (every 60 s) so that if
 * Realtime delivery fails (e.g. RLS misconfiguration), the user's
 * role still converges to the DB value within a minute.
 *
 * @param {string|undefined} userId — current user ID from useAuthStore
 */
export function useRealtimeSubscription(userId) {
    const qc = useQueryClient()
    const userIdRef = useRef(userId)
    userIdRef.current = userId

    // ── Fallback: poll profile every 60 s to sync role ──────────────
    useEffect(() => {
        if (!userId) return

        let active = true
        const POLL_INTERVAL = 60_000

        const poll = async () => {
            if (!active) return
            try {
                const profile = await _fetchProfile(userId)
                if (!active) return
                const { user } = useAuthStore.getState()
                if (user && profile?.role && user.role !== profile.role) {
                    useAuthStore.setState({ user: { ...user, role: profile.role } })
                    console.info('[realtime] Role synced via poll:', user.role, '→', profile.role)
                }
            } catch { /* network error — ignore, will retry next interval */ }
        }

        // First poll after 30 s, then every 60 s
        const initial = setTimeout(poll, 30_000)
        const interval = setInterval(poll, POLL_INTERVAL)

        return () => {
            active = false
            clearTimeout(initial)
            clearInterval(interval)
        }
    }, [userId])

    // ── Realtime subscriptions ───────────────────────────────────────
    useEffect(() => {
        if (!supabase || !userId) return

        const channel = supabase
            .channel('app-realtime')
            // User favorites changed (from another device, admin action, etc.)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_favorites', filter: `user_id=eq.${userId}` },
                () => {
                    const uid = userIdRef.current
                    // Invalidate both favorites queries for this user
                    qc.invalidateQueries({ queryKey: queryKeys.favorites.all(uid) })
                    qc.invalidateQueries({ queryKey: queryKeys.favorites.withLocations(uid) })
                }
            )
            // User visits changed
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_visits', filter: `user_id=eq.${userId}` },
                () => {
                    const uid = userIdRef.current
                    // Invalidate both visits queries for this user
                    qc.invalidateQueries({ queryKey: queryKeys.visits.all(uid) })
                    qc.invalidateQueries({ queryKey: queryKeys.visits.withLocations(uid) })
                }
            )
            // Profile changed (role update by admin) — refresh auth store
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
                (payload) => {
                    const newRole = payload.new?.role
                    if (!newRole) return
                    const { user } = useAuthStore.getState()
                    if (user && user.role !== newRole) {
                        // Update the role in auth store immediately
                        useAuthStore.setState({
                            user: { ...user, role: newRole },
                        })
                        console.info('[realtime] Role synced via Realtime:', user.role, '→', newRole)
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.info('[realtime] app-realtime channel subscribed')
                } else if (status === 'CHANNEL_ERROR') {
                    console.warn('[realtime] app-realtime channel error — role sync will rely on polling fallback')
                } else if (status === 'TIMED_OUT') {
                    console.warn('[realtime] app-realtime channel timed out — role sync will rely on polling fallback')
                }
            })

        return () => {
            try { supabase.removeChannel(channel) } catch { /* already removed */ }
        }
    }, [userId, qc])
}
