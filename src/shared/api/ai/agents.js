/**
 * Agentic Loop with Function Calling
 *
 * Handles the agent pass workflow:
 * 1. Call OpenRouter with tool definitions
 * 2. If tool calls detected (native OR XML text), execute them locally
 * 3. Send results back to model for final text generation
 */

import { fetchOpenRouter } from './openrouter'
import { executeTool } from './tools'
import { MODEL_CASCADE } from './constants'
import { normalizeCityName } from '@/utils/normalizeCityName'
import { getOperationalRules } from './operational-rules'
import { detectIntent } from './intents'

// ─── Search Result Cache (LRU, 3-min TTL) ────────────────────────────────────
const _searchCache = new Map()
const SEARCH_CACHE_TTL = 3 * 60 * 1000 // 3 minutes

function getCachedSearch(key) {
    const entry = _searchCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.ts > SEARCH_CACHE_TTL) { _searchCache.delete(key); return null }
    return entry.data
}

function setCachedSearch(key, data) {
    // LRU: keep max 20 entries
    if (_searchCache.size >= 20) {
        const oldest = _searchCache.keys().next().value
        _searchCache.delete(oldest)
    }
    _searchCache.set(key, { data, ts: Date.now() })
}

/**
 * Check if LLM response is garbage (hallucination, wrong language mix, nonsense).
 * Returns true if the response should be replaced with a template.
 */
