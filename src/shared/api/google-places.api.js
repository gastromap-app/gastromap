/**
 * Google Places API client (via Vercel Proxy)
 */

const PROXY_BASE = '/api/places/autocomplete'

/**
 * Fetch autocomplete suggestions from Google Places
 * @param {string} query Search input
 * @param {string} [sessionToken] Optional session token for billing optimization
 */
export async function fetchPlacesSuggestions(query, sessionToken) {
    if (!query || query.length < 2) return []

    try {
        const url = new URL(PROXY_BASE, window.location.origin)
        url.searchParams.set('q', query)
        if (sessionToken) url.searchParams.set('sessiontoken', sessionToken)

        const res = await fetch(url.toString())
        if (!res.ok) throw new Error(`Status: ${res.status}`)
        
        const data = await res.json()
        return (data.predictions || []).map(p => ({
            id: p.place_id,
            name: p.main_text,
            description: p.description,
            secondaryText: p.secondary_text,
            source: 'google'
        }))
    } catch (err) {
        console.error('[google-places] Autocomplete error:', err)
        return []
    }
}

/**
 * Fetch full place details from Google Places
 * @param {string} placeId Google Place ID
 * @param {string} [sessionToken] Optional session token
 */
export async function fetchPlaceDetails(placeId, sessionToken) {
    if (!placeId) return null

    try {
        const url = new URL(PROXY_BASE, window.location.origin)
        url.searchParams.set('place_id', placeId)
        if (sessionToken) url.searchParams.set('sessiontoken', sessionToken)

        const res = await fetch(url.toString())
        if (!res.ok) throw new Error(`Status: ${res.status}`)

        const data = await res.json()
        return data.result || null
    } catch (err) {
        console.error('[google-places] Details error:', err)
        return null
    }
}
