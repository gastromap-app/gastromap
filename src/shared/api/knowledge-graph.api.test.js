import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    getCuisines, getCuisineById, createCuisine, updateCuisine, deleteCuisine,
    getDishes, createDish, updateDish, deleteDish,
    getIngredients, createIngredient, updateIngredient, deleteIngredient,
    mergeEntities,
} from './knowledge-graph.api'

// ─── Mock @/shared/config/env ──────────────────────────────────────────────
vi.mock('@/shared/config/env', () => ({
    config: {
        supabase: { isConfigured: true, url: 'https://mock.supabase.co', anonKey: 'anon' },
        ai: { openRouterKey: 'test-key' },
        kg: { saveUrl: '/api/kg/save' },
    }
}))

// ─── Mock @/shared/store/useAppConfigStore ─────────────────────────────────
vi.mock('@/shared/store/useAppConfigStore', () => ({
    useAppConfigStore: {
        getState: vi.fn(() => ({ aiApiKey: 'test-api-key' })),
    }
}))

// ─── Mock @/shared/lib/cache ───────────────────────────────────────────────
vi.mock('@/shared/lib/cache', () => ({
    getCachedData: vi.fn(() => null),
    setCachedData: vi.fn(),
    invalidateCacheGroup: vi.fn(),
    TTL: { cuisines: 3600, dishes: 3600, ingredients: 3600 },
}))

// ─── Mock global fetch ──────────────────────────────────────────────────────
const mockFetch = vi.fn()
global.fetch = mockFetch

// ─── Supabase mock — use vi.hoisted to share chain mocks ──────────────────
const { mockSelect, mockInsert, mockUpdate, mockDelete, mockEq, mockIn, mockOrder, mockSingle } = vi.hoisted(() => {
    const mockSelect = vi.fn()
    const mockInsert = vi.fn()
    const mockUpdate = vi.fn()
    const mockDelete = vi.fn()
    const mockEq = vi.fn()
    const mockIn = vi.fn()
    const mockOrder = vi.fn()
    const mockSingle = vi.fn()
    return { mockSelect, mockInsert, mockUpdate, mockDelete, mockEq, mockIn, mockOrder, mockSingle }
})

const chainable = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    in: mockIn,
    order: mockOrder,
    single: mockSingle,
}

