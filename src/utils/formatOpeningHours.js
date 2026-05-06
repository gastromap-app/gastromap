/**
 * formatOpeningHours — normalizes opening hours to a unified display format.
 *
 * Accepts:
 *   - JSON string: '{"monday":"08:00-18:00","tuesday":"08:00-18:00",...}'
 *   - JSON object: { monday: "08:00-18:00", tuesday: "08:00-18:00", ... }
 *   - Simple string: "09:00 - 23:00" (same hours every day)
 *   - Day-range string: "Mon-Fri: 10:00-22:00, Sat-Sun: 11:00-23:00"
 *
 * Returns:
 *   - "08:00 – 18:00" (if same every day)
 *   - "Today: 08:00 – 18:00" (current day hours)
 *   - "Mon–Fri: 08:00 – 18:00 · Sat–Sun: 09:00 – 18:00" (if grouped)
 *   - "" (if invalid/missing)
 */

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
}

/**
 * Parse any format into normalized { day: "HH:MM-HH:MM" } map
 */
function parseHours(input) {
    if (!input) return null

    // Already an object
    if (typeof input === 'object') {
        const result = {}
        for (const [key, value] of Object.entries(input)) {
            const day = key.toLowerCase()
            if (DAYS_ORDER.includes(day) && value) {
                result[day] = normalizeTimeRange(value)
            }
        }
        return Object.keys(result).length > 0 ? result : null
    }

    // JSON string
    if (input.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(input)
            return parseHours(parsed)
        } catch {
            return null
        }
    }

    // Simple string: "09:00 - 23:00"
    const simple = input.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/)
    if (simple) {
        const range = `${normalizeTime(simple[1])}-${normalizeTime(simple[2])}`
        // Apply to all days
        const result = {}
        DAYS_ORDER.forEach(d => { result[d] = range })
        return result
    }

    return null
}

/**
 * Normalize time string to HH:MM format
 * "8:00" → "08:00", "08:00" → "08:00"
 */
function normalizeTime(time) {
    const match = time.match(/(\d{1,2}):(\d{2})/)
    if (!match) return time
    const [, h, m] = match
    return `${h.padStart(2, '0')}:${m}`
}

/**
 * Normalize time range to "HH:MM-HH:MM"
 * "8:00-18:00" → "08:00-18:00", "08:00 - 18:00" → "08:00-18:00"
 */
function normalizeTimeRange(range) {
    const match = range.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/)
    if (!match) return range
    return `${normalizeTime(match[1])}-${normalizeTime(match[2])}`
}

/**
 * Format time range for display: "08:00-18:00" → "08:00 – 18:00"
 */
function formatTimeRange(range) {
    const match = range.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/)
    if (!match) return range
    return `${match[1]} – ${match[2]}`
}

/**
 * Group consecutive days with same hours
 * Returns array of { days: string[], hours: string }
 */
function groupDays(hoursMap) {
    const groups = []
    let currentGroup = { days: [], hours: null }

    for (const day of DAYS_ORDER) {
        const hours = hoursMap[day]
        if (!hours) continue

        if (hours === currentGroup.hours) {
            currentGroup.days.push(day)
        } else {
            if (currentGroup.days.length > 0) {
                groups.push({ ...currentGroup })
            }
            currentGroup = { days: [day], hours }
        }
    }

    if (currentGroup.days.length > 0) {
        groups.push(currentGroup)
    }

    return groups
}

/**
 * Format day range: ["monday", "tuesday", "wednesday"] → "Mon–Wed"
 */
function formatDayRange(days) {
    if (days.length === 1) return DAY_LABELS[days[0]]
    if (days.length === 2) return `${DAY_LABELS[days[0]]}, ${DAY_LABELS[days[1]]}`
    return `${DAY_LABELS[days[0]]}–${DAY_LABELS[days[days.length - 1]]}`
}

/**
 * Get today's day key (lowercase)
 */
function getTodayKey() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    return days[new Date().getDay()]
}

/**
 * Main export — format opening hours for display
 *
 * @param {string|object} input - opening hours in any format
 * @param {object} options
 * @param {boolean} options.showToday - show "Today:" prefix (default: true)
 * @param {boolean} options.compact - use compact format (default: false)
 * @returns {string} formatted hours string
 */
export function formatOpeningHours(input, options = {}) {
    const { showToday = true, compact = false } = options

    const hoursMap = parseHours(input)
    if (!hoursMap) return ''

    // Check if all days are the same
    const uniqueHours = new Set(Object.values(hoursMap))
    if (uniqueHours.size === 1) {
        return formatTimeRange(Object.values(hoursMap)[0])
    }

    // Get today's hours
    const today = getTodayKey()
    const todayHours = hoursMap[today]

    if (compact) {
        return todayHours ? formatTimeRange(todayHours) : ''
    }

    // Group days
    const groups = groupDays(hoursMap)

    if (groups.length === 1) {
        // All same (shouldn't reach here, but safety)
        return formatTimeRange(groups[0].hours)
    }

    if (groups.length === 2) {
        // Simple split: weekdays + weekend
        const parts = groups.map(g => `${formatDayRange(g.days)}: ${formatTimeRange(g.hours)}`)
        return parts.join(' · ')
    }

    // Show today's hours with prefix
    if (showToday && todayHours) {
        return `Today: ${formatTimeRange(todayHours)}`
    }

    // Fallback: show first group
    return formatTimeRange(groups[0]?.hours || '')
}

/**
 * Get hours for a specific day
 *
 * @param {string|object} input - opening hours
 * @param {string} day - day key (e.g., "monday")
 * @returns {string|null} formatted hours for that day, or null
 */
export function getHoursForDay(input, day) {
    const hoursMap = parseHours(input)
    if (!hoursMap || !hoursMap[day]) return null
    return formatTimeRange(hoursMap[day])
}

/**
 * Check if a place is currently open (for use in open-now logic)
 *
 * @param {string|object} input - opening hours
 * @returns {{ isOpen: boolean, todayHours: string|null, closeTime: string|null }}
 */
export function isCurrentlyOpen(input) {
    const hoursMap = parseHours(input)
    if (!hoursMap) return { isOpen: null, todayHours: null, closeTime: null }

    const today = getTodayKey()
    const todayHours = hoursMap[today]
    if (!todayHours) return { isOpen: null, todayHours: null, closeTime: null }

    const match = todayHours.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/)
    if (!match) return { isOpen: null, todayHours: formatTimeRange(todayHours), closeTime: null }

    const [, openH, openM, closeH, closeM] = match.map(Number)
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const openMinutes = openH * 60 + openM
    const closeMinutes = closeH * 60 + openM

    let isOpen
    if (closeMinutes < openMinutes) {
        // Overnight
        isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes
    } else {
        isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes
    }

    return {
        isOpen,
        todayHours: formatTimeRange(todayHours),
        closeTime: `${String(closeH).padStart(2, '0')}:${String(closeM).padStart(2, '0')}`
    }
}

export default formatOpeningHours
