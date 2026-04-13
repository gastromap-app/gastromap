/**
 * /api/ai/semantic-search.js
 * Semantic search via OpenRouter embeddings + Supabase float8[] cosine similarity
 */
const handler = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query, city, category, limit = 10, threshold = 0.3 } = req.body || {}
  if (!query?.trim()) return res.status(400).json({ error: 'query is required' })

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const OR_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY || !OR_KEY) {
    console.error('Missing env vars:', { hasSupabaseUrl: !!SUPABASE_URL, hasSupabaseKey: !!SUPABASE_KEY, hasOrKey: !!OR_KEY })
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    // 1. Get query embedding from OpenRouter
    const embRes = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OR_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: query.slice(0, 2000) })
    })
    if (!embRes.ok) {
      const errText = await embRes.text()
      throw new Error(`Embedding API ${embRes.status}: ${errText.slice(0, 200)}`)
    }
    const embData = await embRes.json()
    const rawVec = embData.data[0].embedding.slice(0, 768)
    const norm = Math.sqrt(rawVec.reduce((s, x) => s + x * x, 0))
    const queryVec = rawVec.map(x => x / norm)

    // 2. Fetch locations with embeddings from Supabase
    let sbUrl = `${SUPABASE_URL}/rest/v1/locations?select=id,title,description,city,country,category,cuisine,rating,image,price_level,tags,special_labels,vibe,embedding_vec&status=eq.active&embedding_vec=not.is.null&limit=500`
    if (city) sbUrl += `&city=ilike.${encodeURIComponent(city)}`
    if (category) sbUrl += `&category=ilike.${encodeURIComponent(category)}`

    const locRes = await fetch(sbUrl, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    })
    if (!locRes.ok) throw new Error(`Supabase ${locRes.status}`)
    const locations = await locRes.json()

    // 3. Compute cosine similarity (vectors are already normalized)
    const scored = locations
      .map(loc => {
        if (!Array.isArray(loc.embedding_vec) || loc.embedding_vec.length === 0) return null
        let dot = 0
        const len = Math.min(queryVec.length, loc.embedding_vec.length)
        for (let i = 0; i < len; i++) dot += queryVec[i] * loc.embedding_vec[i]
        const { embedding_vec, ...rest } = loc
        return { ...rest, similarity: Math.round(dot * 1000) / 1000 }
      })
      .filter(loc => loc && loc.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    console.log(`[semantic-search] "${query}" -> ${scored.length} results (from ${locations.length} locations)`)

    return res.status(200).json({ results: scored, count: scored.length, total_checked: locations.length })

  } catch (err) {
    console.error('[semantic-search] error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

module.exports = handler
