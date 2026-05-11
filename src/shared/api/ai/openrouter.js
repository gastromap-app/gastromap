/**
 * OpenRouter API Integration
 *
 * Sends chat completion requests to OpenRouter with automatic model cascade
 * (fallback chain) on rate-limit errors and multi-key rotation.
 */

import { getActiveAIConfig } from '../ai-config.api'
import { config } from '@/shared/config/env'
import { OPENROUTER_URL, MODEL_CASCADE, TOOLS } from './constants'

/**
 * Multi-key rotation: when primary key hits rate-limit, switch to secondary.
 * Keys are read from env (VITE_OPENROUTER_API_KEY) and secondary (VITE_OPENROUTER_API_KEY_2).
 */
let _currentKeyIndex = 0

function getApiKeys(primaryKey) {
    const keys = [primaryKey].filter(Boolean)
    const secondary = import.meta.env.VITE_OPENROUTER_API_KEY_2
    if (secondary && !keys.includes(secondary)) keys.push(secondary)
    return keys
}

function rotateKey(keys) {
    _currentKeyIndex = (_currentKeyIndex + 1) % keys.length
    return keys[_currentKeyIndex]
}

/**
 * Send a chat completion request to OpenRouter.
 * Automatically tries multiple models in cascade on rate-limit errors.
 *
 * @param {Array}   messages - Chat messages array
 * @param {Object}  options - Request options
 * @param {boolean} [options.stream=false] - Enable streaming
 * @param {boolean} [options.withTools=true] - Include tool definitions for function calling
 * @param {string}  [options.modelOverride] - Override the default model selection
 * @returns {Promise<{response: Response, modelUsed: string}>} - Response object and model used
 */
export async function fetchOpenRouter(messages, { stream = false, withTools = true, modelOverride, temperature, maxTokens, cascade: adminCascade } = {}) {
    const { apiKey, model: activeModel, fallbackModel, useProxy } = getActiveAIConfig()
    const apiKeys = getApiKeys(apiKey)

    // Build cascade: start with preferred model, then try all others
    const preferredModel = modelOverride ?? activeModel
    const cascade = [preferredModel]

    // Add fallback model if different
    if (fallbackModel && fallbackModel !== preferredModel && !cascade.includes(fallbackModel)) {
        cascade.push(fallbackModel)
    }

    // Use admin cascade if provided, otherwise fall back to MODEL_CASCADE
    const fallbackList = (adminCascade && adminCascade.length > 0) ? adminCascade : MODEL_CASCADE

    // Always add all cascade models (even in proxy mode - proxy might not handle cascade)
    for (const m of fallbackList) {
        if (!cascade.includes(m)) {
            cascade.push(m)
        }
    }

    let lastError = null
    let lastStatus = 0
    let keyRotations = 0
    const maxKeyRotations = apiKeys.length // max 1 rotation per key

    for (let i = 0; i < cascade.length; i++) {
        const currentModel = cascade[i]

        const body = {
            model: currentModel,
            messages,
            max_tokens: maxTokens ?? config.ai.maxResponseTokens,
            stream,
        }
        if (temperature != null) {
            body.temperature = temperature
        }
        if (withTools) {
            body.tools = TOOLS
            body.tool_choice = 'auto'
        }

        const url = useProxy ? config.ai.proxyUrl : OPENROUTER_URL
        const headers = { 'Content-Type': 'application/json' }
        if (!useProxy) {
            const currentKey = apiKeys[_currentKeyIndex] || apiKey
            headers['Authorization'] = `Bearer ${currentKey}`
            headers['HTTP-Referer'] = 'https://gastromap.app'
            headers['X-Title'] = 'GastroMap'
        }

        try {
            // Per-model timeout: 15s is enough for a fast response, prevents total hang on slow server
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000)

            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (res.ok) {
                return { response: res, modelUsed: currentModel }
            }

            lastStatus = res.status

            // Parse error to get details
            const errBody = await res.json().catch(() => ({}))
            lastError = errBody

            // Skip 404 (deprecated/removed models) — try next in cascade
            if (res.status === 404) {
                console.warn(`[GastroAI] Model ${currentModel} is deprecated (404), skipping...`)
                continue
            }

            // Retry on rate-limit (429) or server errors (500, 502, 503, 504)
            const retryableErrors = [429, 500, 502, 503, 504]
            if (!retryableErrors.includes(res.status)) {
                const msg = errBody?.error?.message || `OpenRouter error ${res.status}`
                throw Object.assign(new Error(msg), { status: res.status, errorData: errBody })
            }

            // On 429: try rotating to another API key before moving to next model
            if (res.status === 429 && apiKeys.length > 1 && keyRotations < maxKeyRotations) {
                rotateKey(apiKeys)
                keyRotations++
                console.warn(`[GastroAI] Rate-limited, rotating to key #${_currentKeyIndex + 1}`)
                // Retry same model with new key (decrement i to retry)
                i--
                continue
            }

            console.warn(`[GastroAI] Model ${currentModel} returned ${res.status}, trying next model...`)
        } catch (err) {
            // Handle timeout or other network errors
            const isTimeout = err.name === 'AbortError'
            const isRetryableStatus = err.status && [429, 500, 502, 503, 504].includes(err.status)

            if (!isTimeout && !isRetryableStatus) {
                throw err
            }

            const reason = isTimeout ? 'timeout' : `status ${err.status}`
            console.warn(`[GastroAI] Model ${currentModel} failed (${reason}), trying next model...`)
        }
    }

    // All models exhausted - provide helpful error message
    const errorMsg = lastError?.error?.message || 'All AI models are currently rate-limited. Please try again in a few minutes or add your own OpenRouter API key in Admin Settings.'
    throw Object.assign(new Error(errorMsg), {
        status: lastStatus || 503,
        errorData: lastError,
        allModelsTried: cascade
    })
}
