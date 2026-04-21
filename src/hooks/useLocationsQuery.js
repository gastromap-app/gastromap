import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { config } from '@/shared/config/env'

/**
 * useLocationsQuery — основной хук загрузки локаций.
 *
 * Стратегия источника данных:
 *   1. Supabase (locations таблица) — если VITE_SUPABASE_URL настроен
 *      - Если БД вернула данные → используем их
 *      - Если БД вернула 0 результатов (пустой город) → возвращаем [] без fallback
 *      - Если БД недоступна (сетевая ошибка, 5xx) → fallback на OSM
 *   2. OpenStreetMap Overpass API — только при ОШИБКЕ Supabase, не при пустом результате
 *   3. MOCK_LOCATIONS — последний резерв при ошибке OSM
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
                let supabaseReached = false
                try {
                    const { getLocations } = await import('@/shared/api/locations.api')
                    // EXPL-2 FIX: no city/country on /explore root → fetch all active locations
                    console.log('[useLocationsQuery] Fetching:', { city, country })
                    const result = await getLocations({
                        ...(city ? { city } : {}),
                        ...(country ? { country } : {}),
                        limit: 200,
                        // Don't pass status — let the API use default 'approved' for public queries
                    })
                    // БД ответила — запрос дошёл до Supabase
                    supabaseReached = true
                    const places = result?.data ?? []

                    if (places.length > 0) {
                        console.log('[useLocationsQuery] ✅ Supabase:', places.length, 'locations for', city, country)
                        return places
                    }

                    // Supabase доступен, но данных нет — это пустой город, НЕ ошибка.
                    // Не падаем на OSM: там данные не совпадают с нашей схемой.
                    console.log('[useLocationsQuery] ℹ️ Supabase: no locations for', city, country, '— city is empty in DB')
                    return []
                } catch (err) {
                    if (supabaseReached) {
                        // БД ответила, но с ошибкой в данных — не fallback, просто пусто
                        console.error('[useLocationsQuery] Supabase data error:', err.message)
                        return []
                    }
                    // Supabase вообще не ответил (сеть, 5xx, timeout) → пробуем OSM
                    console.warn('[useLocationsQuery] Supabase unreachable, falling back to OSM:', err.message)
                }
            }

            // ── Путь 2: OpenStreetMap (Overpass) ─────────────────────────
            // Только если Supabase не настроен или недоступен (не при пустом результате!)
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
        // EXPL-2 FIX: enable even without city/country to load all locations on /explore root
        enabled: true,
        retry: 1,
    })

    useEffect(() => {
        if (query.data) {
            // REGRESSION FIX: only update global store when fetching ALL locations (no city/country filter)
            // City-scoped queries (city + country) must NOT overwrite the global store —
            // this caused the dashboard to show only city-filtered data after navigating back.
            // DrillDownExplorer filters from the global store client-side instead.
            if (!city && !country) {
                setLocations(query.data)
            }
        }
    }, [query.data, city, country, setLocations])

    return query
}
