import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { signIn, signUp, signOut, updateProfile, subscribeToAuthChanges, resetPassword, updatePassword, resendVerification, uploadAvatar } from '@/shared/api/auth.api'

/**
 * useAuthStore — session & identity.
 *
 * Stores: user identity, auth state, token.
 * Persists to localStorage ('auth-storage') — survives page refresh.
 *
 * On app mount, call initAuth() once to:
 *   1. Restore session from Supabase (if configured)
 *   2. Set up onAuthStateChange listener for token refresh, tab sync, logout
 */
export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,            // { id, name, email, role, avatar, createdAt }
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            // ─── Actions ─────────────────────────────────────────────────

            /**
             * Call once on App mount. Sets up Supabase auth listener
             * and restores session if it exists.
             */
            initAuth: () => {
                set({ isLoading: true })

                const unsubscribe = subscribeToAuthChanges(
                    // onSession — called with current + future sessions
                    ({ user, token }) => {
                        set({ user, token, isAuthenticated: true, isLoading: false })
                    },
                    // onSignOut
                    () => {
                        set({ user: null, token: null, isAuthenticated: false, isLoading: false })
                    }
                )

                // Safety timeout — if Supabase is unreachable, stop loading after 5s
                const timeout = setTimeout(() => {
                    if (get().isLoading) set({ isLoading: false })
                }, 5000)

                set({ _unsubscribeAuth: unsubscribe, _authTimeout: timeout })
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

                    // Email confirmation required (Supabase setting enabled)
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
                // 1. Tear down auth listener FIRST so the SIGNED_OUT event
                //    from Supabase doesn't race with our manual state clear.
                const { _unsubscribeAuth } = get()
                if (_unsubscribeAuth) _unsubscribeAuth()

                // 2. Tell Supabase to invalidate the session. Wrap in try/catch
                //    so a network failure or stale token never blocks sign-out.
                try {
                    await signOut()
                } catch (err) {
                    console.warn('[auth] signOut request failed (state cleared anyway):', err?.message)
                }

                // 3. Always clear local state — even if the network call failed.
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    isLoading: false,
                    error: null,
                    _unsubscribeAuth: null,
                })
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

            // ─── Password Reset ─────────────────────────────────────────────

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

            // ─── Avatar Upload ──────────────────────────────────────────────

            uploadAvatar: async (file) => {
                const { user } = get()
                if (!user) return { success: false, error: 'Not authenticated' }
                set({ isLoading: true, error: null })
                try {
                    const { url } = await uploadAvatar(user.id, file)
                    // Update profile with new avatar URL
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