function isGarbageResponse(text) {
    if (!text || text.length < 10) return true
    // Contains CJK characters (Chinese/Japanese/Korean) mixed with Cyrillic — clear hallucination
    if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text) && /[а-яА-Я]/.test(text)) return true
    // Contains CJK in a response that should be purely Latin/Cyrillic
    if (/[\u4e00-\u9fff]{3,}/.test(text)) return true
    // Contains code-like patterns (function declarations, brackets soup) — model outputting code
    if (/\bfunction\b.*\{|void\s+\w+\(|#include|#endif|\.map\(\)/.test(text)) return true
    // High ratio of special characters (>30%) — gibberish/noise
    const specialChars = text.replace(/[\w\sа-яА-ЯёЁіїєґІЇЄҐąćęłńóśźżĄĆĘŁŃÓŚŹŻ.,!?:;'"()\-—–]/g, '')
    if (specialChars.length / text.length > 0.3) return true
    // Excessive repetition of ) or other single chars (model stuck in loop)
    if (/(.)\1{10,}/.test(text) || /(\)\s*){8,}/.test(text)) return true
    // Contains Arabic/Hebrew mixed with Cyrillic (hallucination pattern)
    if (/[\u0600-\u06FF\u0590-\u05FF]/.test(text) && /[а-яА-Я]/.test(text)) return true
    return false
}

/**
 * Validate that the LLM response only mentions places from the provided data.
 * If the response contains bold names (**Name**) not in usedLocations, it's hallucinating.
 * Returns the template response if hallucination detected, otherwise returns the original.
 */
function validateGrounding(text, usedLocations) {
    if (!text || !usedLocations?.length) return text

    // Extract all bold names from the response: **Name** → Name
    const boldNames = []
    const boldRe = /\*\*([^*]+)\*\*/g
    let match
    while ((match = boldRe.exec(text)) !== null) {
        boldNames.push(match[1].trim().toLowerCase())
    }

    if (boldNames.length === 0) return text // No bold names — can't validate

    // Build set of allowed names from usedLocations
    const allowedNames = new Set()
    for (const loc of usedLocations) {
        if (loc.title) allowedNames.add(loc.title.toLowerCase())
        if (loc.name) allowedNames.add(loc.name.toLowerCase())
        // Also add partial matches (first 3 words) for flexibility
        const title = (loc.title || loc.name || '').toLowerCase()
        const words = title.split(/\s+/)
        if (words.length > 2) allowedNames.add(words.slice(0, 3).join(' '))
    }

    // Check if any bold name is NOT in allowed set
    const hallucinated = boldNames.filter(name => {
        // Check exact match or substring match
        for (const allowed of allowedNames) {
            if (allowed.includes(name) || name.includes(allowed)) return false
        }
        return true
    })

    if (hallucinated.length > 0) {
        // Only reject if ALL bold names are hallucinated (not just some with spelling differences)
        if (hallucinated.length === boldNames.length) {
            console.warn('[Agent] ALL places hallucinated:', hallucinated, '— using template response')
            return null // Signal to use template
        }
        // Some names didn't match exactly but others did — likely spelling variation, keep the text
        console.info('[Agent] Some bold names not in DB (possible spelling variation):', hallucinated)
    }

    return text
}

/**
 * Generate a template response from location data when LLM produces garbage.
 * This ensures the user always gets useful info even with bad models.
 */
function buildTemplateResponse(usedLocations, userText) {
    if (!usedLocations?.length) return null
    const items = usedLocations.slice(0, 5).map(l => {
        const name = l.title || l.name
        let desc = ''
        if (l.description) desc = l.description.slice(0, 100)
        else if (l.vibe?.length) desc = `Атмосфера: ${l.vibe.slice(0, 2).join(', ')}`
        const tip = l.insider_tip ? `\n*Совет:* ${l.insider_tip}` : ''
        const tryThis = l.what_to_try?.length ? `\n*Попробуй:* ${l.what_to_try.slice(0, 2).join(', ')}` : ''
        return `**${name}**\n${desc}${tip}${tryThis}`
    })
    return items.join('\n\n')
}


/**
 * Determine whether the deterministic fallback should activate.
 * Returns true when the model skipped tool calls on a gastro-related query.
 *
 * @param {string|null} intent - From detectIntent()
 * @param {string} assistantContent - Cleaned model output (Path C text)
 * @returns {boolean}
 */
function shouldForceFallback(intent, assistantContent) {
    // Non-gastro intents: never activate fallback
    if (intent === 'meta' || intent === 'off_topic') return false

    // Gastro intents (or unknown/null — default-open per Requirement 2.5):
    // search_nearby, search_by_filter, follow_up, compare, card_request, or any unrecognized value

    // If model returned empty/very short text — definitely needs fallback
    if (!assistantContent || assistantContent.trim().length < 50) return true

    // If model returned a substantive response with bold place names (**Name**),
    // it likely answered from its own knowledge — still needs fallback because
    // those places might not be in our DB. But if it's a conversational response
    // (e.g., asking clarification), don't force fallback.
    const hasBoldNames = /\*\*[^*]+\*\*/.test(assistantContent)

    // If the response is long (>200 chars) and doesn't contain bold place names,
    // it's likely a conversational/clarification response — don't force fallback
    if (assistantContent.length > 200 && !hasBoldNames) return false

    // Default: activate fallback for gastro queries
    return true
}

// ─── Fallback Argument Extraction ────────────────────────────────────────────

/** City extraction patterns (multilingual) */
const CITY_PATTERNS = [
    /(?:in|в|w|у|near|около|біля|koło)\s+([A-ZА-ЯЁЇІЄҐa-zа-яёїієґ\u0100-\u024F]{3,}(?:\s[A-ZА-ЯЁ][a-zа-яёїієґ\u0100-\u024F]{2,})?)/i,
]

/** Category keywords → canonical category */
const CATEGORY_MAP = [
    [/restaurant|ресторан|restauracja/i, 'Restaurant'],
    [/cafe|кафе|kawiarnia|coffee|кофе|кав'ярн/i, 'Cafe'],
    [/bar|бар|pub|паб/i, 'Bar'],
    [/fine\s*dining|файн|изысканн/i, 'Fine Dining'],
    [/street\s*food|стрит|уличн/i, 'Street Food'],
]

/** Cuisine keywords → canonical cuisine */
const CUISINE_MAP = [
    [/italian|итальянск|włosk|італійськ/i, 'Italian'],
    [/japanese|японск|sushi|суши|japońsk/i, 'Japanese'],
    [/french|французск|francusk/i, 'French'],
    [/polish|польск|polsk/i, 'Polish'],
    [/ukrainian|украинск|українськ/i, 'Ukrainian'],
    [/asian|азиатск|azjat/i, 'Asian'],
    [/mexican|мексиканск/i, 'Mexican'],
    [/indian|индийск/i, 'Indian'],
    [/georgian|грузинск/i, 'Georgian'],
    [/chinese|китайск/i, 'Chinese'],
    [/thai|тайск/i, 'Thai'],
    [/korean|корейск/i, 'Korean'],
    [/spanish|испанск/i, 'Spanish'],
    [/greek|греческ/i, 'Greek'],
    [/turkish|турецк/i, 'Turkish'],
    [/vietnamese|вьетнамск/i, 'Vietnamese'],
    [/pizza|пицц/i, 'Italian'],
    [/burger|бургер/i, 'American'],
    [/ramen|рамен/i, 'Japanese'],
]

/** "What's new" keywords */
const NEWEST_RE = /новое|новые|новинк|new|nowe|что нового|co nowego|what's new|latest/i

/** Common words that should NOT be treated as city names */
const COMMON_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'are', 'was',
    'good', 'best', 'nice', 'great', 'cool', 'fine', 'cozy',
    'где', 'что', 'как', 'мне', 'для', 'это', 'там', 'тут', 'еще', 'ещё',
    'хочу', 'найди', 'покажи', 'дай', 'нужен', 'нужна',
    'restaurant', 'cafe', 'bar', 'food', 'place', 'spot',
    'ресторан', 'кафе', 'бар', 'место', 'заведение',
])

/**
 * Deterministically extract search parameters from user query text
 * when the LLM fails to produce a tool call.
 * Pure function — never mutates inputs.
 *
 * @param {'search_nearby'|'search_by_filter'|'follow_up'|'compare'|string} intent
 * @param {string} userText - Raw user message
 * @param {Object} ctx - Context with geo, geoCity, sessionId
 * @returns {Object} FallbackToolArgs
 */
export function buildFallbackToolArgs(intent, userText, ctx) {
    const args = {
        limit: 5,
        city: null,
        category: null,
        cuisine_types: null,
        keyword: null,
        sort_by: null,
        useNearby: false,
        radius_m: null,
    }

    if (!userText || !userText.trim()) return args

    const text = userText.trim()
    const textLower = text.toLowerCase()

    // 1. Extract city (first match wins)
    for (const pattern of CITY_PATTERNS) {
        const match = text.match(pattern)
        if (match?.[1]) {
            const candidate = match[1].trim()
            if (candidate.length >= 3 && !COMMON_WORDS.has(candidate.toLowerCase())) {
                const normalized = normalizeCityName(candidate)
                if (normalized) {
                    args.city = normalized
                    break
                }
            }
        }
    }

    // 2. Fallback to geo city if no city found in text
    if (!args.city && ctx?.geoCity) {
        const normalized = normalizeCityName(ctx.geoCity)
        if (normalized) args.city = normalized
    }

    // 3. Extract category (first match wins)
    for (const [pattern, category] of CATEGORY_MAP) {
        if (pattern.test(textLower)) {
            args.category = category
            break
        }
    }

    // 4. Extract cuisine (first match wins)
    for (const [pattern, cuisine] of CUISINE_MAP) {
        if (pattern.test(textLower)) {
            args.cuisine_types = [cuisine]
            break
        }
    }

    // 5. Detect "what's new" intent
    if (NEWEST_RE.test(textLower)) {
        args.sort_by = 'newest'
    }

    // 6. Handle search_nearby intent
    if (intent === 'search_nearby' && ctx?.geo && typeof ctx.geo.lat === 'number' && typeof ctx.geo.lng === 'number') {
        args.useNearby = true
        args.radius_m = 1500
    }

    // 7. Use full text as keyword ONLY when no structured params were extracted
    if (!args.city && !args.category && !args.cuisine_types) {
        args.keyword = text.slice(0, 100)
    }

    return args
}

/**
 * Build the message array for the 2nd LLM call (response generation).
 * Uses OPERATIONAL_RULES as system prompt and injects tool results as structured
 * data in the system message. Language handling is fully delegated to the model
 * via a single language-mirroring instruction — no specific languages are hardcoded.
 *
 * @param {Object[]} usedLocations - Location objects from tool execution
 * @param {string} userQuery - Original user question
 * @param {Object} [userContext] - Optional soft user context (DNA, dietary, city)
 * @returns {Object[]} - Messages array for fetchOpenRouter
 */
export function buildResponseMessages(usedLocations, userQuery, userContext = null, conversationHistory = [], sessionSummary = null) {
    const rules = getOperationalRules()

    // Language-agnostic instruction (model handles ALL languages natively)
    const langInstruction = 'IMPORTANT: Respond in the SAME language the user wrote their message in. Never switch languages.'

    // Session summary — gives model long-term memory of the conversation
    let summaryBlock = ''
    if (sessionSummary) {
        summaryBlock = `\n\n[SESSION SUMMARY — what was discussed earlier]\n${sessionSummary}`
    }

    // Soft user context — only include non-empty fields.
    let userBlock = ''
    if (userContext) {
        const parts = []
        if (userContext.city) parts.push(`User city: ${userContext.city}`)
        if (userContext.foodieDNA) parts.push(`Taste profile: ${userContext.foodieDNA}`)
        if (userContext.dietary?.length) parts.push(`Dietary: ${userContext.dietary.join(', ')}`)
        if (userContext.favoriteCuisines?.length) parts.push(`Favorite cuisines: ${userContext.favoriteCuisines.join(', ')}`)
        if (parts.length > 0) {
            userBlock = `\n\n[USER CONTEXT — use silently for personalization, NEVER mention explicitly]\n${parts.join('\n')}`
        }
    }

    let locationBlock = ''
    if (usedLocations && usedLocations.length > 0) {
        const items = usedLocations.slice(0, 5).map((l, i) => {
            const name = l.title || l.name || 'Unnamed location'
            const parts = [`${i + 1}. ${name}`]
            if (l.category) parts.push(`   Category: ${l.category}`)
            if (l.city) parts.push(`   City: ${l.city}`)
            if (l.google_rating || l.rating) parts.push(`   Rating: ${l.google_rating || l.rating}`)
            if (l.price_range) parts.push(`   Price: ${l.price_range}`)
            if (l.description) parts.push(`   About: ${l.description.slice(0, 150)}`)
            if (l.vibe?.length) parts.push(`   Vibe: ${l.vibe.slice(0, 3).join(', ')}`)
            if (l.insider_tip) parts.push(`   Insider tip: ${l.insider_tip}`)
            if (l.what_to_try?.length) parts.push(`   Must try: ${l.what_to_try.slice(0, 3).join(', ')}`)
            if (l.distance) parts.push(`   Distance: ${l.distance}m`)
            return parts.join('\n')
        })
        locationBlock = `\n\n---\nDATA FROM DATABASE (these are the ONLY places you may mention):\n${items.join('\n\n')}\n\n⚠️ RULES FOR THIS DATA:\n- You MUST describe places from this list. Do NOT invent places.\n- If the places don't exactly match what the user asked for (e.g., they asked for restaurants but we found cafes), STILL recommend them — explain what you found and why it might interest them.\n- NEVER say "I couldn't find anything" when this DATA section contains places.`
    } else {
        locationBlock = '\n\n---\nNo places found matching the criteria. Suggest the user try a broader search (different area, cuisine type, or price range). Be helpful and encouraging.'
    }

    const systemContent = `${rules}\n\n${langInstruction}${summaryBlock}${userBlock}${locationBlock}`

    const messages = [{ role: 'system', content: systemContent }]

    // Include conversation history for context continuity (last 10 turns)
    // Optimization: first 6 messages compressed to 1 sentence, last 4 full (500 chars)
    if (conversationHistory && conversationHistory.length > 0) {
        const validHistory = conversationHistory
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .filter(m => m.content && m.content.trim() && m.content !== '…')
            .slice(-10)

        const historyTurns = validHistory.map((m, i, arr) => {
            const isRecent = i >= arr.length - 4 // Last 4 messages: full content
            const content = isRecent
                ? m.content.slice(0, 500)
                : m.content.slice(0, 120) + (m.content.length > 120 ? '...' : '') // Older: compressed
            return { role: m.role, content }
        })
        messages.push(...historyTurns)
    }

    // Add current user message
    if (userQuery && userQuery.trim()) {
        messages.push({ role: 'user', content: userQuery })
    }

    return messages
}

/**
 * Remove all tool-call artifacts from a model's text output so the user
 * never sees raw XML or JSON tool-call blocks in the chat UI.
 *
 * Handles multiple formats emitted by free models:
 *  - <tool_call>...</tool_call>   (Hermes, Nemotron, GLM…)
 *  - {"name":"search_locations","arguments":{…}}  (some models leak JSON)
 *  - {"matches":[...]}  (legacy GastroAI inline JSON)
 */
function cleanModelOutput(text) {
    if (!text) return ''
    return text
        // Strip XML tool_call blocks
        .replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '')
        // Strip stray <function=...> tags without tool_call wrapper
        .replace(/<function[\s\S]*?<\/function>/gi, '')
        // Strip thinking/reasoning blocks (Gemini 2.5 Flash outputs these)
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
        .replace(/<plan>[\s\S]*?<\/plan>/gi, '')
        // Strip inline JSON that looks like a tool call object
        .replace(/\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:[\s\S]*?\}/g, '')
        // Strip legacy {"matches":[...]} blobs
        .replace(/\{"matches":\[.*?\]\}\s*$/s, '')
        // Remove [PERSON_NAME] and similar bracketed placeholders
        .replace(/\[PERSON_NAME\]/gi, '')
        .replace(/\[USER_NAME\]/gi, '')
        .replace(/\[NAME\]/gi, '')
        // Clean up double spaces left after removal
        .replace(/  +/g, ' ')
        .trim()
}

