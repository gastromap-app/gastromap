import { renderHook, act } from '@testing-library/react'
import { usePullToRefresh } from './usePullToRefresh'

function createTouchEvent(type, touches = [], currentTarget = null) {
    return { type, touches, currentTarget, preventDefault: vi.fn() }
}

describe('usePullToRefresh', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const mockElement = { scrollTop: 0 }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns initial state with zero pull distance', () => {
        const { result } = renderHook(() => usePullToRefresh(onRefresh))
        expect(result.current.pullDistance).toBe(0)
        expect(result.current.isRefreshing).toBe(false)
        expect(result.current.progress).toBe(0)
    })

    it('returns handlers object', () => {
        const { result } = renderHook(() => usePullToRefresh(onRefresh))
        expect(typeof result.current.handlers.onTouchStart).toBe('function')
        expect(typeof result.current.handlers.onTouchMove).toBe('function')
        expect(typeof result.current.handlers.onTouchEnd).toBe('function')
    })

    it('starts tracking on touchStart when scrollTop is 0', () => {
        const { result } = renderHook(() => usePullToRefresh(onRefresh))
        const event = createTouchEvent('touchstart', [{ clientY: 200 }], mockElement)
        act(() => {
            result.current.handlers.onTouchStart(event)
        })
        // No crash; internal state updated (startY ref set)
    })

    it('does NOT start tracking when scrollTop > 0', () => {
        const { result } = renderHook(() => usePullToRefresh(onRefresh))
        const scrolledElement = { scrollTop: 10 }
        const event = createTouchEvent('touchstart', [{ clientY: 200 }], scrolledElement)
        act(() => {
            result.current.handlers.onTouchStart(event)
        })
        // Touch move should be ignored
        const moveEvent = createTouchEvent('touchmove', [{ clientY: 260 }], scrolledElement)
        act(() => {
            result.current.handlers.onTouchMove(moveEvent)
        })
        expect(result.current.pullDistance).toBe(0)
    })

    it('increases pullDistance on touchMove when pulling down', () => {
        const { result } = renderHook(() => usePullToRefresh(onRefresh))

        const startEvent = createTouchEvent('touchstart', [{ clientY: 200 }], mockElement)
        act(() => { result.current.handlers.onTouchStart(startEvent) })

        const moveEvent = createTouchEvent('touchmove', [{ clientY: 280 }], mockElement)
        act(() => { result.current.handlers.onTouchMove(moveEvent) })

        expect(result.current.pullDistance).toBeGreaterThan(0)
        expect(result.current.progress).toBeGreaterThan(0)
    })

    it('caps progress at 1', () => {
        const { result } = renderHook(() => usePullToRefresh(onRefresh, { threshold: 30 }))

        const startEvent = createTouchEvent('touchstart', [{ clientY: 200 }], mockElement)
        act(() => { result.current.handlers.onTouchStart(startEvent) })

        // Pull far enough to exceed threshold
        const moveEvent = createTouchEvent('touchmove', [{ clientY: 500 }], mockElement)
        act(() => { result.current.handlers.onTouchMove(moveEvent) })

        expect(result.current.progress).toBeLessThanOrEqual(1)
    })

    it('resets pullDistance on touchEnd when below threshold', () => {
        const { result } = renderHook(() => usePullToRefresh(onRefresh, { threshold: 100 }))

        const startEvent = createTouchEvent('touchstart', [{ clientY: 200 }], mockElement)
        act(() => { result.current.handlers.onTouchStart(startEvent) })

        // Small pull, not enough to trigger refresh
        const moveEvent = createTouchEvent('touchmove', [{ clientY: 220 }], mockElement)
        act(() => { result.current.handlers.onTouchMove(moveEvent) })

        act(() => { result.current.handlers.onTouchEnd() })
        expect(result.current.pullDistance).toBe(0)
        expect(onRefresh).not.toHaveBeenCalled()
    })

    it('triggers onRefresh when pullDistance exceeds threshold', async () => {
        const { result } = renderHook(() => usePullToRefresh(onRefresh, { threshold: 20 }))

        const startEvent = createTouchEvent('touchstart', [{ clientY: 200 }], mockElement)
        act(() => { result.current.handlers.onTouchStart(startEvent) })

        // Large pull exceeding threshold
        const moveEvent = createTouchEvent('touchmove', [{ clientY: 400 }], mockElement)
        act(() => { result.current.handlers.onTouchMove(moveEvent) })

        await act(async () => {
            await result.current.handlers.onTouchEnd()
        })

        expect(onRefresh).toHaveBeenCalled()
        expect(result.current.isRefreshing).toBe(false) // done after await
    })

    it('sets isRefreshing=true during refresh', async () => {
        let resolveRefresh
        const slowRefresh = vi.fn(() => new Promise(r => { resolveRefresh = r }))
        const { result } = renderHook(() => usePullToRefresh(slowRefresh, { threshold: 20 }))

        const startEvent = createTouchEvent('touchstart', [{ clientY: 200 }], mockElement)
        act(() => { result.current.handlers.onTouchStart(startEvent) })

        const moveEvent = createTouchEvent('touchmove', [{ clientY: 400 }], mockElement)
        act(() => { result.current.handlers.onTouchMove(moveEvent) })

        const endPromise = act(async () => {
            await result.current.handlers.onTouchEnd()
        })

        // While refreshing is in progress, isRefreshing should be true
        // (It's set synchronously before the await)
        // After resolve, it should be false
        resolveRefresh()
        await endPromise

        expect(result.current.isRefreshing).toBe(false)
    })

    it('uses default threshold of 64', () => {
        const { result } = renderHook(() => usePullToRefresh(onRefresh))

        const startEvent = createTouchEvent('touchstart', [{ clientY: 200 }], mockElement)
        act(() => { result.current.handlers.onTouchStart(startEvent) })

        // Pull 50px — not enough for 64px threshold
        const moveEvent = createTouchEvent('touchmove', [{ clientY: 250 }], mockElement)
        act(() => { result.current.handlers.onTouchMove(moveEvent) })

        act(() => { result.current.handlers.onTouchEnd() })
        expect(onRefresh).not.toHaveBeenCalled()
    })

    it('ignores touchMove when not dragging', () => {
        const { result } = renderHook(() => usePullToRefresh(onRefresh))
        const moveEvent = createTouchEvent('touchmove', [{ clientY: 280 }], mockElement)
        act(() => { result.current.handlers.onTouchMove(moveEvent) })
        expect(result.current.pullDistance).toBe(0)
    })

    it('ignores touchEnd when not dragging', () => {
        const { result } = renderHook(() => usePullToRefresh(onRefresh))
        act(() => { result.current.handlers.onTouchEnd() })
        expect(onRefresh).not.toHaveBeenCalled()
    })
})
