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
 * Models used via OpenRouter (both free):
 *   Primary : meta-llama/llama-3.3-70b-instruct:free  (131K ctx, tool use)
 *   Fallback: qwen/qwen3-coder:free                    (262K ctx, 100+ languages)
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
import { supabase } from '@/shared/api/client'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Cascading free models for production.
 * Ordered by reliability and availability - models less likely to be rate-limited first.
 * The system tries these in order until one succeeds.
 */
const MODEL_CASCADE = [
    'stepfun/step-3.5-flash:free',          // User preferred free model
    'nvidia/nemotron-nano-9b-v2:free',      // Often available, very fast
    'z-ai/glm-4.5-air:free',                 // Good availability
    'mistralai/mistral-small-3.1:free',      // Reliable multilingual
    'openai/gpt-oss-20b:free',               // OpenAI open-weight
    'minimax/minimax-m2.5:free',             // Large context
    'mistralai/devstral-2512:free',          // Good but often rate-limited
    'meta-llama/llama-3.3-70b-instruct:free', // Often rate-limited
    'qwen/qwen3-coder:free',                 // Last resort, often rate-limited
]

/**
 * Get active AI config — admin store overrides env vars at runtime.
 * Admin can change model/key in AdminAIPage without redeploying.
 */
function getActiveAIConfig() {
    const appCfg = useAppConfigStore.getState()
    return {
        apiKey:        appCfg.aiApiKey        || config.ai.openRouterKey,
        model:         appCfg.aiPrimaryModel  || config.ai.model,
        fallbackModel: appCfg.aiFallbackModel || config.ai.modelFallback,
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

// ─── Semantic Search ──────────────────────────────────────────────────────

/**
 * Semantic search via pgvector in Supabase.
 * Converts user query into an embedding → then searches for similar locations.
 */
async function semanticSearch(queryText, limit = 10) {
    const appCfg = useAppConfigStore.getState()
    const apiKey = appCfg.aiApiKey || config.ai.openRouterKey

    if (!apiKey || !supabase) return []

    try {
        // 1. Generate embedding for user query
        const embResponse = await fetch('https://openrouter.ai/api/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://gastromap.app',
                'X-Title': 'GastroMap',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai/text-embedding-3-small',
                input: queryText,
                dimensions: 768,
            }),
        })

        if (!embResponse.ok) return []

        const embData = await embResponse.json()
        const queryEmbedding = embData.data?.[0]?.embedding

        if (!queryEmbedding) return []

        // 2. Call pgvector RPC function in Supabase
        const { data, error } = await supabase.rpc('search_locations_by_embedding', {
            query_embedding: queryEmbedding,
            match_threshold: 0.35, // More permissive for broad intent
            match_count: limit,
        })

        if (error) {
            console.warn('[ai.api] pgvector search error:', error.message)
            return []
        }

        return data || []
    } catch (error) {
        console.warn('[ai.api] semanticSearch failed:', error.message)
        return []
    }
}

// ─── Client-side tool executor ────────────────────────────────────────────

/**
 * Execute a tool call locally using the Zustand locations store.
 * This avoids any extra network request — data is already in memory.
 *
 * @param {string} name   tool name
 * @param {Object} args   parsed JSON arguments from the model
 * @returns {Promise<Object>} tool result to send back to the model
 */
