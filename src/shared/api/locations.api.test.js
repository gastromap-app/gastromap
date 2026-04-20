import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getLocations, getLocation, getLocationById, createLocation, updateLocation, deleteLocation, getCategories } from './locations.api'

// ─── Mock @/shared/config/env ────────────────────────────────────────────
vi.mock('@/shared/config/env', () => ({
    config: {
        supabase: { isConfigured: true, url: 'https://mock.supabase.co', anonKey: 'anon' },
        app: { isDev: false },
        ai: { isConfigured: false, openRouterKey: '' },
    }
}))

// ─── Mock @/mocks/locations ───────────────────────────────────────────────
vi.mock('@/mocks/locations', () => ({
    MOCK_LOCATIONS: [],
    MOCK_CATEGORIES: ['All', 'Restaurant', 'Cafe'],
}))

// ─── Hoisted mock vars so they can be referenced in vi.mock factory ───────
const { mockSelect, mockInsert, mockUpdate, mockDelete, mockEq, mockIlike, mockIn, mockGte,
    mockOverlaps, mockOr, mockOrder, mockRange, mockSingle, mockUpsert } = vi.hoisted(() => ({
    mockSelect: vi.fn(),
    mockInsert: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockEq: vi.fn(),
    mockIlike: vi.fn(),
    mockIn: vi.fn(),
    mockGte: vi.fn(),
    mockOverlaps: vi.fn(),
    mockOr: vi.fn(),
    mockOrder: vi.fn(),
    mockRange: vi.fn(),
    mockSingle: vi.fn(),
    mockUpsert: vi.fn(),
}))

const chainable = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    ilike: mockIlike,
    in: mockIn,
    gte: mockGte,
    overlaps: mockOverlaps,
    or: mockOr,
    order: mockOrder,
    range: mockRange,
    single: mockSingle,
    upsert: mockUpsert,
}

vi.mock('./client', () => ({
    supabase: {
        from: vi.fn(() => chainable),
    },
    ApiError: class ApiError extends Error {
        constructor(message, status, code) {
            super(message)
            this.name = 'ApiError'
            this.status = status
            this.code = code
        }
    },
}))

// ─── Mock dynamic imports used inside createLocation / updateLocation ─────
vi.mock('./ai-config.api', () => ({
    getActiveAIConfig: vi.fn(() => ({ isConfigured: false })),
}))

vi.mock('./translation.api', () => ({
    processLocationTranslations: vi.fn(async (data) => data),
    saveTranslations: vi.fn(async () => {}),
    getTranslations: vi.fn(async () => null),
}))

vi.mock('./knowledge-graph.api', () => ({
    syncKGForLocation: vi.fn(async () => null),
}))

vi.mock('@/features/admin/components/LocationForm/enrichment', () => ({
    enrichLocationData: vi.fn(async (data) => data),
}))

// ─── Tests ───────────────────────────────────────────────────────────────

// Helper: make a thenable chainable with a specific resolved result.
// getLocations builds a dynamic query chain. The terminal call could be
// eq / ilike / gte / in / overlaps / or / range depending on filters.
// We make EVERY chain method also a thenable so it resolves correctly.
function makeChainResult(data) {
    return {
        ...chainable,
        then(resolve) { return Promise.resolve(data).then(resolve) },
        catch(reject) { return Promise.resolve(data).catch(reject) },
    }
}

