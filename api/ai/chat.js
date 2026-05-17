/**
 * Vercel Serverless Function — AI Chat Proxy
 *
 * Proxies requests to OpenRouter so the API key stays server-side.
 * Cascading model rotation on 429.
 * RAG: when messages contain food/location intent, enriches with semantic search results.
 */

import { setCorsHeaders } from '../_shared/cors.js'
import { applyRateLimit } from '../_shared/rate-limit.js'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Free fallback models for API Key 2 (no balance needed, tool calling + reasoning)
const FREE_FALLBACK_MODELS = [
    'google/gemma-4-31b-it:free',             // ✅ tool calling, 262K ctx, reasoning
    'google/gemma-3-27b-it:free',             // ✅ tool calling, 128K ctx
    'meta-llama/llama-3.3-70b-instruct:free', // ✅ tool calling
    'z-ai/glm-4.5-air:free',                  // ✅ 131K ctx, fast
]

// Keywords and RAG functions removed — client-side search_locations tool handles all retrieval

export default async function handler(req, res) {
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    // Mode validation — route embedding requests before chat rate-limit
    const { mode } = req.body
    if (mode && mode !== 'embedding') {
        return res.status(400).json({ error: `Unsupported mode: ${mode}` })
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    // Fallback key — separate OpenRouter account with free-tier models only (no balance needed)
    const apiKeyFallback = process.env.OPENROUTER_API_KEY_2 || null
    if (!apiKey?.trim()) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })

    // Route to embedding handler if mode is 'embedding'
    if (mode === 'embedding') {
        return handleEmbedding(req, res, apiKey)
    }

    // Chat mode — apply chat-specific rate limit
    if (applyRateLimit(req, res, 'ai-chat', { maxRequests: 10, windowMs: 60000 })) return

    try {
        let { messages, model, max_tokens, tools, tool_choice, _direct_model, _skip_rag, _cascade, _session_id, _user_id } = req.body

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array is required' })
        }

        // _skip_rag is now a no-op — server-side RAG removed; client-side tools handle retrieval

        // Cap max_tokens at 4096 for all chat modes
        const cappedMaxTokens = Math.min(max_tokens || 1024, 4096)

        // ── Direct model mode (paid model — skip cascade, but fall through to free on failure) ──
        if (_direct_model && model) {
            const body = { model, messages, max_tokens: cappedMaxTokens }
            if (tools) { body.tools = tools; body.tool_choice = tool_choice || 'auto' }
            if (_session_id) body.session_id = _session_id
            if (_user_id) body.user = _user_id
            try {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 10000)
                const response = await fetch(OPENROUTER_URL, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': 'https://gastromap.app', 'X-Title': 'GastroMap', 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                })
                clearTimeout(timeoutId)
                if (response.ok || (response.status < 500 && response.status !== 429)) {
                    const data = await response.json()
                    if (!data.error || data.choices?.length) {
                        data._model_used = model
                        return res.status(response.status).json(data)
                    }
                }
                // Direct model failed — fall through to free tier below
                console.warn(`[ai/chat] Direct model ${model} failed (${response.status}), falling back to free tier`)
            } catch (err) {
                console.warn(`[ai/chat] Direct model ${model} error: ${err.message}, falling back to free tier`)
            }
            // Fall through to free fallback models with Key 2
            if (apiKeyFallback) {
                const tier2Result = await runCascade(FREE_FALLBACK_MODELS, 0, { ...req.body, messages, max_tokens: cappedMaxTokens }, apiKeyFallback, res, true)
                if (tier2Result) return
            }
            return res.status(503).json({ error: 'All AI models unavailable' })
        }

        // ── Two-tier cascade: ──────────────────────────────────────────────────
        // Tier 1: Admin cascade (paid models) with API Key 1
        // Tier 2: Free fallback models with API Key 2 (if Key 1 fails entirely)
        const adminCascade = (Array.isArray(_cascade) && _cascade.length > 0) ? _cascade : [model]
        
        // Try admin cascade with primary API key first
        const tier1Result = await runCascade(adminCascade, 0, { ...req.body, messages, max_tokens: cappedMaxTokens }, apiKey, res, false)
        if (tier1Result) return // Success — response already sent

        // Tier 1 failed → try free models with fallback API key
        if (apiKeyFallback) {
            console.warn('[ai/chat] Tier 1 (paid) failed, falling back to free models with Key 2')
            const tier2Result = await runCascade(FREE_FALLBACK_MODELS, 0, { ...req.body, messages, max_tokens: cappedMaxTokens }, apiKeyFallback, res, true)
            if (tier2Result) return
        }

        // Both tiers failed
        return res.status(503).json({ error: 'All AI models are currently unavailable. Please try again in a minute.' })

    } catch (error) {
        console.error('[ai/chat proxy] Error:', error.message)
        return res.status(500).json({ error: 'AI proxy error' })
    }
}

