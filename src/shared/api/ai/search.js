/**
 * Semantic + Hybrid Search
 *
 * Uses search_locations_hybrid RPC (pgvector cosine + FTS via RRF).
 * Falls back to search_locations_fulltext if embedding generation fails.
 */

import { supabase } from '@/shared/api/client'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
import { config } from '@/shared/config/env'

/**
 * Generate an embedding vector for the given text via OpenRouter.
 * Tries paid model first, then free fallback.
 */
async function generateEmbedding(text) {
    const appCfg = useAppConfigStore.getState()
    const apiKey = appCfg.aiApiKey || config.ai?.openRouterKey
    if (!apiKey) return null

    const models = [
        { name: 'openai/text-embedding-3-small', dimensions: 768 },
        { name: 'nvidia/nemotron-embed-20250702:free', dimensions: 768 },
    ]

    for (const { name: model, dimensions } of models) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://gastromap.app',
                    'X-Title': 'GastroMap',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model, input: text, dimensions }),
            })
            if (!response.ok) continue
            const data = await response.json()
            const embedding = data.data?.[0]?.embedding
            if (embedding?.length > 0) return embedding
        } catch {
            continue
        }
    }
    return null
}

/**
 * Hybrid search: pgvector (cosine similarity) + FTS (tsvector), merged via RRF.
 * Searches across title, description, tags, kg_dishes, kg_cuisines, ai_keywords, etc.
 *
 * @param {string} queryText - Natural language query
 * @param {number} [limit=10] - Max results
 * @param {string} [city] - Optional city filter
 * @param {string} [category] - Optional category filter
 * @returns {Promise<Array>} Matched location rows
 */
export async function semanticSearch(queryText, limit = 10, _apiKey = null, { city, category } = {}) {
    if (!queryText?.trim() || !supabase) return []

    try {
        // Try to generate embedding for hybrid search
        const queryEmbedding = await generateEmbedding(queryText)

        if (queryEmbedding) {
            // Full hybrid: vector + FTS via RRF
            const { data, error } = await supabase.rpc('search_locations_hybrid', {
                query_embedding: queryEmbedding,
                query_text: queryText,
                city_filter: city || null,
                category_filter: category || null,
                match_count: limit,
                rrf_k: 60,
            })

            if (!error && data?.length > 0) {
                return data
            }
            if (error) {
                console.warn('[ai.search] hybrid RPC error:', error.message)
            }
        }

        // Fallback: FTS only (no embedding needed)
        const { data, error } = await supabase.rpc('search_locations_fulltext', {
            query_text: queryText,
            city_filter: city || null,
            category_filter: category || null,
            match_count: limit,
        })

        if (error) {
            console.warn('[ai.search] fulltext RPC error:', error.message)
            return []
        }

        return data || []
    } catch (err) {
        console.warn('[ai.search] semanticSearch failed:', err.message)
        return []
    }
}

/**
 * Build embed text from all semantic fields of a location.
 */
function buildEmbedText(loc) {
    const parts = [
        loc.title,
        loc.category,
        loc.cuisine,
        loc.description,
    ]
    for (const field of ['tags', 'vibe', 'features', 'best_for', 'ai_keywords']) {
        const v = loc[field]
        if (Array.isArray(v) && v.length) parts.push(v.join(' '))
        else if (typeof v === 'string' && v) parts.push(v)
    }
    if (loc.ai_context) parts.push(loc.ai_context.slice(0, 500))
    return parts.filter(Boolean).join(' | ')
}

/**
 * Generate & return embedding vector for a location object.
 * Returns float[] (768 dims) or null on failure.
 */
export async function generateEmbeddingForLocation(location) {
    const text = buildEmbedText(location)
    if (!text.trim()) return null
    return generateEmbedding(text)
}
