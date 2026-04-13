
// api/ai/semantic-search.js
// Semantic search using Supabase float8[] embeddings + OpenRouter
const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { query, city, category, limit = 10, threshold = 0.3 } = req.body

  if (!query) {
    return res.status(400).json({ error: 'query is required' })
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY

  try {
    // 1. Get query embedding
    const embRes = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/text-embedding-3-small',
        input: query.slice(0, 2000)
      })
    })

    if (!embRes.ok) {
      throw new Error(`Embedding API error: ${embRes.status}`)
    }

    const embData = await embRes.json()
    const queryVec = embData.data[0].embedding.slice(0, 768)
    
    // Normalize
    const norm = Math.sqrt(queryVec.reduce((sum, x) => sum + x * x, 0))
    const normalizedVec = queryVec.map(x => x / norm)

    // 2. Fetch all locations with embeddings
    let url = `${SUPABASE_URL}/rest/v1/locations?select=id,title,description,city,category,cuisine,rating,image,price_level,tags,embedding_vec&status=eq.active&embedding_vec=not.is.null&limit=500`
    if (city) url += `&city=ilike.${city}`
    if (category) url += `&category=ilike.${category}`

    const locRes = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    })

    const locations = await locRes.json()

    // 3. Compute cosine similarity
    const scored = locations
      .map(loc => {
        if (!loc.embedding_vec || loc.embedding_vec.length === 0) return null
        let dot = 0
        for (let i = 0; i < normalizedVec.length; i++) {
          dot += normalizedVec[i] * (loc.embedding_vec[i] || 0)
        }
        const { embedding_vec, ...rest } = loc
        return { ...rest, similarity: dot }
      })
      .filter(loc => loc && loc.similarity > threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    return res.status(200).json({
      results: scored,
      count: scored.length,
      query_processed: query
    })

  } catch (error) {
    console.error('Semantic search error:', error)
    return res.status(500).json({ error: error.message })
  }
}

module.exports = handler
