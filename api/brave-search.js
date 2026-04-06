/**
 * Vercel Serverless Function — Brave Search Proxy
 *
 * Proxies Brave Search API requests server-side to avoid CORS.
 * Always searches in English with trusted culinary sources.
 * Filters out unreliable sources (food.ru, яндекс еда, etc.)
 *
 * Free tier: 2 000 requests/month — https://api.search.brave.com
 */

const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search'

// Trusted culinary sources — authoritative, accurate, English-first
const TRUSTED_DOMAINS = [
    'wikipedia.org',
    'britannica.com',
    'seriouseats.com',
    'bonappetit.com',
    'epicurious.com',
    'food52.com',
    'tasteatlas.com',
    'thespruceeats.com',
    'bbcgoodfood.com',
    'allrecipes.com',
    'finedininglovers.com',
    'gastroatlas.com',
    'culinarybackstreets.com',
    'eater.com',
    'michelin.com',
    'visitgreece.gr',
    'italianfoodforever.com',
    'japan.travel',
    'germany.travel',
    'france.fr',
]

// Blocked domains — unreliable or non-English junk sources
const BLOCKED_DOMAINS = [
    'food.ru',
    'eda.ru',
    'gastronom.ru',
    'povarenok.ru',
    'russianfood.com',
    'cooking.nytimes.com', // paywalled
    'yandex.ru',
    'ok.ru',
    'vk.com',
]

function isBlocked(url) {
    try {
        const hostname = new URL(url).hostname.replace('www.', '')
        return BLOCKED_DOMAINS.some(d => hostname.includes(d))
    } catch { return false }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const apiKey = process.env.BRAVE_SEARCH_API_KEY || req.body?.apiKey || ''
    if (!apiKey || !apiKey.trim()) {
        return res.status(400).json({ error: 'Brave Search API key not configured' })
    }

    const { query, count = 5 } = req.body || {}
    if (!query || !query.trim()) {
        return res.status(400).json({ error: 'query is required' })
    }

    // Force English query — translate obvious Russian/non-Latin queries
    // The caller (kg-ai-agent) should pass pre-translated query,
    // but as safety net we add "cuisine food traditional" to bias toward culinary EN results
    const cleanQuery = query.trim()
    const hasNonLatin = /[а-яёА-ЯЁ\u4e00-\u9fff\u3040-\u309f]/.test(cleanQuery)
    const searchQuery = hasNonLatin
        ? `${cleanQuery} cuisine traditional dishes food`  // adds EN context words
        : cleanQuery

    console.log(`[brave-search] query: "${cleanQuery}" → "${searchQuery}" (nonLatin: ${hasNonLatin})`)

    try {
        const url = new URL(BRAVE_URL)
        url.searchParams.set('q', searchQuery)
        url.searchParams.set('count', String(Math.min(Number(count) * 2 || 10, 20))) // fetch 2x, filter down
        url.searchParams.set('search_lang', 'en')
        url.searchParams.set('country', 'us')   // US results = more English
        url.searchParams.set('result_filter', 'web')
        url.searchParams.set('safesearch', 'off')

        const response = await fetch(url.toString(), {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': apiKey.trim(),
            },
        })

        if (!response.ok) {
            const text = await response.text().catch(() => '')
            console.error(`[brave-search] API error ${response.status}:`, text)
            return res.status(response.status).json({
                error: `Brave API returned ${response.status}`,
                detail: text.slice(0, 200),
            })
        }

        const data = await response.json()
        const allResults = data?.web?.results || []

        // Filter out blocked domains first
        const filtered = allResults.filter(r => !isBlocked(r.url || ''))

        // Prefer trusted domains (sort to top)
        const trusted   = filtered.filter(r => {
            try {
                const hostname = new URL(r.url).hostname.replace('www.', '')
                return TRUSTED_DOMAINS.some(d => hostname.includes(d))
            } catch { return false }
        })
        const rest = filtered.filter(r => !trusted.includes(r))

        const results = [...trusted, ...rest].slice(0, count)

        console.log(`[brave-search] ${allResults.length} raw → ${filtered.length} filtered → ${trusted.length} trusted → ${results.length} returned`)
        return res.status(200).json({ results })

    } catch (err) {
        console.error('[brave-search] Error:', err.message)
        return res.status(500).json({ error: 'Brave Search proxy error', detail: err.message })
    }
}