async function executeTool(name, args) {
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
            // 1. Literal local search (includes AI keywords & context)
            const literalMatches = results.filter(l =>
                l.title?.toLowerCase().includes(kw) ||
                l.description?.toLowerCase().includes(kw) ||
                l.tags?.some(t => t.toLowerCase().includes(kw)) ||
                l.ai_keywords?.some(k => k.toLowerCase().includes(kw)) ||
                l.ai_context?.toLowerCase().includes(kw) ||
                l.insider_tip?.toLowerCase().includes(kw) ||
                l.what_to_try?.some(w => w.toLowerCase().includes(kw))
            )

            // 2. Semantic AI Search boost
            if (supabase) {
                try {
                    const semanticResults = await semanticSearch(keyword, limit * 2)
                    const semanticIds = new Set(semanticResults.map(r => r.id))
                    
                    // We use ALL locations for semantic search, but keep only those that 
                    // fit our other hard filters (city, cuisine, etc.)
                    // RESULTS here already contains locations filtered by city/cuisine/etc.
                    
                    results.sort((a, b) => {
                        const aInSemantic = semanticIds.has(a.id) ? 1 : 0
                        const bInSemantic = semanticIds.has(b.id) ? 1 : 0
                        
                        // Priority: 1. Semantic match, 2. Rating
                        if (aInSemantic !== bInSemantic) return bInSemantic - aInSemantic
                        return (b.rating ?? 0) - (a.rating ?? 0)
                    })
                } catch (err) {
                    console.warn('[ai.api] Semantic search failed, using literal filter:', err)
                    results = literalMatches
                    results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
                }
            } else {
                results = literalMatches
                results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
            }
        } else {
            results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        }

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
            // Expert data — included for AI context, NOT shown in raw UI
            insider_tip: l.insider_tip ?? null,
            what_to_try: l.what_to_try ?? [],
            ai_context: l.ai_context ?? null,
        }))
    }

    if (name === 'get_location_details') {
        const { location_id } = args
        const loc = locations.find(l => l.id === location_id)
        if (!loc) return { error: `Location ${location_id} not found` }
        return {
            id: loc.id,
            name: loc.title,
            category: loc.category,
            cuisine: loc.cuisine,
            vibe: loc.vibe,
            price_level: loc.priceLevel,
            rating: loc.rating,
            review_count: loc.review_count ?? 0,
            address: loc.address,
            opening_hours: loc.openingHours,
            phone: loc.phone ?? null,
            website: loc.website ?? null,
            features: loc.features ?? [],
            dietary: loc.dietary ?? [],
            michelin_stars: loc.michelin_stars ?? 0,
            michelin_bib: loc.michelin_bib ?? false,
            description: loc.description,
            insider_tip: loc.insider_tip ?? null,
            what_to_try: loc.what_to_try ?? [],
            ai_context: loc.ai_context ?? null,
        }
    }

    return { error: `Unknown tool: ${name}` }
}

// ─── Default System Prompts ────────────────────────────────────────────────

const DEFAULT_GUIDE_PROMPT = `You are GastroGuide — a warm, knowledgeable dining assistant for GastroMap, a gastronomy app focused on discovering the best places to eat and drink.

CORE RULES:
- NEVER invent or guess restaurant names. ALWAYS use the search_locations tool before recommending any places.
- When the user asks for recommendations, call search_locations with appropriate filters first.
- When the user asks about a specific place by name or ID, use get_location_details.
- Use the insider_tip and what_to_try fields from tool results to make your response feel personal and expert.
- Respond in the same language the user writes in (Russian, English, Polish — match their language).
- Be concise and friendly. Max 3–4 sentences for general responses, slightly longer when detailing recommendations.
- When discussing cuisines, dishes, or ingredients, draw on your culinary expertise to provide helpful context.

When recommending places, format your response naturally — mention the name, why it fits, and include one insider tip or dish recommendation from the data.`

const DEFAULT_ASSISTANT_PROMPT = `You are GastroAssistant — a background AI agent that powers smart search, recommendations, and personalization for GastroMap.

CORE RULES:
- Be precise and factual. You run silently in the background to enhance user experience.
- When analyzing queries, extract structured filters (cuisine, price, vibe, location, dietary).
- Prioritize accuracy over creativity. Return actionable data.
- Respond in the same language as the user's query.
- Keep responses concise and structured when possible.

Your output is used internally for recommendations, filtering, and personalization. Focus on extracting intent and relevant parameters.`

// ─── System prompt builder (compact — no location list injected) ────────────

/**
 * Build a system prompt for the specified agent.
 * @param {'guide' | 'assistant'} agentType - Which agent's prompt to build
 * @param {Object} userPrefs - User preferences
 * @param {string | null} queryContext - Query for knowledge graph context
 * @param {Object} userData - Dynamic user profile data (history, favorites)
 */
