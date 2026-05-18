/**
 * Query Analysis & Public API
 *
 * Main public endpoints for analyzing user queries:
 * - analyzeQuery: Non-streaming variant
 * - analyzeQueryStream: Streaming variant with word-by-word emission
 */

import { ApiError } from '../client'
import { gastroIntelligence } from '@/services/gastroIntelligence'
import { getActiveAIConfig } from '../ai-config.api'
import { buildSystemPrompt } from './prompts'
import { detectIntent } from './intents'
import { runAgentPass, buildResponseMessages } from './agents'
import { fetchOpenRouterStream } from './openrouter'
import { executeTool } from './tools'
import { buildFallbackToolArgs } from './agents'

/**
 * @typedef {Object} AIResponse
 * @property {string}   content  - Text to display in chat
 * @property {Array}    matches  - Matched location objects for UI cards (up to 3)
 * @property {string}   intent   - 'recommendation' | 'info' | 'general'
 */

/**
 * Analyze a user query and return a GastroGuide response.
 * Uses proxy when useProxy is true, else local engine.
 *
 * @param {string} message - User query
 * @param {{ preferences?: Object, history?: Array, locations?: Array, userData?: Object }} [context]
 * @returns {Promise<AIResponse>}
 */
export async function analyzeQuery(message, context = {}) {
    if (!message?.trim()) throw new ApiError('Message cannot be empty', 400, 'EMPTY_MESSAGE')

    const intent = detectIntent(message)

    if (getActiveAIConfig().useProxy === true) {
        try {
            const historyMessages = (context.history ?? [])
                .slice(-10)
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map(m => ({ role: m.role, content: m.content }))

            let systemPrompt = await buildSystemPrompt(context.preferences, message, 'guide', context.userData, context.history)

            // Inject strict off-topic instruction if intent detection flagged it
            if (intent === 'off_topic') {
                systemPrompt += '\n\nIMPORTANT: The user message appears to be OFF-TOPIC. Strictly follow the BOUNDARIES & GUARDRAILS and decline this request using the provided template.'
            }

            const messages = [
                { role: 'system', content: systemPrompt },
                ...historyMessages,
                { role: 'user', content: message },
            ]

            // Build context for the agentic pass
            let locations = context.locations
            if (!locations?.length) {
                try {
                    const { useLocationsStore } = await import('@/shared/store/useLocationsStore')
                    locations = useLocationsStore.getState().locations
                } catch { locations = [] }
            }
            const agentCtx = {
                locations,
                geo: context.geo || null,
                geoCity: context.userData?.userCity || null,
                userId: context.userId || null,
                sessionId: context.sessionId || null,
                dietary: context.dietary || [],
                userData: context.userData || null,
                conversationHistory: (context.history ?? []).filter(m => m.role === 'user' || m.role === 'assistant').filter(m => m.content?.trim() && m.content !== '…').slice(-10),
                sessionSummary: null, // non-streaming path doesn't fetch summary for speed
            }
            const agentResult = await runAgentPass(messages, agentCtx)

            if (agentResult.needsGeo) {
                return { content: '', matches: [], intent, needsGeo: true, pendingTool: agentResult.pendingTool }
            }
            if (agentResult.askClarification) {
                return { content: agentResult.text, matches: [], intent, askClarification: agentResult.askClarification }
            }

            return {
                content: agentResult.text,
                matches: agentResult.usedLocations ?? [],
                attachments: agentResult.attachments ?? agentResult.usedLocations ?? [],
                intent,
            }
        } catch (err) {
            if (err.status === 401) throw new ApiError('Invalid OpenRouter API key. Check VITE_OPENROUTER_API_KEY.', 401, 'AUTH_ERROR')
            console.warn('[GastroAI] analyzeQuery: proxy unavailable, falling back to local engine:', err.message)
        }
    } else {
        console.log('[GastroAI] analyzeQuery: useProxy=false, using local engine')
    }

    // Local fallback — pass live locations from context or store
    let fallbackLocations = context.locations
    if (!fallbackLocations?.length) {
        try {
            const { useLocationsStore } = await import('@/shared/store/useLocationsStore')
            fallbackLocations = useLocationsStore.getState().locations
        } catch { fallbackLocations = [] }
    }
    const result = await gastroIntelligence.analyzeQuery(message, fallbackLocations)
    // Validate: only return locations that exist in the store
    const validMatches = (result.matches ?? []).filter(loc =>
        loc?.id && typeof loc.id === 'string' && loc.id.length > 10  // UUID format check
    )
    return { content: result.content, matches: validMatches, intent }
}

/**
 * Streaming variant — runs the agentic pass first (non-streaming for tool calls),
 * then simulates word-by-word streaming via onChunk for a natural typing effect.
 *
 * @param {string} message - User query
 * @param {{ preferences?: Object, history?: Array, locations?: Array, userData?: Object }} [context]
 * @param {(chunk: string) => void} onChunk - Callback for each word chunk
 * @returns {Promise<AIResponse>}
 */
