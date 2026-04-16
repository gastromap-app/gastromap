/**
 * Push Notifications Service
 *
 * Uses Web Notifications API for local notifications.
 * Prepared for Firebase Cloud Messaging (FCM) integration.
 *
 * Features:
 * - Request/Check notification permission
 * - Subscribe/Unsubscribe to push notifications
 * - Store push subscriptions in Supabase
 * - Send local notifications for app events
 * - Admin-configurable notification types
 */

import { supabase } from './client'

// ─── Notification Types ─────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = {
    // User-facing notifications
    NEW_RECOMMENDATION: {
        id: 'new_recommendation',
        label: 'New Recommendations',
        description: 'Get notified when AI finds places matching your taste',
        icon: '🍽️',
        defaultEnabled: true,
    },
    LOCATION_APPROVED: {
        id: 'location_approved',
        label: 'Location Approved',
        description: 'Your submitted location was approved by moderators',
        icon: '✅',
        defaultEnabled: true,
    },
    LOCATION_REJECTED: {
        id: 'location_rejected',
        label: 'Location Rejected',
        description: 'Your submitted location needs changes or was rejected',
        icon: '❌',
        defaultEnabled: true,
    },
    REVIEW_REPLY: {
        id: 'review_reply',
        label: 'Review Replies',
        description: 'Someone replied to your review',
        icon: '💬',
        defaultEnabled: true,
    },
    PRICE_DROP: {
        id: 'price_drop',
        label: 'Price Updates',
        description: 'Price changes at your saved places',
        icon: '💰',
        defaultEnabled: false,
    },
    NEW_FEATURE: {
        id: 'new_feature',
        label: 'New Features',
        description: 'Announcements about new app features',
        icon: '🎉',
        defaultEnabled: true,
    },
    WEEKLY_DIGEST: {
        id: 'weekly_digest',
        label: 'Weekly Digest',
        description: 'Weekly summary of top places and trends',
        icon: '📊',
        defaultEnabled: false,
    },

    // Admin notifications
    MODERATION_PENDING: {
        id: 'moderation_pending',
        label: 'Pending Moderation',
        description: 'New locations waiting for review',
        icon: '⏳',
        defaultEnabled: true,
        adminOnly: true,
    },
    NEW_USER: {
        id: 'new_user',
        label: 'New Users',
        description: 'New user registrations (admin only)',
        icon: '👤',
        defaultEnabled: false,
        adminOnly: true,
    },
}

// ─── Permission Management ─────────────────────────────────────────────────

/**
 * Check current notification permission status
 * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
 */
export function getPermissionStatus() {
    if (!('Notification' in window)) {
        return 'unsupported'
    }
    return Notification.permission
}

/**
 * Check if notifications are supported
 */
export function isSupported() {
    return 'Notification' in window
}

/**
 * Check if push is supported (requires service worker)
 */
export function isPushSupported() {
    return 'PushManager' in window && 'serviceWorker' in navigator
}

/**
 * Request notification permission
 * @returns {Promise<'granted' | 'denied' | 'default'>}
 */
export async function requestPermission() {
    if (!isSupported()) {
        console.warn('[Notifications] Not supported in this browser')
        return 'unsupported'
    }

    try {
        const permission = await Notification.requestPermission()
        return permission
    } catch (err) {
        console.error('[Notifications] Error requesting permission:', err)
        return 'denied'
    }
}

// ─── Local Notifications ───────────────────────────────────────────────────

/**
 * Show a local notification
 * @param {string} title
 * @param {Object} options
 * @param {string} [options.body]
 * @param {string} [options.icon]
 * @param {string} [options.tag] - Tag for grouping/replace
 * @param {any} [options.data] - Custom data to pass to click handler
 * @param {string} [options.url] - URL to open on click
 */
export async function showLocalNotification(title, options = {}) {
    if (getPermissionStatus() !== 'granted') {
        console.warn('[Notifications] No permission to show notification')
        return null
    }

    const { body, icon, tag, data, url } = options

    try {
        // Try to use service worker for better control
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready

            await registration.showNotification(title, {
                body,
                icon: icon || '/pwa-icon-192.png',
                badge: '/pwa-icon-192.png',
                tag,
                data: { ...data, url },
                requireInteraction: false,
            })
        } else {
            // Fallback to regular Notification
            const notification = new Notification(title, {
                body,
                icon: icon || '/pwa-icon-192.png',
                tag,
                data,
            })

            if (url) {
                notification.onclick = () => {
                    window.open(url, '_blank')
                    notification.close()
                }
            }
        }

        // Store notification in history (for in-app notification center)
        await storeNotification({
            type: tag || 'general',
            title,
            body,
            data,
            read: false,
        })

        return true
    } catch (err) {
        console.error('[Notifications] Error showing notification:', err)
        return null
    }
}

