/**
 * AI / GastroIntelligence API via OpenRouter
 *
 * Features:
 * - Unified API for 300+ models (free & premium)
 * - Streaming support
 * - Multi-turn conversation history
 * - RAG-lite with location catalogue
 * - Automatic fallback to free models
 *
 * SECURITY:
 * - API key stored in VITE_OPENROUTER_API_KEY
 * - For production, proxy through edge function
 */

import { gastroIntelligence } from '@/services/gastroIntelligence'
import { config } from '@/shared/config/env'
import { ApiError } from './client'
import { MOCK_LOCATIONS } from '@/mocks/locations'

// ─── OpenRouter API Client ───────────────────────────────────────────────────

const OPENROUTER_BASE_URL = config.ai.openRouter.baseUrl

/**
 * Build headers for OpenRouter API
 * Includes app metadata for ranking & analytics
 */
function buildHeaders() {
    return {
        'Authorization': `Bearer ${config.ai.openRouter.apiKey}`,
        'HTTP-Referer': config.ai.openRouter.siteUrl,
        'X-Title': config.ai.openRouter.appName,
        'Content-Type': 'application/json',
    }
}

// ─── Location Catalogue (RAG-lite) ──────────────────────────────────────────

/**
 * Serialize the location catalogue into a compact string for the AI model.
 * Keeps token count low by only including fields relevant to recommendations.
 */
function buildLocationCatalogue(locations = MOCK_LOCATIONS) {
    return locations.map((loc) =>
        [
            `ID:${loc.id}`,
            `Name:${loc.title}`,
            `Category:${loc.category}`,
            `Cuisine:${loc.cuisine}`,
            `Vibe:${loc.vibe}`,
            `Price:${loc.priceLevel}`,
            `Rating:${loc.rating}`,
            `Hours:${loc.openingHours}`,
            `Tags:${loc.tags.join(',')}`,
            `Features:${(loc.features ?? []).join(',')}`,
            `Address:${loc.address}`,
        ].join(' | ')
    ).join('\n')
}

/**
 * Build the GastroGuide system prompt.
 * @param {Object} [userPrefs]  - prefs from useUserPrefsStore
 */
function buildSystemPrompt(userPrefs = {}, locations = MOCK_LOCATIONS) {
    const { favoriteCuisines = [], vibePreference = [], priceRange = [] } = userPrefs

    const prefSection = [
        favoriteCuisines.length ? `Favorite cuisines: ${favoriteCuisines.join(', ')}` : '',
        vibePreference.length ? `Preferred vibes: ${vibePreference.join(', ')}` : '',
        priceRange.length ? `Budget range: ${priceRange.join(', ')}` : '',
    ].filter(Boolean).join('\n')

    return `You are GastroGuide, a warm and knowledgeable AI dining assistant for GastroMap — a premium restaurant discovery app focused on Krakow, Poland.

PERSONALITY
- Friendly, enthusiastic, and concise (max 3 sentences per response)
- Always give concrete place names from the catalogue below — never invent venues
- When you recommend a place, always end with its ID so the app can link to it
- Use the language the user writes in (Polish, English, Ukrainian, etc.)

USER PREFERENCES
${prefSection || 'No preferences set yet — make varied recommendations'}

LOCATION CATALOGUE (Krakow)
${buildLocationCatalogue(locations)}

RESPONSE FORMAT
Respond in plain conversational text. When you recommend specific places from the catalogue, append a JSON block at the very end of your message (on its own line) listing the IDs of recommended locations, like this:
{"matches":["1","3"]}

If the user asks something not related to dining, gently redirect them. Never make up locations not in the catalogue.`
}

// ─── Intent Detection ────────────────────────────────────────────────────────

/**
 * @param {string} text
 * @returns {'recommendation' | 'info' | 'general'}
 */
function detectIntent(text) {
    const q = text.toLowerCase()
    if (q.match(/\b(recommend|where|best|find|eat|drink|cafe|coffee|dinner|lunch|breakfast|date|romantic|cozy)\b/)) {
        return 'recommendation'
    }
    if (q.match(/\b(open|close|hours|menu|price|book|reservation|phone|address)\b/)) {
        return 'info'
    }
    return 'general'
}

