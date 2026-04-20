import { renderHook, act } from '@testing-library/react'
import { usePWA } from './usePWA'

describe('usePWA', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Default: not installed, not standalone
        window.matchMedia.mockImplementation((query) => ({
            matches: query === '(display-mode: standalone)' ? false : false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
    })

    it('returns isInstalled=false when not in standalone mode', () => {
        const { result } = renderHook(() => usePWA())
        expect(result.current.isInstalled).toBe(false)
    })

    it('returns isInstalled=true when in standalone display mode', () => {
        window.matchMedia.mockImplementation((query) => ({
            matches: query === '(display-mode: standalone)',
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
        const { result } = renderHook(() => usePWA())
        expect(result.current.isInstalled).toBe(true)
    })

    it('returns isInstallable=false initially', () => {
        const { result } = renderHook(() => usePWA())
        expect(result.current.isInstallable).toBe(false)
    })

    it('sets isInstallable=true when beforeinstallprompt fires', () => {
        const { result } = renderHook(() => usePWA())

        const promptEvent = new Event('beforeinstallprompt')
        promptEvent.preventDefault = vi.fn()
        promptEvent.prompt = vi.fn()
        promptEvent.userChoice = Promise.resolve({ outcome: 'accepted' })

        act(() => {
            window.dispatchEvent(promptEvent)
        })

        expect(result.current.isInstallable).toBe(true)
    })

    it('stores deferred prompt when beforeinstallprompt fires', () => {
        const { result } = renderHook(() => usePWA())

        const promptEvent = new Event('beforeinstallprompt')
        promptEvent.preventDefault = vi.fn()
        promptEvent.prompt = vi.fn()
        promptEvent.userChoice = Promise.resolve({ outcome: 'accepted' })

        act(() => {
            window.dispatchEvent(promptEvent)
        })

        // installPWA should be callable (deferredPrompt stored)
        expect(result.current.isInstallable).toBe(true)
    })

    it('installPWA does nothing when no deferredPrompt', async () => {
        const { result } = renderHook(() => usePWA())
        await act(async () => {
            await result.current.installPWA()
        })
        // No error, state unchanged
        expect(result.current.isInstallable).toBe(false)
        expect(result.current.isInstalled).toBe(false)
    })

    it('installPWA calls prompt and resets state', async () => {
        const { result } = renderHook(() => usePWA())

        const mockPrompt = vi.fn()
        const promptEvent = new Event('beforeinstallprompt')
        promptEvent.preventDefault = vi.fn()
        promptEvent.prompt = mockPrompt
        promptEvent.userChoice = Promise.resolve({ outcome: 'accepted' })

        act(() => {
            window.dispatchEvent(promptEvent)
        })

        expect(result.current.isInstallable).toBe(true)

        await act(async () => {
            await result.current.installPWA()
        })

        expect(mockPrompt).toHaveBeenCalled()
        expect(result.current.isInstallable).toBe(false)
    })

    it('sets isInstalled=true and isInstallable=false on appinstalled event', () => {
        const { result } = renderHook(() => usePWA())

        // First make it installable
        const promptEvent = new Event('beforeinstallprompt')
        promptEvent.preventDefault = vi.fn()
        act(() => { window.dispatchEvent(promptEvent) })
        expect(result.current.isInstallable).toBe(true)

        // Then appinstalled fires
        act(() => {
            window.dispatchEvent(new Event('appinstalled'))
        })

        expect(result.current.isInstalled).toBe(true)
        expect(result.current.isInstallable).toBe(false)
    })

    it('removes beforeinstallprompt listener on unmount', () => {
        const addSpy = vi.spyOn(window, 'addEventListener')
        const removeSpy = vi.spyOn(window, 'removeEventListener')

        const { unmount } = renderHook(() => usePWA())
        unmount()

        const removedEvents = removeSpy.mock.calls.map(c => c[0])
        expect(removedEvents).toContain('beforeinstallprompt')

        addSpy.mockRestore()
        removeSpy.mockRestore()
    })
})
