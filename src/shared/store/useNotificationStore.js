import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * useNotificationStore - manages user and admin notification preferences
 * and permissions status.
 */

const DEFAULT_PREFERENCES = {
    new_locations: true,
    recommendations: true,
    system_updates: true,
    admin_pending_review: true,
    admin_system_errors: true,
    admin_kg_updates: true
}

export const useNotificationStore = create(
    persist(
        (set) => ({
            preferences: DEFAULT_PREFERENCES,
            permissionStatus: 'default', // 'default', 'granted', 'denied', 'unsupported'
            pushEnabled: false,
            notifications: [],
            unreadCount: 0,
            loading: false,

            // Actions
            setPermissionStatus: (status) => set({ permissionStatus: status }),
            
            setPushEnabled: (enabled) => set({ pushEnabled: enabled }),

            setLoading: (loading) => set({ loading }),

            setNotifications: (notifications) => set({ 
                notifications,
                unreadCount: notifications.filter(n => !n.read).length
            }),
            
            togglePreference: (id) => set((state) => ({
                preferences: {
                    ...state.preferences,
                    [id]: !state.preferences[id]
                }
            })),
            
            resetPreferences: () => set({ preferences: DEFAULT_PREFERENCES }),

            addNotification: (notification) => set((state) => {
                const newNotifications = [
                    { id: Date.now(), timestamp: new Date().toISOString(), read: false, ...notification },
                    ...state.notifications
                ].slice(0, 50)
                
                return {
                    notifications: newNotifications,
                    unreadCount: newNotifications.filter(n => !n.read).length
                }
            }),

            markAsRead: (id) => set((state) => {
                const newNotifications = state.notifications.map(n => 
                    n.id === id ? { ...n, read: true } : n
                )
                return {
                    notifications: newNotifications,
                    unreadCount: newNotifications.filter(n => !n.read).length
                }
            }),

            markAllAsRead: () => set((state) => ({
                notifications: state.notifications.map(n => ({ ...n, read: true })),
                unreadCount: 0
            })),

            clearNotifications: () => set({ notifications: [], unreadCount: 0 })
        }),
        {
            name: 'gastromap-notifications-storage',
            // Only persist preferences and certain flags
            partialize: (state) => ({ 
                preferences: state.preferences,
                pushEnabled: state.pushEnabled
            }),
        }
    )
)

/**
 * Helper hook for derived state
 */
export const useUnreadCount = () => useNotificationStore((state) => state.unreadCount)
