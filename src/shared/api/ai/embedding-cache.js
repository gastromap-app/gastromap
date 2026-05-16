import { supabase } from '../../client.js'

// Simple LRU cache
class LRUCache {
  constructor(maxSize = 256) {
    this.maxSize = maxSize
    this.cache = new Map()
  }
  get(key) {
    if (!this.cache.has(key)) return undefined
    const val = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, val)
    return val
  }
  set(key, value) {
    if (this.cache.has(key)) this.cache.delete(key)
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }
}

const lru = new LRUCache(256)

function hashQuery(text) {
  // Simple string hash for cache key
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return 'h_' + Math.abs(hash).toString(36)
}

export function recordEmbeddingFailure(event) {
  console.warn('[EmbeddingCache] Failure:', {
    provider: event.provider,
    query_hash: event.queryHash,
    http_status: event.httpStatus,
    error_message: event.errorMessage,
  })
}

export async function getOrComputeEmbedding(text, opts = {}) {
  if (!text?.trim()) return { embedding: null, source: 'failed' }

  const provider = opts.provider || 'openrouter'
  const model = opts.model || 'openai/text-embedding-3-small'
  const dimensions = opts.dimensions || 768
  const normalized = text.trim().slice(0, 2000)
  const queryHash = hashQuery(normalized)
  const cacheKey = `${queryHash}:${provider}:${model}:${dimensions}`

  // Layer 1: LRU
  const cached = lru.get(cacheKey)
  if (cached) return { embedding: cached, source: 'lru' }

  // Layer 2: Supabase
  if (supabase) {
    try {
      const { data } = await supabase
        .from('embedding_cache')
        .select('embedding, hit_count')
        .eq('query_hash', queryHash)
        .eq('provider', provider)
        .eq('model', model)
        .eq('dimensions', dimensions)
        .single()
      if (data?.embedding) {
        lru.set(cacheKey, data.embedding)
        // Update hit_count + last_used_at (fire-and-forget)
        supabase.from('embedding_cache')
          .update({ hit_count: (data.hit_count || 0) + 1, last_used_at: new Date().toISOString() })
          .eq('query_hash', queryHash).eq('provider', provider).eq('model', model).eq('dimensions', dimensions)
          .then(() => {})
          .catch(() => {})
        return { embedding: data.embedding, source: 'db' }
      }
    } catch { /* not found or table missing */ }
  }

  // Layer 3: Fresh computation via proxy
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'embedding', input: normalized, dimensions }),
    })
    if (!response.ok) {
      recordEmbeddingFailure({ provider, queryHash, httpStatus: response.status, errorMessage: `HTTP ${response.status}` })
      return { embedding: null, source: 'failed' }
    }
    const result = await response.json()
    const embedding = result.data?.[0]?.embedding || null
    if (embedding) {
      lru.set(cacheKey, embedding)
      // Persist to Supabase (fire-and-forget)
      if (supabase) {
        supabase.from('embedding_cache')
          .upsert({ query_hash: queryHash, provider, model, dimensions, embedding, hit_count: 0, last_used_at: new Date().toISOString() }, { onConflict: 'query_hash,provider,model,dimensions' })
          .then(() => {})
          .catch(() => {})
      }
      return { embedding, source: 'fresh' }
    }
    return { embedding: null, source: 'failed' }
  } catch (err) {
    recordEmbeddingFailure({ provider, queryHash, httpStatus: 0, errorMessage: err?.message || 'Network error' })
    return { embedding: null, source: 'failed' }
  }
}
