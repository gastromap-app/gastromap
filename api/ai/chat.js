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

// TAIL FALLBACK — primary model is passed via req.body.model from the client
// (which reads it from AdminAIPage → useAppConfigStore). This list kicks in
// only if the primary model fails. Updated 2026-04-14.
const MODEL_CASCADE = [
    'google/gemma-4-31b-it:free',             // ✅ tool calling, 262K ctx, 140+ languages
    'nvidia/nemotron-3-super-120b-a12b:free', // ✅ 262K ctx, best RAG, XML tool calls
    'google/gemma-3-27b-it:free',             // ✅ tool calling, 128K ctx
    'z-ai/glm-4.5-air:free',                  // ✅ 131K ctx, fast
    'openai/gpt-oss-120b:free',               // ⚠️ may not support native tools
    'meta-llama/llama-3.3-70b-instruct:free', // ✅ tool calling
    'openai/gpt-oss-20b:free',                // fast fallback
    'nousresearch/hermes-3-llama-3.1-405b:free', // XML tool calls
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
    const apiKeyFallback = process.env.OPENROUTER_API_KEY_2 || null
    if (!apiKey?.trim()) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })

    // Route to embedding handler if mode is 'embedding'
    if (mode === 'embedding') {
        return handleEmbedding(req, res, apiKey)
    }

    // Chat mode — apply chat-specific rate limit
    if (applyRateLimit(req, res, 'ai-chat', { maxRequests: 10, windowMs: 60000 })) return

    try {
        let { messages, model, max_tokens, tools, tool_choice, _direct_model, _skip_rag, _cascade } = req.body

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array is required' })
        }

        // _skip_rag is now a no-op — server-side RAG removed; client-side tools handle retrieval

        // Cap max_tokens at 4096 for all chat modes
        const cappedMaxTokens = Math.min(max_tokens || 1024, 4096)

        // ── Direct model mode ─────────────────────────────────────────────────
        if (_direct_model && model) {
            const body = { model, messages, max_tokens: cappedMaxTokens }
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
        // Use client-provided cascade (from admin config) if available, otherwise server default
        const activeCascade = (Array.isArray(_cascade) && _cascade.length > 0) ? _cascade : MODEL_CASCADE
        let startIdx = activeCascade.indexOf(model)
        if (startIdx === -1) {
            return runCascade([model, ...activeCascade], 0, { ...req.body, messages, max_tokens: cappedMaxTokens }, [apiKey, apiKeyFallback].filter(Boolean), res)
        }
        return runCascade(activeCascade, startIdx, { ...req.body, messages, max_tokens: cappedMaxTokens }, [apiKey, apiKeyFallback].filter(Boolean), res)

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

async function runCascade(cascade, startIdx, reqBody, apiKeys, res) {
    const { messages, max_tokens, tools, tool_choice } = reqBody
    const keys = Array.isArray(apiKeys) ? apiKeys : [apiKeys]

    let lastError = null
    const maxTokens = max_tokens || 1024
    let currentKeyIdx = 0
    const maxAttempts = 2 // Vercel Hobby: 10s limit → max 2 models × 4.5s each

    for (let i = startIdx; i < cascade.length && (i - startIdx) < maxAttempts; i++) {
        const currentModel = cascade[i]
        const body = { model: currentModel, messages, max_tokens: maxTokens }
        if (tools) { body.tools = tools; body.tool_choice = tool_choice || 'auto' }

        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 3500) // 3.5s per model — 2 attempts × 3.5s = 7s + overhead < 10s Vercel limit
            const response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${keys[currentKeyIdx]}`,
                    'HTTP-Referer': 'https://gastromap.app',
                    'X-Title': 'GastroMap',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            })
            clearTimeout(timeoutId)

            // If 401 (invalid key) or 429 (rate limited) — try fallback key
            if ((response.status === 401 || response.status === 429) && currentKeyIdx < keys.length - 1) {
                currentKeyIdx++
                console.warn(`[ai/chat] Key ${currentKeyIdx} failed (${response.status}), switching to fallback key`)
                i-- // retry same model with new key
                continue
            }

            if (response.status === 429) {
                lastError = { error: { message: `429 on ${currentModel}` } }
                console.warn(`[ai/chat] 429 on ${currentModel}, trying next model...`)
                continue
            }

            // Any 5xx error → try next model (don't return error to client)
            if (response.status >= 500) {
                lastError = { error: { message: `${response.status} on ${currentModel}` } }
                console.warn(`[ai/chat] ${response.status} on ${currentModel}, trying next model...`)
                continue
            }

            const data = await response.json()
            if (data.error && (data.error.code === 429 || data.error.type === 'rate_limit')) {
                lastError = data
                continue
            }

            // If model returned an error in the body (not HTTP error) → try next
            if (data.error && !data.choices?.length) {
                lastError = data
                console.warn(`[ai/chat] Model error on ${currentModel}:`, data.error.message || data.error)
                continue
            }

            data._model_used = currentModel
            return res.status(200).json(data)

        } catch (err) {
            lastError = { error: { message: err.message } }
            if (err.name === 'AbortError') {
                console.warn(`[ai/chat] Timeout on ${currentModel} (8s), trying next...`)
            } else {
                console.warn(`[ai/chat] Error on ${currentModel}:`, err.message)
            }
            // Always continue to next model on any error
        }
    }

    return res.status(503).json({
        error: 'All AI models are currently rate-limited. Please try again in a minute.',
        last_error: lastError?.error?.message,
        models_tried: cascade.slice(startIdx),
    })
}
