/**
 * Vercel Serverless Function — AI Chat Proxy
 *
 * Proxies requests to OpenRouter so the API key stays server-side.
 * Cascading model rotation on 429.
 * RAG: when messages contain food/location intent, enriches with semantic search results.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// TAIL FALLBACK — primary model is passed via req.body.model from the client
// (which reads it from AdminAIPage → useAppConfigStore). This list kicks in
// only if the primary model fails. Updated 2026-04-14.
const MODEL_CASCADE = [
    'openai/gpt-oss-120b:free',               // ✅ best JSON quality
    'nvidia/nemotron-3-super-120b-a12b:free', // ✅ 262K ctx, best RAG
    'arcee-ai/trinity-large-preview:free',    // ✅ stable
    'liquid/lfm-2.5-1.2b-instruct:free',      // ✅ fast
    'liquid/lfm-2.5-1.2b-thinking:free',
    'meta-llama/llama-3.3-70b-instruct:free', // sometimes 429
    'google/gemma-4-31b-it:free',             // sometimes 429
    'google/gemma-3-27b-it:free',             // sometimes 429
    'nousresearch/hermes-3-llama-3.1-405b:free',
]

// Keywords that trigger semantic search enrichment
const FOOD_KEYWORDS = [
    'restaurant', 'cafe', 'bar', 'eat', 'food', 'dinner', 'lunch', 'breakfast',
    'coffee', 'cuisine', 'dish', 'menu', 'bistro', 'tavern', 'pub',
    'ресторан', 'кафе', 'бар', 'еда', 'ужин', 'обед', 'завтрак',
    'кофе', 'кухня', 'блюдо', 'restauracja', 'kawiarnia', 'jedzenie',
    'recommend', 'suggest', 'find', 'where', 'best', 'top', 'near',
    'найди', 'посоветуй', 'где', 'лучший', 'хочу', 'miejsce',
]

function hasLocationIntent(messages) {
    const lastMessages = messages.slice(-3).map(m => (m.content || '').toLowerCase())
    const text = lastMessages.join(' ')
    return FOOD_KEYWORDS.some(kw => text.includes(kw))
}

async function getSemanticContext(messages, baseUrl) {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return null

    const query = typeof lastUserMsg.content === 'string'
        ? lastUserMsg.content
        : lastUserMsg.content?.map?.(c => c.text || '').join(' ') || ''

    if (!query.trim()) return null

    try {
        const res = await fetch(`${baseUrl}/api/ai/semantic-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit: 5, threshold: 0.3 }),
        })
        if (!res.ok) return null
        const data = await res.json()
        if (!data.results?.length) return null

        const formatted = data.results.map((loc, i) => {
            const tags = loc.tags?.slice(0, 4).join(', ') || ''
            const vibe = loc.vibe?.slice(0, 2).join(', ') || ''
            return `${i + 1}. **${loc.title}** — ${loc.category}, ${loc.city}\n` +
                   `   Rating: ${loc.rating || 'N/A'} | Price: ${loc.price_level || 'N/A'} | Cuisine: ${loc.cuisine || 'N/A'}\n` +
                   `   ${loc.description?.slice(0, 120) || ''}\n` +
                   `   Tags: ${tags}${vibe ? ' | Vibe: ' + vibe : ''}`
        }).join('\n\n')

        return `## Relevant locations from GastroMap database (semantic search):\n\n${formatted}\n\n` +
               `Use these real locations when recommending. Always mention the name and city.`
    } catch (e) {
        console.error('[chat] semantic search failed:', e.message)
        return null
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey?.trim()) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })

    try {
        let { messages, model, max_tokens, tools, tool_choice, _direct_model, _skip_rag } = req.body

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array is required' })
        }

        // RAG enrichment: inject semantic search results into system context
        if (!_skip_rag && hasLocationIntent(messages)) {
            const protocol = req.headers['x-forwarded-proto'] || 'https'
            const host = req.headers['host'] || 'gastromap-five.vercel.app'
            const baseUrl = `${protocol}://${host}`

            const context = await getSemanticContext(messages, baseUrl)
            if (context) {
                const sysIdx = messages.findIndex(m => m.role === 'system')
                if (sysIdx >= 0) {
                    messages = messages.map((m, i) =>
                        i === sysIdx
                            ? { ...m, content: m.content + '\n\n' + context }
                            : m
                    )
                } else {
                    messages = [{ role: 'system', content: context }, ...messages]
                }
                console.log('[chat] RAG context injected from semantic search')
            }
        }

        // ── Direct model mode ─────────────────────────────────────────────────
        if (_direct_model && model) {
            const body = { model, messages, max_tokens: Math.min(max_tokens || 256, 4096) }
            if (tools) { body.tools = tools; body.tool_choice = tool_choice || 'auto' }
            const response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': 'https://gastromap.app', 'X-Title': 'GastroMap', 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const data = await response.json()
            data._model_used = model
            return res.status(response.status).json(data)
        }

        // ── Cascade mode ──────────────────────────────────────────────────────
        let startIdx = MODEL_CASCADE.indexOf(model)
        if (startIdx === -1) {
            return runCascade([model, ...MODEL_CASCADE], 0, { ...req.body, messages }, apiKey, res)
        }
        return runCascade(MODEL_CASCADE, startIdx, { ...req.body, messages }, apiKey, res)

    } catch (error) {
        console.error('[ai/chat proxy] Error:', error.message)
        return res.status(500).json({ error: 'AI proxy error' })
    }
}

async function runCascade(cascade, startIdx, reqBody, apiKey, res) {
    const { messages, max_tokens, tools, tool_choice } = reqBody

    let lastError = null
    const maxTokens = Math.min(max_tokens || 1024, 4096)

    for (let i = startIdx; i < cascade.length; i++) {
        const currentModel = cascade[i]
        const body = { model: currentModel, messages, max_tokens: maxTokens }
        if (tools) { body.tools = tools; body.tool_choice = tool_choice || 'auto' }

        try {
            const response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://gastromap.app',
                    'X-Title': 'GastroMap',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            })

            if (response.status === 429) {
                lastError = { error: { message: `429 on ${currentModel}` } }
                console.warn(`[ai/chat] 429 on ${currentModel}, trying next...`)
                await new Promise(r => setTimeout(r, 500))
                continue
            }

            const data = await response.json()
            if (data.error && (data.error.code === 429 || data.error.type === 'rate_limit')) {
                lastError = data
                continue
            }

            data._model_used = currentModel
            return res.status(response.ok ? 200 : response.status).json(data)

        } catch (err) {
            lastError = { error: { message: err.message } }
            console.warn(`[ai/chat] Error on ${currentModel}:`, err.message)
        }
    }

    return res.status(503).json({
        error: 'All AI models are currently rate-limited. Please try again in a minute.',
        last_error: lastError?.error?.message,
        models_tried: cascade.slice(startIdx),
    })
}
