/**
 * Integration: Knowledge Graph Enrichment
 *
 * Tests KG entity CRUD, dedup, cuisine-dish linking, batch ops,
 * and cache invalidation after mutations.
 *
 * All Supabase + fetch calls are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Supabase chainable mock ─────────────────────────────────────────────────

const mockSingle  = vi.fn()
const mockSelect  = vi.fn()
const mockInsert  = vi.fn()
const mockUpdate  = vi.fn()
const mockDelete  = vi.fn()
const mockEq      = vi.fn()
const mockOrder   = vi.fn()

const chain = {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
    eq:     mockEq,
    order:  mockOrder,
    single: mockSingle,
}
Object.values(chain).forEach(fn => fn.mockReturnValue(chain))

vi.mock('@/shared/api/client', () => ({
    supabase: {
        from: () => chain,
        auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'fake-jwt-token' } } }) },
    },
    ApiError: class ApiError extends Error {
        constructor(msg, status, code) {
            super(msg)
            this.name   = 'ApiError'
            this.status = status
            this.code   = code
        }
    },
    simulateDelay: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/shared/config/env', () => ({
    config: {
        supabase: { isConfigured: true },
        kg:       { saveUrl: '/api/kg/save' },
        ai:       { openRouterKey: null },
        app:      { isDev: false },
    },
}))

// ─── Cache mock ───────────────────────────────────────────────────────────────

const mockGetCached     = vi.fn(() => null)
const mockSetCached     = vi.fn()
const mockInvalidateGrp = vi.fn()

vi.mock('@/shared/lib/cache', () => ({
    getCachedData:        (...args) => mockGetCached(...args),
    setCachedData:        (...args) => mockSetCached(...args),
    invalidateCacheGroup: (...args) => mockInvalidateGrp(...args),
    TTL: { cuisines: 86400000, dishes: 86400000, ingredients: 86400000 },
}))

vi.mock('@/shared/store/useAppConfigStore', () => ({
    useAppConfigStore: { getState: vi.fn(() => ({ aiApiKey: null, aiPrimaryModel: null, aiFallbackModel: null })) },
}))

// ─── Mock global fetch → 404 so saveViaProxy falls back to direct Supabase ───
globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
)

import {
    getCuisines,
    createCuisine,
    updateCuisine,
    deleteCuisine,
    getDishes,
    createDish,
    getIngredients,
    createIngredient,
} from '@/shared/api/knowledge-graph.api'

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Knowledge Graph Enrichment Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.values(chain).forEach(fn => fn.mockReturnValue(chain))
        mockGetCached.mockReturnValue(null)  // default: cache miss
        globalThis.fetch.mockResolvedValue(
            new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
        )
    })

    // ── 1. Cuisine entity creation ────────────────────────────────────────────

    describe('createCuisine', () => {
        it('inserts a new cuisine entity and returns it', async () => {
            const cuisine = { name: 'Georgian', region: 'Caucasian', flavor_profile: 'rich, herbal, walnut' }
            const stored  = { id: 'c-10', ...cuisine, created_at: new Date().toISOString() }

            mockSingle.mockResolvedValueOnce({ data: stored, error: null })

            const result = await createCuisine(cuisine)

            expect(result.name).toBe('Georgian')
            expect(result.id).toBe('c-10')
            expect(mockInsert).toHaveBeenCalled()
        })

        it('throws ApiError if insert fails', async () => {
            mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'unique violation', code: '23505' } })
            await expect(createCuisine({ name: 'Italian' })).rejects.toMatchObject({ name: 'ApiError' })
        })
    })

    // ── 2. Dedup check — creating the same name twice ─────────────────────────

    describe('dedup — same cuisine name triggers DB unique constraint', () => {
        it('first creation succeeds; second throws ApiError (unique key violation)', async () => {
            const cuisine = { name: 'Mexican' }
            const stored  = { id: 'c-20', ...cuisine }

            // First call succeeds
            mockSingle.mockResolvedValueOnce({ data: stored, error: null })
            const first = await createCuisine(cuisine)
            expect(first.id).toBe('c-20')

            // Second call — DB rejects with unique violation
            mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'duplicate key value', code: '23505' } })
            await expect(createCuisine(cuisine)).rejects.toMatchObject({ name: 'ApiError' })
        })
    })

    // ── 3. Dish linked to cuisine_id ──────────────────────────────────────────

    describe('createDish — linked to cuisine', () => {
        it('stores dish with cuisine_id properly set', async () => {
            const dish   = { name: 'Khinkali', cuisine_id: 'c-10', ingredients: ['lamb', 'dough', 'herbs'] }
            const stored = { id: 'd-1', ...dish, created_at: new Date().toISOString() }

            mockSingle.mockResolvedValueOnce({ data: stored, error: null })

            const result = await createDish(dish)

            expect(result.cuisine_id).toBe('c-10')
            expect(result.name).toBe('Khinkali')
        })

        it('getDishes filters by cuisine_id when provided', async () => {
            const dishes = [{ id: 'd-1', name: 'Khinkali', cuisine_id: 'c-10' }]
            mockOrder.mockResolvedValueOnce({ data: dishes, error: null })

            const result = await getDishes('c-10')

            expect(result).toHaveLength(1)
            expect(result[0].cuisine_id).toBe('c-10')
        })
    })

    // ── 4. Ingredient entity creation ─────────────────────────────────────────

    describe('createIngredient', () => {
        it('inserts an ingredient and returns it', async () => {
            const ingredient = { name: 'Walnut Paste', category: 'condiment' }
            const stored     = { id: 'i-1', ...ingredient }

            mockSingle.mockResolvedValueOnce({ data: stored, error: null })

            const result = await createIngredient(ingredient)

            expect(result.name).toBe('Walnut Paste')
            expect(result.id).toBe('i-1')
        })
    })

    // ── 5. Batch operations ───────────────────────────────────────────────────

    describe('batch operations — create multiple entities', () => {
        it('creates three cuisines sequentially and all succeed', async () => {
            const cuisines = [
                { name: 'Thai',      region: 'South-East Asian' },
                { name: 'Peruvian',  region: 'South American'   },
                { name: 'Ethiopian', region: 'East African'      },
            ]

            for (const [idx, cuisine] of cuisines.entries()) {
                mockSingle.mockResolvedValueOnce({
                    data: { id: `c-${idx}`, ...cuisine },
                    error: null,
                })
            }

            const results = await Promise.all(cuisines.map(c => createCuisine(c)))
            expect(results).toHaveLength(3)
            expect(results.map(r => r.name)).toEqual(['Thai', 'Peruvian', 'Ethiopian'])
        })
    })

    // ── 6. Cache invalidation after mutations ─────────────────────────────────

    describe('cache invalidation', () => {
        it('invalidates cuisines cache group after createCuisine succeeds', async () => {
            mockSingle.mockResolvedValueOnce({ data: { id: 'c-99', name: 'Korean' }, error: null })

            await createCuisine({ name: 'Korean' })

            expect(mockInvalidateGrp).toHaveBeenCalledWith('cuisines')
        })

        it('invalidates dishes cache group after createDish succeeds', async () => {
            mockSingle.mockResolvedValueOnce({ data: { id: 'd-99', name: 'Bibimbap' }, error: null })

            await createDish({ name: 'Bibimbap', cuisine_id: 'c-99' })

            expect(mockInvalidateGrp).toHaveBeenCalledWith('dishes')
        })

        it('serves getCuisines from localStorage cache when cache is populated', async () => {
            const cached = [{ id: 'c-1', name: 'Italian' }]
            mockGetCached.mockReturnValueOnce(cached)   // cache HIT

            const result = await getCuisines()

            expect(result).toEqual(cached)
            // mockGetCached was called with 'cuisines' — cache hit
            expect(mockGetCached).toHaveBeenCalledWith('cuisines')
        })

        it('fetches from Supabase and populates cache on cache miss', async () => {
            // Cache miss (default)
            const dbData = [{ id: 'c-1', name: 'Italian' }, { id: 'c-2', name: 'Japanese' }]
            mockOrder.mockResolvedValueOnce({ data: dbData, error: null })

            const result = await getCuisines()

            expect(result).toHaveLength(2)
            expect(mockSetCached).toHaveBeenCalledWith('cuisines', dbData, expect.any(Number))
        })

        it('invalidates cuisines cache after deleteCuisine', async () => {
            mockEq.mockResolvedValueOnce({ error: null })

            await deleteCuisine('c-1')

            expect(mockInvalidateGrp).toHaveBeenCalledWith('cuisines')
        })

        it('invalidates cuisines cache after updateCuisine', async () => {
            mockSingle.mockResolvedValueOnce({ data: { id: 'c-1', name: 'Italian Updated' }, error: null })

            await updateCuisine('c-1', { name: 'Italian Updated' })

            expect(mockInvalidateGrp).toHaveBeenCalledWith('cuisines')
        })
    })
})
