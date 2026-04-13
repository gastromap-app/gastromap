import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { config } from '@/shared/config/env'

/**
 * useLocationsQuery — основной хук загрузки локаций.
 *
 * Стратегия источника данных:
 *   1. Supabase (locations таблица) — если VITE_SUPABASE_URL настроен
 *   2. OpenStreetMap Overpass API — fallback если Supabase недоступен
 *   3. MOCK_LOCATIONS — последний резерв
 *
 * React Query кэширует: staleTime 1h, gcTime 24h.
 * Результат синхронизируется в Zustand store (filteredLocations обновится автоматически).
 */
export function useLocationsQuery(city, country) {
    const setLocations = useLocationsStore((s) => s.setLocations)
    const USE_SUPABASE = config.supabase.isConfigured

    const query = useQuery({
        queryKey: ['locations', city?.toLowerCase(), country?.toLowerCase(), USE_SUPABASE ? 'supabase' : 'osm'],
        queryFn: async () => {
            // ── Путь 1: Supabase ─────────────────────────────────────────
            if (USE_SUPABASE) {
                try {
                    const { getLocations } = await import('@/shared/api/locations.api')
                    const result = await getLocations({
                        city,
                        country,
                        limit: 200,
                        status: 'approved',
                    })
                    const places = result?.data ?? []
                    if (places.length > 0) {
                        console.log('[useLocationsQuery] ✅ Supabase:', places.length, 'locations for', city, country)
                        return places
                    }
                    console.warn('[useLocationsQuery] Supabase returned 0 results — falling back to OSM')
                } catch (err) {
                    console.warn('[useLocationsQuery] Supabase error, falling back to OSM:', err.message)
                }
            }

            // ── Путь 2: OpenStreetMap (Overpass) ─────────────────────────
            try {
                const { geocodeCity } = await import('@/services/nominatimApi')
                const { fetchPlacesByBoundingBox } = await import('@/services/overpassApi')
                const geo = await geocodeCity(city, country)
                const places = await fetchPlacesByBoundingBox(geo.boundingbox, 100)
                if (places.length > 0) {
                    console.log('[useLocationsQuery] ✅ OSM fallback:', places.length, 'places')
                    return places
                }
            } catch (err) {
                console.warn('[useLocationsQuery] OSM error, falling back to mocks:', err.message)
            }

            // ── Путь 3: Mock data ────────────────────────────────────────
            const { MOCK_LOCATIONS } = await import('@/mocks/locations')
            console.warn('[useLocationsQuery] ⚠️  Using MOCK_LOCATIONS')
            return MOCK_LOCATIONS
        },
        staleTime: 60 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        enabled: !!(city && country),
        retry: 1,
    })

    useEffect(() => {
        if (query.data) {
            setLocations(query.data)
        }
    }, [query.data, setLocations])

    return query
}
