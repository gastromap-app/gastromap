import { useState, useEffect } from 'react'

/**
 * useDebounce — delays updating a value until after the given delay.
 *
 * @template T
 * @param {T} value  - The value to debounce
 * @param {number} delay - Delay in milliseconds (default 300ms)
 * @returns {T} debounced value
 *
 * @example
 * const debouncedQuery = useDebounce(searchInput, 300)
 * useEffect(() => { search(debouncedQuery) }, [debouncedQuery])
 */
export function useDebounce(value, delay = 300) {
    const [debouncedValue, setDebouncedValue] = useState(value)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])

    return debouncedValue
}
