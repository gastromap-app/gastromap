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
        // Only activate if window is at the very top
        if (window.scrollY > 0) return
        
        startY.current = e.touches[0].clientY
        isDragging.current = true
    }, [])

    const onTouchMove = useCallback((e) => {
        if (!isDragging.current || startY.current === null) return
        
        // If user scrolled down during the move, cancel the pull
        if (window.scrollY > 0) {
            isDragging.current = false
            setPullDistance(0)
            return
        }

        const delta = e.touches[0].clientY - startY.current
        
        // Only trigger if pulling DOWN (delta > 0) and we are at the top
        if (delta > 5) { // Added 5px deadzone to avoid jitter
            // Rubber-band easing: resistance increases as you pull more
            const distance = Math.min(delta * 0.4, threshold * 1.5)
            setPullDistance(distance)
        } else if (delta < 0) {
            // If swiping UP, cancel pull immediately
            isDragging.current = false
            setPullDistance(0)
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
