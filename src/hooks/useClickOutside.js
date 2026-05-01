import { useEffect } from 'react'

/**
 * useClickOutside — close dropdowns/popovers when clicking outside a ref.
 *
 * @param {React.RefObject<HTMLElement>} ref
 * @param {() => void} callback
 * @param {boolean} [enabled=true]
 */
export function useClickOutside(ref, callback, enabled = true) {
    useEffect(() => {
        if (!enabled) return

        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                callback()
            }
        }

        document.addEventListener('mousedown', handler)
        document.addEventListener('touchstart', handler)
        return () => {
            document.removeEventListener('mousedown', handler)
            document.removeEventListener('touchstart', handler)
        }
    }, [ref, callback, enabled])
}
