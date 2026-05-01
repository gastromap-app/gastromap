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
import { useCallback, useEffect } from 'react'
import { useGeoStore } from '@/shared/store/useGeoStore'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { trackUserLocation } from '@/shared/api/user.api'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'
const IP_API_URL = 'https://ipapi.co/json/'

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
 * @returns {Promise<{lat: number, lng: number, city: string, country: string, address: string}>}
 */
async function fetchGeoByIP() {
    const res = await fetch(IP_API_URL, {
        headers: { 'User-Agent': 'GastroMapApp/1.0' },
    })
    if (!res.ok) throw new Error('IP geolocation request failed')
    const data = await res.json()

    const city = data.city || data.region || 'Unknown'
    const country = data.country_name || ''
    return {
        lat: data.latitude,
        lng: data.longitude,
        city,
        country,
        address: `${city}, ${country}`,
    }
}

/**
 * @param {{ autoRequest?: boolean }} [options]
 */
export function useUserGeo({ autoRequest = false } = {}) {
    const { lat, lng, city, country, address, status, error, setCoords, setLocation, setStatus, setError, setVisitData } =
        useGeoStore()
    const { user } = useAuthStore()

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
                    try {
                        const location = await reverseGeocode(latitude, longitude)
                        await finalizeLocation(latitude, longitude, location)
                    } catch {
                        // Reverse geocoding failed but coords are valid
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
        isLoading: status === 'loading',
        isGranted: status === 'granted',
        isDenied: status === 'denied',
        requestGeo,
    }
}
