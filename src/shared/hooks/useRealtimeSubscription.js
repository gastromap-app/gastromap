import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queries/queryKeys'
import { useAuthStore } from '@/shared/store/useAuthStore'

/**
 * useRealtimeSubscription — subscribes to Supabase Realtime for
 * user-specific tables (favorites, visits) and invalidates the
 * corresponding React Query caches when data changes.
 *
 * This means: when the user favorites a place from another device,
 * or when an admin modifies data, the next read gets fresh data.
 *
 * The hook is a no-op if supabase is not configured or userId is missing.
 *
 * @param {string|undefined} userId — current user ID from useAuthStore
 */
export function useRealtimeSubscription(userId) {
    const qc = useQueryClient()
    const userIdRef = useRef(userId)
    userIdRef.current = userId

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
                    }
                }
            )
            .subscribe()

        return () => {
            try { supabase.removeChannel(channel) } catch { /* already removed */ }
        }
    }, [userId, qc])
}
