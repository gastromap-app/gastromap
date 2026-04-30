import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

// ─── AI Query & Extraction ──────────────────────────────────────────────────

export function useAIQueryMutation() {
    return useMutation({
        mutationFn: async ({ message, context }) => {
            const { analyzeQuery } = await import('../ai/analysis')
            return analyzeQuery(message, context)
        },
    })
}

export function useExtractLocationMutation() {
    return useMutation({
        mutationFn: async (query) => {
            const { extractLocationData } = await import('../ai/location')
            return extractLocationData(query)
        },
    })
}

// ─── AI Assistant (Enrichment & KG Sync) ───────────────────────────────────

export function useSyncLocationKGMutation() {
    return useMutation({
        mutationFn: async (locationId) => {
            const { syncLocationWithKnowledgeGraph } = await import('../ai-assistant.service')
            return syncLocationWithKnowledgeGraph(locationId)
        },
    })
}

export function useEnrichLocationFullMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (locationId) => {
            const { enrichLocationFull } = await import('../ai-assistant.service')
            return enrichLocationFull(locationId)
        },
        onSuccess: (_data, locationId) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.detail(locationId) })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

export function useBulkSyncKGMutation() {
    return useMutation({
        mutationFn: async (limit = 50) => {
            const { bulkSyncKG } = await import('../ai-assistant.service')
            return bulkSyncKG(limit)
        },
    })
}

export function useReindexLocationSemanticMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { reindexLocationSemantic } = await import('../ai-assistant.service')
            return reindexLocationSemantic(id)
        },
        onSuccess: (_data, id) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.detail(id) })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

export function useBulkReindexLocationsMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (config) => {
            const { bulkReindexLocations } = await import('../ai-assistant.service')
            return bulkReindexLocations(config)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

export function useUpdateLocationEmbeddingMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { updateLocationEmbedding } = await import('../ai-assistant.service')
            return updateLocationEmbedding(id)
        },
        onSuccess: (_data, id) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.detail(id) })
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

export function useBulkUpdateEmbeddingsMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (config) => {
            const { bulkUpdateEmbeddings } = await import('../ai-assistant.service')
            return bulkUpdateEmbeddings(config)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.all })
        },
    })
}

export function useSyncLocationWithKGMutation() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id) => {
            const { syncLocationWithKnowledgeGraph } = await import('../ai-assistant.service')
            return syncLocationWithKnowledgeGraph(id)
        },
        onSuccess: (_data, id) => {
            qc.invalidateQueries({ queryKey: queryKeys.locations.detail(id) })
        },
    })
}
