/**
 * AI / GastroIntelligence API
 *
 * Two modes:
 *  1. PRODUCTION — Claude API via @anthropic-ai/sdk when VITE_AI_API_KEY is set.
 *     Uses RAG-lite: injects a curated location catalogue into the system prompt so
 *     Claude can make factual recommendations without hallucinating restaurant names.
 *
 *  2. DEVELOPMENT FALLBACK — local scoring engine when API key is absent.
 *     Enables full offline dev without burning API credits.
 *
 * ⚠️ SECURITY NOTE:
 *   VITE_AI_API_KEY is embedded in the client bundle at build time.
 *   For production, proxy all Claude calls through a server-side edge function
 *   (Cloudflare Worker, Vercel Edge, etc.) and remove the key from VITE_ env vars.
 *
 * The public interface (analyzeQuery, analyzeQueryStream) is stable — components
 * never import from this file directly, they go through @/shared/api/queries.
 */

import Anthropic from '@anthropic-ai/sdk'
import { gastroIntelligence } from '@/services/gastroIntelligence'
import { config } from '@/shared/config/env'
import { ApiError } from './client'
import { MOCK_LOCATIONS } from '@/mocks/locations'

// ─── Anthropic client (lazy, only when key present) ───────────────────────

let _client = null

function getClient() {
    if (!config.ai.apiKey) return null
    if (!_client) {
        _client = new Anthropic({
            apiKey: config.ai.apiKey,
            // dangerouslyAllowBrowser: true — required when calling from a browser context.
            // Remove this line once the API is proxied through a server-side edge function.
            dangerouslyAllowBrowser: true,
        })
    }
    return _client
}

// ─── RAG-lite: build a compact location catalogue for the system prompt ───

/**
 * Serialize the location catalogue into a compact string Claude can reason over.
 * Keeps token count low by only including fields relevant to recommendations.
 */
function buildLocationCatalogue() {
    return MOCK_LOCATIONS.map((loc) =>
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
function buildSystemPrompt(userPrefs = {}) {
    const { favoriteCuisines = [], vibePreference = [], priceRange = [] } = userPrefs

    const prefSection = [
        favoriteCuisines.length ? `Favourite cuisines: ${favoriteCuisines.join(', ')}` : '',
        vibePreference.length ? `Preferred vibes: ${vibePreference.join(', ')}` : '',
        priceRange.length ? `Budget range: ${priceRange.join(', ')}` : '',
    ].filter(Boolean).join('\n')

    return `You are GastroGuide, a warm and knowledgeable AI dining assistant for GastroMap — a premium restaurant discovery app focused on Krakow, Poland.

PERSONALITY
- Friendly, enthusiastic, and concise (max 3 sentences per response)
- Always give concrete place names from the catalogue below — never invent venues
- When you recommend a place, always end with its ID so the app can link to it

USER PREFERENCES
${prefSection || 'No preferences set yet — make varied recommendations'}

LOCATION CATALOGUE (Krakow)
${buildLocationCatalogue()}

RESPONSE FORMAT
Respond in plain conversational English. When you recommend specific places from the catalogue, append a JSON block at the very end of your message (on its own line) listing the IDs of recommended locations, like this:
{"matches":["1","3"]}

If the user asks something not related to dining, gently redirect them. Never make up locations not in the catalogue.`
}

// ─── Intent detection (lightweight, no LLM needed) ────────────────────────

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

// ─── Parse matches from Claude response ───────────────────────────────────

/**
 * Extract content text and matched location IDs from Claude's response.
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
 * Analyze a user query and return a GastroGuide response.
 *
 * Uses Claude API when VITE_AI_API_KEY is set, otherwise falls back to the
 * local gastroIntelligence scoring engine (for offline dev / demo mode).
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
    const client = getClient()

    // ── Claude API path ────────────────────────────────────────────────────
    if (client) {
        try {
            // Build conversation history for multi-turn context
            const historyMessages = (context.history ?? [])
                .slice(-8) // last 4 exchanges = 8 messages
                .filter((m) => m.role === 'user' || m.role === 'assistant')
                .map((m) => ({ role: m.role, content: m.content }))

            const allMessages = [
                ...historyMessages,
                { role: 'user', content: message },
            ]

            const response = await client.messages.create({
                model: config.ai.model,
                max_tokens: config.ai.maxResponseTokens,
                system: buildSystemPrompt(context.preferences),
                messages: allMessages,
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
            // Surface auth / rate-limit errors; silently fall through for network issues
            if (err.status === 401) {
                throw new ApiError('Invalid Claude API key. Check VITE_AI_API_KEY.', 401, 'CLAUDE_AUTH')
            }
            if (err.status === 429) {
                throw new ApiError('Claude API rate limit reached. Try again shortly.', 429, 'CLAUDE_RATE_LIMIT')
            }
            // Fall through to local engine on any other error
            console.warn('[GastroAI] Claude API error, falling back to local engine:', err.message)
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
 * Streaming variant — yields text chunks as they arrive from Claude.
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
    const client = getClient()

    if (client) {
        try {
            const historyMessages = (context.history ?? [])
                .slice(-8)
                .filter((m) => m.role === 'user' || m.role === 'assistant')
                .map((m) => ({ role: m.role, content: m.content }))

            let fullText = ''

            const stream = await client.messages.stream({
                model: config.ai.model,
                max_tokens: config.ai.maxResponseTokens,
                system: buildSystemPrompt(context.preferences),
                messages: [
                    ...historyMessages,
                    { role: 'user', content: message },
                ],
            })

            for await (const chunk of stream) {
                if (
                    chunk.type === 'content_block_delta' &&
                    chunk.delta?.type === 'text_delta'
                ) {
                    fullText += chunk.delta.text
                    onChunk?.(chunk.delta.text)
                }
            }

            const { content, matchIds } = parseResponse(fullText)

            return {
                content,
                matches: resolveMatches(matchIds),
                intent,
            }
        } catch (err) {
            if (err.status === 401) {
                throw new ApiError('Invalid Claude API key.', 401, 'CLAUDE_AUTH')
            }
            console.warn('[GastroAI] Streaming error, falling back to single-shot:', err.message)
        }
    }

    // Fallback: non-streaming
    return analyzeQuery(message, context)
}
