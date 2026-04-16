import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/shared/api/client'

/**
 * useUserPrefsStore — user preferences & personalisation.
 * Persists to localStorage (instant) + Supabase profiles.preferences (sync).
 */

const DEFAULT_PREFS = {
    favoriteCuisines: [],
    dietaryRestrictions: [],
    atmospherePreference: [],
    vibePreference: [],
    priceRange: ['$', '$$'],
    features: [],
    foodieDNA: '',
    lastVisited: [],
    frequentSearches: [],
}

async function syncToSupabase(prefs) {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        await supabase
            .from('profiles')
            .update({ preferences: { onboarding: prefs } })
            .eq('id', session.user.id)
    } catch {
        // Silently fail — localStorage is always the source of truth
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
        }),
        {
            name: 'user-prefs-storage',
        }
    )
)
