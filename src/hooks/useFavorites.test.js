import { renderHook, act } from '@testing-library/react'

// Mock the favorites store before importing useFavorites
const mockToggleFavorite = vi.fn()
const mockIsFavorite = vi.fn()

vi.mock('@/features/dashboard/hooks/useFavoritesStore', () => ({
    useFavoritesStore: (selector) => {
        const state = {
            favoriteIds: ['loc-1', 'loc-2'],
            toggleFavorite: mockToggleFavorite,
            isFavorite: mockIsFavorite,
        }
        return selector ? selector(state) : state
    },
}))

// Mock navigator.vibrate
const mockVibrate = vi.fn()

import { useFavorites } from './useFavorites'

describe('useFavorites', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsFavorite.mockReturnValue(false)
        window.navigator.vibrate = mockVibrate
    })

    afterEach(() => {
        delete window.navigator.vibrate
    })

    it('returns favoriteIds from the store', () => {
        const { result } = renderHook(() => useFavorites())
        expect(result.current.favoriteIds).toEqual(['loc-1', 'loc-2'])
    })

    it('returns correct count of favorites', () => {
        const { result } = renderHook(() => useFavorites())
        expect(result.current.count).toBe(2)
    })

    it('exposes isFavorite function from the store', () => {
        mockIsFavorite.mockReturnValue(true)
        const { result } = renderHook(() => useFavorites())
        expect(result.current.isFavorite('loc-1')).toBe(true)
        expect(mockIsFavorite).toHaveBeenCalledWith('loc-1')
    })

    it('calls store toggleFavorite when toggleFavorite is invoked', () => {
        const { result } = renderHook(() => useFavorites())
        act(() => {
            result.current.toggleFavorite('loc-3')
        })
        expect(mockToggleFavorite).toHaveBeenCalledWith('loc-3')
    })

    it('vibrates with pattern when removing a favorite (isFavorite=true)', () => {
        mockIsFavorite.mockReturnValue(true)
        const { result } = renderHook(() => useFavorites())
        act(() => {
            result.current.toggleFavorite('loc-1')
        })
        expect(mockVibrate).toHaveBeenCalledWith([10])
    })

    it('vibrates with longer pattern when adding a favorite (isFavorite=false)', () => {
        mockIsFavorite.mockReturnValue(false)
        const { result } = renderHook(() => useFavorites())
        act(() => {
            result.current.toggleFavorite('loc-3')
        })
        expect(mockVibrate).toHaveBeenCalledWith([10, 30, 10])
    })

    it('does not call vibrate when navigator.vibrate is unavailable', () => {
        delete window.navigator.vibrate
        const { result } = renderHook(() => useFavorites())
        // Should not throw
        act(() => {
            result.current.toggleFavorite('loc-3')
        })
        expect(mockToggleFavorite).toHaveBeenCalledWith('loc-3')
    })
})