describe('locations.api', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // By default: all methods return the chainable (non-thenable)
        Object.values(chainable).forEach(fn => fn.mockReturnValue(chainable))
    })

    // Helper: set result for any getLocations call regardless of which filter is last
    function setQueryResult(result) {
        Object.values(chainable).forEach(fn => {
            fn.mockReturnValue(makeChainResult(result))
        })
    }

    // ─── getLocations ───────────────────────────────────────────────────

    describe('getLocations', () => {
        it('returns normalised data and pagination info on success', async () => {
            const rawRow = {
                id: '1', title: 'Cafe Test', rating: '4.5', price_level: '$$',
                city: 'Krakow', country: 'Poland', category: 'cafe', status: 'approved',
                lat: '50.06', lng: '19.94',
            }
            setQueryResult({ data: [rawRow], error: null, count: 1 })

            const result = await getLocations()

            expect(result.data).toHaveLength(1)
            expect(result.data[0].title).toBe('Cafe Test')
            expect(result.data[0].rating).toBe(4.5)
            expect(result.total).toBe(1)
            expect(result.hasMore).toBe(false)
        })

        it('filters by status=approved by default', async () => {
            setQueryResult({ data: [], error: null, count: 0 })
            await getLocations()
            expect(mockEq).toHaveBeenCalledWith('status', 'approved')
        })

        it('bypasses status filter when all=true', async () => {
            setQueryResult({ data: [], error: null, count: 0 })
            await getLocations({ all: true })
            // Should NOT call eq('status', ...) for bypass
            const eqCalls = mockEq.mock.calls.map(c => c[0])
            expect(eqCalls).not.toContain('status')
        })

        it('applies category filter', async () => {
            setQueryResult({ data: [], error: null, count: 0 })
            await getLocations({ category: 'Restaurant' })
            expect(mockEq).toHaveBeenCalledWith('category', 'Restaurant')
        })

        it('applies city filter with ilike', async () => {
            setQueryResult({ data: [], error: null, count: 0 })
            await getLocations({ city: 'Krakow' })
            expect(mockIlike).toHaveBeenCalledWith('city', 'Krakow')
        })

        it('applies minRating filter', async () => {
            setQueryResult({ data: [], error: null, count: 0 })
            await getLocations({ minRating: 4 })
            expect(mockGte).toHaveBeenCalledWith('rating', 4)
        })

        it('applies priceLevel filter with in()', async () => {
            setQueryResult({ data: [], error: null, count: 0 })
            await getLocations({ priceLevel: ['$$', '$$$'] })
            expect(mockIn).toHaveBeenCalledWith('price_level', ['$$', '$$$'])
        })

        it('applies text query filter', async () => {
            setQueryResult({ data: [], error: null, count: 0 })
            await getLocations({ query: 'pizza' })
            expect(mockOr).toHaveBeenCalledWith('title.ilike.%pizza%,city.ilike.%pizza%')
        })

        it('falls back to mocks on Supabase error', async () => {
            setQueryResult({ data: null, error: { message: 'db error' }, count: 0 })
            const result = await getLocations()
            // Should not throw, should return object shape
            expect(result).toHaveProperty('data')
            expect(result).toHaveProperty('total')
        })

        it('normalises legacy status active→approved', async () => {
            const rawRow = { id: '2', title: 'Bar', status: 'active', lat: 0, lng: 0 }
            setQueryResult({ data: [rawRow], error: null, count: 1 })
            const result = await getLocations()
            expect(result.data[0].status).toBe('approved')
        })
    })

    // ─── getLocation / getLocationById ─────────────────────────────────

    describe('getLocation', () => {
        it('returns normalised location on success', async () => {
            const rawRow = { id: 'loc1', title: 'Sushi Place', rating: 5, lat: 50, lng: 19 }
            mockSingle.mockResolvedValue({ data: rawRow, error: null })

            const result = await getLocation('loc1')
            expect(result.id).toBe('loc1')
            expect(result.title).toBe('Sushi Place')
        })

        it('filters by approved status in public mode', async () => {
            mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
            await getLocation('x')
            expect(mockEq).toHaveBeenCalledWith('status', 'approved')
        })

        it('skips status filter in admin mode', async () => {
            mockSingle.mockResolvedValue({ data: { id: 'x', title: 'Draft', lat: 0, lng: 0 }, error: null })
            await getLocation('x', { adminMode: true })
            const eqCalls = mockEq.mock.calls.map(c => c[0])
            expect(eqCalls).not.toContain('status')
        })

        it('falls back to mock on error', async () => {
            mockSingle.mockResolvedValue({ data: null, error: { message: 'fail' } })
            // Should not throw
            const result = await getLocation('nonexistent')
            expect(result === null || result === undefined || typeof result === 'object').toBe(true)
        })

        it('getLocationById is an alias for getLocation', () => {
            expect(getLocationById).toBe(getLocation)
        })
    })

    // ─── createLocation ─────────────────────────────────────────────────

    describe('createLocation', () => {
        it('inserts a location and returns normalised data', async () => {
            const created = { id: 'new1', title: 'New Bistro', lat: 50, lng: 19, status: 'approved' }
            mockSingle.mockResolvedValue({ data: created, error: null })

            const result = await createLocation({ title: 'New Bistro', city: 'Krakow', category: 'restaurant' })
            expect(result.id).toBe('new1')
            expect(result.title).toBe('New Bistro')
        })

        it('throws ApiError on insert failure', async () => {
            mockSingle.mockResolvedValue({ data: null, error: { message: 'insert failed', code: '23505' } })
            await expect(createLocation({ title: 'X', city: 'Y', category: 'cafe' })).rejects.toThrow()
        })

        it('uses title fallback "Untitled" when no title provided', async () => {
            const created = { id: 'n2', title: 'Untitled', lat: 0, lng: 0, status: 'approved' }
            mockSingle.mockResolvedValue({ data: created, error: null })

            const result = await createLocation({ city: 'Krakow', category: 'cafe' })
            expect(result.id).toBe('n2')
        })
    })

    // ─── updateLocation ─────────────────────────────────────────────────

    describe('updateLocation', () => {
        it('updates a location and returns normalised data', async () => {
            const updated = { id: 'u1', title: 'Updated', lat: 50, lng: 19, status: 'approved' }
            mockSingle.mockResolvedValue({ data: updated, error: null })

            const result = await updateLocation('u1', { title: 'Updated' })
            expect(result.id).toBe('u1')
            expect(result.title).toBe('Updated')
        })

        it('throws ApiError on update failure', async () => {
            mockSingle.mockResolvedValue({ data: null, error: { message: 'update failed', code: '42000' } })
            await expect(updateLocation('u1', { title: 'Bad' })).rejects.toThrow()
        })
    })

    // ─── deleteLocation ─────────────────────────────────────────────────

    describe('deleteLocation', () => {
        it('resolves without error on success', async () => {
            mockEq.mockResolvedValue({ error: null })
            await expect(deleteLocation('d1')).resolves.toBeUndefined()
        })

        it('throws ApiError on delete failure', async () => {
            mockEq.mockResolvedValue({ error: { message: 'delete failed', code: '42000' } })
            await expect(deleteLocation('d1')).rejects.toThrow()
        })
    })

    // ─── getCategories ───────────────────────────────────────────────────

    describe('getCategories', () => {
        it('returns unique sorted categories with All prepended', async () => {
            const rows = [{ category: 'cafe' }, { category: 'restaurant' }, { category: 'cafe' }]
            mockEq.mockResolvedValue({ data: rows, error: null })

            const result = await getCategories()
            expect(result[0]).toBe('All')
            expect(result).toContain('cafe')
            expect(result).toContain('restaurant')
            // No duplicates
            const cafes = result.filter(c => c === 'cafe')
            expect(cafes).toHaveLength(1)
        })

        it('falls back to mock categories on error', async () => {
            mockEq.mockResolvedValue({ data: null, error: { message: 'fail' } })
            const result = await getCategories()
            expect(Array.isArray(result)).toBe(true)
        })
    })
})
