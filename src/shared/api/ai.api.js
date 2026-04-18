/**
 * AI / GastroIntelligence API via OpenRouter
 *
 * Two modes:
 *  1. PRODUCTION — OpenRouter API (free models) when VITE_OPENROUTER_API_KEY is set.
 *     Uses Tool Use (function calling): model decides which filters to apply,
 *     calls search_locations / get_location_details, then generates a response.
 *     Locations are NOT injected into the system prompt — only requested results
 *     are in context, keeping token count minimal.
 *
 *  2. DEVELOPMENT FALLBACK — local scoring engine when no API key.
 *     Full offline dev without any API cost.
 *
 * Model cascade (all free via OpenRouter, tried in order on 429):
 *   1. meta-llama/llama-3.3-70b-instruct:free  (131K ctx, tool use)
 *   2. google/gemma-3-27b-it:free              (vision + multilingual)
 *   3. qwen/qwen3-coder:free                   (262K ctx)
 *   4. openai/gpt-oss-20b:free
 *   5. stepfun/step-3.5-flash:free             (fastest)
 *   6. z-ai/glm-4.5-air:free
 *
 * ⚠️  SECURITY NOTE:
 *   VITE_OPENROUTER_API_KEY is embedded in the client bundle.
 *   For production, proxy all AI calls through a server-side edge function.
 */

import { gastroIntelligence } from '@/services/gastroIntelligence'
import { config } from '@/shared/config/env'
import { ApiError } from './client'
import { useLocationsStore } from '@/features/public/hooks/useLocationsStore'
import { useAppConfigStore } from '@/store/useAppConfigStore'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// ─── Model cascade — tried in order on 429 ───────────────────────────────
// ✅ Updated 2026-04-18: llama-3.3-70b moved to #1 (most stable), trinity-large removed (EOL)
const MODEL_CASCADE = [
    'meta-llama/llama-3.3-70b-instruct:free', // ✅ Most reliable, tool calling
    'openai/gpt-oss-120b:free',               // ✅ 131K ctx, best quality (intermittent 503)
    'openai/gpt-oss-20b:free',                // ✅ Reliable, fast
    'z-ai/glm-4.5-air:free',                  // ✅ Multilingual
    'nvidia/nemotron-nano-9b:free',            // ✅ Lightweight last resort
]

/**
 * Get active AI config — admin store overrides env vars at runtime.
 * Admin can change model/key in AdminAIPage without redeploying.
 */
function getActiveAIConfig() {
    const appCfg = useAppConfigStore.getState()
    return {
        apiKey:        appCfg.aiApiKey        || config.ai.openRouterKey,
        model:         appCfg.aiPrimaryModel  || config.ai.model || MODEL_CASCADE[0],
        fallbackModel: appCfg.aiFallbackModel || config.ai.modelFallback || MODEL_CASCADE[1],
    }
}

// ─── Tool definitions (OpenAI function calling format) ────────────────────

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'search_locations',
            description: 'Search gastro locations (restaurants, cafes, bars) by filters. ALWAYS call this tool before making any specific recommendations. Do not recommend places you have not retrieved via this tool.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name, e.g. "Krakow"',
                    },
                    cuisine: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Cuisine types, e.g. ["French", "Italian", "Polish"]',
                    },
                    vibe: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Atmosphere vibes, e.g. ["Romantic", "Casual", "Sophisticated", "Energetic"]',
                    },
                    price_level: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Price levels: "$", "$$", "$$$", "$$$$"',
                    },
                    category: {
                        type: 'string',
                        description: 'Category: Restaurant, Cafe, Bar, Fine Dining, Street Food',
                    },
                    features: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Features, e.g. ["outdoor seating", "wifi", "pet-friendly", "river view"]',
                    },
                    best_for: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Occasion, e.g. ["date", "family", "business", "solo", "party", "anniversary"]',
                    },
                    dietary: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Dietary needs, e.g. ["vegan", "vegetarian", "gluten-free"]',
                    },
                    min_rating: {
                        type: 'number',
                        description: 'Minimum rating (1–5)',
                    },
                    keyword: {
                        type: 'string',
                        description: 'Free-text keyword to match against name, description, tags, and hidden ai_keywords (e.g. "proposal spot", "jazz", "sunday brunch")',
                    },
                    michelin: {
                        type: 'boolean',
                        description: 'True to filter only Michelin-recognized places',
                    },
                    limit: {
                        type: 'integer',
                        description: 'Max results to return (default 5)',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_location_details',
            description: 'Get full details for a specific location by ID, including insider tips, dishes to try, and expert notes.',
            parameters: {
                type: 'object',
                properties: {
                    location_id: {
                        type: 'string',
                        description: 'The location ID',
                    },
                },
                required: ['location_id'],
            },
        },
    },
]

