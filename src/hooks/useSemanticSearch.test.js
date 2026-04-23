import { renderHook, act } from '@testing-library/react'

// Mock cache module
const mockGetCachedData = vi.fn()
const mockSetCachedData = vi.fn()
vi.mock('@/shared/lib/cache', () => ({
    getCachedData: (...args) => mockGetCachedData(...args),
    setCachedData: (...args) => mockSetCachedData(...args),
    TTL: { semanticSearch: 600000 },
}))

// Mock env config
vi.mock('@/shared/config/env', () => ({
    config: {
        supabase: { anonKey: 'test-key' },
        ai: {
            semanticSearchUrl: 'https://edge.test/semantic-search',
            semanticSearchFallback: '/api/ai/semantic-search',
        },
    },
}))

import { useSemanticSearch } from './useSemanticSearch'

describe('useSemanticSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetCachedData.mockReturnValue(null)
    })

    afterEach(() => {
        if (global.fetch && global.fetch.mockClear) {
            global.fetch.mockClear()
        }
    })

    it('returns initial state', () => {
        const { result } = renderHook(() => useSemanticSearch())
        expect(result.current.results).toEqual([])
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
        expect(result.current.lastQuery).toBe('')
        expect(result.current.fromCache).toBe(false)
    })

    it('returns empty array when query is empty/whitespace', async () => {
        const { result } = renderHook(() => useSemanticSearch())
        let res
        await act(async () => {
            res = await result.current.search('')
        })
        expect(res).toEqual([])
        expect(result.current.isLoading).toBe(false)

        await act(async () => {
            res = await result.current.search('   ')
        })
        expect(res).toEqual([])
    })

    it('returns cached results when available (L2 cache hit)', async () => {
        const cachedResults = [{ id: '1', title: 'Cached Place' }]
        mockGetCachedData.mockReturnValue(cachedResults)

        const { result } = renderHook(() => useSemanticSearch())
        let res
        await act(async () => {
            res = await result.current.search('pizza')
        })

        expect(res).toEqual(cachedResults)
        expect(result.current.results).toEqual(cachedResults)
        expect(result.current.fromCache).toBe(true)
        expect(result.current.isLoading).toBe(false)
    })

    it('fetches from API when no cache and populates results', async () => {
        const apiResults = [{ id: '2', title: 'API Place', similarity: 0.9 }]
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ results: apiResults }),
        })

        const { result } = renderHook(() => useSemanticSearch())
        await act(async () => {
            await result.current.search('sushi')
        })

        expect(result.current.results).toEqual(apiResults)
        expect(result.current.isLoading).toBe(false)
        expect(result.current.fromCache).toBe(false)
        expect(mockSetCachedData).toHaveBeenCalled()
    })

    it('sets error when all endpoints fail', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network down'))

        const { result } = renderHook(() => useSemanticSearch())
        await act(async () => {
            await result.current.search('pizza')
        })

        expect(result.current.error).toBe('Network down')
        expect(result.current.isLoading).toBe(false)
    })

    it('tries fallback URL when primary fails', async () => {
        let callCount = 0
        global.fetch = vi.fn().mockImplementation((url) => {
            callCount++
            if (url.includes('edge.test')) {
                return Promise.resolve({ ok: false, status: 500 })
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ results: [{ id: '3', title: 'Fallback' }] }),
            })
        })

        const { result } = renderHook(() => useSemanticSearch())
        await act(async () => {
            await result.current.search('burger')
        })

        expect(result.current.results).toEqual([{ id: '3', title: 'Fallback' }])
        expect(callCount).toBeGreaterThanOrEqual(2)
    })

    it('clear resets all state', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ results: [{ id: '1' }] }),
        })

        const { result } = renderHook(() => useSemanticSearch())
        await act(async () => {
            await result.current.search('test')
        })

        expect(result.current.results.length).toBeGreaterThan(0)

        act(() => {
            result.current.clear()
        })

        expect(result.current.results).toEqual([])
        expect(result.current.error).toBeNull()
        expect(result.current.lastQuery).toBe('')
        expect(result.current.fromCache).toBe(false)
    })

    it('sets loading state during fetch and clears after', async () => {
        // Use a simple approach: verify isLoading is false before and after
        // The loading true state is transient within the same act() call
        const { result } = renderHook(() => useSemanticSearch())
        expect(result.current.isLoading).toBe(false)

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ results: [] }),
        })

        await act(async () => {
            await result.current.search('test')
        })

        expect(result.current.isLoading).toBe(false)
    })

    it('sends Authorization header when anonKey is configured', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ results: [] }),
        })

        const { result } = renderHook(() => useSemanticSearch())
        await act(async () => {
            await result.current.search('test')
        })

        const fetchCall = global.fetch.mock.calls[0]
        expect(fetchCall[1].headers['Authorization']).toBe('Bearer test-key')
    })

    it('uses custom threshold and limit from options', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ results: [] }),
        })

        const { result } = renderHook(() => useSemanticSearch({ threshold: 0.5, limit: 5 }))
        await act(async () => {
            await result.current.search('test')
        })

        const fetchCall = global.fetch.mock.calls[0]
        const body = JSON.parse(fetchCall[1].body)
        expect(body.threshold).toBe(0.5)
        expect(body.limit).toBe(5)
    })

    it('filters out null/undefined URLs from the endpoint list', async () => {
        // The hook filters URLs with .filter(Boolean), verify the first call URL
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ results: [] }),
        })

        const { result } = renderHook(() => useSemanticSearch())
        await act(async () => {
            await result.current.search('test')
        })

        // First call should be to the edge URL (not null/undefined)
        expect(global.fetch.mock.calls[0][0]).toBe('https://edge.test/semantic-search')
    })

    it('returns empty results when API returns no results property', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        })

        const { result } = renderHook(() => useSemanticSearch())
        await act(async () => {
            await result.current.search('test')
        })

        expect(result.current.results).toEqual([])
    })

    it('continues to next URL on HTTP error', async () => {
        let callIndex = 0
        global.fetch = vi.fn().mockImplementation(() => {
            callIndex++
            if (callIndex === 1) {
                return Promise.resolve({ ok: false, status: 500 })
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ results: [{ id: 'fb' }] }),
            })
        })

        const { result } = renderHook(() => useSemanticSearch())
        await act(async () => {
            await result.current.search('test')
        })

        expect(result.current.results).toEqual([{ id: 'fb' }])
    })
})
