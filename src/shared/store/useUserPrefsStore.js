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

        // Sync to both tables for redundancy and backward compatibility
        await Promise.all([
            supabase
                .from('profiles')
                .update({ onboarding_completed: prefs.onboardingCompleted })
                .eq('id', userId),
            supabase
                .from('user_preferences')
                .upsert({
                    user_id: userId,
                    onboarding_completed: prefs.onboardingCompleted,
                    favorite_cuisines:  prefs.favoriteCuisines  || [],
                    vibe_preferences:     prefs.vibePreference    || [],
                    dietary_restrictions: prefs.dietaryRestrictions || [],
                    price_range:     prefs.priceRange?.length ? prefs.priceRange[0] : null,
                    foodie_dna:      prefs.foodieDNA || '',
                    last_updated:    new Date().toISOString(),
                }, { onConflict: 'user_id' })
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

                    // Fetch from both profiles (new source of truth) and user_preferences (legacy)
                    const [profileRes, prefsRes] = await Promise.all([
                        supabase.from('profiles').select('onboarding_completed').eq('id', userId).maybeSingle(),
                        supabase.from('user_preferences').select('onboarding_completed, favorite_cuisines, vibe_preferences, dietary_restrictions, price_range, foodie_dna').eq('user_id', userId).maybeSingle()
                    ])

                    // If we get a 400, the table or column is probably missing — ignore and use local
                    if (profileRes.error && profileRes.error.code !== 'PGRST116') {
                        // ignore 400/406 during migration
                    }

                    const profile = profileRes.data
                    const up = prefsRes.data

                    // profiles.onboarding_completed takes precedence
                    const onboardingCompleted = profile?.onboarding_completed ?? up?.onboarding_completed ?? false

                    if (up || profile) {
                        set((state) => ({
                            prefs: {
                                ...state.prefs,
                                onboardingCompleted: onboardingCompleted,
                                favoriteCuisines:    up?.favorite_cuisines    || state.prefs.favoriteCuisines,
                                vibePreference:      up?.vibe_preferences       || state.prefs.vibePreference,
                                dietaryRestrictions: up?.dietary_restrictions   || state.prefs.dietaryRestrictions,
                                priceRange:          up?.price_range ? [up.price_range] : state.prefs.priceRange,
                                foodieDNA:           up?.foodie_dna           || state.prefs.foodieDNA,
                            },
                        }))
                        return !!onboardingCompleted
                    }
                } catch {
                    // Silent fail for background sync
                }
                return false
            },
        }),
        {
            name: 'user-prefs-storage',
        }
    )
)