/**
 * @param {string} text - Raw assistant message content
 * @returns {Array<{id:string, function:{name:string, arguments:string}}>}
 */
function parseXmlToolCalls(text) {
    if (!text) return []
    const calls = []

    // ── Format 1: <tool_call> <function=name> <parameter=key>val</parameter> </function> </tool_call>
    const blockRe = /<tool_call[^>]*>([\s\S]*?)<\/tool_call>/gi
    let m
    while ((m = blockRe.exec(text)) !== null) {
        const block = m[1]

        // Sub-format A: <function=search_locations> or <function name="search_locations">
        const fnMatch = /<function[=\s]+"?([^\s"<>]+)"?/i.exec(block)
        if (fnMatch) {
            const name = fnMatch[1].trim()
            const args = {}
            const paramRe = /<parameter[=\s]+"?([^\s"<>]+)"?[^>]*>([\s\S]*?)<\/parameter>/gi
            let pm
            while ((pm = paramRe.exec(block)) !== null) {
                const key = pm[1].trim()
                const raw = pm[2].trim()
                if (raw !== '' && !isNaN(raw)) {
                    args[key] = Number(raw)
                } else if (raw === 'true') {
                    args[key] = true
                } else if (raw === 'false') {
                    args[key] = false
                } else {
                    args[key] = raw
                }
            }
            calls.push({
                id: `xml_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                function: { name, arguments: JSON.stringify(args) },
            })
            continue
        }

        // Sub-format B: JSON object inside <tool_call>{"name":"search_locations","arguments":{...}}</tool_call>
        try {
            const jsonStr = block.trim()
            if (jsonStr.startsWith('{')) {
                const parsed = JSON.parse(jsonStr)
                if (parsed.name && (parsed.arguments || parsed.parameters)) {
                    calls.push({
                        id: `xml_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        function: {
                            name: parsed.name,
                            arguments: typeof parsed.arguments === 'string'
                                ? parsed.arguments
                                : JSON.stringify(parsed.arguments ?? parsed.parameters ?? {}),
                        },
                    })
                }
            }
        } catch { /* not valid JSON, skip */ }
    }
    return calls
}

