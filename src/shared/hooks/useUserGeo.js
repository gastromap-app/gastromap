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

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse'

/**
 * Reverse geocode lat/lng to a human-readable location using Nominatim.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{city: string, country: string, address: string}>}
 */
async function reverseGeocode(lat, lng) {
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&accept-language=en`
    const res = await fetch(url, {
        headers: { 'User-Agent': 'GastroMap/1.0' },
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
 * @param {{ autoRequest?: boolean }} [options]
 */
export function useUserGeo({ autoRequest = false } = {}) {
    const { lat, lng, city, country, address, status, error, setCoords, setLocation, setStatus, setError } =
        useGeoStore()

    const requestGeo = useCallback(() => {
        if (status === 'loading' || status === 'granted') return
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by this browser')
            return
        }

        setStatus('loading')

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords
                setCoords(latitude, longitude)
                setStatus('granted')

                // Reverse geocode to get human-readable city name
                try {
                    const location = await reverseGeocode(latitude, longitude)
                    setLocation(location)
                    console.log(`[GeoLocation] User city detected: ${location.city}, ${location.country}`)
                } catch (err) {
                    console.warn('[GeoLocation] Reverse geocoding failed:', err.message)
                    // Don't fail the whole flow — coords are still available
                    setLocation({ city: 'Current Location', country: null, address: 'Near your current position' })
                }
            },
            (err) => {
                const messages = {
                    1: 'Location access denied by user. Please enable in browser settings.',
                    2: 'Location unavailable. The device could not determine your position (Check GPS/Signal).',
                    3: 'Location request timed out. Retrying with lower accuracy...',
                }
                const msg = messages[err.code] || 'Unknown geolocation error'
                console.warn(`[GeoLocation] Error ${err.code}: ${msg}`)
                
                // Special case: If it was a timeout, we could retry once automatically
                if (err.code === 3 && !navigator.onLine) {
                    setError('You are offline. Geolocation requires internet.')
                } else {
                    setError(msg)
                }
                
                setStatus('denied')
            },
            {
                enableHighAccuracy: true,
                timeout: 10000, // Increase to 10s for better stability
                maximumAge: 0, // Force fresh location
            }
        )
    }, [status, setCoords, setLocation, setStatus, setError])

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
