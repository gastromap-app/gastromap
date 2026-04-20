import { renderHook, act } from '@testing-library/react'
import { useDebounce } from './useDebounce'

describe('useDebounce', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('hello', 500))
        expect(result.current).toBe('hello')
    })

    it('delays updating the value until after the specified delay', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 300 } }
        )

        rerender({ value: 'updated', delay: 300 })
        expect(result.current).toBe('initial')

        act(() => { vi.advanceTimersByTime(299) })
        expect(result.current).toBe('initial')

        act(() => { vi.advanceTimersByTime(1) })
        expect(result.current).toBe('updated')
    })

    it('uses default delay of 300ms when not specified', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value),
            { initialProps: { value: 'a' } }
        )

        rerender({ value: 'b' })
        expect(result.current).toBe('a')

        act(() => { vi.advanceTimersByTime(299) })
        expect(result.current).toBe('a')

        act(() => { vi.advanceTimersByTime(1) })
        expect(result.current).toBe('b')
    })

    it('cancels previous timer when value changes rapidly', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 300),
            { initialProps: { value: 'first' } }
        )

        rerender({ value: 'second' })
        act(() => { vi.advanceTimersByTime(150) })

        rerender({ value: 'third' })
        act(() => { vi.advanceTimersByTime(150) })
        expect(result.current).toBe('first') // first timer was cancelled

        act(() => { vi.advanceTimersByTime(150) })
        expect(result.current).toBe('third')
    })

    it('cleans up timer on unmount', () => {
        const { unmount, rerender } = renderHook(
            ({ value }) => useDebounce(value, 300),
            { initialProps: { value: 'a' } }
        )

        rerender({ value: 'b' })
        unmount()

        // Should not throw or cause issues
        act(() => { vi.advanceTimersByTime(500) })
    })

    it('works with different value types (number, object, null)', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value, 100),
            { initialProps: { value: 0 } }
        )

        expect(result.current).toBe(0)

        rerender({ value: 42 })
        act(() => { vi.advanceTimersByTime(100) })
        expect(result.current).toBe(42)

        rerender({ value: null })
        act(() => { vi.advanceTimersByTime(100) })
        expect(result.current).toBeNull()

        const obj = { name: 'test' }
        rerender({ value: obj })
        act(() => { vi.advanceTimersByTime(100) })
        expect(result.current).toEqual(obj)
    })

    it('respects delay changes', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'a', delay: 300 } }
        )

        rerender({ value: 'b', delay: 100 })

        act(() => { vi.advanceTimersByTime(100) })
        expect(result.current).toBe('b')
    })
})
