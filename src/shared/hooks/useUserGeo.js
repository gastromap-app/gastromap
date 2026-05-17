/**
 * useUserGeo — Requests browser geolocation once and reverse-geocodes it.
 *
 * Uses the browser Geolocation API + OpenStreetMap Nominatim for reverse geocoding
 * (free, no API key required). Results are stored in useGeoStore so any component
 * in the app can access the user's city without re-requesting.
 *
 * Usage:
 *   const { city, status, requestGeo } = useUserGeo()
 *
 *   // Auto-request on mount (optional):
 *   const { city } = useUserGeo({ autoRequest: true })
 */
import { useCallback, useEffect, useState } from 'react'
import { useGeoStore } from '@/shared/store/useGeoStore'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { trackUserLocation } from '@/shared/api/user.api'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
const IP_API_URLS = [
    'https://ipapi.co/json/',
    'https://ip-api.com/json/?fields=status,city,country,lat,lon,regionName',
]

/**
 * Reverse geocode lat/lng to a human-readable location using Nominatim.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{city: string, country: string, address: string}>}
 */
async function reverseGeocode(lat, lng) {
    const email = 'support@gastromap.app' // Contact email for Nominatim policy
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&accept-language=en&email=${encodeURIComponent(email)}`
    const res = await fetch(url, {
        headers: { 'User-Agent': 'GastroMapApp/1.0 (https://gastromap.app)' },
    })
    if (!res.ok) throw new Error('Nominatim request failed')
    const data = await res.json()

    const a = data.address || {}
    // Nominatim address hierarchy: city → town → village → municipality
    const city =
        a.city || a.town || a.village || a.municipality || a.county || 'Unknown'
    const country = a.country || ''
    const address = data.display_name || `${city}, ${country}`

    return { city, country, address }
}

/**
 * Fallback geolocation using IP address (free, no API key).
 * Tries multiple providers in order — handles rate limits gracefully.
 * @returns {Promise<{lat: number, lng: number, city: string, country: string, address: string}>}
 */
async function fetchGeoByIP() {
    // Provider 1: ipapi.co (1000 req/day free)
    try {
        const res = await fetch(IP_API_URLS[0], {
            headers: { 'User-Agent': 'GastroMapApp/1.0' },
        })
        if (res.ok) {
            const data = await res.json()
            if (data.latitude && data.longitude) {
                const city = data.city || data.region || 'Unknown'
                const country = data.country_name || ''
                return { lat: data.latitude, lng: data.longitude, city, country, address: `${city}, ${country}` }
            }
        }
    } catch { /* try next provider */ }

    // Provider 2: ip-api.com (45 req/min free, no HTTPS on free — use HTTP)
    try {
        const res = await fetch(IP_API_URLS[1])
        if (res.ok) {
            const data = await res.json()
            if (data.status === 'success' && data.lat && data.lon) {
                const city = data.city || data.regionName || 'Unknown'
                const country = data.country || ''
                return { lat: data.lat, lng: data.lon, city, country, address: `${city}, ${country}` }
            }
        }
    } catch { /* all providers failed */ }

    throw new Error('All IP geolocation providers failed or rate-limited')
}

/**
 * @param {{ autoRequest?: boolean }} [options]
 */
export function useUserGeo({ autoRequest = false } = {}) {
    const lat = useGeoStore(state => state.lat)
    const lng = useGeoStore(state => state.lng)
    const city = useGeoStore(state => state.city)
    const country = useGeoStore(state => state.country)
    const address = useGeoStore(state => state.address)
    const status = useGeoStore(state => state.status)
    const error = useGeoStore(state => state.error)
    const setCoords = useGeoStore(state => state.setCoords)
    const setLocation = useGeoStore(state => state.setLocation)
    const setStatus = useGeoStore(state => state.setStatus)
    const setError = useGeoStore(state => state.setError)
    const setVisitData = useGeoStore(state => state.setVisitData)
    const { user } = useAuthStore()
    const [source, setSource] = useState(null) // 'gps' | 'ip' | null

    const requestGeo = useCallback(async () => {
        if (status === 'loading' || status === 'granted') return

        setStatus('loading')

        // Helper to finalize location and track history
        const finalizeLocation = async (latitude, longitude, location) => {
            setCoords(latitude, longitude)
            setLocation({ ...location, lat: latitude, lng: longitude })
            setStatus('granted')

            if (user?.id && location.city && location.city !== 'Unknown') {
                try {
                    const data = await trackUserLocation(user.id, location.city, location.country)
                    if (data) {
                        setVisitData({
                            visitCount: data.visit_count,
                            lastVisitedAt: data.last_visited_at,
                        })
                    }
                } catch {
                    // Silently ignore tracking errors — they shouldn't break UX
                }
            }
        }

        // Try browser geolocation first
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords
                    // Treat non-finite coordinates as unavailable — trigger IP fallback
                    if (!isFinite(latitude) || !isFinite(longitude)) {
                        try {
                            const ipGeo = await fetchGeoByIP()
                            setSource('ip')
                            await finalizeLocation(ipGeo.lat, ipGeo.lng, {
                                city: ipGeo.city,
                                country: ipGeo.country,
                                address: ipGeo.address,
                            })
                        } catch {
                            const msg = 'Unable to determine your location. Please check your connection or enable location access.'
                            setError(msg)
                            setStatus('denied')
                        }
                        return
                    }
                    try {
                        const location = await reverseGeocode(latitude, longitude)
                        setSource('gps')
                        await finalizeLocation(latitude, longitude, location)
                    } catch {
                        // Reverse geocoding failed but coords are valid
                        setSource('gps')
                        await finalizeLocation(latitude, longitude, {
                            city: 'Unknown',
                            country: null,
                            address: 'Near your current position',
                        })
                    }
                },
                async (_err) => {
                    // Browser geolocation failed — try IP fallback
                    try {
                        const ipGeo = await fetchGeoByIP()
                        setSource('ip')
                        await finalizeLocation(ipGeo.lat, ipGeo.lng, {
                            city: ipGeo.city,
                            country: ipGeo.country,
                            address: ipGeo.address,
                        })
                    } catch {
                        const msg = 'Unable to determine your location. Please check your connection or enable location access.'
                        setError(msg)
                        setStatus('denied')
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0,
                }
            )
        } else {
            // No browser geolocation support — try IP fallback immediately
            try {
                const ipGeo = await fetchGeoByIP()
                setSource('ip')
                await finalizeLocation(ipGeo.lat, ipGeo.lng, {
                    city: ipGeo.city,
                    country: ipGeo.country,
                    address: ipGeo.address,
                })
            } catch {
                setError('Geolocation is not supported by this browser')
                setStatus('denied')
            }
        }
    }, [status, setCoords, setLocation, setStatus, setError, user, setVisitData])

    // Auto-request on mount if enabled
    useEffect(() => {
        if (autoRequest && status === 'idle') {
            requestGeo()
        }
    }, [autoRequest, status, requestGeo])

    return {
        lat,
        lng,
        city,
        country,
        address,
        status,
        error,
        source,
        isLoading: status === 'loading',
        isGranted: status === 'granted',
        isDenied: status === 'denied',
        requestGeo,
    }
}
