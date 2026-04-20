import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getLeaderboard, getUserRank } from './leaderboard.api'

// ─── Supabase chainable mock ──────────────────────────────────────────────────
const mockSelect = vi.fn()
const mockIn = vi.fn()
const mockFrom = vi.fn()

// Each "from" call returns a fresh chainable for that table
vi.mock('./client', () => ({
    supabase: {
        from: (...args) => mockFrom(...args),
    },
}))

vi.mock('@/shared/config/env', () => ({
    config: { supabase: { isConfigured: true } },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeChainable(resolvedValue) {
    const chain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
    }
    // The last call in the Supabase query chain resolves the promise.
    // For leaderboard the terminal call is `.select()` (no further chaining),
    // so we make the chain itself thenable.
    chain.then = (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject)
    return chain
}

describe('leaderboard.api', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('getLeaderboard', () => {
        it('returns ranked users based on reviews + visits (profiles table)', async () => {
            const profilesData = [
                { id: 'u1', full_name: 'Alice', avatar_url: null },
                { id: 'u2', full_name: 'Bob',   avatar_url: null },
            ]
            const reviewsData = [
                { user_id: 'u1' }, { user_id: 'u1' }, // 2 reviews = 10 pts
                { user_id: 'u2' },                     // 1 review  =  5 pts
            ]
            const visitsData = [
                { user_id: 'u1' },                     // 1 visit   =  2 pts → u1 total 12
                { user_id: 'u2' }, { user_id: 'u2' },  // 2 visits  =  4 pts → u2 total 9
            ]

            // Call sequence: profiles → reviews → user_visits
            let callCount = 0
            mockFrom.mockImplementation((table) => {
                if (table === 'profiles')    return makeChainable({ data: profilesData, error: null })
                if (table === 'reviews')     return makeChainable({ data: reviewsData,  error: null })
                if (table === 'user_visits') return makeChainable({ data: visitsData,   error: null })
                return makeChainable({ data: [], error: null })
            })

            const result = await getLeaderboard(50)

            expect(result).toHaveLength(2)
            expect(result[0].user_id).toBe('u1')
            expect(result[0].total_points).toBe(12) // 2*5 + 1*2
            expect(result[0].reviews_count).toBe(2)
            expect(result[0].visits_count).toBe(1)
            expect(result[1].user_id).toBe('u2')
            expect(result[1].total_points).toBe(9) // 1*5 + 2*2
        })

        it('falls back to user_profiles when profiles table is empty', async () => {
            const upData = [
                { id: 'u3', display_name: 'Carol', avatar_url: null },
            ]
            mockFrom.mockImplementation((table) => {
                if (table === 'profiles')      return makeChainable({ data: [], error: null })
                if (table === 'user_profiles') return makeChainable({ data: upData, error: null })
                if (table === 'reviews')       return makeChainable({ data: [{ user_id: 'u3' }], error: null })
                if (table === 'user_visits')   return makeChainable({ data: [], error: null })
                return makeChainable({ data: [], error: null })
            })

            const result = await getLeaderboard(50)
            expect(result[0].user_name).toBe('Carol')
        })

        it('filters out users with zero points', async () => {
            const profilesData = [
                { id: 'u1', full_name: 'Alice', avatar_url: null },
                { id: 'u2', full_name: 'Bob',   avatar_url: null }, // no activity
            ]
            mockFrom.mockImplementation((table) => {
                if (table === 'profiles')    return makeChainable({ data: profilesData, error: null })
                if (table === 'reviews')     return makeChainable({ data: [{ user_id: 'u1' }], error: null })
                if (table === 'user_visits') return makeChainable({ data: [], error: null })
                return makeChainable({ data: [], error: null })
            })

            const result = await getLeaderboard(50)
            expect(result).toHaveLength(1)
            expect(result[0].user_id).toBe('u1')
        })

        it('respects the limit parameter', async () => {
            const profiles = Array.from({ length: 10 }, (_, i) => ({
                id: `u${i}`, full_name: `User${i}`, avatar_url: null
            }))
            const reviews = profiles.map(p => ({ user_id: p.id }))

            mockFrom.mockImplementation((table) => {
                if (table === 'profiles')    return makeChainable({ data: profiles, error: null })
                if (table === 'reviews')     return makeChainable({ data: reviews,  error: null })
                if (table === 'user_visits') return makeChainable({ data: [],       error: null })
                return makeChainable({ data: [], error: null })
            })

            const result = await getLeaderboard(3)
            expect(result).toHaveLength(3)
        })

        it('returns empty array when profiles is empty and user_profiles is empty', async () => {
            mockFrom.mockImplementation(() => makeChainable({ data: [], error: null }))
            const result = await getLeaderboard()
            expect(result).toEqual([])
        })

        it('returns empty array on unexpected error', async () => {
            mockFrom.mockImplementation(() => { throw new Error('DB crash') })
            const result = await getLeaderboard()
            expect(result).toEqual([])
        })

        it('uses default name "User" when name field is missing', async () => {
            const profilesData = [{ id: 'u1', full_name: null, avatar_url: null }]
            mockFrom.mockImplementation((table) => {
                if (table === 'profiles')    return makeChainable({ data: profilesData, error: null })
                if (table === 'reviews')     return makeChainable({ data: [{ user_id: 'u1' }], error: null })
                if (table === 'user_visits') return makeChainable({ data: [], error: null })
                return makeChainable({ data: [], error: null })
            })
            const result = await getLeaderboard()
            expect(result[0].user_name).toBe('User')
        })

        it('sets locations_added to 0 for all entries', async () => {
            mockFrom.mockImplementation((table) => {
                if (table === 'profiles')    return makeChainable({ data: [{ id: 'u1', full_name: 'A', avatar_url: null }], error: null })
                if (table === 'reviews')     return makeChainable({ data: [{ user_id: 'u1' }], error: null })
                if (table === 'user_visits') return makeChainable({ data: [], error: null })
                return makeChainable({ data: [], error: null })
            })
            const result = await getLeaderboard()
            expect(result[0].locations_added).toBe(0)
        })

        it('point formula: each review = 5pts, each visit = 2pts', async () => {
            mockFrom.mockImplementation((table) => {
                if (table === 'profiles')    return makeChainable({ data: [{ id: 'u1', full_name: 'A', avatar_url: null }], error: null })
                if (table === 'reviews')     return makeChainable({ data: [{ user_id: 'u1' }, { user_id: 'u1' }, { user_id: 'u1' }], error: null })
                if (table === 'user_visits') return makeChainable({ data: [{ user_id: 'u1' }, { user_id: 'u1' }], error: null })
                return makeChainable({ data: [], error: null })
            })
            const result = await getLeaderboard()
            // 3 reviews × 5 = 15; 2 visits × 2 = 4 → total 19
            expect(result[0].total_points).toBe(19)
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('getUserRank', () => {
        it('returns rank and points for a known user', async () => {
            const profilesData = [
                { id: 'u1', full_name: 'Alice', avatar_url: null },
                { id: 'u2', full_name: 'Bob',   avatar_url: null },
            ]
            mockFrom.mockImplementation((table) => {
                if (table === 'profiles')    return makeChainable({ data: profilesData, error: null })
                if (table === 'reviews')     return makeChainable({ data: [{ user_id: 'u2' }, { user_id: 'u2' }], error: null })
                if (table === 'user_visits') return makeChainable({ data: [{ user_id: 'u1' }], error: null })
                return makeChainable({ data: [], error: null })
            })

            // u2: 2 reviews = 10pts (rank 1); u1: 1 visit = 2pts (rank 2)
            const rank = await getUserRank('u1')
            expect(rank.rank).toBe(2)
            expect(rank.points).toBe(2)
        })

        it('returns { rank: 0, points: 0 } for unknown user', async () => {
            mockFrom.mockImplementation((table) => {
                if (table === 'profiles')    return makeChainable({ data: [{ id: 'u1', full_name: 'A', avatar_url: null }], error: null })
                if (table === 'reviews')     return makeChainable({ data: [{ user_id: 'u1' }], error: null })
                if (table === 'user_visits') return makeChainable({ data: [], error: null })
                return makeChainable({ data: [], error: null })
            })

            const rank = await getUserRank('nobody')
            expect(rank).toEqual({ rank: 0, points: 0 })
        })

        it('returns { rank: 0, points: 0 } when userId is falsy', async () => {
            const rank = await getUserRank(null)
            expect(rank).toEqual({ rank: 0, points: 0 })
        })

        it('returns { rank: 0, points: 0 } on error', async () => {
            mockFrom.mockImplementation(() => { throw new Error('fail') })
            const rank = await getUserRank('u1')
            expect(rank).toEqual({ rank: 0, points: 0 })
        })
    })
})
