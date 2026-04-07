import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useFavoritesStore = create(
    persist(
        (set, get) => ({
            favoriteIds: [],

            toggleFavorite: (id) => {
                const { favoriteIds } = get()
                const isFav = favoriteIds.includes(id)
                if (isFav) {
                    set({ favoriteIds: favoriteIds.filter(favId => favId !== id) })
                } else {
                    set({ favoriteIds: [...favoriteIds, id] })
                }
            },

            isFavorite: (id) => get().favoriteIds.includes(id)
        }),
        {
            name: 'favorites-storage', // unique name
        }
    )
)