// ─── Client-side tool executor ────────────────────────────────────────────

function executeTool(name, args) {
    const { locations } = useLocationsStore.getState()

    if (name === 'search_locations') {
        const {
            city, cuisine, vibe, price_level, category,
            features, best_for, dietary, min_rating, keyword, michelin, limit = 5
        } = args

        let results = [...locations]

        if (city) {
            const c = city.toLowerCase()
            results = results.filter(l =>
                l.city?.toLowerCase().includes(c) ||
                l.address?.toLowerCase().includes(c)
            )
        }
        if (category) {
            results = results.filter(l => l.category?.toLowerCase() === category.toLowerCase())
        }
        if (cuisine?.length) {
            results = results.filter(l =>
                cuisine.some(c => l.cuisine?.toLowerCase().includes(c.toLowerCase()))
            )
        }
        if (vibe?.length) {
            results = results.filter(l => {
                const locVibes = Array.isArray(l.vibe) ? l.vibe : [l.vibe]
                return vibe.some(v =>
                    locVibes.some(lv => lv?.toLowerCase().includes(v.toLowerCase()))
                )
            })
        }
        if (price_level?.length) {
            results = results.filter(l => price_level.includes(l.priceLevel))
        }
        if (min_rating) {
            results = results.filter(l => (l.rating ?? 0) >= min_rating)
        }
        if (features?.length) {
            results = results.filter(l => {
                const locFeatures = (l.features ?? []).map(f => f.toLowerCase())
                return features.some(f =>
                    locFeatures.some(lf => lf.includes(f.toLowerCase()))
                )
            })
        }
        if (best_for?.length) {
            results = results.filter(l => {
                const locBestFor = Array.isArray(l.best_for) ? l.best_for : []
                return best_for.some(b =>
                    locBestFor.some(lb => lb.toLowerCase().includes(b.toLowerCase()))
                )
            })
        }
        if (dietary?.length) {
            results = results.filter(l => {
                const locDietary = (l.dietary ?? []).map(d => d.toLowerCase())
                return dietary.some(d =>
                    locDietary.some(ld => ld.includes(d.toLowerCase()))
                )
            })
        }
        if (michelin) {
            results = results.filter(l => l.michelin_stars > 0 || l.michelin_bib)
        }
        if (keyword) {
            const kw = keyword.toLowerCase()
            results = results.filter(l =>
                l.title?.toLowerCase().includes(kw) ||
                l.description?.toLowerCase().includes(kw) ||
                l.tags?.some(t => t.toLowerCase().includes(kw)) ||
                l.ai_keywords?.some(k => k.toLowerCase().includes(kw)) ||
                l.ai_context?.toLowerCase().includes(kw) ||
                l.insider_tip?.toLowerCase().includes(kw) ||
                l.what_to_try?.some(w => w.toLowerCase().includes(kw))
            )
        }

        results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        results = results.slice(0, limit)

        return results.map(l => ({
            id: l.id,
            name: l.title,
            category: l.category,
            cuisine: l.cuisine,
            vibe: l.vibe,
            price_level: l.priceLevel,
            rating: l.rating,
            address: l.address,
            opening_hours: l.openingHours,
            phone: l.phone ?? null,
            website: l.website ?? null,
            features: l.features ?? [],
            best_for: l.best_for ?? [],
            dietary: l.dietary ?? [],
            michelin_stars: l.michelin_stars ?? 0,
            michelin_bib: l.michelin_bib ?? false,
            description: l.description,
            insider_tip: l.insider_tip ?? null,
            what_to_try: l.what_to_try ?? [],
            ai_context: l.ai_context ?? null,
        }))
    }

    if (name === 'get_location_details') {
        const { locations } = useLocationsStore.getState()
        const loc = locations.find(l => l.id === args.location_id)
        if (!loc) return { error: 'Location not found' }
        return {
            id: loc.id,
            name: loc.title,
            category: loc.category,
            cuisine: loc.cuisine,
            description: loc.description,
            address: loc.address,
            phone: loc.phone ?? null,
            website: loc.website ?? null,
            opening_hours: loc.openingHours,
            rating: loc.rating,
            features: loc.features ?? [],
            best_for: loc.best_for ?? [],
            dietary: loc.dietary ?? [],
            michelin_stars: loc.michelin_stars ?? 0,
            michelin_bib: loc.michelin_bib ?? false,
            insider_tip: loc.insider_tip ?? null,
            what_to_try: loc.what_to_try ?? [],
            ai_context: loc.ai_context ?? null,
            photos: loc.photos?.slice(0, 3) ?? [],
        }
    }

    return { error: `Unknown tool: ${name}` }
}

