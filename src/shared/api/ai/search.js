/**
 * Semantic_Search — the single, universal location search.
 *
 * Calls the consolidated `search_locations` RPC which fuses
 * pgvector cosine similarity, full-text search, and filter-only
 * results via Reciprocal Rank Fusion.
 */

import { supabase } from '@/shared/api/client'
import { getOrComputeEmbedding } from './embedding-cache.js'

/**
 * Semantic_Search — the single, universal location search.
 *
 * @param {Object}  args
 * @param {string=} args.query     - Optional natural-language text
 * @param {string=} args.city      - Optional city filter
 * @param {string=} args.category  - Optional category filter
 * @param {string=} args.cuisine   - Optional cuisine filter
 * @param {number=} args.limit     - Optional result cap (default 10, max 25)
 *
 * @returns {Promise<{ ok: true, results: Location[] } | { ok: false, error: string }>}
 */
export async function semanticSearch(args = {}) {
  const { query = null, city = null, category = null, cuisine = null } = args
  const limit = Math.max(1, Math.min(25, args.limit ?? 10))

  // Empty args short-circuit (Req 2.5)
  if (!query && !city && !category && !cuisine) {
    return { ok: true, results: [] }
  }

  // Optional embedding lookup (only when query text is present)
  let embedding = null
  if (query?.trim()) {
    const cached = await getOrComputeEmbedding(query).catch(() => null)
    embedding = cached?.embedding ?? null
  }

  // Build RPC params — omit query_embedding when null (PostgREST can't cast null to vector)
  const rpcParams = {
    query:           query || null,
    city_filter:     city || null,
    category_filter: category || null,
    cuisine_filter:  cuisine || null,
    result_limit:    limit,
  }
  if (embedding) {
    rpcParams.query_embedding = embedding
  }

  const { data, error } = await supabase.rpc('search_locations', rpcParams)

  if (error) return { ok: false, error: error.message }
  return { ok: true, results: data ?? [] }
}

export { generateEmbeddingForLocation } from './embedding-cache.js'
