/**
 * Nominatim (OpenStreetMap) geocoding utilities.
 * Free, no API key. Rate limit: ≤1 req/s — always debounce calls.
 *
 * Usage:
 *   import { searchPlaces, searchCities, searchAddresses } from './useNominatim'
 */

const BASE = 'https://nominatim.openstreetmap.org'
const COMMON_HEADERS = {
    'User-Agent': 'GastroMap/1.0 (contact@gastromap.app)',
    'Accept-Language': 'en',
}

/** Extract a clean city name from a Nominatim address object. */
function extractCity(addr) {
    return addr.city || addr.town || addr.village || addr.municipality || addr.county || ''
}

/** Extract a clean street address from a Nominatim address object. */
function extractStreet(addr) {
    return [addr.house_number, addr.road].filter(Boolean).join(' ')
}

/**
 * Search for places (restaurants, cafes, etc.) by name.
 * Returns up to 7 results with auto-parsed address components.
 *
 * @param {string} query — min 2 chars
 * @returns {Promise<Array>}
 */
export async function searchPlaces(query) {
    if (!query || query.trim().length < 2) return []
    const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '7',
        dedupe: '1',
    })
    try {
        const res = await fetch(`${BASE}/search?${params}`, { headers: COMMON_HEADERS })
        if (!res.ok) return []
        const data = await res.json()
        return data.map((r) => ({
            id:           r.place_id,
            name:         r.name || r.display_name.split(',')[0].trim(),
            displayName:  r.display_name,
            country:      r.address?.country      || '',
            countryCode:  (r.address?.country_code || '').toUpperCase(),
            city:         extractCity(r.address || {}),
            street:       extractStreet(r.address || {}),
            lat:          r.lat,
            lon:          r.lon,
        }))
    } catch {
        return []
    }
}

/**
 * Search for cities/towns within a country.
 *
 * @param {string} query — min 2 chars
 * @param {string} countryCode — ISO-2 (e.g. 'PL', 'US'), empty = global
 * @returns {Promise<Array<{id, name, displayName}>>}
 */
export async function searchCities(query, countryCode = '') {
    if (!query || query.trim().length < 2) return []
    const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '6',
        featuretype: 'city',
    })
    if (countryCode) params.set('countrycodes', countryCode.toLowerCase())
    try {
        const res = await fetch(`${BASE}/search?${params}`, { headers: COMMON_HEADERS })
        if (!res.ok) return []
        const data = await res.json()
        return data
            .map((r) => ({
                id:          r.place_id,
                name:        extractCity(r.address || {}) || r.name || '',
                displayName: r.display_name,
            }))
            .filter((r) => r.name)
    } catch {
        return []
    }
}

/**
 * Search for street addresses within a city/country.
 * Min 3 chars in query to start searching.
 *
 * @param {string} query — street + house number
 * @param {string} city
 * @param {string} countryCode — ISO-2
 * @returns {Promise<Array<{id, street, displayName}>>}
 */
export async function searchAddresses(query, city = '', countryCode = '') {
    if (!query || query.trim().length < 3) return []
    const q = [query, city].filter(Boolean).join(', ')
    const params = new URLSearchParams({
        q,
        format: 'json',
        addressdetails: '1',
        limit: '6',
    })
    if (countryCode) params.set('countrycodes', countryCode.toLowerCase())
    try {
        const res = await fetch(`${BASE}/search?${params}`, { headers: COMMON_HEADERS })
        if (!res.ok) return []
        const data = await res.json()
        return data
            .map((r) => ({
                id:          r.place_id,
                street:      extractStreet(r.address || '') || r.display_name.split(',')[0].trim(),
                displayName: r.display_name,
            }))
            .filter((r) => r.street)
    } catch {
        return []
    }
}