async function buildSystemPrompt(userPrefs = {}, queryContext = null, agentType = 'guide', userData = null) {
    const appCfg = useAppConfigStore.getState()

    // Use custom prompt if set, otherwise default
    const basePrompt = agentType === 'guide'
        ? (appCfg.aiGuideSystemPrompt || DEFAULT_GUIDE_PROMPT)
        : (appCfg.aiAssistantSystemPrompt || DEFAULT_ASSISTANT_PROMPT)

    const { favoriteCuisines = [], vibePreference = [], priceRange = [], dietaryRestrictions = [] } = userPrefs

    const prefLines = [
        favoriteCuisines.length ? `Favourite cuisines: ${favoriteCuisines.join(', ')}` : '',
        vibePreference.length ? `Preferred vibes: ${vibePreference.join(', ')}` : '',
        priceRange.length ? `Budget: ${priceRange.join(', ')}` : '',
        dietaryRestrictions.length ? `Dietary restrictions: ${dietaryRestrictions.join(', ')}` : '',
    ].filter(Boolean).join('\n')

    // 1. Dynamic user personalization context (injecting knowledge from database)
    const profile = userData ? `
USER PROFILE & EXPERIENCE:
- Visited locations: ${userData.visitedNames?.join(', ') || 'none yet'} (${userData.visitedCount || 0} total)
- Favorite places: ${userData.favoritesNames?.join(', ') || 'none yet'}
- Foodie DNA (Taste Profile): ${userData.foodieDNA || 'Developing taste profile'}
- Past Experiences & Reviews: 
${userData.userExperience || 'No direct review history yet.'}
- Recent Search Interests: ${userData.recentInterests?.join(', ') || 'General explorer'}
` : ''

    // 2. Fetch knowledge graph context if query is provided
    let knowledgeContext = ''
    if (queryContext) {
        try {
            const { getAIContextForQuery } = await import('./knowledge-graph.api')
            const kgContext = await getAIContextForQuery(queryContext)
            if (kgContext?.relevantCuisines?.length) {
                const cuisines = kgContext.relevantCuisines.map(c =>
                    `${c.name}: typical dishes (${c.typical_dishes?.slice(0, 3).join(', ')})`
                ).join('; ')
                knowledgeContext = `\n\nCULINARY KNOWLEDGE:\n${cuisines}\n${kgContext.contextNote}`
            }
        } catch (err) {
            // Silently continue without knowledge context
        }
    }

    return `${basePrompt}
${knowledgeContext}
${prefLines ? `\nUSER PREFERENCES:\n${prefLines}` : ''}
${profile}

INSTRUCTIONS: 
- Use the USER PROFILE & EXPERIENCE to tailor your tone and recommendations. 
- If they've liked certain dishes or vibes in the past, prioritize similar matches. 
- Reference their past experiences naturally (e.g., "Since you enjoyed the spicy ramen at X, you'll love the Y here").`
}

// Export defaults for Admin UI
export const DEFAULT_PROMPTS = {
    guide: DEFAULT_GUIDE_PROMPT,
    assistant: DEFAULT_ASSISTANT_PROMPT,
}

// ─── OpenRouter fetch helper ──────────────────────────────────────────────

/**
 * Send a chat completion request to OpenRouter.
 * Automatically tries multiple models in cascade on rate-limit errors.
 *
 * @param {Array}   messages
 * @param {boolean} stream
 * @param {boolean} withTools   include tool definitions
 * @param {string}  [modelOverride]
 * @returns {Promise<{response: Response, modelUsed: string}>}
 */
