/**
 * Semantic Search via pgvector
 *
 * Converts user query into an embedding and searches for similar locations
 * using Supabase's vector database capabilities.
 */

import { supabase } from '@/shared/api/client'
import { getActiveAIConfig } from '../ai-config.api'

/**
 * Semantic search via pgvector in Supabase.
 * Converts user query into an embedding → then searches for similar locations.
 *
 * @param {string} queryText - User query to embed and search
 * @param {number} [limit=10] - Max number of results
 * @param {string} [apiKey=null] - Optional API key (if not provided, fetches from config)
 * @returns {Promise<Array>} - Array of matched locations
 */
export async function semanticSearch(queryText, limit = 10, apiKey = null) {
    if (!apiKey) {
        const { getActiveAIConfig } = await import('../ai-config.api')
        apiKey = getActiveAIConfig().apiKey
    }

    if (!apiKey || !supabase) return []

    try {
        // 1. Generate embedding for user query
        const embResponse = await fetch('https://openrouter.ai/api/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://gastromap.app',
                'X-Title': 'GastroMap',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai/text-embedding-3-small',
                input: queryText,
                dimensions: 768,
            }),
        })

        if (!embResponse.ok) return []

        const embData = await embResponse.json()
        const queryEmbedding = embData.data?.[0]?.embedding

        if (!queryEmbedding) return []

        // 2. Call pgvector RPC function in Supabase
        const { data, error } = await supabase.rpc('search_locations_by_embedding', {
            query_embedding: queryEmbedding,
            match_threshold: 0.35, // More permissive for broad intent
            match_count: limit,
        })

        if (error) {
            console.warn('[ai.search] pgvector search error:', error.message)
            return []
        }

        return data || []
    } catch (error) {
        console.warn('[ai.search] semanticSearch failed:', error.message)
        return []
    }
}
