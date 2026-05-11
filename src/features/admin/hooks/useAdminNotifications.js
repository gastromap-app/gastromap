import { useEffect, useCallback } from 'react'
import { supabase } from '@/shared/api/client'
import { useNotificationStore } from '@/shared/store/useNotificationStore'
import { getNotificationHistory } from '@/shared/api/notifications.api'
import { useAuthStore } from '@/shared/store/useAuthStore'

/**
 * useAdminNotifications — subscribes to Realtime events relevant to admin:
 * - New reviews (pending moderation)
 * - New users (profiles INSERT)
 * - New locations with status 'pending' (user submissions)
 * - New waitlist entries (dine_with_me_waitlist, biosync_waitlist)
 *
 * Populates the notification store with real-time events.
 */
export function useAdminNotifications() {
    const { user } = useAuthStore()
    const { addNotification, setNotifications } = useNotificationStore()
    const notifications = useNotificationStore(s => s.notifications)
    const unreadCount = useNotificationStore(s => s.unreadCount)

    // Load existing notifications from DB on mount
    useEffect(() => {
        if (!user?.id) return
        getNotificationHistory(30, false).then(history => {
            if (history.length > 0) {
                const mapped = history.map(n => ({
                    id: n.id,
                    text: n.title + (n.body ? `: ${n.body}` : ''),
                    time: formatTimeAgo(n.created_at),
                    unread: !n.read,
                    type: n.type,
                }))
                setNotifications(mapped)
            }
        }).catch(() => {})
    }, [user?.id, setNotifications])

    // Subscribe to Realtime for admin-relevant events
    useEffect(() => {
        if (!supabase || !user?.id) return

        const channel = supabase
            .channel('admin-notifications')
            // New reviews pending moderation
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews', filter: 'status=eq.pending' }, () => {
                addNotification({
                    text: `New review pending moderation`,
                    type: 'review',
                    unread: true,
                    time: 'Just now',
                })
            })
            // New user registered
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
                const name = payload.new?.full_name || payload.new?.display_name || 'Someone'
                addNotification({
                    text: `New user: ${name}`,
                    type: 'new_user',
                    unread: true,
                    time: 'Just now',
                })
            })
            // New location submitted for moderation
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locations', filter: 'status=eq.pending' }, (payload) => {
                addNotification({
                    text: `New location for moderation: ${payload.new?.title || 'Untitled'}`,
                    type: 'moderation',
                    unread: true,
                    time: 'Just now',
                })
            })
            // Dine With Me waitlist
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dine_with_me_waitlist' }, () => {
                addNotification({
                    text: 'New Dine With Me waitlist request',
                    type: 'waitlist',
                    unread: true,
                    time: 'Just now',
                })
            })
            .subscribe()

        return () => {
            try { supabase.removeChannel(channel) } catch { /* already removed */ }
        }
    }, [user?.id, addNotification])

    const markAllRead = useCallback(() => {
        useNotificationStore.getState().markAllAsRead()
    }, [])

    return { notifications, unreadCount, markAllRead }
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}