export async function analyzeQueryStream(message, context = {}, onChunk) {
    if (!message?.trim()) throw new ApiError('Message cannot be empty', 400, 'EMPTY_MESSAGE')

    const intent = detectIntent(message)

    if (getActiveAIConfig().useProxy) {
        try {
            // Full conversation history for context continuity (last 10 messages, no truncation)
            const conversationHistory = (context.history ?? [])
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .filter(m => {
                    const c = m.content?.trim()
                    if (!c || c === '…' || c === '...') return false
                    if (c.startsWith('An error occurred')) return false
                    return true
                })
                .slice(-10)

            // Build system prompt for the 1st LLM call (tool selection in agentic mode)
            let systemPrompt = await buildSystemPrompt(context.preferences, message, 'guide', context.userData, context.history)
            
            // Inject strict off-topic instruction if intent detection flagged it
            if (intent === 'off_topic') {
                systemPrompt += '\n\nIMPORTANT: The user message appears to be OFF-TOPIC. Strictly follow the BOUNDARIES & GUARDRAILS and decline this request using the provided template.'
            }

            // Messages for 1st LLM call include full history for tool-selection context
            const recentForToolCall = conversationHistory.slice(-6).map(m => ({
                role: m.role,
                content: m.content?.slice(0, 400) || ''
            }))

            const messages = [
                { role: 'system', content: systemPrompt },
                ...recentForToolCall,
                { role: 'user', content: message },
            ]

            // Build context for the agentic pass (locations, geo, userId)
            let locations = context.locations
            if (!locations?.length) {
                try {
                    const { useLocationsStore } = await import('@/shared/store/useLocationsStore')
                    locations = useLocationsStore.getState().locations
                } catch { locations = [] }
            }

            // Fetch session summary for long-term context (non-blocking)
            let sessionSummary = null
            if (context.sessionId) {
                try {
                    const { fetchSessionSummary } = await import('./summarize-session')
                    sessionSummary = await fetchSessionSummary(context.sessionId)
                } catch { /* summary not available — continue without it */ }
            }

            const agentCtx = {
                locations,
                geo: context.geo || null,
                geoCity: context.userData?.userCity || null,
                userId: context.userId || null,
                sessionId: context.sessionId || null,
                dietary: context.dietary || [],
                userData: context.userData || null,
                conversationHistory,
                sessionSummary,
            }

            // ── Real-time SSE streaming path ─────────────────────────────────────
            // Step 1: Execute tool (search DB) — non-streaming
            const fallbackArgs = buildFallbackToolArgs(intent, message, agentCtx)
            const toolName = (intent === 'search_nearby' && fallbackArgs.useNearby) ? 'search_nearby' : 'search_locations'

            let toolResult
            try {
                toolResult = await executeTool(toolName, fallbackArgs, agentCtx)
            } catch { toolResult = { results: [] } }

            // Handle needs_geo signal
            if (toolResult?.needs_geo) {
                return { content: '', matches: [], intent, needsGeo: true, pendingTool: { name: toolName, args: fallbackArgs } }
            }

            const usedLocations = (toolResult?.results || (Array.isArray(toolResult) ? toolResult : [])).slice(0, 5)

            // Step 2: Build response messages with DATA block + history
            const userContext = {
                city: agentCtx.geoCity || null,
                foodieDNA: context.userData?.foodieDNA || null,
                dietary: context.dietary || [],
                favoriteCuisines: context.userData?.favoriteCuisines || [],
            }
            const responseMessages = buildResponseMessages(usedLocations, message, userContext, conversationHistory, sessionSummary)

            // Step 3: Stream response via SSE
            if (onChunk) {
                onChunk('') // Reset signal — clear "…" placeholder
            }

            let streamedText = ''
            try {
                const { useAppConfigStore } = await import('@/shared/store/useAppConfigStore')
                const cfg = useAppConfigStore.getState()
                const adminTemp = cfg.aiGuideTemp ?? 0.7
                const adminMaxTokens = Math.max(2048, Math.min(8192, cfg.aiGuideMaxTokens ?? 2048))

                const { fullText, modelUsed } = await fetchOpenRouterStream(
                    responseMessages,
                    { temperature: adminTemp, maxTokens: adminMaxTokens },
                    (chunk) => {
                        streamedText += chunk
                        if (onChunk) onChunk(chunk)
                    }
                )
                streamedText = fullText
            } catch (streamErr) {
                // SSE failed — fallback to runAgentPass (non-streaming)
                console.warn('[GastroAI] SSE stream failed, falling back to non-streaming:', streamErr.message)
                const agentResult = await Promise.race([
                    runAgentPass(messages, agentCtx),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('AI response timeout (15s)')), 15000))
                ])
                if (agentResult.needsGeo) return { content: '', matches: [], intent, needsGeo: true, pendingTool: agentResult.pendingTool }
                streamedText = agentResult.text || ''
                if (onChunk && streamedText) {
                    onChunk('')
                    const words = streamedText.split(' ')
                    for (let i = 0; i < words.length; i++) {
                        onChunk((i === 0 ? '' : ' ') + words[i])
                        await new Promise(r => setTimeout(r, 5))
                    }
                }
                return {
                    content: streamedText,
                    matches: agentResult.usedLocations ?? [],
                    attachments: agentResult.attachments ?? agentResult.usedLocations ?? [],
                    intent,
                }
            }

            return {
                content: streamedText,
                matches: usedLocations,
                attachments: usedLocations,
                intent,
            }
        } catch (err) {
            console.error('[GastroAI] OpenRouter streaming error:', err.message, err.stack?.split('\n')[1])
            // Instead of silently falling back to useless local engine,
            // re-throw so the caller (useAIChat) can show a proper error message
            throw err
        }
    }

    // Fallback: only reached when useProxy is false (dev mode without server)
    const result = await analyzeQuery(message, context)
    // Validate: only return locations that exist in the store
    const validMatches = (result.matches ?? []).filter(loc =>
        loc?.id && typeof loc.id === 'string' && loc.id.length > 10  // UUID format check
    )
    const validatedResult = { ...result, matches: validMatches }
    if (onChunk && validatedResult?.content) {
        const words = result.content.split(' ')
        for (let i = 0; i < words.length; i++) {
            onChunk((i === 0 ? '' : ' ') + words[i])
            await new Promise(r => setTimeout(r, 5))
        }
    }
    return validatedResult
}