// ─── System prompt ────────────────────────────────────────────────────────

function buildSystemPrompt(prefs = {}) {
    const parts = [
        `You are GastroGuide — an expert AI assistant for GastroMap, a curated gastronomy app focused on Krakow, Poland.`,
        `Your role: help users discover the perfect restaurant, cafe, or bar based on their mood, occasion, and preferences.`,
        ``,
        `TOOLS: Always use search_locations before recommending any place. Never invent venues.`,
        `TONE: Warm, knowledgeable, concise. Max 3 recommendations per response. No bullet spam.`,
        `LANGUAGE: Match the user's language (Polish, English, Russian, Ukrainian all supported).`,
    ]

    if (prefs?.dietaryRestrictions?.length) {
        parts.push(`USER DIETARY: ${prefs.dietaryRestrictions.join(', ')} — filter accordingly.`)
    }
    if (prefs?.preferredCuisines?.length) {
        parts.push(`USER PREFERENCES: Enjoys ${prefs.preferredCuisines.join(', ')}.`)
    }

    return parts.join('\n')
}

// ─── fetchOpenRouter with full model cascade ──────────────────────────────

/**
 * Try models in cascade order. On 429, waits 800ms then tries next model.
 * Falls back to local engine if all models are rate-limited.
 */
async function fetchOpenRouter(messages, { stream = false, withTools = true, modelIndex = 0 } = {}) {
    const { apiKey, model: adminModel } = getActiveAIConfig()

    // Build cascade: admin-set model first, then defaults
    const cascade = [adminModel, ...MODEL_CASCADE.filter(m => m !== adminModel)]
    const model = cascade[modelIndex] ?? cascade[0]

    const body = {
        model,
        messages,
        max_tokens: config.ai.maxResponseTokens ?? 1024,
        stream,
    }
    if (withTools) {
        body.tools = TOOLS
        body.tool_choice = 'auto'
    }

    // AbortController: 30s timeout protects against hung requests
    const abortCtrl = new AbortController()
    const abortTimer = setTimeout(() => abortCtrl.abort(), 30_000)
    let res
    try {
        res = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://gastromap.app',
                'X-Title': 'GastroMap',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: abortCtrl.signal,
        })
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('AI request timed out (30s) — please try again')
        throw err
    } finally {
        clearTimeout(abortTimer)
    }

    // Rate limited — try next model in cascade
    if (res.status === 429) {
        const nextIndex = modelIndex + 1
        if (nextIndex < cascade.length) {
            console.warn(`[GastroAI] ${model} rate limited, trying ${cascade[nextIndex]}...`)
            await new Promise(r => setTimeout(r, 800))
            return fetchOpenRouter(messages, { stream, withTools, modelIndex: nextIndex })
        }
        // All models exhausted — throw so caller falls back to local engine
        throw Object.assign(new Error('All OpenRouter models are rate limited. Using local engine.'), { status: 429 })
    }

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const msg = errBody?.error?.message ?? `OpenRouter error ${res.status}`
        throw Object.assign(new Error(msg), { status: res.status })
    }

    return res
}

// ─── Agentic pass (tool calls → final response) ───────────────────────────