async function fetchOpenRouter(messages, { stream = false, withTools = true, modelOverride } = {}) {
    const { apiKey, model: activeModel, fallbackModel } = getActiveAIConfig()
    const useProxy = config.ai.useProxy

    // Build cascade: start with preferred model, then try all others
    const preferredModel = modelOverride ?? activeModel
    const cascade = [preferredModel]

    // Add fallback model if different
    if (fallbackModel && fallbackModel !== preferredModel && !cascade.includes(fallbackModel)) {
        cascade.push(fallbackModel)
    }

    // Always add all cascade models (even in proxy mode - proxy might not handle cascade)
    for (const m of MODEL_CASCADE) {
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
            max_tokens: config.ai.maxResponseTokens,
            stream,
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

// Export cascade for Admin test panel
export { MODEL_CASCADE }

// ─── Intent Detection ────────────────────────────────────────────────────────

/**
 * @param {string} text
 * @returns {'recommendation' | 'info' | 'general'}
 */
function detectIntent(text) {
    const q = text.toLowerCase()
    if (q.match(/\b(recommend|where|best|find|eat|drink|cafe|coffee|dinner|lunch|breakfast|date|romantic|cozy|хочу|найди|посоветуй|порекомендуй|где|лучший|хорошее)\b/)) {
        return 'recommendation'
    }
    if (q.match(/\b(open|close|hours|menu|price|book|reservation|phone|address|открыт|закрыт|часы|меню|цена|бронь|телефон|адрес)\b/)) {
        return 'info'
    }
    return 'general'
}

// ─── Agentic loop: handle tool calls ─────────────────────────────────────

/**
 * Run one agentic pass:
 *  1. Call OpenRouter (no stream) to get tool_calls or direct content.
 *  2. If tool_calls → execute locally → send results back → get final text.
 *
 * @param {Array} messages  Full messages array incl. system prompt
 * @returns {{ text: string, usedLocations: Array, modelUsed: string }}
 */
async function runAgentPass(messages) {
    // First call: detect tool calls
    const { response: res, modelUsed } = await fetchOpenRouter(messages, { stream: false, withTools: true })
    const data = await res.json()
    const choice = data.choices?.[0]

    if (!choice) throw new Error('No response from OpenRouter')

    const assistantMsg = choice.message
    const finishReason = choice.finish_reason

    // No tool calls — return text directly
    if (finishReason !== 'tool_calls' || !assistantMsg.tool_calls?.length) {
        return { text: assistantMsg.content ?? '', usedLocations: [], modelUsed }
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

        const result = await executeTool(toolCall.function.name, args)

        toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
        })

        // Collect full location objects for UI cards
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

    // Second call: get final text with tool results (no tools needed in second pass)
    const finalMessages = [
        ...messages,
        assistantMsg,         // assistant message that contained tool_calls
        ...toolResults,       // tool result messages
    ]

    const { response: finalRes } = await fetchOpenRouter(finalMessages, { stream: false, withTools: false })
    const finalData = await finalRes.json()
    const finalContent = finalData.choices?.[0]?.message?.content ?? ''

    return { text: finalContent, usedLocations, modelUsed }
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} AIResponse
 * @property {string}   content  - Text to display in chat
 * @property {Array}    matches  - Matched location objects for UI cards (up to 3)
 * @property {string}   intent   - 'recommendation' | 'info' | 'general'
 */

/**
 * Analyze a user query and return a GastroGuide response.
 * Uses OpenRouter when VITE_OPENROUTER_API_KEY is set, else local engine.
 *
 * @param {string} message
 * @param {{ preferences?: Object, history?: Array }} [context]
 * @returns {Promise<AIResponse>}
 */
export async function analyzeQuery(message, context = {}) {
    if (!message?.trim()) throw new ApiError('Message cannot be empty', 400, 'EMPTY_MESSAGE')

    const intent = detectIntent(message)

    if (getActiveAIConfig().apiKey) {
        try {
            const historyMessages = (context.history ?? [])
                .slice(-8)
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map(m => ({ role: m.role, content: m.content }))

            const systemPrompt = await buildSystemPrompt(context.preferences, message, 'guide', context.userData)

            const messages = [
                { role: 'system', content: systemPrompt },
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
 *
 * @param {string} message
 * @param {{ preferences?: Object, history?: Array }} [context]
 * @param {(chunk: string) => void} onChunk
 * @returns {Promise<AIResponse>}
 */
export async function analyzeQueryStream(message, context = {}, onChunk) {
    if (!message?.trim()) throw new ApiError('Message cannot be empty', 400, 'EMPTY_MESSAGE')

    const intent = detectIntent(message)

    if (getActiveAIConfig().apiKey || config.ai.useProxy) {
        try {
            const model = config.ai.model || 'deepseek/deepseek-chat-v3-0324:free'
            const historyMessages = (context.history ?? [])
                .slice(-8)
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map(m => ({ role: m.role, content: m.content }))

            const systemPrompt = await buildSystemPrompt(context.preferences, message, 'guide', context.userData)
            const messages = [
                { role: 'system', content: systemPrompt },
                ...historyMessages,
                { role: 'user', content: message },
            ]

            const { text, usedLocations } = await runAgentPass(messages)

            // Simulate streaming: emit word by word
            if (onChunk && text) {
                const words = text.split(' ')
                for (let i = 0; i < words.length; i++) {
                    const chunk = (i === 0 ? '' : ' ') + words[i]
                    onChunk(chunk)
                    // Small delay between words for natural typing feel
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

export async function generateLocationSemanticSummary(location, extraContext = null) {
    const { apiKey } = getActiveAIConfig()
    if (!apiKey) return { summary: location.description || '', keywords: [] }

    // 1. Enrich with Culinary context (Spoonacular + OpenFoodFacts)
    let culinaryContext = ''
    try {
        const { enrichCulinaryTerm } = await import('./spoonacular.api')
        const { getIngredientCulinaryContext } = await import('./openfoodfacts.api')
        
        // Search by cuisine or category for deep context
        const queryTerm = location.cuisine || location.category
        const [spoonData, offData] = await Promise.all([
            enrichCulinaryTerm(queryTerm),
            getIngredientCulinaryContext(queryTerm).catch(() => null)
        ])

        if (spoonData?.data) {
            culinaryContext += `\nCULINARY DATA (Dishes/Ingredients): ${JSON.stringify(spoonData.data)}`
        }
        if (offData) {
            culinaryContext += `\nFOOD FACTS: Categories: ${offData.categories.join(', ')}, Allergens: ${offData.allergens.join(', ')}`
        }
    } catch (err) {
        console.warn('[GastroAI] Culinary enrichment partial success:', err.message)
    }

    // Merge manual extra context if provided
    if (extraContext) {
        culinaryContext += `\nADDITIONAL INFO: ${JSON.stringify(extraContext)}`
    }

    const prompt = `
        You are a Michelin-level culinary critic and data scientist.
        Your task is to create a "Semantic Identity" for the following location:
        
        NAME: ${location.title}
        CATEGORY: ${location.category}
        CUISINE: ${location.cuisine}
        DESCRIPTION: ${location.description}
        FEATURES: ${(location.features || []).join(', ')}
        VIBE: ${location.vibe}
        BEST FOR: ${(location.best_for || []).join(', ')}
        
        ${culinaryContext ? `CULINARY ENRICHMENT CONTEXT:\n${culinaryContext}` : ''}

        INSTRUCTIONS:
        1. Create a "Semantic Summary" (ai_context): A dense, keyword-rich 2-3 paragraph description that captures the essence, 
           flavor profile, target audience, and unique selling points. Use actual culinary terminology and mention potential signature dishes.
        2. Extract "AI Keywords" (ai_keywords): A list of 15-20 highly specific tags (e.g. "rare single origin coffee", "mibrasa charcoal oven", "secret dinner spot").
        3. If cuisine is ${location.cuisine}, ensure you use terminology specific to that culture.
        4. Focus on SEMANTIC searchability - think about what a user might search for beyond just "Italian food".
        
        RETURN JSON ONLY:
        {
            "summary": "...",
            "keywords": ["...", "..."]
        }
    `

    try {
        const { response } = await fetchOpenRouter([
            { role: 'system', content: 'You are a culinary data expert. Respond in JSON.' },
            { role: 'user', content: prompt }
        ], { stream: false, withTools: false })

        const data = await response.json()
        const text = data.choices?.[0]?.message?.content || '{}'
        const parsed = robustParseJSON(text)

        return {
            summary: parsed.summary || location.description || '',
            keywords: parsed.keywords || []
        }
    } catch (err) {
        console.error('[GastroAI] Failed to generate semantic summary:', err)
        return { summary: location.description || '', keywords: [] }
    }
}

// ─── Test Helper (for Admin Panel) ────────────────────────────────────────

/**
 * Test AI connectivity with a simple query.
 * Uses the full model cascade to find an available model.
 *
 * @param {string} message - Test message
 * @param {string} [preferredModel] - Optional preferred model to try first
 * @returns {Promise<{ ok: boolean, text: string, modelUsed: string, latency: number, error?: string }>}
 */
export async function testAIConnection(message, preferredModel) {
    const startTime = performance.now()

    try {
        const { apiKey } = getActiveAIConfig()
        const useProxy = config.ai.useProxy

        if (!apiKey && !useProxy) {
            return {
                ok: false,
                text: 'No API key configured. Add your OpenRouter API key in Settings or set VITE_OPENROUTER_API_KEY.',
                modelUsed: 'none',
                latency: 0,
            }
        }

        const messages = [
            { role: 'system', content: 'You are a helpful assistant. Keep responses under 2 sentences.' },
            { role: 'user', content: message },
        ]

        // ── DIRECT call to the specific model — no cascade fallback during test ──
        // This ensures the test result reflects EXACTLY the chosen model performance.
        const modelToTest = preferredModel || MODEL_CASCADE[0]
        const url = useProxy ? config.ai.proxyUrl : OPENROUTER_URL
        const headers = { 'Content-Type': 'application/json' }
        if (!useProxy) {
            headers['Authorization'] = `Bearer ${apiKey}`
            headers['HTTP-Referer'] = 'https://gastromap.app'
            headers['X-Title'] = 'GastroMap'
        }

        const body = {
            model: modelToTest,
            messages,
            max_tokens: 256,
            // Pass a flag so the proxy knows this is a direct test (no cascade)
            _direct_model: true,
        }

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        })

        const data = await res.json()
        const latency = Math.round(performance.now() - startTime)

        if (!res.ok) {
            const errMsg = data?.error?.message || `Model returned ${res.status}`
            return { ok: false, text: errMsg, modelUsed: modelToTest, latency }
        }

        // Proxy may return _model_used to confirm which model actually answered
        const actualModel = data._model_used || modelToTest
        const text = data.choices?.[0]?.message?.content || '(no response)'

        return { ok: true, text, modelUsed: actualModel, latency }
    } catch (err) {
        const latency = Math.round(performance.now() - startTime)
        return {
            ok: false,
            text: err.message || 'Unknown error',
            modelUsed: preferredModel || 'unknown',
            latency,
            error: err.message,
        }
    }
}

/**
 * Robust JSON extraction from LLM response.
 * Handles markdown blocks, extra text, and problematic control characters.
 *
 * @param {string} text - Raw model response
 * @returns {Object}     - Parsed JSON or empty object
 */
function robustParseJSON(text) {
    if (!text) return {}

    try {
        // 1. Remove markdown code blocks and excess whitespace
        let cleaned = text.replace(/```json\n?|```/g, '').trim()

        // 2. Isolate the first '{' and last '}'
        const firstBrace = cleaned.indexOf('{')
        const lastBrace = cleaned.lastIndexOf('}')

        if (firstBrace !== -1 && lastBrace !== -1) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1)
        }

        try {
            return JSON.parse(cleaned)
        } catch (initialError) {
            // 4. Second attempt: Clean "bad control characters" ONLY inside strings
            // This regex finds content inside double quotes properly handling escaped quotes \".
            // It finds and escapes literal newlines, tabs, and other non-printable control chars.
            let surgicallyCleaned = cleaned.replace(/"(?:[^"\\]|\\.)*"/gs, (m) => {
                // Keep the opening and closing quotes, clean the inner part
                const inner = m.substring(1, m.length - 1)
                const cleanedInner = inner.replace(/[\x00-\x1F]/g, (char) => {
                    const map = {
                        '\n': '\\n',
                        '\r': '\\r',
                        '\t': '\\t',
                        '\f': '\\f',
                        '\b': '\\b'
                    }
                    return map[char] || '' // Strip other control chars
                })
                return '"' + cleanedInner + '"'
            })

            // 5. Fix common escaping/trailing issues
            surgicallyCleaned = surgicallyCleaned
                .replace(/\\(?!["\\\/bfnrtu])/g, '\\\\') // Escape lone backslashes
                .replace(/,\s*}/g, '}')                  // Trailing comma in objects
                .replace(/,\s*\]/g, ']')                  // Trailing comma in arrays

            try {
                return JSON.parse(surgicallyCleaned)
            } catch (secondError) {
                // Final fallback: Basic field extraction using regex for key fields
                try {
                    const result = {}
                    const fields = [
                        'name', 'title', 'category', 'cuisine', 'description', 
                        'city', 'country', 'address', 'insider_tip', 'phone', 
                        'website', 'opening_hours'
                    ]
                    for (const field of fields) {
                        // Match "field": "value" (handles escaped quotes inside value)
                        const regex = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i')
                        const match = surgicallyCleaned.match(regex)
                        if (match) {
                            try {
                                // Try to unescape common sequences
                                result[field] = match[1]
                                    .replace(/\\n/g, '\n')
                                    .replace(/\\"/g, '"')
                                    .replace(/\\\\/g, '\\')
                            } catch (e) {
                                result[field] = match[1]
                            }
                        }
                    }
                    if (Object.keys(result).length > 0) return result
                } catch (e) {}

                throw initialError // Return the most descriptive error if recovery fails
            }
        }
    } catch (err) {
        console.warn('[GastroAI] Robust parse failed:', err.message)
        throw err
    }
}



/**
 * Admin helper to extract structured restaurant data from a name or description.
 * Useful for auto-filling the location form.
 *
 * @param {string} query - Restaurant name or "Name, City" or description
 * @returns {Promise<Object>} - Structured location data
 */
export async function extractLocationData(query) {
    if (!query?.trim()) throw new Error('Query cannot be empty')

    // Enhanced system prompt with comprehensive field extraction
    const systemPrompt = `You are GastroData Extractor AI - a precision-focused restaurant intelligence system.

Your task: Extract structured information about a restaurant/cafe/bar based ONLY on verifiable facts.
CRITICAL: DO NOT hallucinate or make up data. If you are not 100% sure about a specific field (like phone, website, or exact opening hours), leave it as NULL. 
Accuracy is prioritized over completeness. It is better to return NULL than wrong data.

Return ONLY a valid JSON object:
{
    "title": "Full official name",
    "category": "Map any establishment to one of: restaurant, cafe, bar, bakery, street_food, fine_dining, casual_dining, fast_food, food_truck, market, other",
    "city": "City name",
    "country": "Country",
    "address": "Full official street address",
    "description": "Compelling 2-3 sentence description in Russian (based ONLY on factual data)",
    "cuisine": "Comma-separated cuisines (e.g. 'Polish, Fusion')",
    "price_level": "$|$$|$$$|$$$$",
    "opening_hours": "Opening hours (e.g. '10:00-22:00')",
    "website": "Official website URL",
    "phone": "Phone number with country code",
    "booking_url": "Reservation URL (if known)",
    "insider_tip": "Expert local tip in Russian based on the venue's reputation (if known)",
    "what_to_try": ["Must-try dish 1", "Must-try dish 2"],
    "latitude": number or null,
    "longitude": number or null,
    "tags": ["tag1", "tag2"],
    "vibe": ["cozy", "modern"],
    "features": ["wifi", "outdoor_seating"],
    "dietary": ["vegetarian", "vegan"]
}

RULES:
1. TRUTHFULNESS: Never invent phone numbers, addresses, or URLs. If it's not in your certain knowledge base, return NULL for that field.
2. MISSING DATA: If data is missing or uncertain, return null.
3. LANGUAGES: "description" and "insider_tip" MUST be in Russian.
4. COORDINATES: Only provide if you have high confidence in the specific location.
5. NO HALLUCINATION: We are building a real-world map. Incorrect data ruins trust.`

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `EXTRACT FACTUAL DATA FOR: "${query}"

        Instructions:
        1. Only include information you are certain about.
        2. If you don't know a detail, return null for that field.
        3. DO NOT make educated guesses. If you haven't heard of this place, return a JSON with just the name you can infer and nulls for everything else.
        4. Focus on the most recent known state of this establishment.` },
    ]

    try {
        console.log('[GastroAI] Extracting enhanced location data for:', query)

        const { response } = await fetchOpenRouter(messages, {
            stream: false,
            withTools: false,
            model: 'deepseek/deepseek-chat-v3-0324:free',
        })

        const data = await response.json()
        const text = data.choices?.[0]?.message?.content || '{}'

        const extracted = robustParseJSON(text)
        console.log('[GastroAI] Successfully extracted:', extracted)

        return extracted
    } catch (err) {
        console.error('[GastroAI] Failed to extract location data:', err)
        throw err
    }
}
