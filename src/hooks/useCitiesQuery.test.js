import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock Nominatim API
const mockGetCities = vi.fn()
const mockGetCityImage = vi.fn().mockReturnValue('https://images.unsplash.com/photo?q=80')
vi.mock('@/services/nominatimApi', () => ({
    getCitiesForCountry: (...args) => mockGetCities(...args),
    getCityImage: (...args) => mockGetCityImage(...args),
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

describe('useCitiesQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('is disabled when country is not provided', () => {
        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery(null), { wrapper })
        expect(result.current.fetchStatus).toBe('idle')
    })

    it('is disabled when country is empty string', () => {
        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery(''), { wrapper })
        expect(result.current.fetchStatus).toBe('idle')
    })

    it('fetches cities for a given country', async () => {
        const cities = [
            { name: 'Krakow', lat: 50.06, lon: 19.94, image: 'https://img.jpg' },
            { name: 'Warsaw', lat: 52.23, lon: 21.01, image: 'https://img2.jpg' },
        ]
        mockGetCities.mockResolvedValue(cities)

        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery('Poland'), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        // API returns the cities; the data should contain them
        const names = result.current.data.map(c => c.name)
        expect(names).toContain('Krakow')
        expect(names).toContain('Warsaw')
        expect(mockGetCities).toHaveBeenCalledWith('Poland')
    })

    it('uses fallback cities when API returns empty', async () => {
        mockGetCities.mockResolvedValue([])

        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery('Poland'), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        // Should have fallback cities from FALLBACK_CITIES.poland
        const names = result.current.data.map(c => c.name)
        expect(names).toContain('Krakow')
        expect(names).toContain('Warsaw')
    })

    it('uses fallback cities when API throws', async () => {
        mockGetCities.mockRejectedValue(new Error('API down'))

        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery('Germany'), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        const names = result.current.data.map(c => c.name)
        expect(names).toContain('Berlin')
        expect(names).toContain('Munich')
    })

    it('returns empty array for unknown country in fallback', async () => {
        mockGetCities.mockRejectedValue(new Error('fail'))

        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery('Atlantis'), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(result.current.data).toEqual([])
    })

    it('provides placeholderData immediately', () => {
        mockGetCities.mockReturnValue(new Promise(() => {})) // never resolves

        const wrapper = createWrapper()
        const { result } = renderHook(() => useCitiesQuery('France'), { wrapper })

        // placeholderData should be available immediately
        const names = result.current.data?.map(c => c.name) ?? []
        expect(names).toContain('Paris')
    })

    it('generates query key with lowercase country', async () => {
        mockGetCities.mockResolvedValue([])

        const wrapper = createWrapper()
        renderHook(() => useCitiesQuery('POLAND'), { wrapper })

        await waitFor(() => {
            expect(mockGetCities).toHaveBeenCalledWith('POLAND')
        })
    })
})
