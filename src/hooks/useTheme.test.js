import { renderHook, act } from '@testing-library/react'

// Mock ThemeController before importing useTheme
const mockSetTheme = vi.fn()
vi.mock('../utils/ThemeController', () => ({
    themeController: {
        setTheme: (...args) => mockSetTheme(...args),
    },
}))

import { useTheme } from './useTheme'

describe('useTheme', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset data-theme attribute
        document.documentElement.removeAttribute('data-theme')
        document.documentElement.classList.remove('dark')
    })

    it('reads initial theme from data-theme attribute (light)', () => {
        document.documentElement.setAttribute('data-theme', 'light')
        const { result } = renderHook(() => useTheme())
        expect(result.current.theme).toBe('light')
    })

    it('reads initial theme from data-theme attribute (dark)', () => {
        document.documentElement.setAttribute('data-theme', 'dark')
        const { result } = renderHook(() => useTheme())
        expect(result.current.theme).toBe('dark')
    })

    it('defaults to "light" when data-theme is not set', () => {
        const { result } = renderHook(() => useTheme())
        expect(result.current.theme).toBe('light')
    })

    it('toggleTheme switches from light to dark', () => {
        document.documentElement.setAttribute('data-theme', 'light')
        const { result } = renderHook(() => useTheme())

        act(() => {
            result.current.toggleTheme()
        })

        expect(mockSetTheme).toHaveBeenCalledWith('dark')
    })

    it('toggleTheme switches from dark to light', () => {
        document.documentElement.setAttribute('data-theme', 'dark')
        const { result } = renderHook(() => useTheme())

        act(() => {
            result.current.toggleTheme()
        })

        expect(mockSetTheme).toHaveBeenCalledWith('light')
    })

    it('updates theme state on "themechange" custom event', () => {
        document.documentElement.setAttribute('data-theme', 'light')
        const { result } = renderHook(() => useTheme())
        expect(result.current.theme).toBe('light')

        // Simulate theme controller changing the DOM
        document.documentElement.setAttribute('data-theme', 'dark')

        act(() => {
            window.dispatchEvent(new CustomEvent('themechange', {
                detail: { theme: 'dark' },
            }))
        })

        expect(result.current.theme).toBe('dark')
    })

    it('removes event listeners on unmount', () => {
        const addSpy = vi.spyOn(window, 'addEventListener')
        const removeSpy = vi.spyOn(window, 'removeEventListener')

        const { unmount } = renderHook(() => useTheme())

        const addedListeners = addSpy.mock.calls.map(c => c[0])
        expect(addedListeners).toContain('themechange')

        unmount()

        const removedListeners = removeSpy.mock.calls.map(c => c[0])
        expect(removedListeners).toContain('themechange')

        addSpy.mockRestore()
        removeSpy.mockRestore()
    })
})