async function runAgentPass(messages) {
    const res = await fetchOpenRouter(messages, { stream: false, withTools: true })
    const data = await res.json()
    const choice = data.choices?.[0]

    if (!choice) throw new Error('No response from OpenRouter')

    const assistantMsg = choice.message
    const finishReason = choice.finish_reason

    // No tool calls — return text directly
    if (finishReason !== 'tool_calls' || !assistantMsg.tool_calls?.length) {
        return { text: assistantMsg.content ?? '', usedLocations: [] }
    }

    // Execute tool calls
    const toolResults = []
    let usedLocations = []

    for (const toolCall of assistantMsg.tool_calls) {
        let args = {}
        try {
            args = JSON.parse(toolCall.function.arguments)
        } catch {
            args = {}
        }

        const result = executeTool(toolCall.function.name, args)

        toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
        })

        if (toolCall.function.name === 'search_locations' && Array.isArray(result)) {
            const { locations } = useLocationsStore.getState()
            usedLocations = result
                .map(r => locations.find(l => l.id === r.id))
                .filter(Boolean)
                .slice(0, 3)
        }
        if (toolCall.function.name === 'get_location_details' && result?.id) {
            const { locations } = useLocationsStore.getState()
            const loc = locations.find(l => l.id === result.id)
            if (loc) usedLocations = [loc]
        }
    }

    // Second pass: send tool results back to model
    const messagesWithTools = [
        ...messages,
        { role: 'assistant', ...assistantMsg },
        ...toolResults,
    ]

    const res2 = await fetchOpenRouter(messagesWithTools, { stream: false, withTools: false })
    const data2 = await res2.json()
    const finalContent = data2.choices?.[0]?.message?.content ?? ''

    return { text: finalContent, usedLocations }
}

// ─── Intent detection ─────────────────────────────────────────────────────

function detectIntent(text) {
    const q = text.toLowerCase()
    if (q.match(/\b(recommend|where|best|find|eat|drink|cafe|coffee|dinner|lunch|breakfast|date|romantic|cozy|хочу|найди|посоветуй|порекомендуй|где|лучший|хорошее)\b/)) {
        return 'recommendation'
    }
    if (q.match(/\b(hours|open|close|phone|address|contact|reservation|book|адрес|телефон|часы|работает)\b/)) {
        return 'info'
    }
    return 'general'
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function analyzeQuery(message, context = {}) {
    if (!message?.trim()) throw new ApiError('Message cannot be empty', 400, 'EMPTY_MESSAGE')

    const intent = detectIntent(message)

    if (getActiveAIConfig().apiKey) {
        try {
            const historyMessages = (context.history ?? [])
                .slice(-8)
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map(m => ({ role: m.role, content: m.content }))

            const messages = [
                { role: 'system', content: buildSystemPrompt(context.preferences) },
                ...historyMessages,
                { role: 'user', content: message },
            ]

            const { text, usedLocations } = await runAgentPass(messages)
            return { content: text, matches: usedLocations, intent }
        } catch (err) {
            if (err.status === 401) throw new ApiError('Invalid OpenRouter API key. Check VITE_OPENROUTER_API_KEY.', 401, 'AUTH_ERROR')
            console.warn('[GastroAI] OpenRouter error, falling back to local engine:', err.message)
        }
    }

    // Local fallback
    const result = await gastroIntelligence.analyzeQuery(message)
    return { content: result.content, matches: result.matches ?? [], intent }
}

/**
 * Streaming variant — runs the agentic pass first (non-streaming for tool calls),
 * then simulates word-by-word streaming via onChunk for a natural typing effect.
 */
export async function analyzeQueryStream(message, context = {}, onChunk) {
    if (!message?.trim()) throw new ApiError('Message cannot be empty', 400, 'EMPTY_MESSAGE')

    const intent = detectIntent(message)

    if (getActiveAIConfig().apiKey) {
        try {
            const historyMessages = (context.history ?? [])
                .slice(-8)
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map(m => ({ role: m.role, content: m.content }))

            const messages = [
                { role: 'system', content: buildSystemPrompt(context.preferences) },
                ...historyMessages,
                { role: 'user', content: message },
            ]

            const { text, usedLocations } = await runAgentPass(messages)

            // Simulate streaming: word by word
            if (onChunk && text) {
                const words = text.split(' ')
                for (let i = 0; i < words.length; i++) {
                    onChunk((i === 0 ? '' : ' ') + words[i])
                    await new Promise(r => setTimeout(r, 18))
                }
            }

            return { content: text, matches: usedLocations, intent }
        } catch (err) {
            if (err.status === 401) throw new ApiError('Invalid OpenRouter API key.', 401, 'AUTH_ERROR')
            console.warn('[GastroAI] OpenRouter streaming error, falling back:', err.message)
        }
    }

    return analyzeQuery(message, context)
}
