/**
 * Date formatting utilities
 */

/**
 * Format a date as relative time (e.g., "5 minutes ago")
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDistanceToNow(date) {
    const now = new Date()
    const then = new Date(date)

    if (isNaN(then.getTime())) {
        return 'unknown'
    }

    const diffMs = now - then
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)
    const diffWeek = Math.floor(diffDay / 7)
    const diffMonth = Math.floor(diffDay / 30)
    const diffYear = Math.floor(diffDay / 365)

    if (diffSec < 60) {
        return 'just now'
    } else if (diffMin < 60) {
        return `${diffMin}m ago`
    } else if (diffHour < 24) {
        return `${diffHour}h ago`
    } else if (diffDay < 7) {
        return `${diffDay}d ago`
    } else if (diffWeek < 4) {
        return `${diffWeek}w ago`
    } else if (diffMonth < 12) {
        return `${diffMonth}mo ago`
    } else {
        return `${diffYear}y ago`
    }
}

/**
 * Format a date as a short date string
 * @param {Date|string} date
 * @returns {string}
 */
export function formatShortDate(date) {
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''

    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    })
}

/**
 * Format a date with time
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDateTime(date) {
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''

    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}
