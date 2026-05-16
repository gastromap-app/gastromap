/**
 * Format a location count for display on country cards.
 * 
 * Rules:
 * - Exact count for values < 100
 * - "100+" for 100-199
 * - "200+" for 200-299
 * - "300+" for 300-399, etc.
 * 
 * City cards always show exact counts (they use a separate query).
 * 
 * @param {number} count - Raw location count
 * @param {boolean} [exact=false] - If true, always show exact number (for city cards)
 * @returns {string} Formatted count string
 */
export function formatLocationCount(count, exact = false) {
    if (exact || count < 100) return String(count)
    const base = Math.floor(count / 100) * 100
    return `${base}+`
}