async function handleEmbedding(req, res, apiKey) {
    const { input, model, dimensions } = req.body

    // Validation
    if (!input || typeof input !== 'string' || !input.trim()) {
        return res.status(400).json({ error: 'input string is required for embedding mode' })
    }
    if (input.length > 2000) {
        return res.status(400).json({ error: 'input exceeds maximum length of 2000 characters' })
    }

    // Rate limit: 20 req/60s for embeddings
    if (applyRateLimit(req, res, 'ai-embedding', { maxRequests: 20, windowMs: 60000 })) return

    const EMBEDDING_MODELS = [
        { name: model || 'openai/text-embedding-3-small', dimensions: dimensions || 768 },
        { name: 'nvidia/nemotron-embed-20250702:free', dimensions: dimensions || 768 },
    ]

    for (const { name: embModel, dimensions: dims } of EMBEDDING_MODELS) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://gastromap.app',
                    'X-Title': 'GastroMap',
                },
                body: JSON.stringify({ model: embModel, input: input.trim(), dimensions: dims }),
            })

            if (!response.ok) {
                console.warn(`[ai/chat] embedding model ${embModel} failed: ${response.status}`)
                continue
            }

            const data = await response.json()
            const embedding = data.data?.[0]?.embedding
            if (embedding?.length > 0) {
                return res.status(200).json({ data: [{ embedding }], model: embModel })
            }
        } catch (err) {
            console.error(`[ai/chat] embedding error for ${embModel}:`, err.message)
            continue
        }
    }

    return res.status(502).json({ error: 'Embedding generation failed' })
}

/**
 * Try models in cascade order with a single API key.
 * Returns true if response was sent, false if all models failed.
 */
async function runCascade(cascade, startIdx, reqBody, apiKey, res, isFallbackTier = false) {
    const { messages, max_tokens, tools, tool_choice, _session_id, _user_id } = reqBody

    let lastError = null
    const maxTokens = max_tokens || 1024
    const maxAttempts = isFallbackTier ? 4 : 2 // Free tier: try all 4, Paid tier: try 2

    for (let i = startIdx; i < cascade.length && (i - startIdx) < maxAttempts; i++) {
        const currentModel = cascade[i]
        const body = { model: currentModel, messages, max_tokens: maxTokens }
        if (tools) { body.tools = tools; body.tool_choice = tool_choice || 'auto' }
        if (_session_id) body.session_id = _session_id
        if (_user_id) body.user = _user_id

        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 8000)
            const response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://gastromap.app',
                    'X-Title': 'GastroMap',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            })
            clearTimeout(timeoutId)

            if (response.status === 429) {
                lastError = { error: { message: `429 on ${currentModel}` } }
                console.warn(`[ai/chat] 429 on ${currentModel}, trying next model...`)
                continue
            }

            if (response.status >= 500) {
                lastError = { error: { message: `${response.status} on ${currentModel}` } }
                console.warn(`[ai/chat] ${response.status} on ${currentModel}, trying next model...`)
                continue
            }

            if (response.status === 401) {
                lastError = { error: { message: `401 on ${currentModel} — invalid key` } }
                console.warn(`[ai/chat] 401 on ${currentModel} — key invalid for this tier`)
                break // Don't retry with same key
            }

            const data = await response.json()
            if (data.error && !data.choices?.length) {
                lastError = data
                console.warn(`[ai/chat] Model error on ${currentModel}:`, data.error.message || data.error)
                continue
            }

            data._model_used = currentModel
            res.status(200).json(data)
            return true // Success

        } catch (err) {
            lastError = { error: { message: err.message } }
            if (err.name === 'AbortError') {
                console.warn(`[ai/chat] Timeout on ${currentModel} (8s), trying next...`)
            } else {
                console.warn(`[ai/chat] Error on ${currentModel}:`, err.message)
            }
        }
    }

    return false // All attempts failed
}
