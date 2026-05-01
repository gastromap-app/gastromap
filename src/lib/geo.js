/**
 * Geo utilities — single source of truth for distance calculations
 * and location-related helpers across the entire app.
 */

const EARTH_RADIUS_KM = 6371
const EARTH_RADIUS_M = 6371e3

/**
 * Calculate distance between two lat/lng points using the Haversine formula.
 *
 * @param {number|string} lat1
 * @param {number|string} lon1
 * @param {number|string} lat2
 * @param {number|string} lon2
 * @param {'km'|'m'} [unit='km'] — 'km' or 'm'
 * @returns {number} Distance in the requested unit, or Infinity if inputs invalid
 */
export function calculateDistance(lat1, lon1, lat2, lon2, unit = 'km') {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
        return Infinity
    }

    // Handle European decimal commas
    const nLat1 = Number(String(lat1).replace(',', '.'))
    const nLon1 = Number(String(lon1).replace(',', '.'))
    const nLat2 = Number(String(lat2).replace(',', '.'))
    const nLon2 = Number(String(lon2).replace(',', '.'))

    if (Number.isNaN(nLat1) || Number.isNaN(nLon1) || Number.isNaN(nLat2) || Number.isNaN(nLon2)) {
        return Infinity
    }

    const R = unit === 'm' ? EARTH_RADIUS_M : EARTH_RADIUS_KM
    const dLat = (nLat2 - nLat1) * (Math.PI / 180)
    const dLon = (nLon2 - nLon1) * (Math.PI / 180)
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(nLat1 * (Math.PI / 180)) *
            Math.cos(nLat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

/**
 * Format a distance for display.
 * < 1 km → "240 m"
 * >= 1 km → "1.2 km"
 *
 * @param {number} distanceKm
 * @returns {string}
 */
export function formatDistance(distanceKm) {
    if (distanceKm == null || !Number.isFinite(distanceKm)) return ''
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m`
    }
    return `${distanceKm.toFixed(1)} km`
}

/**
 * Quick check whether a city name looks valid (not a placeholder or empty).
 *
 * @param {string|null} city
 * @returns {boolean}
 */
export function isValidCity(city) {
    return typeof city === 'string' && city.trim() !== '' && city !== 'Unknown'
}