/**
 * Run one agentic pass:
 * 1. Call OpenRouter (no stream) to get tool_calls or direct content.
 * 2. If tool_calls (native OpenAI format or XML text) → execute locally → send results back → get final text.
 *
 * @param {Array} messages - Full messages array including system prompt
 * @param {Object|Array} [ctx] - Execution context: { locations, geo, userId }.
 *                               Legacy callers may pass a locations array directly.
 * @returns {Promise<{ text: string, usedLocations: Array, modelUsed: string, attachments?: Array,
 *                    needsGeo?: boolean, askClarification?: { question, suggestions } }>}
 */
export async function runAgentPass(messages, ctx = {}) {
    const startTime = Date.now()

    // Backwards-compat: callers used to pass a locations array directly.
    if (Array.isArray(ctx)) ctx = { locations: ctx }
    const locations = ctx?.locations || []
    void locations // kept for API parity

    // ── Read admin config from store ────────────────────────────────────────
    let adminCascade = []
    let adminTemp = 0.7
    let adminMaxTokens = 2048
    let cfg = null
    try {
        const { useAppConfigStore } = await import('@/shared/store/useAppConfigStore')
        // Ensure Supabase config is loaded (no-op if already loaded)
        await useAppConfigStore.getState().loadFromDB()
        cfg = useAppConfigStore.getState()
        adminCascade = cfg.aiModelCascade || []
        adminTemp = cfg.aiGuideTemp ?? 0.7
        adminMaxTokens = Math.max(2048, Math.min(8192, cfg.aiGuideMaxTokens ?? 2048))
    } catch { /* config store not available — use defaults */ }

    // Use admin cascade if set, otherwise fall back to MODEL_CASCADE
    const cascade = adminCascade.length > 0 ? adminCascade : MODEL_CASCADE

    // ── V2 Guardrails (gated behind feature flag) ────────────────────────────
    const useV2 = cfg?.aiBotImprovementsV2 ?? false
    let queryClassification = null

    if (useV2) {
        // Extract user text from the last user message
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
        const userText = lastUserMsg?.content || ''

        // Stage 1: Input Guardrail
        const { classifyQuery } = await import('./guardrails/input.js')
        queryClassification = classifyQuery(userText, { threshold: cfg.guardThreshold ?? 0.6 })

        console.log('[Agent] Stage 1 classification:', { kind: queryClassification.kind, confidence: queryClassification.confidence })

        if (queryClassification.kind === 'off_topic') {
            const { recordGuardrailEvent } = await import('./guardrails/audit.js')
            const turnId = `turn_${Date.now()}`
            await recordGuardrailEvent({
                stage: 'input', verdict: 'rejected', turnId,
                reason: queryClassification.reason,
                userId: ctx?.userId, sessionId: ctx?.sessionId,
            })
            // Return polite refusal without calling LLM/tools
            return {
                text: "I'm GastroGuide — I specialize in helping you discover great food spots! I can't help with that topic, but I'd love to help you find an amazing restaurant, café, or bar. What are you in the mood for?",
                usedLocations: [],
                attachments: [],
                modelUsed: 'guardrail',
                toolCalls: [],
                timing: { startMs: startTime, toolExecutionMs: 0, totalMs: Date.now() - startTime },
            }
        }
    }

    // Tracked tool calls for enhanced metadata
    const trackedToolCalls = []

    // OpenRouter session tracking — shared across all fetchOpenRouter calls
    const sessionOpts = { sessionId: ctx?.sessionId || null, userId: ctx?.userId || null }

    // ── RAG-FIRST MODE: Single LLM call (search first, then generate) ───────
    // When aiBotMode === 'rag', skip tool calling entirely.
    // Search DB programmatically, then ask LLM to format the results in 1 call.
    // This fits within Vercel Hobby 10s limit (1 LLM call instead of 2).
    const botMode = cfg?.aiBotMode ?? 'rag' // 'rag' | 'agentic' — default 'rag' for Vercel Hobby compatibility

    if (botMode === 'rag') {
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
        const userText = lastUserMsg?.content || ''
        const intent = detectIntent(userText)

        // For non-gastro intents in RAG mode, still do a single LLM call without tools
        if (intent === 'meta' || intent === 'off_topic') {
            const { response: res, modelUsed } = await fetchOpenRouter(messages, {
                stream: false,
                withTools: false,
                temperature: adminTemp,
                maxTokens: adminMaxTokens,
                cascade,
                ...sessionOpts,
            })
            const data = await res.json()
            const text = cleanModelOutput(data.choices?.[0]?.message?.content ?? '')
            return {
                text: text || "I'm GastroGuide — I help you find great food spots! What are you in the mood for?",
                usedLocations: [], attachments: [], modelUsed,
                toolCalls: [], timing: { startMs: startTime, toolExecutionMs: 0, totalMs: Date.now() - startTime },
            }
        }

        // Gastro intent → search DB first, then 1 LLM call
        const fallbackArgs = buildFallbackToolArgs(intent, userText, ctx)
        const toolName = (intent === 'search_nearby' && fallbackArgs.useNearby) ? 'search_nearby' : 'search_locations'

        // Check search cache first (3-min TTL)
        const cacheKey = JSON.stringify({ toolName, args: fallbackArgs })
        const cached = getCachedSearch(cacheKey)

        const toolStart = Date.now()
        let result
        if (cached) {
            result = cached
        } else {
            try {
                result = await executeTool(toolName, fallbackArgs, ctx)
                if (result?.results?.length) setCachedSearch(cacheKey, result)
            } catch { result = { results: [] } }
        }
        const toolTime = Date.now() - toolStart

        const resultList = result?.results || (Array.isArray(result) ? result : [])
        trackedToolCalls.push({ name: toolName, args: fallbackArgs, resultCount: resultList.length, source: 'rag_mode' })

        if (result?.needs_geo) {
            return { text: '', usedLocations: [], attachments: [], needsGeo: true, pendingTool: { name: toolName, args: fallbackArgs }, modelUsed: 'rag', toolCalls: trackedToolCalls, timing: { startMs: startTime, toolExecutionMs: toolTime, totalMs: Date.now() - startTime } }
        }

        const usedLocations = resultList.slice(0, 5)
        const userContext = {
            city: ctx?.geoCity || null,
            foodieDNA: ctx?.userData?.foodieDNA || null,
            dietary: ctx?.dietary || [],
            favoriteCuisines: ctx?.userData?.favoriteCuisines || [],
        }
        const responseMessages = buildResponseMessages(usedLocations, userText, userContext, ctx?.conversationHistory || [], ctx?.sessionSummary || null)

        const { response: finalRes, modelUsed } = await fetchOpenRouter(responseMessages, {
            stream: false,
            withTools: false,
            temperature: adminTemp,
            maxTokens: adminMaxTokens,
            cascade,
            ...sessionOpts,
        })
        const finalData = await finalRes.json()
        let finalContent = cleanModelOutput(finalData.choices?.[0]?.message?.content ?? '')

        if (isGarbageResponse(finalContent) && usedLocations.length > 0) {
            finalContent = buildTemplateResponse(usedLocations, userText) || ''
        }
        // Validate grounding — reject hallucinated place names
        if (finalContent && usedLocations.length > 0) {
            const validated = validateGrounding(finalContent, usedLocations)
            if (validated === null) {
                finalContent = buildTemplateResponse(usedLocations, userText) || ''
            } else {
                finalContent = validated
            }
        }
        if (!finalContent && usedLocations.length > 0) {
            finalContent = buildTemplateResponse(usedLocations, userText) || usedLocations.map(l => `**${l.title || l.name}**`).join(', ')
        }
        if (!finalContent) {
            finalContent = 'I couldn\'t find places matching your criteria. Try a broader search!'
        }

        if (ctx?.sessionId && ctx?.userId && usedLocations.length) {
            import('./session-locations.js').then(({ recordSessionLocations }) => {
                recordSessionLocations(ctx.sessionId, usedLocations, ctx.userId).catch(() => {})
            }).catch(() => {})
        }

        return {
            text: finalContent, usedLocations, attachments: usedLocations, modelUsed,
            toolCalls: trackedToolCalls, timing: { startMs: startTime, toolExecutionMs: toolTime, totalMs: Date.now() - startTime },
        }
    }

    // ── AGENTIC MODE: Two LLM calls (tool calling + response generation) ────
    // First call: detect tool calls
    const { response: res, modelUsed } = await fetchOpenRouter(messages, {
        stream: false,
        withTools: true,
        toolChoice: 'required',
        temperature: adminTemp,
        maxTokens: adminMaxTokens,
        cascade,
        ...sessionOpts,
    })
    const data = await res.json()
    const choice = data.choices?.[0]

    if (!choice) throw new Error('No response from OpenRouter')

    const assistantMsg = choice.message
    const finishReason = choice.finish_reason

    // ── Path A: Native OpenAI tool_calls ────────────────────────────────────
    if (finishReason === 'tool_calls' && assistantMsg.tool_calls?.length) {
        return runToolCalls(assistantMsg.tool_calls, assistantMsg, messages, ctx, modelUsed, 'native', {
            startTime, trackedToolCalls, adminTemp, adminMaxTokens, cascade, useV2,
        })
    }

    // ── Path B: XML tool calls embedded in text (some free models) ──────────
    const xmlCalls = parseXmlToolCalls(assistantMsg.content)
    if (xmlCalls.length) {
        return runToolCalls(xmlCalls, assistantMsg, messages, ctx, modelUsed, 'xml', {
            startTime, trackedToolCalls, adminTemp, adminMaxTokens, cascade, useV2,
        })
    }

    // ── Path C: ENHANCED — Deterministic tool fallback ──────────────────────
    // Strip any stray XML/JSON artifacts the model might have left in the text
    const cleanText = cleanModelOutput(assistantMsg.content)

    // Extract user query from last user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    const userText = lastUserMsg?.content || ''
    const intent = detectIntent(userText)

    if (shouldForceFallback(intent, cleanText)) {
        console.log('[Agent] Path C fallback activated:', { intent, modelUsed })

        // Deterministically derive tool arguments from user query
        const fallbackArgs = buildFallbackToolArgs(intent, userText, ctx)

        // Decide which tool to call
        const toolName = (intent === 'search_nearby' && fallbackArgs.useNearby)
            ? 'search_nearby'
            : 'search_locations'

        // Execute tool programmatically
        const toolStart = Date.now()
        let result
        try {
            result = await executeTool(toolName, fallbackArgs, ctx)
        } catch (err) {
            console.warn('[Agent] Fallback executeTool error:', err.message)
            result = { results: [] }
        }
        const toolTime = Date.now() - toolStart

        const resultList = result?.results || (Array.isArray(result) ? result : [])
        trackedToolCalls.push({
            name: toolName,
            args: fallbackArgs,
            resultCount: resultList.length,
            source: 'deterministic_fallback',
        })

        // Handle needs_geo signal
        if (result?.needs_geo) {
            return {
                text: '',
                usedLocations: [],
                attachments: [],
                needsGeo: true,
                pendingTool: { name: toolName, args: fallbackArgs },
                modelUsed,
                toolCalls: trackedToolCalls,
                timing: { startMs: startTime, toolExecutionMs: toolTime, totalMs: Date.now() - startTime },
            }
        }

        // Extract locations from result
        const usedLocations = resultList.slice(0, 5)

        // Build 2nd call with compact prompt + structured data in system message
        const pathCUserContext = {
            city: ctx?.geoCity || null,
            foodieDNA: ctx?.userData?.foodieDNA || null,
            dietary: ctx?.dietary || [],
            favoriteCuisines: ctx?.userData?.favoriteCuisines || [],
        }
        const responseMessages = buildResponseMessages(usedLocations, userText, pathCUserContext, ctx?.conversationHistory || [], ctx?.sessionSummary || null)

        const { response: finalRes } = await fetchOpenRouter(responseMessages, {
            stream: false,
            withTools: false,
            temperature: adminTemp,
            maxTokens: adminMaxTokens,
            cascade,
            ...sessionOpts,
        })
        const finalData = await finalRes.json()
        let finalContent = cleanModelOutput(finalData.choices?.[0]?.message?.content ?? '')

        // Quality check: if model produced garbage, use template response
        if (isGarbageResponse(finalContent) && usedLocations.length > 0) {
            console.warn('[Agent] Garbage response detected, using template fallback')
            finalContent = buildTemplateResponse(usedLocations, userText) || ''
        }
        // Validate grounding — reject hallucinated place names
        if (finalContent && usedLocations.length > 0) {
            const validated = validateGrounding(finalContent, usedLocations)
            if (validated === null) {
                console.warn('[Agent] Hallucinated places in Path C fallback — using template')
                finalContent = buildTemplateResponse(usedLocations, userText) || ''
            } else {
                finalContent = validated
            }
        }

        // Minimal fallback if model still returns empty
        if (!finalContent && usedLocations.length > 0) {
            const names = usedLocations.slice(0, 5).map(l => `**${l.title || l.name}**`).join(', ')
            finalContent = `Here are some places I found: ${names}`
        }
        // If no locations and no content, provide a helpful message
        if (!finalContent && usedLocations.length === 0) {
            finalContent = 'I couldn\'t find places matching your exact criteria. Try a broader search — different cuisine, area, or price range might help!'
        }

        // Persist shown locations to session_locations
        if (ctx?.sessionId && ctx?.userId && usedLocations.length) {
            import('./session-locations.js').then(({ recordSessionLocations }) => {
                recordSessionLocations(ctx.sessionId, usedLocations, ctx.userId).catch(() => {})
            }).catch(() => {})
        }

        return {
            text: finalContent,
            usedLocations,
            attachments: usedLocations,
            modelUsed,
            toolCalls: trackedToolCalls,
            timing: { startMs: startTime, toolExecutionMs: toolTime, totalMs: Date.now() - startTime },
        }
    }

    // ── Stage 2: Output Guardrail (V2 only) ─────────────────────────────────
    if (useV2 && cleanText) {
        const { validateResponse } = await import('./guardrails/output.js')
        const { sanitizedText, redactions } = validateResponse(cleanText)

        if (redactions.length) {
            const { recordGuardrailEvent } = await import('./guardrails/audit.js')
            await recordGuardrailEvent({
                stage: 'output', verdict: 'modified',
                turnId: `turn_${Date.now()}`,
                reason: `Redacted ${redactions.length} items`,
                payload: { redactions: redactions.map(r => ({ kind: r.kind, original: r.original })) },
                userId: ctx?.userId, sessionId: ctx?.sessionId,
            })
        }

        return {
            text: sanitizedText,
            usedLocations,
            attachments: usedLocations,
            modelUsed,
            toolCalls: trackedToolCalls,
            timing: {
                startMs: startTime,
                toolExecutionMs: 0,
                totalMs: Date.now() - startTime,
            },
        }
    }

    return {
        text: cleanText,
        usedLocations: [],
        attachments: [],
        modelUsed,
        toolCalls: trackedToolCalls,
        timing: {
            startMs: startTime,
            toolExecutionMs: 0,
            totalMs: Date.now() - startTime,
        },
    }
}

