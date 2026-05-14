/**
 * OpenRouter API Integration (via Server Proxy)
 *
 * All requests route through server-side proxy endpoints.
 * The API key is never exposed to the client — it lives only on the server.
 *
 * Primary proxy: Supabase Edge Function (config.ai.proxyUrl)
 * Fallback proxy: Vercel Function (/api/ai/chat)
 */

import { getActiveAIConfig } from '../ai-config.api'
import { config } from '@/shared/config/env'
import { MODEL_CASCADE, TOOLS } from './constants'

/**
 * Send a chat completion request through the server proxy.
 *
 * The proxy handles API key injection and forwards to OpenRouter.
 * Client only sends Content-Type header — no Authorization needed.
 *
 * @param {Array}   messages - Chat messages array
 * @param {Object}  options - Request options
 * @returns {Promise<{response: Response, modelUsed: string}>}
 */
export async function fetchOpenRouter(messages, { stream = false, withTools = true, modelOverride, temperature, maxTokens, cascade } = {}) {
    const { model: activeModel, fallbackModel } = getActiveAIConfig()
    const preferredModel = modelOverride ?? activeModel

    const body = {
        messages,
        model: preferredModel,
        max_tokens: maxTokens || 1024,
    }
    if (withTools !== false) {
        body.tools = TOOLS
        body.tool_choice = 'auto'
    }
    if (temperature != null) body.temperature = temperature
    if (stream) body.stream = true
    if (cascade) body._cascade = cascade

    // Try proxy endpoints (no Authorization header — key is server-side)
    const proxyUrl = config.ai?.proxyUrl || '/api/ai/chat'
    const fallbackUrl = '/api/ai/chat'
    const urls = [proxyUrl, fallbackUrl].filter((u, i, a) => a.indexOf(u) === i) // dedupe

    for (const url of urls) {
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 20000)
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            })
            clearTimeout(timeoutId)
            if (res.ok || res.status < 500) {
                return { response: res, modelUsed: preferredModel }
            }
        } catch (err) {
            if (err.name === 'AbortError') continue
            console.warn(`[fetchOpenRouter] ${url} failed:`, err.message)
        }
    }
    throw new Error('All AI proxy endpoints failed')
}
