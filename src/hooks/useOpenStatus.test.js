import { renderHook, act } from '@testing-library/react'
import { useOpenStatus } from './useOpenStatus'

// Helper: create a Date at a specific hour:minute today
function dateAt(hour, minute = 0) {
    const d = new Date()
    d.setHours(hour, minute, 0, 0)
    return d
}

describe('useOpenStatus', () => {
    let realDate

    beforeEach(() => {
        realDate = Date
    })

    afterEach(() => {
        Date = realDate
    })

    function mockDateAt(hour, minute = 0) {
        const fixed = dateAt(hour, minute)
        Date = class extends realDate {
            constructor(...args) {
                if (args.length === 0) return new realDate(fixed.getTime())
                return new realDate(...args)
            }
            static now() { return fixed.getTime() }
        }
    }

    it('returns null-ish values when openingHours is null/empty', () => {
        const { result } = renderHook(() => useOpenStatus(null))
        expect(result.current.isOpen).toBeNull()
        expect(result.current.label).toBe('')
        expect(result.current.color).toBe('')
        expect(result.current.minutesUntilClose).toBeNull()
    })

    it('returns null-ish values when openingHours is empty string', () => {
        const { result } = renderHook(() => useOpenStatus(''))
        expect(result.current.isOpen).toBeNull()
    })

    it('returns null-ish values when openingHours format is unrecognized', () => {
        const { result } = renderHook(() => useOpenStatus('all day'))
        expect(result.current.isOpen).toBeNull()
    })

    it('reports "Open now" during business hours', () => {
        // 09:00 - 23:00, and it's currently 12:00
        mockDateAt(12, 0)
        const { result } = renderHook(() => useOpenStatus('09:00 - 23:00'))
        expect(result.current.isOpen).toBe(true)
        expect(result.current.label).toBe('Open now')
        expect(result.current.color).toBe('text-emerald-500')
        expect(result.current.minutesUntilClose).toBe(11 * 60) // 660 minutes
    })

    it('reports "Closed" outside business hours', () => {
        // 09:00 - 23:00, and it's currently 23:30
        mockDateAt(23, 30)
        const { result } = renderHook(() => useOpenStatus('09:00 - 23:00'))
        expect(result.current.isOpen).toBe(false)
        expect(result.current.label).toBe('Closed')
        expect(result.current.color).toBe('text-red-400')
    })

    it('reports "Closed" before opening hours', () => {
        // 09:00 - 23:00, and it's currently 08:30
        mockDateAt(8, 30)
        const { result } = renderHook(() => useOpenStatus('09:00 - 23:00'))
        expect(result.current.isOpen).toBe(false)
        expect(result.current.label).toBe('Closed')
    })

    it('handles overnight hours (e.g. 18:00 - 02:00) — open at midnight', () => {
        // 18:00 - 02:00, and it's currently 00:30
        mockDateAt(0, 30)
        const { result } = renderHook(() => useOpenStatus('18:00 - 02:00'))
        expect(result.current.isOpen).toBe(true)
        expect(result.current.label).toBe('Open now')
    })

    it('handles overnight hours — open at 19:00', () => {
        mockDateAt(19, 0)
        const { result } = renderHook(() => useOpenStatus('18:00 - 02:00'))
        expect(result.current.isOpen).toBe(true)
    })

    it('handles overnight hours — closed at 03:00', () => {
        mockDateAt(3, 0)
        const { result } = renderHook(() => useOpenStatus('18:00 - 02:00'))
        expect(result.current.isOpen).toBe(false)
    })

    it('reports "Closing soon" when <=60 minutes until close', () => {
        // 09:00 - 23:00, and it's currently 22:30 — 30 min until close
        mockDateAt(22, 30)
        const { result } = renderHook(() => useOpenStatus('09:00 - 23:00'))
        expect(result.current.isOpen).toBe(true)
        expect(result.current.label).toBe('Closing soon')
        expect(result.current.color).toBe('text-amber-500')
        expect(result.current.minutesUntilClose).toBe(30)
    })

    it('reports "Closing soon" when exactly 60 minutes until close', () => {
        mockDateAt(22, 0)
        const { result } = renderHook(() => useOpenStatus('09:00 - 23:00'))
        expect(result.current.label).toBe('Closing soon')
        expect(result.current.minutesUntilClose).toBe(60)
    })

    it('does NOT report "Closing soon" when 61 minutes until close', () => {
        mockDateAt(21, 59)
        const { result } = renderHook(() => useOpenStatus('09:00 - 23:00'))
        expect(result.current.label).toBe('Open now')
    })

    it('computes minutesUntilClose for overnight hours when after midnight', () => {
        // 18:00 - 02:00, and it's currently 01:00 — 60 min until close
        mockDateAt(1, 0)
        const { result } = renderHook(() => useOpenStatus('18:00 - 02:00'))
        expect(result.current.isOpen).toBe(true)
        expect(result.current.minutesUntilClose).toBe(60)
    })

    it('computes minutesUntilClose for overnight hours when before midnight', () => {
        // 18:00 - 02:00, and it's currently 20:00
        mockDateAt(20, 0)
        const { result } = renderHook(() => useOpenStatus('18:00 - 02:00'))
        expect(result.current.isOpen).toBe(true)
        // 24*60 - 20*60 + 2*60 = 1440 - 1200 + 120 = 360 min
        expect(result.current.minutesUntilClose).toBe(360)
    })

    it('handles en-dash separator (–)', () => {
        mockDateAt(12, 0)
        const { result } = renderHook(() => useOpenStatus('09:00 – 23:00'))
        expect(result.current.isOpen).toBe(true)
    })

    it('memoizes result for same openingHours value', () => {
        mockDateAt(12, 0)
        const { result, rerender } = renderHook(
            ({ hours }) => useOpenStatus(hours),
            { initialProps: { hours: '09:00 - 23:00' } }
        )
        const first = result.current
        rerender({ hours: '09:00 - 23:00' })
        // Same reference due to useMemo
        expect(result.current).toBe(first)
    })
})
