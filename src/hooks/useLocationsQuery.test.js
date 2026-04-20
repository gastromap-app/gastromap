import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock env config
vi.mock('@/shared/config/env', () => ({
    config: {
        supabase: {
            isConfigured: false,
            url: '',
            anonKey: '',
        },
    },
}))

// Mock the locations store
const mockSetLocations = vi.fn()
vi.mock('@/shared/store/useLocationsStore', () => ({
    useLocationsStore: (selector) => {
        const state = { setLocations: mockSetLocations }
        return selector ? selector(state) : state
    },
}))

// Mock API modules — OSM path
const mockGeocodeCity = vi.fn()
const mockFetchPlaces = vi.fn()
vi.mock('@/services/nominatimApi', () => ({
    geocodeCity: (...args) => mockGeocodeCity(...args),
}))
vi.mock('@/services/overpassApi', () => ({
    fetchPlacesByBoundingBox: (...args) => mockFetchPlaces(...args),
}))

// Mock locations API — Supabase path
const mockGetLocations = vi.fn()
vi.mock('@/shared/api/locations.api', () => ({
    getLocations: (...args) => mockGetLocations(...args),
}))

// Mock MOCK_LOCATIONS
vi.mock('@/mocks/locations', () => ({
    MOCK_LOCATIONS: [
        { id: 'mock-1', title: 'Mock Place', lat: 50, lng: 20 },
    ],
}))

import { useLocationsQuery } from './useLocationsQuery'

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

describe('useLocationsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('generates correct query key based on city and country', async () => {
        mockGeocodeCity.mockResolvedValue({ boundingbox: [50, 51, 19, 20] })
        mockFetchPlaces.mockResolvedValue([{ id: 'osm-1', title: 'OSM Place' }])

        const wrapper = createWrapper()
        renderHook(() => useLocationsQuery('Krakow', 'Poland'), { wrapper })

        await waitFor(() => {
            expect(mockGeocodeCity).toHaveBeenCalledWith('Krakow', 'Poland')
        })
    })

    it('falls back to OSM when Supabase is not configured', async () => {
        mockGeocodeCity.mockResolvedValue({ boundingbox: [50, 51, 19, 20] })
        mockFetchPlaces.mockResolvedValue([{ id: 'osm-1', title: 'OSM Place' }])

        const wrapper = createWrapper()
        const { result } = renderHook(() => useLocationsQuery('Krakow', 'Poland'), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(result.current.data).toEqual([{ id: 'osm-1', title: 'OSM Place' }])
    })

    it('falls back to mock data when both Supabase and OSM fail', async () => {
        mockGeocodeCity.mockRejectedValue(new Error('Network error'))

        const wrapper = createWrapper()
        const { result } = renderHook(() => useLocationsQuery('Krakow', 'Poland'), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(result.current.data).toEqual([
            { id: 'mock-1', title: 'Mock Place', lat: 50, lng: 20 },
        ])
    })

    it('syncs data to Zustand store only when no city/country filter', async () => {
        mockGeocodeCity.mockResolvedValue({ boundingbox: [50, 51, 19, 20] })
        mockFetchPlaces.mockResolvedValue([{ id: 'osm-1', title: 'OSM Place' }])

        const wrapper = createWrapper()
        const { result } = renderHook(() => useLocationsQuery(null, null), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(mockSetLocations).toHaveBeenCalledWith([{ id: 'osm-1', title: 'OSM Place' }])
    })

    it('does NOT sync to Zustand when city is provided', async () => {
        mockGeocodeCity.mockResolvedValue({ boundingbox: [50, 51, 19, 20] })
        mockFetchPlaces.mockResolvedValue([{ id: 'osm-1', title: 'OSM Place' }])

        const wrapper = createWrapper()
        const { result } = renderHook(() => useLocationsQuery('Krakow', 'Poland'), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(mockSetLocations).not.toHaveBeenCalled()
    })

    it('handles OSM returning empty results by falling back to mocks', async () => {
        mockGeocodeCity.mockResolvedValue({ boundingbox: [50, 51, 19, 20] })
        mockFetchPlaces.mockResolvedValue([])

        const wrapper = createWrapper()
        const { result } = renderHook(() => useLocationsQuery('GhostTown', 'Antarctica'), { wrapper })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(result.current.data).toEqual([
            { id: 'mock-1', title: 'Mock Place', lat: 50, lng: 20 },
        ])
    })
})
