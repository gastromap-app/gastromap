import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUserPreferences, updateUserPreferences } from './preferences.api'

// ─── Supabase chainable mock ──────────────────────────────────────────────────
const mockFrom = vi.fn()

vi.mock('./client', () => ({
    supabase: {
        from: (...args) => mockFrom(...args),
    },
}))

vi.mock('@/shared/config/env', () => ({
    config: { supabase: { isConfigured: true } },
}))

// ─── Chainable builder ────────────────────────────────────────────────────────
function makeChain(resolved) {
    const chain = {
        select:  vi.fn().mockReturnThis(),
        update:  vi.fn().mockReturnThis(),
        upsert:  vi.fn().mockReturnThis(),
        eq:      vi.fn().mockReturnThis(),
        single:  vi.fn().mockReturnThis(),
    }
    chain.then = (resolve, reject) => Promise.resolve(resolved).then(resolve, reject)
    return chain
}

describe('preferences.api', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('getUserPreferences', () => {
        it('returns preferences from profiles table when present', async () => {
            const prefs = { longTerm: { favoriteCuisines: ['Italian'] } }
            mockFrom.mockReturnValue(makeChain({ data: { preferences: prefs }, error: null }))

            const result = await getUserPreferences('user-1')
            expect(result).toEqual(prefs)
        })

        it('falls back to user_profiles table when profiles has no preferences', async () => {
            let callCount = 0
            mockFrom.mockImplementation((table) => {
                callCount++
                if (table === 'profiles') {
                    return makeChain({ data: { preferences: null }, error: { message: 'no row' } })
                }
                // user_profiles fallback
                return makeChain({
                    data: {
                        dna_cuisines:  ['French'],
                        dna_vibes:     ['Cozy'],
                        dna_allergens: ['nuts'],
                        dna_price:     ['$$'],
                    },
                    error: null,
                })
            })

            const result = await getUserPreferences('user-1')
            expect(result).toEqual({
                longTerm: {
                    favoriteCuisines:    ['French'],
                    vibePreference:      ['Cozy'],
                    dietaryRestrictions: ['nuts'],
                    priceRange:          ['$$'],
                },
            })
        })

        it('returns empty object when both tables have no data', async () => {
            mockFrom.mockImplementation((table) => {
                if (table === 'profiles')      return makeChain({ data: null, error: { message: 'not found' } })
                if (table === 'user_profiles') return makeChain({ data: null, error: null })
                return makeChain({ data: null, error: null })
            })

            const result = await getUserPreferences('user-1')
            expect(result).toEqual({})
        })

        it('uses empty arrays when dna_* fields are null', async () => {
            mockFrom.mockImplementation((table) => {
                if (table === 'profiles')      return makeChain({ data: null, error: { message: 'err' } })
                if (table === 'user_profiles') return makeChain({
                    data: { dna_cuisines: null, dna_vibes: null, dna_allergens: null, dna_price: null },
                    error: null,
                })
                return makeChain({ data: null, error: null })
            })

            const result = await getUserPreferences('user-1')
            expect(result.longTerm.favoriteCuisines).toEqual([])
            expect(result.longTerm.vibePreference).toEqual([])
            expect(result.longTerm.dietaryRestrictions).toEqual([])
            expect(result.longTerm.priceRange).toEqual([])
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('updateUserPreferences', () => {
        it('updates profiles table when it succeeds', async () => {
            const prefs = { theme: 'dark' }
            const returnedData = { preferences: prefs }
            mockFrom.mockReturnValue(makeChain({ data: returnedData, error: null }))

            const result = await updateUserPreferences('user-1', prefs)
            expect(result).toEqual({ data: returnedData, error: null })
        })

        it('falls back to user_profiles upsert when profiles update fails', async () => {
            let callCount = 0
            mockFrom.mockImplementation(() => {
                callCount++
                if (callCount === 1) {
                    // profiles update fails
                    return makeChain({ data: null, error: { message: 'update failed' } })
                }
                // user_profiles upsert succeeds
                return makeChain({ data: null, error: null })
            })

            const prefs = {
                longTerm: {
                    favoriteCuisines:    ['Italian'],
                    vibePreference:      ['Casual'],
                    dietaryRestrictions: [],
                    priceRange:          ['$$'],
                },
            }
            const result = await updateUserPreferences('user-1', prefs)
            expect(result.error).toBeNull()
        })

        it('passes longTerm fields to user_profiles upsert correctly', async () => {
            let capturedUpsert = null
            const upsertChain = {
                select:  vi.fn().mockReturnThis(),
                update:  vi.fn().mockReturnThis(),
                upsert:  vi.fn((data) => { capturedUpsert = data; return upsertChain }),
                eq:      vi.fn().mockReturnThis(),
                single:  vi.fn().mockReturnThis(),
            }
            upsertChain.then = (resolve) => Promise.resolve({ data: null, error: null }).then(resolve)

            let callCount = 0
            mockFrom.mockImplementation(() => {
                callCount++
                if (callCount === 1) return makeChain({ data: null, error: { message: 'fail' } })
                return upsertChain
            })

            const prefs = {
                longTerm: {
                    favoriteCuisines:    ['Japanese'],
                    vibePreference:      ['Romantic'],
                    dietaryRestrictions: ['gluten'],
                    priceRange:          ['$$$'],
                },
            }
            await updateUserPreferences('user-42', prefs)
            expect(capturedUpsert).toMatchObject({
                id:            'user-42',
                dna_cuisines:  ['Japanese'],
                dna_vibes:     ['Romantic'],
                dna_allergens: ['gluten'],
                dna_price:     ['$$$'],
            })
        })

        it('handles flat preferences object (no longTerm wrapper) in fallback', async () => {
            let callCount = 0
            mockFrom.mockImplementation(() => {
                callCount++
                if (callCount === 1) return makeChain({ data: null, error: { message: 'fail' } })
                return makeChain({ data: null, error: null })
            })

            // flat prefs without longTerm
            const result = await updateUserPreferences('u1', { favoriteCuisines: ['Thai'] })
            expect(result.error).toBeNull()
        })

        it('returns error from user_profiles upsert when it fails', async () => {
            const upsertError = { message: 'upsert failed', code: '42P01' }
            let callCount = 0
            mockFrom.mockImplementation(() => {
                callCount++
                if (callCount === 1) return makeChain({ data: null, error: { message: 'profiles fail' } })
                return makeChain({ data: null, error: upsertError })
            })

            const result = await updateUserPreferences('u1', {})
            expect(result.error).toEqual(upsertError)
        })
    })
})
