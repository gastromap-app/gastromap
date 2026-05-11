import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock Supabase client
const mockSelect = vi.fn()
const mockIlike = vi.fn()
const mockIn = vi.fn()
const mockNot = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/shared/api/client', () => ({
    supabase: {
        from: (...args) => mockFrom(...args),
    },
}))

// Mock getCityImage
vi.mock('@/services/nominatimApi', () => ({
    getCityImage: (name) => `https://images.unsplash.com/${name}`,
}))

import { useCitiesQuery } from './useCitiesQuery'

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return function Wrapper({ children }) {
        return React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children
        )
    }
}

function setupSupabaseMock({ locationsData = [], locationsError = null, coversData = [] } = {}) {
    // Chain: supabase.from('locations').select().ilike().in().not()
    mockNot.mockReturnValue(Promise.resolve({ data: locationsData, error: locationsError }))
    mockIn.mockReturnValue({ not: mockNot })
    mockIlike.mockReturnValue({ in: mockIn })
    mockSelect.mockReturnValue({ ilike: mockIlike })

    // Chain: supabase.from('geo_covers').select().eq()
    const mockEq = vi.fn().mockReturnValue(Promise.resolve({ data: coversData }))
    const mockCoversSelect = vi.fn().mockReturnValue({ eq: mockEq })

    mockFrom.mockImplementation((table) => {
        if (table === 'locations') return { select: mockSelect }
        if (table === 'geo_covers') return { select: mockCoversSelect }
        return { select: vi.fn().mockReturnValue({ ilike: vi.fn().mockReturnValue({ in: vi.fn().mockReturnValue({ not: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) }
    })
}

describe('useCitiesQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('is disabled when country is not provided', () => {
        setupSupabaseMock()
        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery(null), { wrapper })
        expect(result.current.fetchStatus).toBe('idle')
    })

    it('is disabled when country is empty string', () => {
        setupSupabaseMock()
        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery(''), { wrapper })
        expect(result.current.fetchStatus).toBe('idle')
    })

    it('fetches cities for a given country', async () => {
        setupSupabaseMock({
            locationsData: [
                { city: 'Krakow' },
                { city: 'Krakow' },
                { city: 'Warsaw' },
            ],
            coversData: [],
        })

        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery('Poland'), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        const names = result.current.data.map(c => c.name)
        expect(names).toContain('Krakow')
        expect(names).toContain('Warsaw')
    })

    it('returns empty array when no locations found', async () => {
        setupSupabaseMock({ locationsData: [] })

        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery('Atlantis'), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(result.current.data).toEqual([])
    })

    it('propagates supabase errors to query state', async () => {
        setupSupabaseMock({ locationsError: { message: 'DB error' } })

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        const wrapper = function Wrapper({ children }) {
            return React.createElement(QueryClientProvider, { client: queryClient }, children)
        }
        const { result } = renderHook(() => useCitiesQuery('Poland'), { wrapper })

        await waitFor(() => {
            // Hook has retry: 1 internally, so it may take a moment
            expect(result.current.status === 'error' || result.current.isError).toBe(true)
        }, { timeout: 5000 })
    })

    it('filters out hidden cities based on geo_covers', async () => {
        setupSupabaseMock({
            locationsData: [
                { city: 'Krakow' },
                { city: 'Hidden City' },
            ],
            coversData: [
                { slug: 'hidden-city', image_url: null, is_visible: false, is_coming_soon: false },
            ],
        })

        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery('Poland'), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        const names = result.current.data.map(c => c.name)
        expect(names).toContain('Krakow')
        expect(names).not.toContain('Hidden City')
    })

    it('sorts cities by count descending', async () => {
        setupSupabaseMock({
            locationsData: [
                { city: 'Warsaw' },
                { city: 'Krakow' },
                { city: 'Krakow' },
                { city: 'Krakow' },
            ],
            coversData: [],
        })

        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery('Poland'), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(result.current.data[0].name).toBe('Krakow')
        expect(result.current.data[0].count).toBe(3)
        expect(result.current.data[1].name).toBe('Warsaw')
        expect(result.current.data[1].count).toBe(1)
    })
})
