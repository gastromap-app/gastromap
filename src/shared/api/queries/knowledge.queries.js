import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

// ─── Knowledge Graph Taxonomy ───────────────────────────────────────────────

export function useCuisines() {
    return useQuery({
        queryKey: queryKeys.knowledge.cuisines,
        queryFn: async () => {
            const { getCuisines } = await import('../knowledge-graph.api')
            return getCuisines()
        },
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
    })
}

export function useCuisine(id) {
    return useQuery({
        queryKey: queryKeys.knowledge.cuisine(id),
        queryFn: async () => {
            const { getCuisineById } = await import('../knowledge-graph.api')
            return getCuisineById(id)
        },
        enabled: !!id,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
    })
}

export function useCreateCuisineMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (cuisine) => {
            const { createCuisine } = await import('../knowledge-graph.api')
            return createCuisine(cuisine)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.knowledge.cuisines }),
    })
}

export function useUpdateCuisineMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, updates }) => {
            const { updateCuisine } = await import('../knowledge-graph.api')
            return updateCuisine(id, updates)
        },
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: queryKeys.knowledge.cuisines })
            qc.invalidateQueries({ queryKey: queryKeys.knowledge.cuisine(id) })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

export function useDeleteCuisineMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { deleteCuisine } = await import('../knowledge-graph.api')
            return deleteCuisine(id)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.knowledge.cuisines })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

// ─── Dishes ──────────────────────────────────────────────────────────────────

export function useDishes(cuisineId = null) {
    return useQuery({
        queryKey: queryKeys.knowledge.dishes(cuisineId),
        queryFn: async () => {
            const { getDishes } = await import('../knowledge-graph.api')
            return getDishes(cuisineId)
        },
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
    })
}

export function useCreateDishMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (dish) => {
            const { createDish } = await import('../knowledge-graph.api')
            return createDish(dish)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.knowledge.dishes(null) }),
    })
}

export function useUpdateDishMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, updates }) => {
            const { updateDish } = await import('../knowledge-graph.api')
            return updateDish(id, updates)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.knowledge.dishes(null) })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

export function useDeleteDishMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { deleteDish } = await import('../knowledge-graph.api')
            return deleteDish(id)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.knowledge.dishes(null) })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

// ─── Ingredients ─────────────────────────────────────────────────────────────

export function useIngredients(category = null) {
    return useQuery({
        queryKey: queryKeys.knowledge.ingredients(category),
        queryFn: async () => {
            const { getIngredients } = await import('../knowledge-graph.api')
            return getIngredients(category)
        },
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
    })
}

export function useCreateIngredientMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (ingredient) => {
            const { createIngredient } = await import('../knowledge-graph.api')
            return createIngredient(ingredient)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.knowledge.ingredients(null) }),
    })
}

export function useUpdateIngredientMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, updates }) => {
            const { updateIngredient } = await import('../knowledge-graph.api')
            return updateIngredient(id, updates)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.knowledge.ingredients(null) })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

export function useDeleteIngredientMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { deleteIngredient } = await import('../knowledge-graph.api')
            return deleteIngredient(id)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.knowledge.ingredients(null) })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

// ─── Vibes ───────────────────────────────────────────────────────────────────

export function useVibes() {
    return useQuery({
        queryKey: queryKeys.knowledge.vibes,
        queryFn: async () => {
            const { getVibes } = await import('../knowledge-graph.api')
            return getVibes()
        },
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
    })
}

export function useCreateVibeMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (vibe) => {
            const { createVibe } = await import('../knowledge-graph.api')
            return createVibe(vibe)
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.knowledge.vibes }),
    })
}

export function useUpdateVibeMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, updates }) => {
            const { updateVibe } = await import('../knowledge-graph.api')
            return updateVibe(id, updates)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.knowledge.vibes })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

export function useDeleteVibeMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { deleteVibe } = await import('../knowledge-graph.api')
            return deleteVibe(id)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.knowledge.vibes })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

// ─── External APIs & Stats ───────────────────────────────────────────────────

export function useKnowledgeStats() {
    return useQuery({ 
        queryKey: queryKeys.knowledge.stats, 
        queryFn: async () => {
            const { getKnowledgeStats } = await import('../knowledge-graph.api')
            return getKnowledgeStats()
        }, 
        staleTime: 60_000 
    })
}

export function useSyncKGToLocationsMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (onProgress) => {
            const { syncKGToLocations } = await import('../knowledge-graph.api')
            return syncKGToLocations(onProgress)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

export function useSpoonacularSearchMutation() {
    return useMutation({
        mutationFn: async ({ query, type = 'any' }) => {
            const { searchDishes, searchIngredients } = await import('@/shared/api/spoonacular.api')
            if (type === 'dish') return searchDishes(query)
            if (type === 'ingredient') return searchIngredients(query)
            const [dishes, ingredients] = await Promise.all([
                searchDishes(query, 3),
                searchIngredients(query, 3)
            ])
            return { dishes, ingredients }
        }
    })
}

export function useSearchCuisinesSemantic(query, enabled = true) {
    return useQuery({
        queryKey: queryKeys.knowledge.cuisinesSemantic(query),
        queryFn: async () => {
            const { searchCuisinesSemantic } = await import('../knowledge-graph.api')
            return searchCuisinesSemantic(query)
        },
        enabled: enabled && !!query,
        staleTime: 5 * 60_000,
    })
}

export function useCulinaryContextMutation() {
    return useMutation({
        mutationFn: async ({ searchTerm }) => {
            const { getIngredientCulinaryContext } = await import('../openfoodfacts.api')
            return getIngredientCulinaryContext(searchTerm)
        },
    })
}
