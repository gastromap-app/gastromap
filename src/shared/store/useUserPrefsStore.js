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
        const userId = session.user.id

        // Try `profiles` table first (legacy schema)
        const { error: profilesError } = await supabase
            .from('profiles')
            .update({ preferences: { onboarding: prefs } })
            .eq('id', userId)

        if (profilesError) {
            // Fallback: try `user_profiles` table (new schema)
            await supabase
                .from('user_profiles')
                .upsert({
                    id: userId,
                    dna_cuisines:  prefs.favoriteCuisines  || [],
                    dna_vibes:     prefs.vibePreference    || [],
                    dna_allergens: prefs.dietaryRestrictions || [],
                    dna_price:     prefs.priceRange        || [],
                    updated_at:    new Date().toISOString(),
                })
        }
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

                    // Try user_profiles first (new schema)
                    const { data: up } = await supabase
                        .from('user_profiles')
                        .select('dna_cuisines, dna_vibes, dna_allergens, dna_price, onboarding_done')
                        .eq('id', userId)
                        .maybeSingle()

                    if (up?.onboarding_done || up?.dna_cuisines?.length > 0) {
                        set((state) => ({
                            prefs: {
                                ...state.prefs,
                                favoriteCuisines:    up.dna_cuisines    || state.prefs.favoriteCuisines,
                                vibePreference:      up.dna_vibes       || state.prefs.vibePreference,
                                dietaryRestrictions: up.dna_allergens   || state.prefs.dietaryRestrictions,
                                priceRange:          up.dna_price?.length ? up.dna_price : state.prefs.priceRange,
                            },
                        }))
                        return true
                    }

                    // Fallback: try legacy profiles table
                    const { data: prof } = await supabase
                        .from('profiles')
                        .select('preferences')
                        .eq('id', userId)
                        .maybeSingle()

                    const onb = prof?.preferences?.onboarding
                    if (onb?.cuisines?.length > 0) {
                        set((state) => ({
                            prefs: {
                                ...state.prefs,
                                favoriteCuisines:    onb.cuisines    || state.prefs.favoriteCuisines,
                                vibePreference:      onb.vibes       || state.prefs.vibePreference,
                                dietaryRestrictions: onb.allergens   || state.prefs.dietaryRestrictions,
                                priceRange:          onb.budget?.length ? onb.budget : state.prefs.priceRange,
                            },
                        }))
                        return true
                    }
                } catch { /* silently fail — localStorage is source of truth */ }
                return false
            },
        }),
        {
            name: 'user-prefs-storage',
        }
    )
)