// ─── Parse matches from response ───────────────────────────────────────────

/**
 * Extract content text and matched location IDs from AI response.
 * @param {string} rawText
 * @returns {{ content: string, matchIds: string[] }}
 */
function parseResponse(rawText) {
    const jsonMatch = rawText.match(/\{"matches":\[.*?\]\}/)
    let content = rawText
    let matchIds = []

    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0])
            matchIds = parsed.matches ?? []
            // Remove the JSON block from the visible message
            content = rawText.replace(jsonMatch[0], '').trim()
        } catch {
            // Ignore parse errors — keep full text
        }
    }

    return { content, matchIds }
}

/**
 * Map location IDs to full location objects (for chat card attachments).
 * @param {string[]} ids
 */
function resolveMatches(ids) {
    return ids
        .map((id) => MOCK_LOCATIONS.find((loc) => loc.id === id))
        .filter(Boolean)
        .slice(0, 3)
}

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} AIResponse
 * @property {string}   content  - Text message to display in chat
 * @property {Array}    matches  - Matched location objects (up to 3)
 * @property {string}   intent   - 'recommendation' | 'info' | 'general'
 */

/**
 * Analyze a user query and return a GastroGuide response via OpenRouter.
 *
 * Uses OpenRouter API when VITE_OPENROUTER_API_KEY is set, otherwise falls back to
 * the local gastroIntelligence scoring engine (for offline dev / demo mode).
 *
 * @param {string} message
 * @param {{ preferences?: Object, history?: Array }} [context]
 * @returns {Promise<AIResponse>}
 */
export async function analyzeQuery(message, context = {}) {
    if (!message?.trim()) {
        throw new ApiError('Message cannot be empty', 400, 'EMPTY_MESSAGE')
    }

    const intent = detectIntent(message)
    const hasOpenRouterKey = Boolean(config.ai.openRouter.apiKey)

    // ── OpenRouter API path ────────────────────────────────────────────────────
    if (hasOpenRouterKey) {
        try {
            const model = config.ai.model || 'deepseek/deepseek-chat-v3-0324:free'
            const historyMessages = (context.history ?? [])
                .slice(-8)
                .filter((m) => m.role === 'user' || m.role === 'assistant')
                .map((m) => ({ role: m.role, content: m.content }))

            const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: buildSystemPrompt(context.preferences) },
                        ...historyMessages,
                        { role: 'user', content: message },
                    ],
                    max_tokens: config.ai.maxResponseTokens,
                    temperature: 0.7,
                }),
            })

            if (!response.ok) {
                const errorText = await response.text()
                if (response.status === 401) {
                    throw new ApiError('Invalid OpenRouter API key. Check VITE_OPENROUTER_API_KEY.', 401, 'OPENROUTER_AUTH')
                }
                if (response.status === 429) {
                    throw new ApiError('OpenRouter rate limit reached. Try again shortly.', 429, 'OPENROUTER_RATE_LIMIT')
                }
                throw new ApiError(`OpenRouter API error: ${response.status} - ${errorText}`, response.status, 'OPENROUTER_ERROR')
            }

            const data = await response.json()
            const rawText = data.choices?.[0]?.message?.content || ''
            const { content, matchIds } = parseResponse(rawText)

            return {
                content,
                matches: resolveMatches(matchIds),
                intent,
            }
        } catch (err) {
            if (err instanceof ApiError) {
                throw err
            }
            console.warn('[GastroAI] OpenRouter API error, falling back to local engine:', err.message)
        }
    }

    // ── Legacy Anthropic path (backward compatibility) ───────────────────────
    if (config.ai.apiKey) {
        try {
            const Anthropic = (await import('@anthropic-ai/sdk')).default
            const client = new Anthropic({
                apiKey: config.ai.apiKey,
                dangerouslyAllowBrowser: true,
            })

            const historyMessages = (context.history ?? [])
                .slice(-8)
                .filter((m) => m.role === 'user' || m.role === 'assistant')
                .map((m) => ({ role: m.role, content: m.content }))

            const response = await client.messages.create({
                model: config.ai.model,
                max_tokens: config.ai.maxResponseTokens,
                system: buildSystemPrompt(context.preferences),
                messages: historyMessages.concat({ role: 'user', content: message }),
            })

            const rawText = response.content
                .filter((block) => block.type === 'text')
                .map((block) => block.text)
                .join('')

            const { content, matchIds } = parseResponse(rawText)

            return {
                content,
                matches: resolveMatches(matchIds),
                intent,
            }
        } catch (err) {
            console.warn('[GastroAI] Anthropic API error, falling back to local engine:', err.message)
        }
    }

    // ── Local fallback path ────────────────────────────────────────────────
    const result = await gastroIntelligence.analyzeQuery(message)

    return {
        content: result.content,
        matches: result.matches ?? [],
        intent,
    }
}