vi.mock('./client', () => ({
    supabase: {
        from: vi.fn(() => chainable),
        rpc: vi.fn(),
        auth: {
            getSession: vi.fn(async () => ({ data: { session: { access_token: 'jwt-token' } } })),
        },
        supabaseUrl: 'https://mock.supabase.co',
    },
    simulateDelay: vi.fn(async () => {}),
    ApiError: class ApiError extends Error {
        constructor(message, status, code) {
            super(message)
            this.name = 'ApiError'
            this.status = status
            this.code = code
        }
    },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeProxyOkResponse(data) {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data, duplicate: false }),
        text: async () => JSON.stringify({ data }),
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('knowledge-graph.api', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.values(chainable).forEach(fn => fn.mockReturnValue(chainable))
    })

    // ─── getCuisines ────────────────────────────────────────────────────

    describe('getCuisines', () => {
        it('returns cuisines from Supabase when cache is empty', async () => {
            const cuisines = [
                { id: '1', name: 'Italian' },
                { id: '2', name: 'Japanese' },
            ]
            mockOrder.mockResolvedValue({ data: cuisines, error: null })

            const result = await getCuisines()
            expect(result).toEqual(cuisines)
        })

        it('returns empty array when Supabase returns null data', async () => {
            mockOrder.mockResolvedValue({ data: null, error: null })
            const result = await getCuisines()
            expect(result).toEqual([])
        })

        it('falls back to mock data on error', async () => {
            mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } })
            const result = await getCuisines()
            // Should return mock cuisines (non-empty array)
            expect(Array.isArray(result)).toBe(true)
            expect(result.length).toBeGreaterThan(0)
        })

        it('returns cached data when cache has value', async () => {
            const { getCachedData } = await import('@/shared/lib/cache')
            getCachedData.mockReturnValueOnce([{ id: '99', name: 'Cached Cuisine' }])

            const result = await getCuisines()
            expect(result).toEqual([{ id: '99', name: 'Cached Cuisine' }])
            // Should not call Supabase
            expect(mockOrder).not.toHaveBeenCalled()
        })
    })

    // ─── getCuisineById ─────────────────────────────────────────────────

    describe('getCuisineById', () => {
        it('returns a single cuisine by id', async () => {
            const cuisine = { id: '1', name: 'Italian' }
            mockSingle.mockResolvedValue({ data: cuisine, error: null })

            const result = await getCuisineById('1')
            expect(result).toEqual(cuisine)
        })

        it('throws ApiError when not found', async () => {
            mockSingle.mockResolvedValue({ data: null, error: { message: 'not found', code: 'PGRST116' } })
            await expect(getCuisineById('bad-id')).rejects.toThrow()
        })
    })

    // ─── createCuisine ───────────────────────────────────────────────────

    describe('createCuisine', () => {
        it('returns saved cuisine via proxy on success', async () => {
            const savedCuisine = { id: 'new1', name: 'Mexican' }
            mockFetch.mockResolvedValue(makeProxyOkResponse(savedCuisine))

            const result = await createCuisine({ name: 'Mexican', description: 'Rich flavors' })
            expect(result.name).toBe('Mexican')
        })

        it('falls back to direct Supabase when proxy returns 404', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found', json: async () => ({}), text: async () => '' })
            const savedCuisine = { id: 'new2', name: 'Thai' }
            mockSingle.mockResolvedValue({ data: savedCuisine, error: null })

            const result = await createCuisine({ name: 'Thai' })
            expect(result.name).toBe('Thai')
        })

        it('throws ApiError when direct Supabase insert fails', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'NF', json: async () => ({}), text: async () => '' })
            mockSingle.mockResolvedValue({ data: null, error: { message: 'insert failed', code: '23505' } })
            await expect(createCuisine({ name: 'Thai' })).rejects.toThrow()
        })
    })

    // ─── updateCuisine ───────────────────────────────────────────────────

    describe('updateCuisine', () => {
        it('updates and returns the cuisine', async () => {
            const updated = { id: '1', name: 'Italian (Updated)' }
            mockSingle.mockResolvedValue({ data: updated, error: null })

            const result = await updateCuisine('1', { name: 'Italian (Updated)' })
            expect(result.name).toBe('Italian (Updated)')
        })

        it('throws ApiError on update failure', async () => {
            mockSingle.mockResolvedValue({ data: null, error: { message: 'update failed' } })
            await expect(updateCuisine('1', { name: 'Bad' })).rejects.toThrow()
        })
    })

    // ─── deleteCuisine ───────────────────────────────────────────────────

    describe('deleteCuisine', () => {
        it('returns success object on delete', async () => {
            mockEq.mockResolvedValue({ error: null })
            const result = await deleteCuisine('1')
            expect(result).toEqual({ success: true })
        })

        it('throws ApiError on delete failure', async () => {
            mockEq.mockResolvedValue({ error: { message: 'delete failed' } })
            await expect(deleteCuisine('1')).rejects.toThrow()
        })
    })

    // ─── getDishes ───────────────────────────────────────────────────────

    describe('getDishes', () => {
        it('returns all dishes when no cuisineId provided', async () => {
            const dishes = [{ id: 'd1', name: 'Carbonara', cuisine_id: '1' }]
            mockOrder.mockResolvedValue({ data: dishes, error: null })

            const result = await getDishes()
            expect(result).toEqual(dishes)
        })

        it('filters by cuisineId when provided', async () => {
            const dishes = [{ id: 'd1', name: 'Carbonara', cuisine_id: '1' }]
            mockOrder.mockResolvedValue({ data: dishes, error: null })

            await getDishes('1')
            expect(mockEq).toHaveBeenCalledWith('cuisine_id', '1')
        })

        it('falls back to mocks on error', async () => {
            mockOrder.mockResolvedValue({ data: null, error: { message: 'fail' } })
            const result = await getDishes()
            expect(Array.isArray(result)).toBe(true)
        })

        it('returns empty array when Supabase returns null', async () => {
            mockOrder.mockResolvedValue({ data: null, error: null })
            const result = await getDishes()
            expect(result).toEqual([])
        })
    })

    // ─── createDish ───────────────────────────────────────────────────────

    describe('createDish', () => {
        it('creates dish via proxy', async () => {
            const dish = { id: 'dish1', name: 'Sushi' }
            mockFetch.mockResolvedValue(makeProxyOkResponse(dish))

            const result = await createDish({ name: 'Sushi', cuisine_id: '2' })
            expect(result.name).toBe('Sushi')
        })

        it('throws ApiError when Supabase insert fails (after proxy fallback)', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}), text: async () => '' })
            mockSingle.mockResolvedValue({ data: null, error: { message: 'insert fail' } })
            await expect(createDish({ name: 'Bad', cuisine_id: '1' })).rejects.toThrow()
        })
    })

    // ─── updateDish ──────────────────────────────────────────────────────

    describe('updateDish', () => {
        it('updates a dish', async () => {
            const updated = { id: 'd1', name: 'Updated Dish' }
            mockSingle.mockResolvedValue({ data: updated, error: null })

            const result = await updateDish('d1', { name: 'Updated Dish' })
            expect(result.name).toBe('Updated Dish')
        })

        it('throws ApiError on failure', async () => {
            mockSingle.mockResolvedValue({ data: null, error: { message: 'fail' } })
            await expect(updateDish('d1', { name: 'X' })).rejects.toThrow()
        })
    })

    // ─── deleteDish ──────────────────────────────────────────────────────

    describe('deleteDish', () => {
        it('returns success on delete', async () => {
            mockEq.mockResolvedValue({ error: null })
            const result = await deleteDish('d1')
            expect(result).toEqual({ success: true })
        })

        it('throws ApiError on delete failure', async () => {
            mockEq.mockResolvedValue({ error: { message: 'fail' } })
            await expect(deleteDish('d1')).rejects.toThrow()
        })
    })

    // ─── getIngredients ──────────────────────────────────────────────────

    describe('getIngredients', () => {
        it('returns all ingredients', async () => {
            const ings = [{ id: 'i1', name: 'Truffle Oil', category: 'oil' }]
            mockOrder.mockResolvedValue({ data: ings, error: null })

            const result = await getIngredients()
            expect(result).toEqual(ings)
        })

        it('filters by category when provided', async () => {
            mockOrder.mockResolvedValue({ data: [], error: null })
            await getIngredients('spice')
            expect(mockEq).toHaveBeenCalledWith('category', 'spice')
        })

        it('falls back to mocks on error', async () => {
            mockOrder.mockResolvedValue({ data: null, error: { message: 'fail' } })
            const result = await getIngredients()
            expect(Array.isArray(result)).toBe(true)
        })
    })

    // ─── createIngredient ────────────────────────────────────────────────

    describe('createIngredient', () => {
        it('creates ingredient via proxy', async () => {
            const ing = { id: 'i1', name: 'Saffron' }
            mockFetch.mockResolvedValue(makeProxyOkResponse(ing))

            const result = await createIngredient({ name: 'Saffron', category: 'spice' })
            expect(result.name).toBe('Saffron')
        })

        it('throws ApiError when Supabase insert fails after proxy fallback', async () => {
            mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}), text: async () => '' })
            mockSingle.mockResolvedValue({ data: null, error: { message: 'fail' } })
            await expect(createIngredient({ name: 'X' })).rejects.toThrow()
        })
    })

    // ─── updateIngredient ────────────────────────────────────────────────

    describe('updateIngredient', () => {
        it('updates an ingredient', async () => {
            const updated = { id: 'i1', name: 'Updated' }
            mockSingle.mockResolvedValue({ data: updated, error: null })
            const result = await updateIngredient('i1', { name: 'Updated' })
            expect(result.name).toBe('Updated')
        })

        it('throws ApiError on failure', async () => {
            mockSingle.mockResolvedValue({ data: null, error: { message: 'fail' } })
            await expect(updateIngredient('i1', {})).rejects.toThrow()
        })
    })

    // ─── deleteIngredient ────────────────────────────────────────────────

    describe('deleteIngredient', () => {
        it('returns success on delete', async () => {
            mockEq.mockResolvedValue({ error: null })
            const result = await deleteIngredient('i1')
            expect(result).toEqual({ success: true })
        })

        it('throws ApiError on failure', async () => {
            mockEq.mockResolvedValue({ error: { message: 'fail' } })
            await expect(deleteIngredient('i1')).rejects.toThrow()
        })
    })

    // ─── mergeEntities ───────────────────────────────────────────────────

    describe('mergeEntities', () => {
        it('returns success immediately when idsToDelete is empty', async () => {
            const result = await mergeEntities('cuisines', 'keep1', [])
            expect(result).toEqual({ success: true })
        })

        it('deletes redundant cuisine records and updates dish relations', async () => {
            // Mock dishes update (for cuisine type)
            mockIn.mockResolvedValueOnce({ error: null })
            // Mock final delete
            mockIn.mockResolvedValueOnce({ error: null })

            const result = await mergeEntities('cuisines', 'keep1', ['del1', 'del2'])
            expect(result.success).toBe(true)
            expect(result.count).toBe(2)
        })

        it('merges dishes without updating relations (not cuisines)', async () => {
            mockIn.mockResolvedValue({ error: null })

            const result = await mergeEntities('dishes', 'keepD', ['delD1'])
            expect(result.success).toBe(true)
        })

        it('throws ApiError when delete fails', async () => {
            // For cuisines: first in() call = dish relation update (ok), second = delete (fail)
            mockIn
                .mockResolvedValueOnce({ error: null })
                .mockResolvedValueOnce({ error: { message: 'delete failed' } })

            await expect(mergeEntities('cuisines', 'k', ['d1'])).rejects.toThrow()
        })
    })
})
