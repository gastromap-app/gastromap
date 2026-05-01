/**
 * useGeoStore — Shared geolocation state for the entire app.
 *
 * Stores the user's coordinates and reverse-geocoded city name.
 * Populated by useUserGeo hook once (on first request), then
 * accessible by both the Map AND the AI Chat without re-requesting.
 *
 * City is cached in localStorage with a 7-day TTL so we don't hit
 * the geocoding API on every page refresh.
 */
import { create } from 'zustand'

const CACHE_KEY = 'gastro_geo_cache'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getCachedGeo() {
    try {
        const raw = localStorage.getItem(CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed.timestamp || Date.now() - parsed.timestamp > CACHE_TTL_MS) {
            localStorage.removeItem(CACHE_KEY)
            return null
        }
        return parsed
    } catch {
        return null
    }
}

const cached = getCachedGeo()

export const useGeoStore = create((set) => ({
    // Coordinates
    lat: cached?.lat ?? null,
    lng: cached?.lng ?? null,

    // Reverse-geocoded location
    city: cached?.city ?? null,
    country: cached?.country ?? null,
    address: cached?.address ?? null,

    // Visit statistics for the current city
    visitCount: 0,
    lastVisitedAt: null,

    // Status
    status: 'idle', // 'idle' | 'loading' | 'granted' | 'denied' | 'error'
    error: null,

    setCoords: (lat, lng) => set({ lat, lng }),

    setLocation: ({ city, country, address, lat, lng }) => {
        if (city) {
            const cache = { city, country, address, lat, lng, timestamp: Date.now() }
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
        }
        set({ city, country, address, lat, lng })
    },

    setStatus: (status) => set({ status }),
    setError: (error) => set({ error, status: 'error' }),

    setVisitData: ({ visitCount, lastVisitedAt }) => set({ visitCount, lastVisitedAt }),

    reset: () => {
        localStorage.removeItem(CACHE_KEY)
        set({ lat: null, lng: null, city: null, country: null, address: null, status: 'idle', error: null })
    },
}))
