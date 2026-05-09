import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/shared/api/client', () => ({
    supabase: {
        from: () => ({
            select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        }),
        auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
        channel: () => ({ on: () => ({ subscribe: () => {} }) }),
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
    ]
}))

import { useLocationsStore } from './useLocationsStore'

describe('useLocationsStore.applyFilters', () => {
    beforeEach(() => {
        useLocationsStore.setState({
            locations: [{ id: '1', title: 'Test Cafe', category: 'Cafe', google_rating: 4.5 }],
            activeCategories: [],
            activeCategory: 'All',
            filteredLocations: [],
        })
    })

    it('does not mutate the input updates object', () => {
        const store = useLocationsStore.getState()
        const input = { activeCategories: ['Cafe'] }
        const inputBefore = JSON.stringify(input)
        store.applyFilters(input)
        expect(JSON.stringify(input)).toBe(inputBefore)
    })

    it('syncs activeCategory when activeCategories is provided', () => {
        const store = useLocationsStore.getState()
        store.applyFilters({ activeCategories: ['Restaurant'] })
        const state = useLocationsStore.getState()
        expect(state.activeCategory).toBe('Restaurant')
        expect(state.activeCategories).toEqual(['Restaurant'])
    })

    it('syncs activeCategory to All when activeCategories is empty', () => {
        const store = useLocationsStore.getState()
        store.applyFilters({ activeCategories: [] })
        const state = useLocationsStore.getState()
        expect(state.activeCategory).toBe('All')
        expect(state.activeCategories).toEqual([])
    })
})
