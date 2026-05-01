import { useCallback } from 'react'
import { useFavoritesStore } from '@/shared/store/useFavoritesStore'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useAddFavoriteMutation, useRemoveFavoriteMutation, useUserFavorites } from '@/shared/api/queries'

/**
 * useFavorites — unified favorites hook.
 *
 * For guests: reads/writes localStorage via Zustand.
 * For auth users: Supabase DB is the source of truth; localStorage is kept in sync.
 *
 * @returns {{
 *   favoriteIds: string[],
 *   isFavorite: (id: string) => boolean,
 *   toggleFavorite: (id: string) => Promise<void>,
 *   count: number,
 * }}
 */
export function useFavorites() {
    const { user } = useAuthStore()
    const { favoriteIds: localIds, toggleFavorite: localToggle, isFavorite: isLocalFav } = useFavoritesStore()

    const { data: dbFavs = [] } = useUserFavorites(user?.id)
    const dbFavIds = dbFavs.map(f => f.location_id)

    const addFavMut = useAddFavoriteMutation()
    const removeFavMut = useRemoveFavoriteMutation()

    const isFavorite = useCallback((id) => {
        if (!id) return false
        return user?.id ? dbFavIds.includes(id) : isLocalFav(id)
    }, [user, dbFavIds, isLocalFav])

    const toggleFavorite = useCallback(async (id) => {
        if (!id) return

        // Haptic feedback — native feel on mobile
        if (navigator.vibrate) {
            navigator.vibrate(isFavorite(id) ? [10] : [10, 30, 10])
        }

        if (!user?.id) {
            localToggle(id)
            return
        }

        // Auth user: DB is the source of truth
        const currentlySaved = dbFavIds.includes(id)
        try {
            if (currentlySaved) {
                await removeFavMut.mutateAsync({ userId: user.id, locationId: id })
            } else {
                await addFavMut.mutateAsync({ userId: user.id, locationId: id })
            }
            // Sync local store to match DB state
            if (isLocalFav(id) === currentlySaved) {
                localToggle(id)
            }
        } catch {
            // Silently fail — UI stays consistent because we optimistically don't update
        }
    }, [user, dbFavIds, localToggle, isLocalFav, addFavMut, removeFavMut, isFavorite])

    const favoriteIds = user?.id ? dbFavIds : localIds

    return {
        favoriteIds,
        isFavorite,
        toggleFavorite,
        count: favoriteIds.length,
    }
}