/**
 * Streaming variant — yields text chunks as they arrive from OpenRouter.
 * Falls back to a single-shot response when streaming is unavailable.
 *
 * @param {string} message
 * @param {{ preferences?: Object, history?: Array }} [context]
 * @param {(chunk: string) => void} onChunk  - Called for each text delta
 * @returns {Promise<AIResponse>}
 */
export async function analyzeQueryStream(message, context = {}, onChunk) {
    if (!message?.trim()) {
        throw new ApiError('Message cannot be empty', 400, 'EMPTY_MESSAGE')
    }

    const intent = detectIntent(message)
    const hasOpenRouterKey = Boolean(config.ai.openRouter.apiKey)

    if (hasOpenRouterKey) {
        try {
            const model = config.ai.model || 'deepseek/deepseek-chat-v3-0324:free'
            const historyMessages = (context.history ?? [])
                .slice(-8)
                .filter((m) => m.role === 'user' || m.role === 'assistant')
                .map((m) => ({ role: m.role, content: m.content }))

            const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: buildSystemPrompt(context.preferences) },
                        ...historyMessages,
                        { role: 'user', content: message },
                    ],
                    max_tokens: config.ai.maxResponseTokens,
                    temperature: 0.7,
                    stream: true,
                }),
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new ApiError(`OpenRouter API error: ${response.status} - ${errorText}`, response.status, 'OPENROUTER_ERROR')
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let fullText = ''

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    const chunk = decoder.decode(value)
                    const lines = chunk.split('\n').filter((line) => line.startsWith('data: '))

                    for (const line of lines) {
                        const data = line.slice(6)
                        if (data === '[DONE]') continue

                        try {
                            const parsed = JSON.parse(data)
                            const content = parsed.choices?.[0]?.delta?.content || ''
                            if (content) {
                                fullText += content
                                onChunk(fullText)
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }
            } finally {
                reader.releaseLock()
            }

            const { content, matchIds } = parseResponse(fullText)

            return {
                content,
                matches: resolveMatches(matchIds),
                intent,
            }
        } catch (err) {
            console.warn('[GastroAI] OpenRouter streaming error, falling back to non-streaming:', err.message)
            // Fall back to non-streaming
            return await analyzeQuery(message, context)
        }
    }

    // Fallback to non-streaming
    return await analyzeQuery(message, context)
}

/**
 * Get available models from OpenRouter
 * @returns {Promise<Array>} List of models
 */
export async function getAvailableModels() {
    if (!config.ai.openRouter.apiKey) {
        return config.ai.freeModels.concat(config.ai.premiumModels)
    }

    try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
            headers: buildHeaders(),
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status}`)
        }

        const data = await response.json()
        return data.data || []
    } catch (err) {
        console.warn('[GastroAI] Failed to fetch OpenRouter models:', err.message)
        return config.ai.freeModels.concat(config.ai.premiumModels)
    }
}

/**
 * Test connection to OpenRouter
 * @returns {Promise<boolean>}
 */
export async function testConnection() {
    try {
        await analyzeQuery('Test', { preferences: {} })
        return true
    } catch {
        return false
    }
}
