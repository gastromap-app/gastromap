import { useState, useRef, useCallback } from 'react'

/**
 * usePullToRefresh — native-feel pull-to-refresh hook.
 * Returns { pullDistance, isRefreshing, handlers } to attach to a scroll container.
 * Triggers onRefresh when pull > threshold.
 */
export function usePullToRefresh(onRefresh, { threshold = 64 } = {}) {
    const [pullDistance, setPullDistance] = useState(0)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const startY = useRef(null)
    const isDragging = useRef(false)

    const onTouchStart = useCallback((e) => {
        // Only activate if scrolled to top
        const el = e.currentTarget
        if (el.scrollTop > 0) return
        startY.current = e.touches[0].clientY
        isDragging.current = true
    }, [])

    const onTouchMove = useCallback((e) => {
        if (!isDragging.current || startY.current === null) return
        const el = e.currentTarget
        if (el.scrollTop > 0) { isDragging.current = false; return }
        const delta = e.touches[0].clientY - startY.current
        if (delta > 0) {
            // Rubber-band easing: resistance increases as you pull more
            const distance = Math.min(delta * 0.45, threshold * 1.5)
            setPullDistance(distance)
        }
    }, [threshold])

    const onTouchEnd = useCallback(async () => {
        if (!isDragging.current) return
        isDragging.current = false
        startY.current = null
        if (pullDistance >= threshold) {
            setIsRefreshing(true)
            setPullDistance(0)
            try { await onRefresh() } finally { setIsRefreshing(false) }
        } else {
            setPullDistance(0)
        }
    }, [pullDistance, threshold, onRefresh])

    return {
        pullDistance,
        isRefreshing,
        progress: Math.min(pullDistance / threshold, 1),
        handlers: { onTouchStart, onTouchMove, onTouchEnd },
    }
}
