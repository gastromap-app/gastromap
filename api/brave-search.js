/**
 * Vercel Serverless Function — Brave Search Proxy
 *
 * Proxies Brave Search API requests server-side to avoid CORS.
 * The BRAVE_SEARCH_API_KEY env var (no VITE_ prefix) is server-only.
 *
 * Client sends: POST /api/brave-search { query, count?, apiKey? }
 *   - apiKey is optional: client-side key from admin store (fallback if env not set)
 *   - Server env BRAVE_SEARCH_API_KEY takes priority over client-supplied key
 *
 * Free tier: 2 000 requests/month — https://api.search.brave.com
 */

const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search'

export default async function handler(req, res) {
    // Allow CORS from same origin
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    // Server env key takes priority; fall back to client-supplied key
    const apiKey = process.env.BRAVE_SEARCH_API_KEY || req.body?.apiKey || ''

    if (!apiKey || !apiKey.trim()) {
        return res.status(400).json({ error: 'Brave Search API key not configured' })
    }

    const { query, count = 5 } = req.body || {}

    if (!query || !query.trim()) {
        return res.status(400).json({ error: 'query is required' })
    }

    try {
        const url = new URL(BRAVE_URL)
        url.searchParams.set('q', query.trim())
        url.searchParams.set('count', String(Math.min(Number(count) || 5, 20)))
        url.searchParams.set('search_lang', 'en')
        url.searchParams.set('result_filter', 'web')

        const response = await fetch(url.toString(), {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': apiKey.trim(),
            },
        })

        if (!response.ok) {
            const text = await response.text().catch(() => '')
            console.error(`[brave-search proxy] API error ${response.status}:`, text)
            return res.status(response.status).json({
                error: `Brave API returned ${response.status}`,
                detail: text.slice(0, 200),
            })
        }

        const data = await response.json()
        const results = (data?.web?.results || []).slice(0, count)

        return res.status(200).json({ results })
    } catch (err) {
        console.error('[brave-search proxy] Error:', err.message)
        return res.status(500).json({ error: 'Brave Search proxy error', detail: err.message })
    }
}
