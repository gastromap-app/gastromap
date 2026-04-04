/**
 * Notification Preferences Store
 *
 * Manages user's notification preferences and tracks state.
 * Persisted to localStorage for offline access.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { NOTIFICATION_TYPES } from '@/shared/api/notifications.api'

// Default preferences based on NOTIFICATION_TYPES
const getDefaultPreferences = () => {
    const prefs = {}
    Object.values(NOTIFICATION_TYPES).forEach(type => {
        prefs[type.id] = type.defaultEnabled
    })
    return prefs
}

export const useNotificationStore = create(
    persist(
        (set, get) => ({
            // ─── Permission State ────────────────────────────────
            permissionStatus: 'default', // 'granted' | 'denied' | 'default' | 'unsupported'
            pushEnabled: false,
            subscribed: false,

            // ─── Notification Preferences ─────────────────────────
            preferences: getDefaultPreferences(),

            // ─── In-App Notification Center ───────────────────────
            notifications: [],
            unreadCount: 0,
            loading: false,

            // ─── Actions ───────────────────────────────────────────

            /**
             * Update permission status
             */
            setPermissionStatus: (status) => set({ permissionStatus: status }),

            /**
             * Set push enabled state
             */
            setPushEnabled: (enabled) => set({ pushEnabled: enabled, subscribed: enabled }),

            /**
             * Toggle a specific notification type
             */
            togglePreference: (typeId) => set((state) => ({
                preferences: {
                    ...state.preferences,
                    [typeId]: !state.preferences[typeId],
                },
            })),

            /**
             * Set all preferences at once
             */
            setPreferences: (prefs) => set({ preferences: prefs }),

            /**
             * Reset preferences to defaults
             */
            resetPreferences: () => set({ preferences: getDefaultPreferences() }),

            /**
             * Check if a notification type is enabled
             */
            isTypeEnabled: (typeId) => get().preferences[typeId] ?? false,

            /**
             * Add notification to in-app center
             */
            addNotification: (notification) => set((state) => ({
                notifications: [
                    {
                        id: notification.id || Date.now().toString(),
                        type: notification.type,
                        title: notification.title,
                        body: notification.body,
                        data: notification.data || {},
                        read: false,
                        createdAt: new Date().toISOString(),
                    },
                    ...state.notifications,
                ].slice(0, 50), // Keep last 50
                unreadCount: state.unreadCount + 1,
            })),

            /**
             * Mark notification as read
             */
            markAsRead: (notificationId) => set((state) => ({
                notifications: state.notifications.map(n =>
                    n.id === notificationId ? { ...n, read: true } : n
                ),
                unreadCount: Math.max(0, state.unreadCount - 1),
            })),

            /**
             * Mark all as read
             */
            markAllAsRead: () => set((state) => ({
                notifications: state.notifications.map(n => ({ ...n, read: true })),
                unreadCount: 0,
            })),

            /**
             * Clear all notifications
             */
            clearAll: () => set({ notifications: [], unreadCount: 0 }),

            /**
             * Set notifications from API
             */
            setNotifications: (notifications) => set({
                notifications,
                unreadCount: notifications.filter(n => !n.read).length,
            }),

            /**
             * Set loading state
             */
            setLoading: (loading) => set({ loading }),
        }),
        {
            name: 'notification-preferences',
            partialize: (state) => ({
                preferences: state.preferences,
                pushEnabled: state.pushEnabled,
            }),
        }
    )
)

// ─── Selector Hooks ─────────────────────────────────────────────────────────

/**
 * Get notification preference for a specific type
 */
export function useNotificationPreference(typeId) {
    return useNotificationStore(state => state.preferences[typeId] ?? false)
}

/**
 * Get unread notification count
 */
export function useUnreadCount() {
    return useNotificationStore(state => state.unreadCount)
}

/**
 * Check if notifications are enabled and permitted
 */
export function useNotificationsEnabled() {
    const { permissionStatus, pushEnabled } = useNotificationStore()
    return permissionStatus === 'granted' && pushEnabled
}