/**
 * Execute tool calls, then ask the model for a natural-language final answer.
 *
 * @param {Array}  toolCalls    - Tool call objects (native or xml-parsed, both have .function.name/.arguments)
 * @param {Object} assistantMsg - The assistant message that contained the tool calls
 * @param {Array}  messages     - Original messages array
 * @param {Object} ctx          - Execution context: { locations, geo, userId }
 * @param {string} modelUsed    - Which model produced this response
 * @param {'native'|'xml'} mode - Whether we're handling native or XML tool calls
 */
async function runToolCalls(toolCalls, assistantMsg, messages, ctx, modelUsed, mode, meta = {}) {
    const { startTime = Date.now(), trackedToolCalls = [], adminTemp = 0.7, adminMaxTokens = 2048, cascade, useV2 = false } = meta
    const locations = ctx?.locations || []
    const toolResults = []
    let usedLocations = []
    let toolTime = 0

    for (const toolCall of toolCalls) {
        let args = {}
        try {
            args = JSON.parse(toolCall.function.arguments)
        } catch {
            args = {}
        }

        const toolStart = Date.now()
        const result = await executeTool(toolCall.function.name, args, ctx)
        toolTime += Date.now() - toolStart

        // DEBUG: Log tool result to diagnose empty usedLocations
        console.log('[runToolCalls] Tool result:', {
            tool: toolCall.function.name,
            args: JSON.stringify(args).slice(0, 200),
            resultType: typeof result,
            isArray: Array.isArray(result),
            hasResults: !!result?.results,
            resultsLength: result?.results?.length ?? (Array.isArray(result) ? result.length : 0),
            firstResult: result?.results?.[0]?.title || (Array.isArray(result) ? result[0]?.title : null),
        })

        // Track this tool call for enhanced metadata
        const resultCount = Array.isArray(result) ? result.length : (result ? 1 : 0)
        trackedToolCalls.push({ name: toolCall.function.name, args, resultCount })

        // Early exit: needs_geo — tool signalled that live GPS is required.
        // Stop the agent loop so the UI can prompt the user and retry.
        if (result && typeof result === 'object' && result.needs_geo) {
            return {
                text: '',
                usedLocations: [],
                attachments: [],
                needsGeo: true,
                pendingTool: { name: toolCall.function.name, args },
                modelUsed,
                toolCalls: trackedToolCalls,
                timing: {
                    startMs: startTime,
                    toolExecutionMs: toolTime,
                    totalMs: Date.now() - startTime,
                },
            }
        }

        // Early exit: ask_clarification — surface the question directly.
        if (result && typeof result === 'object' && result.ask_clarification) {
            return {
                text: result.question || '',
                usedLocations: [],
                attachments: [],
                askClarification: {
                    question: result.question || '',
                    suggestions: result.suggestions || [],
                },
                modelUsed,
                toolCalls: trackedToolCalls,
                timing: {
                    startMs: startTime,
                    toolExecutionMs: toolTime,
                    totalMs: Date.now() - startTime,
                },
            }
        }

        if (mode === 'native') {
            // Native mode: use the OpenAI tool role format
            toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
            })
        } else {
            // XML mode: model doesn't understand the 'tool' role — inject results as user message
            const stripped = `[Search results for ${toolCall.function.name}]\n${JSON.stringify(result, null, 2)}\n\nNow please answer the user's question naturally based on these results. Do not show raw JSON.\nIMPORTANT: Answer in the SAME language the user wrote their last message in.`
            toolResults.push({ role: 'user', content: stripped })
        }

        // Collect full location objects for UI cards.
        // search_locations + search_nearby → array of mapLocation results.
        // We use resultList directly — after data-loading-architecture migration,
        // useLocationsStore may be empty (shim). Tool results already contain full data.
        if (toolCall.function.name === 'search_locations' || toolCall.function.name === 'search_nearby') {
            const resultList = Array.isArray(result) ? result : (result?.results || [])
            if (resultList.length > 0) {
                usedLocations = resultList.slice(0, 5)
            }
        }
        if (toolCall.function.name === 'get_location_details' && result?.id) {
            usedLocations = [result]
        }
        if (toolCall.function.name === 'compare_locations' && result?.items?.length) {
            usedLocations = result.items
        }
    }

    // Second call: get final text with tool results (no tools needed)
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')

    // Use compact buildResponseMessages — language-agnostic, structured data in system message
    const toolCallsUserContext = {
        city: ctx?.geoCity || null,
        foodieDNA: ctx?.userData?.foodieDNA || null,
        dietary: ctx?.dietary || [],
        favoriteCuisines: ctx?.userData?.favoriteCuisines || [],
    }
    const finalMessages = buildResponseMessages(usedLocations, lastUserMsg?.content || '', toolCallsUserContext, ctx?.conversationHistory || [], ctx?.sessionSummary || null)

    const { response: finalRes } = await fetchOpenRouter(finalMessages, {
        stream: false,
        withTools: false,
        temperature: adminTemp,
        maxTokens: adminMaxTokens,
        cascade,
        sessionId: ctx?.sessionId || null,
        userId: ctx?.userId || null,
    })
    const finalData = await finalRes.json()
    
    console.log('[Agent] 2nd call response:', {
        hasChoices: !!finalData.choices?.length,
        contentLength: finalData.choices?.[0]?.message?.content?.length || 0,
        model: finalData._model_used,
        finishReason: finalData.choices?.[0]?.finish_reason,
        contentPreview: finalData.choices?.[0]?.message?.content?.slice(0, 100),
    })
    
    // Clean the final response — some models still emit XML/JSON artifacts
    // even when tools are disabled (withTools: false)
    let finalContent = cleanModelOutput(finalData.choices?.[0]?.message?.content ?? '')

    // Quality check: if model produced garbage, use template response
    if (isGarbageResponse(finalContent) && usedLocations.length > 0) {
        console.warn('[Agent] Garbage response detected in runToolCalls, using template fallback')
        finalContent = buildTemplateResponse(usedLocations) || ''
    }
    // Validate grounding — reject hallucinated place names
    if (finalContent && usedLocations.length > 0) {
        const validated = validateGrounding(finalContent, usedLocations)
        if (validated === null) {
            console.warn('[Agent] Hallucinated places in runToolCalls — using template')
            finalContent = buildTemplateResponse(usedLocations) || ''
        } else {
            finalContent = validated
        }
    }

    // If model returned empty text but we have locations, generate a minimal response
    if (!finalContent && usedLocations.length > 0) {
        const names = usedLocations.slice(0, 5).map(l => `**${l.title || l.name}**`).join(', ')
        finalContent = `Here are some places I found: ${names}`
    }

    // ── Stage 2: Output Guardrail (V2 only) ─────────────────────────────────
    if (useV2 && finalContent) {
        const { validateResponse } = await import('./guardrails/output.js')
        const { sanitizedText, redactions } = validateResponse(finalContent)

        if (redactions.length) {
            const { recordGuardrailEvent } = await import('./guardrails/audit.js')
            await recordGuardrailEvent({
                stage: 'output', verdict: 'modified',
                turnId: `turn_${Date.now()}`,
                reason: `Redacted ${redactions.length} items`,
                payload: { redactions: redactions.map(r => ({ kind: r.kind, original: r.original })) },
                userId: ctx?.userId, sessionId: ctx?.sessionId,
            })
        }

        return {
            text: sanitizedText,
            usedLocations,
            attachments: usedLocations,
            modelUsed,
            toolCalls: trackedToolCalls,
            timing: {
                startMs: startTime,
                toolExecutionMs: toolTime,
                totalMs: Date.now() - startTime,
            },
        }
    }

    return {
        text: finalContent,
        usedLocations,
        attachments: usedLocations,
        modelUsed,
        toolCalls: trackedToolCalls,
        timing: {
            startMs: startTime,
            toolExecutionMs: toolTime,
            totalMs: Date.now() - startTime,
        },
    }
}
