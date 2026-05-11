/**
 * OpenRouter API Integration
 *
 * Sends chat completion requests to OpenRouter with automatic model cascade
 * (fallback chain) on rate-limit errors and multi-key rotation.
 * 
 * Strategy: "Racing" — when 2 API keys are available, sends parallel requests
 * with different model orders. First successful response wins.
 */

import { getActiveAIConfig } from '../ai-config.api'
import { config } from '@/shared/config/env'
import { OPENROUTER_URL, MODEL_CASCADE, TOOLS } from './constants'

/**
 * Multi-key support: reads primary + secondary keys from env.
 */
function getApiKeys(primaryKey) {
    const keys = [primaryKey].filter(Boolean)
    const secondary = import.meta.env.VITE_OPENROUTER_API_KEY_2
    if (secondary && !keys.includes(secondary)) keys.push(secondary)
    return keys
}

/**
 * Try a single model with a specific API key. Returns response or throws.
 */
async function tryModel(model, messages, { apiKey, useProxy, stream, withTools, temperature, maxTokens, timeout = 8000 }) {
    const body = {
        model,
        messages,
        max_tokens: maxTokens ?? config.ai.maxResponseTokens,
        stream,
    }
    if (temperature != null) body.temperature = temperature
    if (withTools) {
        body.tools = TOOLS
        body.tool_choice = 'auto'
    }

    const url = useProxy ? config.ai.proxyUrl : OPENROUTER_URL
    const headers = { 'Content-Type': 'application/json' }
    if (!useProxy) {
        headers['Authorization'] = `Bearer ${apiKey}`
        headers['HTTP-Referer'] = 'https://gastromap.app'
        headers['X-Title'] = 'GastroMap'
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (res.ok) return { response: res, modelUsed: model }

    // Parse error for diagnostics
    const errBody = await res.json().catch(() => ({}))
    const msg = errBody?.error?.message || `OpenRouter error ${res.status}`
    throw Object.assign(new Error(msg), { status: res.status, model, errorData: errBody })
}

/**
 * Run a cascade of models sequentially with a single API key.
 * Skips 404 (deprecated) and retries on 429/5xx.
 */
async function runCascade(cascade, messages, opts) {
    let lastError = null
    for (const model of cascade) {
        try {
            return await tryModel(model, messages, opts)
        } catch (err) {
            lastError = err
            const isTimeout = err.name === 'AbortError'
            const isRetryable = isTimeout || [429, 404, 500, 502, 503, 504].includes(err.status)
            
            if (!isRetryable) throw err
            
            const reason = isTimeout ? 'timeout' : err.status === 404 ? 'deprecated' : `${err.status}`
            console.warn(`[GastroAI] ${model} → ${reason}, next...`)
        }
    }
    throw lastError || new Error('All models exhausted')
}

/**
 * Send a chat completion request to OpenRouter.
 * 
 * Strategy:
 * - If 2 API keys available: race two cascades in parallel (different model order).
 *   First successful response wins, other is aborted.
 * - If 1 key: sequential cascade with 8s per-model timeout.
 * - Per-model timeout: 8s (was 15s) — free models that don't respond in 8s are likely overloaded.
 *
 * @param {Array}   messages - Chat messages array
 * @param {Object}  options - Request options
 * @returns {Promise<{response: Response, modelUsed: string}>}
 */
export async function fetchOpenRouter(messages, { stream = false, withTools = true, modelOverride, temperature, maxTokens, cascade: adminCascade } = {}) {
    const { apiKey, model: activeModel, fallbackModel, useProxy } = getActiveAIConfig()
    const apiKeys = getApiKeys(apiKey)

    // Build primary cascade
    const preferredModel = modelOverride ?? activeModel
    const primaryCascade = [preferredModel]
    if (fallbackModel && fallbackModel !== preferredModel) primaryCascade.push(fallbackModel)
    
    const fallbackList = (adminCascade?.length > 0) ? adminCascade : MODEL_CASCADE
    for (const m of fallbackList) {
        if (!primaryCascade.includes(m)) primaryCascade.push(m)
    }

    const baseOpts = { useProxy, stream, withTools, temperature, maxTokens, timeout: 8000 }

    // ── Single key: sequential cascade ──────────────────────────────────────
    if (apiKeys.length < 2) {
        return runCascade(primaryCascade, messages, { ...baseOpts, apiKey: apiKeys[0] })
    }

    // ── Two keys: race parallel cascades ────────────────────────────────────
    // Key 1 uses primary order, Key 2 uses reversed priority (different models first)
    const secondaryCascade = [...primaryCascade].reverse()

    const race1 = runCascade(primaryCascade.slice(0, 4), messages, { ...baseOpts, apiKey: apiKeys[0] })
    const race2 = runCascade(secondaryCascade.slice(0, 4), messages, { ...baseOpts, apiKey: apiKeys[1] })

    try {
        // Promise.any: first to succeed wins. If both fail, AggregateError is thrown.
        return await Promise.any([race1, race2])
    } catch {
        // Both races failed with their top-4 models. Try remaining models with key 1.
        console.warn('[GastroAI] Both racing cascades failed, trying remaining models...')
        return runCascade(primaryCascade.slice(4), messages, { ...baseOpts, apiKey: apiKeys[0] })
    }
}
