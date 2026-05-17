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
import { runAgentPass } from './agents'

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

            // Global timeout: abort if runAgentPass takes longer than 15s
            const agentResult = await Promise.race([
                runAgentPass(messages, agentCtx),
                new Promise((_, reject) => setTimeout(() => reject(new Error('AI response timeout (15s)')), 15000))
            ])

            // Bubble up needs_geo / ask_clarification signals
            if (agentResult.needsGeo) {
                return { content: '', matches: [], intent, needsGeo: true, pendingTool: agentResult.pendingTool }
            }
            if (agentResult.askClarification) {
                return {
                    content: agentResult.text,
                    matches: [],
                    intent,
                    askClarification: agentResult.askClarification,
                }
            }

            // Real-time streaming: emit tokens as they arrive from LLM
            // If runAgentPass already has the full text, stream it with minimal delay
            if (onChunk && agentResult.text) {
                // Signal reset to caller (clear "…" placeholder)
                onChunk('')
                const words = agentResult.text.split(' ')
                for (let i = 0; i < words.length; i++) {
                    const chunk = (i === 0 ? '' : ' ') + words[i]
                    onChunk(chunk)
                    // Minimal delay for smooth rendering without blocking
                    await new Promise(r => setTimeout(r, 5))
                }
            }

            return {
                content: agentResult.text,
                matches: agentResult.usedLocations ?? [],
                attachments: agentResult.attachments ?? agentResult.usedLocations ?? [],
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
