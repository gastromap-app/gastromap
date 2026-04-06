/**
 * Vercel Serverless Function — AI Chat Proxy
 *
 * Proxies requests to OpenRouter so the API key stays server-side.
 * The OPENROUTER_API_KEY env var (no VITE_ prefix) is only available here.
 *
 * Cascading model rotation: when a model is rate-limited (429),
 * automatically retry with the next free model until one succeeds.
 *
 * Special flag: _direct_model=true bypasses cascade and uses exactly the
 * requested model (used by AdminAIPage test panel).
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * All free models supported on client — proxy must know ALL of them.
 * When _direct_model=false, cascade starts from the requested model index.
 * Updated: April 2026.
 */
// Updated April 2026 — only confirmed live models
const MODEL_CASCADE = [
    'openai/gpt-oss-120b:free',                 // GPT-OSS 120B — best JSON quality
    'meta-llama/llama-3.3-70b-instruct:free',   // Llama 3.3 70B — reliable
    'google/gemma-3-27b-it:free',               // Gemma 3 27B — vision + multilingual
    'nvidia/nemotron-3-super-120b-a12b:free',   // Nemotron Super — 262K ctx, RAG
    'openai/gpt-oss-20b:free',                  // GPT-OSS 20B — Apache 2.0
    'stepfun/step-3.5-flash:free',              // Step 3.5 Flash — fastest
    'nvidia/nemotron-nano-9b-v2:free',          // Nemotron Nano 9B — high availability
    'qwen/qwen3.6-plus:free',                   // Qwen3.6 Plus — 1M context
    'qwen/qwen3-next-80b-a3b-instruct:free',    // Qwen3 Next 80B — MoE
    'minimax/minimax-m2.5:free',                // MiniMax M2.5 — large context
    'z-ai/glm-4.5-air:free',                    // GLM-4.5-Air — multilingual
    'nousresearch/hermes-3-llama-3.1-405b:free',// Hermes 3 405B — largest free
]

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey || apiKey.trim() === '') {
        return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured on server' })
    }

    try {
        const { messages, model, max_tokens, tools, tool_choice, _direct_model } = req.body

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array is required' })
        }

        // ── Direct model mode (used by test panel) ────────────────────────────
        // No cascade — test exactly the requested model and return its raw response.
        if (_direct_model && model) {
            const body = {
                model,
                messages,
                max_tokens: Math.min(max_tokens || 256, 4096),
            }
            if (tools) {
                body.tools = tools
                body.tool_choice = tool_choice || 'auto'
            }

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

            const data = await response.json()
            data._model_used = model
            return res.status(response.status).json(data)
        }

        // ── Cascade mode (normal chat) ────────────────────────────────────────
        // Start cascade from the requested model index (or 0 if unknown).
        let startIdx = MODEL_CASCADE.indexOf(model)
        if (startIdx === -1) {
            // Unknown model — prepend it to the cascade so it's tried first
            const dynamicCascade = [model, ...MODEL_CASCADE]
            return runCascade(dynamicCascade, 0, req.body, apiKey, res)
        }

        return runCascade(MODEL_CASCADE, startIdx, req.body, apiKey, res)
    } catch (error) {
        console.error('[ai/chat proxy] Error:', error.message)
        return res.status(500).json({ error: 'AI proxy error' })
    }
}

async function runCascade(cascade, startIdx, reqBody, apiKey, res) {
    const { messages, max_tokens, tools, tool_choice } = reqBody
    let lastError = null

    for (let i = startIdx; i < cascade.length; i++) {
        const currentModel = cascade[i]

        const body = {
            model: currentModel,
            messages,
            max_tokens: Math.min(max_tokens || 1024, 4096),
        }
        if (tools) {
            body.tools = tools
            body.tool_choice = tool_choice || 'auto'
        }

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

        const data = await response.json()

        if (response.ok) {
            data._model_used = currentModel
            return res.status(200).json(data)
        }

        lastError = data

        const status = response.status
        if (status !== 429 && status !== 500 && status !== 502 && status !== 503 && status !== 400 && status !== 404) {
            return res.status(status).json(data)
        }

        console.log()
    }

    console.error('[ai/chat] All models failed:', lastError)
    return res.status(503).json({
        error: 'All AI models are currently rate-limited. Please try again in a minute.',
        last_error: lastError?.error?.message,
        models_tried: cascade.slice(startIdx),
    })
}
