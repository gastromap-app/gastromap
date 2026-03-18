import { useMemo } from 'react'

/**
 * useOpenStatus — determines if a venue is currently open.
 *
 * Parses openingHours strings like "09:00 - 23:00" or "10:00 - 02:00"
 * (handles overnight periods where close < open).
 *
 * @param {string} openingHours  - e.g. "09:00 - 23:00"
 * @returns {{
 *   isOpen: boolean,
 *   label: string,            - "Open" | "Closed" | "Closing soon"
 *   color: string,            - Tailwind text color class
 *   minutesUntilClose: number | null,
 * }}
 */
export function useOpenStatus(openingHours) {
    return useMemo(() => {
        if (!openingHours) return { isOpen: null, label: '', color: '', minutesUntilClose: null }

        const match = openingHours.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/)
        if (!match) return { isOpen: null, label: '', color: '', minutesUntilClose: null }

        const [, openH, openM, closeH, closeM] = match.map(Number)

        const now = new Date()
        const currentMinutes = now.getHours() * 60 + now.getMinutes()
        const openMinutes = openH * 60 + openM
        const closeMinutes = closeH * 60 + closeM

        let isOpen
        let minutesUntilClose = null

        // Handle overnight: e.g. 18:00 - 02:00
        if (closeMinutes < openMinutes) {
            isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes
            if (isOpen) {
                minutesUntilClose =
                    currentMinutes >= openMinutes
                        ? 24 * 60 - currentMinutes + closeMinutes
                        : closeMinutes - currentMinutes
            }
        } else {
            isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes
            if (isOpen) minutesUntilClose = closeMinutes - currentMinutes
        }

        const closingSoon = isOpen && minutesUntilClose != null && minutesUntilClose <= 60

        return {
            isOpen,
            label: closingSoon ? 'Closing soon' : isOpen ? 'Open now' : 'Closed',
            color: closingSoon
                ? 'text-amber-500'
                : isOpen
                ? 'text-emerald-500'
                : 'text-red-400',
            minutesUntilClose,
        }
    }, [openingHours])
}
