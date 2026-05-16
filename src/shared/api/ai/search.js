/**
 * Semantic + Hybrid Search
 *
 * Uses search_locations_hybrid RPC (pgvector cosine + FTS via RRF).
 * Falls back to search_locations_fulltext if embedding generation fails.
 */

import { supabase } from '@/shared/api/client'
import { getOrComputeEmbedding } from './embedding-cache.js'

/**
 * Generate an embedding vector for the given text via the server proxy.
 * The server handles model fallback and API key management.
 * @param {string} text - Text to embed
 * @returns {Promise<number[] | null>} Embedding vector or null on failure
 */
async function generateEmbedding(text) {
    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'embedding', input: text.slice(0, 2000), dimensions: 768 }),
        })
        if (!response.ok) return null
        const data = await response.json()
        return data.data?.[0]?.embedding || null
    } catch {
        return null
    }
}

/**
 * Hybrid search: pgvector (cosine similarity) + FTS (tsvector), merged via RRF.
 * Searches across title, description, tags, kg_dishes, kg_cuisines, ai_keywords, etc.
 *
 * @param {string} queryText - Natural language query
 * @param {number} [limit=10] - Max results
 * @param {string} [_apiKey] - Unused but kept for signature compatibility
 * @param {Object} [options] - Additional filters { city, category, cuisine, price_range }
 * @returns {Promise<Array>} Matched location rows
 */
export async function semanticSearch(queryText, limit = 10, _apiKey = null, { city, category, cuisine: _cuisine, price_range: _priceRange } = {}) {
    if (!queryText?.trim() || !supabase) return []

    try {
        // Try to generate embedding for hybrid search (via cache)
        const { embedding: queryEmbedding, source: embSource } = await getOrComputeEmbedding(queryText)
        console.log(`[ai.search] embedding source: ${embSource}`)

        if (queryEmbedding) {
            // Full hybrid: vector + FTS via RRF
            const { data, error } = await supabase.rpc('search_locations_hybrid', {
                query_embedding: queryEmbedding,
                query_text: queryText,
                p_city: city || null,
                p_category: category || null,
                p_limit: limit,
                rrf_k: 60,
            })

            console.log(`[ai.search] hybrid RPC result:`, { count: data?.length || 0, error: error?.message })

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
            p_city: city || null,
            p_category: category || null,
            p_limit: limit,
        })

        console.log(`[ai.search] fulltext RPC result:`, { count: data?.length || 0, error: error?.message })

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
    // Base tags and AI keywords
    for (const field of ['tags', 'vibe', 'features', 'best_for', 'special_labels', 'ai_keywords']) {
        const v = loc[field]
        if (Array.isArray(v) && v.length) parts.push(v.join(' '))
        else if (typeof v === 'string' && v) parts.push(v)
    }

    // Knowledge Graph specific fields for deep culinary knowledge
    for (const field of ['kg_cuisines', 'kg_dishes', 'kg_ingredients', 'kg_allergens']) {
        const v = loc[field]
        if (Array.isArray(v) && v.length) parts.push(`${field.replace('kg_', '')}: ${v.join(', ')}`)
    }

    // Insider tips and must-try dishes — critical for semantic search
    if (loc.insider_tip) parts.push(`insider tip: ${loc.insider_tip}`)
    if (Array.isArray(loc.what_to_try) && loc.what_to_try.length) parts.push(`must try: ${loc.what_to_try.join(', ')}`)
    if (Array.isArray(loc.must_try) && loc.must_try.length) parts.push(`must try: ${loc.must_try.join(', ')}`)
    
    // Menu dishes (from scanned menu)
    if (Array.isArray(loc.menu_dishes) && loc.menu_dishes.length) {
        const dishNames = loc.menu_dishes.slice(0, 15).map(d => typeof d === 'string' ? d : d.name).filter(Boolean)
        if (dishNames.length) parts.push(`menu: ${dishNames.join(', ')}`)
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
