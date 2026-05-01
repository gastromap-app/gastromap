import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { signIn, signUp, signOut, updateProfile, subscribeToAuthChanges, resetPassword, updatePassword, resendVerification, uploadAvatar } from '@/shared/api/auth.api'

// Import related stores for cleanup during logout
import { useAIChatStore } from './useAIChatStore'
import { useGeoStore } from './useGeoStore'
import { useFavoritesStore } from './useFavoritesStore'
import { useUserPrefsStore } from './useUserPrefsStore'
import { useNotificationStore } from './useNotificationStore'

/**
 * useAuthStore — session & identity.
 *
 * Stores: user identity, auth state, token.
 * Persists to localStorage ('auth-storage') — survives page refresh.
 */
export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,            // { id, name, email, role, avatar, createdAt }
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            _unsubscribeAuth: null,

            // ─── Actions ─────────────────────────────────────────────────

            initAuth: () => {
                set({ isLoading: true })

                const timeout = setTimeout(() => {
                    if (get().isLoading) set({ isLoading: false })
                }, 5000)

                const unsubscribe = subscribeToAuthChanges(
                    ({ user, token }) => {
                        clearTimeout(timeout)
                        set({ user, token, isAuthenticated: true, isLoading: false })
                    },
                    () => {
                        clearTimeout(timeout)
                        set({ user: null, token: null, isAuthenticated: false, isLoading: false })
                    }
                )

                set({ _unsubscribeAuth: unsubscribe })
            },

            login: async (email, password) => {
                set({ isLoading: true, error: null })
                try {
                    const result = await signIn(email, password)
                    set({ user: result.user, token: result.token, isAuthenticated: true, isLoading: false })
                    return { success: true, user: result.user }
                } catch (err) {
                    set({ error: err.message, isLoading: false })
                    return { success: false, error: err.message }
                }
            },

            register: async (email, password, name) => {
                set({ isLoading: true, error: null })
                try {
                    const result = await signUp(email, password, name)
                    if (result.emailConfirmation) {
                        set({ isLoading: false })
                        return { success: true, emailConfirmation: true }
                    }
                    set({ user: result.user, token: result.token, isAuthenticated: true, isLoading: false })
                    return { success: true, user: result.user }
                } catch (err) {
                    set({ error: err.message, isLoading: false })
                    return { success: false, error: err.message }
                }
            },

            logout: async () => {
                try {
                    // 1. Stop auth listener immediately
                    const { _unsubscribeAuth } = get()
                    if (_unsubscribeAuth) {
                        try { _unsubscribeAuth() } catch (e) { console.warn('[auth] listener cleanup failed:', e) }
                        set({ _unsubscribeAuth: null })
                    }

                    // 2. Clear local auth state BEFORE async network calls
                    // This ensures UI updates immediately even if signOut() hangs
                    set({ 
                        user: null, 
                        token: null, 
                        isAuthenticated: false, 
                        isLoading: false, 
                        error: null 
                    })

                    // 3. Reset all related stores (Isolation)
                    // We use static imports now for reliability
                    try {
                        // Reset AI Chat
                        useAIChatStore.getState().clearHistory()
                        useAIChatStore.getState().setIsChatOpen(false)
                        useAIChatStore.getState().setLastScrollY(0)
                        
                        // Reset Preferences (Foodie DNA)
                        useUserPrefsStore.getState().resetPrefs()
                        
                        // Reset Geo
                        useGeoStore.getState().reset()
                        
                        // Reset Favorites
                        useFavoritesStore.getState().reset()
                        
                        // Reset Notifications
                        const notifStore = useNotificationStore.getState()
                        if (notifStore.clearNotifications) notifStore.clearNotifications()
                        if (notifStore.resetPreferences) notifStore.resetPreferences()

                    } catch (e) {
                        console.error('[auth] failed to clear related stores during logout:', e)
                    }

                    // 4. Final safety wipe of persisted chat from localStorage
                    localStorage.removeItem('ai-chat-storage')
                    localStorage.removeItem('auth-storage') // Force clear persistence

                    // 5. Sign out from Supabase (network call last)
                    await signOut()
                    
                } catch (error) {
                    console.error('Logout error:', error)
                    set({ error: error.message })
                }
            },

            updateUserProfile: async (updates) => {
                const { user } = get()
                if (!user) return
                try {
                    const updated = await updateProfile(user.id, updates)
                    set({ user: { ...user, ...updated } })
                } catch (err) {
                    set({ error: err.message })
                }
            },

            requestPasswordReset: async (email) => {
                set({ isLoading: true, error: null })
                try {
                    const result = await resetPassword(email)
                    set({ isLoading: false })
                    return { success: true, message: result.message }
                } catch (err) {
                    set({ error: err.message, isLoading: false })
                    return { success: false, error: err.message }
                }
            },

            setNewPassword: async (newPassword) => {
                set({ isLoading: true, error: null })
                try {
                    const result = await updatePassword(newPassword)
                    set({ isLoading: false })
                    return { success: true, message: result.message }
                } catch (err) {
                    set({ error: err.message, isLoading: false })
                    return { success: false, error: err.message }
                }
            },

            resendVerificationEmail: async (email) => {
                set({ isLoading: true, error: null })
                try {
                    const result = await resendVerification(email)
                    set({ isLoading: false })
                    return { success: true, message: result.message }
                } catch (err) {
                    set({ error: err.message, isLoading: false })
                    return { success: false, error: err.message }
                }
            },

            uploadAvatar: async (file) => {
                const { user } = get()
                if (!user) return { success: false, error: 'Not authenticated' }
                set({ isLoading: true, error: null })
                try {
                    const { url } = await uploadAvatar(user.id, file)
                    const updated = await updateProfile(user.id, { avatar: url })
                    set({ user: { ...user, ...updated }, isLoading: false })
                    return { success: true, url }
                } catch (err) {
                    set({ error: err.message, isLoading: false })
                    return { success: false, error: err.message }
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)
