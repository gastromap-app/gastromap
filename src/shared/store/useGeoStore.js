/**
 * useGeoStore — Shared geolocation state for the entire app.
 *
 * Stores the user's coordinates and reverse-geocoded city name.
 * Populated by useUserGeo hook once (on first request), then
 * accessible by both the Map AND the AI Chat without re-requesting.
 *
 * City is cached in sessionStorage so we don't hit the geocoding
 * API on every page refresh (coordinates are re-fetched each session).
 */
import { create } from 'zustand'

const SESSION_KEY = 'gastro_user_city'

export const useGeoStore = create((set) => ({
    // Coordinates
    lat: null,
    lng: null,

    // Reverse-geocoded location
    city: sessionStorage.getItem(SESSION_KEY) || null,
    country: null,
    address: null,

    // Visit statistics for the current city
    visitCount: 0,
    lastVisitedAt: null,

    // Status
    status: 'idle', // 'idle' | 'loading' | 'granted' | 'denied' | 'error'
    error: null,

    setCoords: (lat, lng) => set({ lat, lng }),

    setLocation: ({ city, country, address }) => {
        if (city) sessionStorage.setItem(SESSION_KEY, city)
        set({ city, country, address })
    },

    setStatus: (status) => set({ status }),
    setError: (error) => set({ error, status: 'error' }),
    
    setVisitData: ({ visitCount, lastVisitedAt }) => set({ visitCount, lastVisitedAt }),

    reset: () => {
        sessionStorage.removeItem(SESSION_KEY)
        set({ lat: null, lng: null, city: null, country: null, address: null, status: 'idle', error: null })
    },
}))
