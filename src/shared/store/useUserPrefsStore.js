import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/shared/api/client'

/**
 * useUserPrefsStore — user preferences & personalisation.
 * Persists to localStorage (instant) + Supabase profiles.preferences (sync).
 */

const DEFAULT_PREFS = {
    onboardingCompleted: false,
    favoriteCuisines: [],
    dietaryRestrictions: [],
    atmospherePreference: '', // Standardized as string
    vibePreference: [],       // Array of tags
    priceRange: ['$', '$$'],
    features: [],
    foodieDNA: '',
    lastVisited: [],
    frequentSearches: [],
}

import { getUserPreferences, updateUserPreferences } from '@/shared/api/preferences.api'

async function syncToSupabase(prefs) {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const userId = session.user.id

        // Sync to both tables for redundancy and backward compatibility
        await Promise.all([
            supabase
                .from('profiles')
                .update({ onboarding_completed: prefs.onboardingCompleted })
                .eq('id', userId),
            updateUserPreferences(userId, prefs)
        ])
    } catch (error) {
        console.error('[PrefsStore] Sync failed:', error)
    }
}


export const useUserPrefsStore = create(
    persist(
        (set, get) => ({
            prefs: DEFAULT_PREFS,

            updatePrefs: async (updates) => {
                set((state) => ({
                    prefs: { ...state.prefs, ...updates },
                }))
                // Sync to Supabase in background
                const updated = { ...get().prefs, ...updates }
                syncToSupabase(updated)
            },

            addVisited: (locationId) => {
                const { lastVisited } = get().prefs
                if (lastVisited.includes(locationId)) return
                set((state) => ({
                    prefs: {
                        ...state.prefs,
                        lastVisited: [locationId, ...state.prefs.lastVisited].slice(0, 50),
                    },
                }))
            },

            removeVisited: (locationId) => {
                set((state) => ({
                    prefs: {
                        ...state.prefs,
                        lastVisited: state.prefs.lastVisited.filter(id => id !== locationId),
                    },
                }))
            },

            addFrequentSearch: (query) => {
                if (!query?.trim()) return
                const q = query.trim()
                set((state) => {
                    const existing = state.prefs.frequentSearches.filter(s => s !== q)
                    return {
                        prefs: {
                            ...state.prefs,
                            frequentSearches: [q, ...existing].slice(0, 20),
                        },
                    }
                })
            },

            resetPrefs: () => set({ prefs: DEFAULT_PREFS }),

            /**
             * Load DNA prefs from Supabase and merge into local store.
             * Called by OnboardingGate on fresh devices where localStorage is empty.
             * Returns true if remote data was found (onboarding was done), false otherwise.
             */
            loadFromSupabase: async () => {
                if (!supabase) return false
                try {
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session?.user) return false
                    const userId = session.user.id

                    // Fetch from both profiles (onboarding status) and preferences api
                    const [profileRes, up] = await Promise.all([
                        supabase.from('profiles').select('onboarding_completed').eq('id', userId).maybeSingle(),
                        getUserPreferences(userId)
                    ])

                    const profile = profileRes.data
                    const dna = up?.longTerm

                    // profiles.onboarding_completed takes precedence for the status
                    const onboardingCompleted = profile?.onboarding_completed ?? dna?.onboardingCompleted ?? false

                    if (dna || profile) {
                        set((state) => ({
                            prefs: {
                                ...state.prefs,
                                ...dna,
                                onboardingCompleted: onboardingCompleted,
                            },
                        }))
                        return !!onboardingCompleted
                    }
                } catch (e) {
                    console.error('[PrefsStore] Load failed:', e)
                }
                return false
            },

        }),
        {
            name: 'user-prefs-storage',
        }
    )
)
