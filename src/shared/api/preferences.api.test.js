import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUserPreferences, updateUserPreferences } from './preferences.api'

// ─── Supabase chainable mock ──────────────────────────────────────────────────
const mockFrom = vi.fn()

vi.mock('./client', () => ({
    supabase: {
        from: (...args) => mockFrom(...args),
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null })
        }
    },
}))

// ─── Chainable builder ────────────────────────────────────────────────────────
function makeChain(resolved) {
    const chain = {
        select:      vi.fn().mockReturnThis(),
        update:      vi.fn().mockReturnThis(),
        upsert:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockReturnThis(),
    }
    chain.then = (resolve, reject) => Promise.resolve(resolved).then(resolve, reject)
    return chain
}

describe('preferences.api', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('getUserPreferences', () => {
        it('returns structured preferences from user_preferences table', async () => {
            const rawDbData = {
                favorite_cuisines: ['Italian'],
                vibe_preferences: ['Cozy'],
                dietary_restrictions: ['nuts'],
                price_range: '$,$$',
                foodie_dna: 'Test DNA',
                atmosphere_preference: 'quiet',
                features: 'wifi,parking',
                onboarding_completed: true
            }
            mockFrom.mockReturnValue(makeChain({ data: rawDbData, error: null }))

            const result = await getUserPreferences('user-1')
            expect(result.longTerm).toEqual({
                favoriteCuisines: ['Italian'],
                vibePreference: ['Cozy'],
                dietaryRestrictions: ['nuts'],
                priceRange: ['$', '$$'],
                foodieDNA: 'Test DNA',
                atmospherePreference: 'quiet',
                features: ['wifi', 'parking'],
                onboardingCompleted: true
            })
        })

        it('handles null/missing fields gracefully', async () => {
            mockFrom.mockReturnValue(makeChain({ data: null, error: null }))
            const result = await getUserPreferences('user-1')
            expect(result).toEqual({})
        })
    })

    describe('updateUserPreferences', () => {
        it('joins arrays into comma-separated strings for storage', async () => {
            let capturedData = null
            const upsertChain = {
                upsert: vi.fn((data) => { capturedData = data; return upsertChain }),
            }
            upsertChain.then = (resolve) => Promise.resolve({ error: null }).then(resolve)
            mockFrom.mockReturnValue(upsertChain)

            const prefs = {
                longTerm: {
                    favoriteCuisines: ['Japanese'],
                    priceRange: ['$$', '$$$'],
                    features: ['terrace', 'kids'],
                }
            }

            await updateUserPreferences('user-1', prefs)
            
            expect(capturedData).toMatchObject({
                user_id: 'user-1',
                favorite_cuisines: ['Japanese'],
                price_range: '$$,$$$',
                features: 'terrace,kids'
            })
        })
    })
})
