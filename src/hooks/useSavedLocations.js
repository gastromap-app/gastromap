import { useMemo } from 'react'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useFavoritesStore } from '@/shared/store/useFavoritesStore'
import { useLocations } from '@/shared/api/queries/location.queries'
import { useUserFavoritesWithLocations, useRemoveFavoriteMutation } from '@/shared/api/queries'

/**
 * useSavedLocations — single source of truth for the "Saved" page.
 *
 * For auth users: fetches from Supabase DB with JOINed location data.
 * For guests: hydrates localStorage favorite IDs from the locations store.
 *
 * @returns {{
 *   favorites: Array<{ location_id, locations }>,
 *   isLoading: boolean,
 *   remove: (locationId: string) => void,
 * }}
 */
export function useSavedLocations() {
    const { user } = useAuthStore()

    // Auth path: Supabase DB
    const { data: dbFavorites = [], isLoading, isError, refetch } = useUserFavoritesWithLocations(user?.id)
    const removeMut = useRemoveFavoriteMutation()

    // Guest path: localStorage + React Query locations hydration
    const { favoriteIds: localIds, toggleFavorite: localToggle } = useFavoritesStore()
    const { data: allLocationsResult = [], isLoading: isLocationsLoading } = useLocations()
    const allLocations = Array.isArray(allLocationsResult) ? allLocationsResult : (allLocationsResult?.data ?? [])

    const localFavorites = useMemo(() => {
        if (user?.id) return []
        return localIds
            .map((id) => allLocations.find((loc) => String(loc.id) === String(id)))
            .filter(Boolean)
            .map((loc) => ({ location_id: loc.id, locations: loc }))
    }, [user, localIds, allLocations])

    const favorites = user?.id ? dbFavorites : localFavorites

    const remove = (locationId) => {
        if (user?.id) {
            removeMut.mutate({ userId: user.id, locationId })
        } else {
            localToggle(locationId)
        }
    }

    return {
        favorites,
        isLoading: user?.id ? isLoading : isLocationsLoading,
        isError: user?.id ? isError : false,
        refetch,
        remove,
    }
}
