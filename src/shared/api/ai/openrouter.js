/**
 * OpenRouter API Integration
 *
 * Sends chat completion requests to OpenRouter with automatic model cascade
 * (fallback chain) on rate-limit errors.
 */

import { getActiveAIConfig } from '../ai-config.api'
import { config } from '@/shared/config/env'
import { OPENROUTER_URL, MODEL_CASCADE, TOOLS } from './constants'

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
            headers['Authorization'] = `Bearer ${apiKey}`
            headers['HTTP-Referer'] = 'https://gastromap.app'
            headers['X-Title'] = 'GastroMap'
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            })

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
            // Only retry on rate-limit or server errors
            if (res.status !== 429 && res.status !== 500 && res.status !== 502 && res.status !== 503) {
                const msg = errBody?.error?.message ?? `OpenRouter error ${res.status}`
                throw Object.assign(new Error(msg), { status: res.status, errorData: errBody })
            }

            console.warn(`[GastroAI] Model ${currentModel} returned ${res.status}, trying next model...`)
        } catch (err) {
            // If it's a network error or non-retryable error, throw
            if (!err.status || (err.status !== 429 && err.status !== 500 && err.status !== 502 && err.status !== 503)) {
                throw err
            }
            console.warn(`[GastroAI] Model ${currentModel} failed:`, err.message)
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
