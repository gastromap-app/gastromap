import { useMemo } from 'react'
import { isCurrentlyOpen } from '@/utils/formatOpeningHours'

/**
 * useOpenStatus — determines if a venue is currently open.
 *
 * Supports:
 *   - Simple string: "09:00 - 23:00"
 *   - JSON: { monday: "08:00-18:00", tuesday: "08:00-18:00", ... }
 *   - JSON string: '{"monday":"08:00-18:00",...}'
 *
 * @param {string|object} openingHours
 * @returns {{
 *   isOpen: boolean,
 *   label: string,            - "Open now" | "Closed" | "Closing soon"
 *   color: string,            - Tailwind text color class
 *   hoursText: string,        - Formatted hours for today
 *   minutesUntilClose: number | null,
 * }}
 */
export function useOpenStatus(openingHours) {
    return useMemo(() => {
        if (!openingHours) {
            return { isOpen: null, label: '', color: '', hoursText: '', minutesUntilClose: null }
        }

        const { isOpen, todayHours, closeTime } = isCurrentlyOpen(openingHours)

        if (isOpen === null) {
            // Couldn't parse — return empty
            return { isOpen: null, label: '', color: '', hoursText: '', minutesUntilClose: null }
        }

        // Calculate minutes until close
        let minutesUntilClose = null
        if (isOpen && closeTime) {
            const now = new Date()
            const [closeH, closeM] = closeTime.split(':').map(Number)
            const closeMinutes = closeH * 60 + closeM
            const currentMinutes = now.getHours() * 60 + now.getMinutes()
            minutesUntilClose = closeMinutes > currentMinutes
                ? closeMinutes - currentMinutes
                : 24 * 60 - currentMinutes + closeMinutes
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
            hoursText: todayHours || '',
            minutesUntilClose,
        }
    }, [openingHours])
}
