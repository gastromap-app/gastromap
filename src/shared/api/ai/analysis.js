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
import { config } from '@/shared/config/env'
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
 * Uses OpenRouter when VITE_OPENROUTER_API_KEY is set, else local engine.
 *
 * @param {string} message - User query
 * @param {{ preferences?: Object, history?: Array, locations?: Array, userData?: Object }} [context]
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

            // locations from context, or fallback to store
            let locations = context.locations
            if (!locations?.length) {
                try {
                    const { useLocationsStore } = await import('@/shared/store/useLocationsStore')
                    locations = useLocationsStore.getState().locations
                } catch { locations = [] }
            }
            const { text, usedLocations } = await runAgentPass(messages, locations)

            return { content: text, matches: usedLocations, intent }
        } catch (err) {
            if (err.status === 401) throw new ApiError('Invalid OpenRouter API key. Check VITE_OPENROUTER_API_KEY.', 401, 'AUTH_ERROR')
            console.warn('[GastroAI] OpenRouter error, falling back to local engine:', err.message)
        }
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
    return { content: result.content, matches: result.matches ?? [], intent }
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

    if (getActiveAIConfig().apiKey || config.ai.useProxy) {
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

            // locations from context, or fallback to store
            let locations = context.locations
            if (!locations?.length) {
                try {
                    const { useLocationsStore } = await import('@/shared/store/useLocationsStore')
                    locations = useLocationsStore.getState().locations
                } catch { locations = [] }
            }
            const { text, usedLocations } = await runAgentPass(messages, locations)

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
            console.warn('[GastroAI] OpenRouter streaming error, falling back to local engine:', err.message)
        }
    }

    return analyzeQuery(message, context)
}
