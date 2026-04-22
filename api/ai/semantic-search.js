/**
 * /api/ai/semantic-search.js
 * Hybrid Search: pgvector (semantic) + Full-Text via RRF
 *
 * Flow:
 *  1. Generate query embedding via OpenRouter
 *  2. Call search_locations_hybrid RPC (pgvector + FTS combined via RRF)
 *  3. Fallback to search_locations_fulltext if embedding fails
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query, city, category, limit = 10, threshold = 0.0 } = req.body || {}
  if (!query?.trim()) return res.status(400).json({ error: 'query is required' })

  const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const OR_KEY       = process.env.OPENROUTER_API_KEY  || process.env.VITE_OPENROUTER_API_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server configuration error: missing Supabase env vars' })
  }

  // ── 1. Try to get embedding ───────────────────────────────────────────────
  let queryEmbedding = null

  if (OR_KEY) {
    try {
      const embRes = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OR_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://gastromap.app',
          'X-Title': 'GastroMap',
        },
        body: JSON.stringify({
          model: 'openai/text-embedding-3-small',
          input: query.slice(0, 2000),
          dimensions: 768,
        }),
        signal: AbortSignal.timeout(8000),
      })

      if (embRes.ok) {
        const embData = await embRes.json()
        const raw = embData.data?.[0]?.embedding
        if (raw?.length) {
          // Normalize to unit vector (cosine similarity)
          const norm = Math.sqrt(raw.reduce((s, x) => s + x * x, 0))
          queryEmbedding = norm > 0 ? raw.map(x => x / norm) : raw
        }
      } else {
        console.warn(`[semantic-search] embedding API ${embRes.status}`)
      }
    } catch (err) {
      console.warn('[semantic-search] embedding failed:', err.message)
    }
  }

  // ── 2. Call RPC ───────────────────────────────────────────────────────────
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  }

  let results = []
  let searchMode = 'fulltext'

  if (queryEmbedding) {
    // Hybrid: pgvector + FTS via RRF
    try {
      const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_locations_hybrid`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query_embedding:  queryEmbedding,
          query_text:       query.trim(),
          city_filter:      city    || null,
          category_filter:  category || null,
          match_count:      limit,
        }),
        signal: AbortSignal.timeout(10000),
      })

      if (rpcRes.ok) {
        results = await rpcRes.json()
        searchMode = 'hybrid_rrf'
      } else {
        const err = await rpcRes.text()
        console.warn('[semantic-search] hybrid RPC error:', rpcRes.status, err.slice(0, 200))
      }
    } catch (err) {
      console.warn('[semantic-search] hybrid RPC failed:', err.message)
    }
  }

  // ── 3. Fallback: Full-Text only ───────────────────────────────────────────
  if (!results.length) {
    try {
      const ftRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_locations_fulltext`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query_text:      query.trim(),
          city_filter:     city    || null,
          category_filter: category || null,
          match_count:     limit,
        }),
        signal: AbortSignal.timeout(8000),
      })

      if (ftRes.ok) {
        results = await ftRes.json()
        searchMode = 'fulltext_only'
      } else {
        const err = await ftRes.text()
        console.warn('[semantic-search] fulltext RPC error:', ftRes.status, err.slice(0, 200))
      }
    } catch (err) {
      console.warn('[semantic-search] fulltext RPC failed:', err.message)
    }
  }

  // ── 4. Last resort: REST filter (no RPC — e.g. migration not applied yet) ─
  if (!results.length) {
    try {
      const q = encodeURIComponent(query.trim())
      const restUrl = `${SUPABASE_URL}/rest/v1/locations?status=eq.active&or=(title.ilike.*${q}*,description.ilike.*${q}*,cuisine.ilike.*${q}*)&limit=${limit}&select=id,title,description,city,country,category,cuisine,rating,image,price_level,tags,special_labels,vibe,kg_dishes,kg_cuisines,lat,lng`
      const restRes = await fetch(restUrl, { headers })
      if (restRes.ok) {
        const raw = await restRes.json()
        results = raw.map(r => ({ ...r, rrf_score: 0.01 }))
        searchMode = 'rest_fallback'
      }
    } catch (err) {
      console.warn('[semantic-search] REST fallback failed:', err.message)
    }
  }

  // Filter by threshold (rrf_score based)
  if (threshold > 0) {
    results = results.filter(r => (r.rrf_score ?? 0) >= threshold)
  }

  console.log(`[semantic-search] "${query}" mode=${searchMode} results=${results.length}`)

  return res.status(200).json({
    results,
    count: results.length,
    search_mode: searchMode,
    has_embedding: !!queryEmbedding,
  })
}