// ─── Notification Storage (Supabase) ────────────────────────────────────────

/**
 * Store notification in user's notification history
 */
async function storeNotification(notification) {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null

        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: user.id,
                type: notification.type,
                title: notification.title,
                body: notification.body,
                data: notification.data || {},
                read: false,
                created_at: new Date().toISOString(),
            })

        if (error) throw error
        return true
    } catch (err) {
        // Table might not exist in mock mode - fail silently
        console.warn('[Notifications] Could not store notification:', err.message)
        return null
    }
}

/**
 * Get user's notification history
 * @param {number} limit
 * @param {boolean} unreadOnly
 */
export async function getNotificationHistory(limit = 20, unreadOnly = false) {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (unreadOnly) {
            query = query.eq('read', false)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    } catch (err) {
        console.warn('[Notifications] Could not fetch history:', err.message)
        return []
    }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId) {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId)

        if (error) throw error
        return true
    } catch (err) {
        console.warn('[Notifications] Could not mark as read:', err.message)
        return false
    }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead() {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return false

        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id)
            .eq('read', false)

        if (error) throw error
        return true
    } catch (err) {
        console.warn('[Notifications] Could not mark all as read:', err.message)
        return false
    }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount() {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return 0

        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('read', false)

        if (error) throw error
        return count || 0
    } catch (err) {
        return 0
    }
}

// ─── Push Subscription (FCM-ready) ──────────────────────────────────────────

/**
 * Subscribe to push notifications
 * Requires VAPID keys for FCM or Web Push
 */
export async function subscribeToPush() {
    if (!isPushSupported()) {
        console.warn('[Notifications] Push not supported')
        return null
    }

    try {
        const registration = await navigator.serviceWorker.ready

        // Check for existing subscription
        let subscription = await registration.pushManager.getSubscription()

        if (!subscription) {
            // Real Web Push subscription
            // Requires VITE_VAPID_PUBLIC_KEY in env for server-sent push
            const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
            if (!vapidKey) {
                console.warn('[Notifications] VITE_VAPID_PUBLIC_KEY not set — push subscription skipped')
                return null
            }
            console.log('[Notifications] Creating Web Push subscription...')
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            })
        }

        // Store subscription in Supabase
        await storePushSubscription(subscription)

        return subscription
    } catch (err) {
        console.error('[Notifications] Error subscribing to push:', err)
        return null
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush() {
    if (!isPushSupported()) return false

    try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
            await subscription.unsubscribe()
        }

        // Remove from Supabase
        await removePushSubscription()

        return true
    } catch (err) {
        console.error('[Notifications] Error unsubscribing from push:', err)
        return false
    }
}

/**
 * Store push subscription in database
 */
async function storePushSubscription(subscription) {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null

        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: user.id,
                endpoint: subscription.endpoint,
                keys: subscription.keys,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' })

        if (error) throw error
        return true
    } catch (err) {
        console.warn('[Notifications] Could not store push subscription:', err.message)
        return null
    }
}

/**
 * Remove push subscription from database
 */
async function removePushSubscription() {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null

        await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)

        return true
    } catch (err) {
        console.warn('[Notifications] Could not remove push subscription:', err.message)
        return null
    }
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

// ─── Convenience Functions ──────────────────────────────────────────────────

/**
 * Notify user about a specific event
 */
export async function notify(type, data = {}) {
    const typeConfig = NOTIFICATION_TYPES[type]

    if (!typeConfig) {
        console.warn(`[Notifications] Unknown type: ${type}`)
        return null
    }

    return showLocalNotification(data.title || typeConfig.label, {
        body: data.body,
        icon: data.icon,
        tag: typeConfig.id,
        url: data.url,
        data: data.data,
    })
}

/**
 * Notify about new recommendation
 */
export async function notifyRecommendation(placeName, reason) {
    return showLocalNotification('New recommendation for you!', {
        body: `${placeName} - ${reason}`,
        tag: 'new_recommendation',
        icon: '🍽️',
    })
}

/**
 * Notify about location approval
 */
export async function notifyLocationApproved(locationName) {
    return showLocalNotification('Location approved!', {
        body: `Your location "${locationName}" has been approved and is now visible to users.`,
        tag: 'location_approved',
    })
}

/**
 * Notify about location rejection
 */
export async function notifyLocationRejected(locationName, reason) {
    return showLocalNotification('Location needs changes', {
        body: `"${locationName}" was not approved. Reason: ${reason}`,
        tag: 'location_rejected',
    })
}

/**
 * Notify moderators about pending locations
 */
export async function notifyModerationPending(count) {
    return showLocalNotification('Locations awaiting review', {
        body: `${count} new location(s) are waiting for moderation.`,
        tag: 'moderation_pending',
    })
}
