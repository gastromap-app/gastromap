import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase before importing store
vi.mock('@/shared/api/client', () => ({
    supabase: {
        from: () => ({
            select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        }),
        auth: {
            getSession: () => Promise.resolve({ data: { session: null } }),
        },
        channel: () => ({
            on: () => ({ subscribe: () => {} }),
        }),
        removeChannel: () => {},
    },
    ApiError: class extends Error {
        constructor(message, status, code) {
            super(message)
            this.status = status
            this.code = code
        }
    },
    simulateDelay: (ms) => new Promise(r => setTimeout(r, ms)),
}))

vi.mock('@/mocks/locations', () => ({
    MOCK_LOCATIONS: [
        { id: '1', title: 'Test Cafe', category: 'Cafe', google_rating: 4.5 },
        { id: '2', title: 'Test Restaurant', category: 'Restaurant', google_rating: 4.0 },
    ]
}))

import { useLocationsStore } from './useLocationsStore'

describe('useLocationsStore.setCategory', () => {
    beforeEach(() => {
        useLocationsStore.setState({
            locations: [
                { id: '1', title: 'Test Cafe', category: 'Cafe', google_rating: 4.5 },
                { id: '2', title: 'Test Restaurant', category: 'Restaurant', google_rating: 4.0 },
            ],
            activeCategories: [],
            activeCategory: 'All',
            filteredLocations: [],
        })
    })

    it('sets activeCategories to [] when selecting All', () => {
        const store = useLocationsStore.getState()
        store.setCategory('All')
        const state = useLocationsStore.getState()
        expect(state.activeCategories).toEqual([])
        expect(state.activeCategory).toBe('All')
    })

    it('sets activeCategories to [cat] when selecting a specific category', () => {
        const store = useLocationsStore.getState()
        store.setCategory('Cafe')
        const state = useLocationsStore.getState()
        expect(state.activeCategories).toEqual(['Cafe'])
        expect(state.activeCategory).toBe('Cafe')
    })

    it('getActiveFiltersCount returns 0 after setCategory(All)', () => {
        const store = useLocationsStore.getState()
        store.setCategory('Cafe')
        expect(store.getActiveFiltersCount()).toBe(1)
        store.setCategory('All')
        expect(store.getActiveFiltersCount()).toBe(0)
    })

    it('is consistent with resetFilters', () => {
        const store = useLocationsStore.getState()
        store.setCategory('Cafe')
        store.setSearchQuery('coffee')
        expect(store.getActiveFiltersCount()).toBe(2)
        store.resetFilters()
        expect(store.getActiveFiltersCount()).toBe(0)
        expect(useLocationsStore.getState().activeCategories).toEqual([])
        expect(useLocationsStore.getState().activeCategory).toBe('All')
    })

    it('toggleCategory then setCategory(All) clears correctly', () => {
        const store = useLocationsStore.getState()
        store.toggleCategory('Cafe')
        store.toggleCategory('Bar')
        expect(useLocationsStore.getState().activeCategories).toEqual(['Cafe', 'Bar'])
        store.setCategory('All')
        expect(useLocationsStore.getState().activeCategories).toEqual([])
        expect(store.getActiveFiltersCount()).toBe(0)
    })
})
