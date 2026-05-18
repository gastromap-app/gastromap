/**
 * Query Analysis & Public API
 *
 * Main public endpoints for analyzing user queries:
 * - analyzeQuery: Non-streaming variant
 * - analyzeQueryStream: Streaming variant with word-by-word emission
 */

import { ApiError } from '../client'
import { getActiveAIConfig } from '../ai-config.api'
import { buildSystemPrompt } from './prompts'
import { detectIntent } from './intents'
import { runAgentPass, buildResponseMessages } from './agents'

/**
 * @typedef {Object} AIResponse
 * @property {string}   content  - Text to display in chat
 * @property {Array}    matches  - Matched location objects for UI cards (up to 3)
 * @property {Array}    attachments - Location cards attached to the message
 * @property {string}   intent   - 'recommendation' | 'info' | 'general'
 */

/**
 * Analyze a user query and return a GastroGuide response.
 * Single agentic pipeline: validate → detect intent → build messages → runAgentPass → return.
 *
 * @param {string} message - User query
 * @param {{ preferences?: Object, history?: Array, locations?: Array, userData?: Object }} [context]
 * @returns {Promise<AIResponse>}
 */
export async function analyzeQuery(message, context = {}) {
  if (!message?.trim()) throw new ApiError('Message cannot be empty', 400, 'EMPTY_MESSAGE')

  const intent = detectIntent(message)

  // Build conversation history
  const conversationHistory = (context.history ?? [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .filter(m => { const c = m.content?.trim(); return c && c !== '…' && c !== '...' && !c.startsWith('An error occurred') })
    .slice(-10)

  // Build system prompt
  let systemPrompt = await buildSystemPrompt(context.preferences, message, 'guide', context.userData, context.history)
  if (intent === 'off_topic') {
    systemPrompt += '\n\nIMPORTANT: The user message appears to be OFF-TOPIC. Strictly follow the BOUNDARIES & GUARDRAILS and decline this request.'
  }

  const recentForToolCall = conversationHistory.slice(-6).map(m => ({
    role: m.role, content: m.content?.slice(0, 400) || ''
  }))
  const messages = [{ role: 'system', content: systemPrompt }, ...recentForToolCall, { role: 'user', content: message }]

  // Build agent context
  const agentCtx = {
    geo: context.geo || null,
    geoCity: context.userData?.userCity || null,
    userId: context.userId || null,
    sessionId: context.sessionId || null,
    dietary: context.dietary || [],
    userData: context.userData || null,
    conversationHistory,
    sessionSummary: null,
  }

  // Run with timeout
  const agentResult = await Promise.race([
    runAgentPass(messages, agentCtx),
    new Promise((_, reject) => setTimeout(() => reject(new Error('AI response timeout (25s)')), 25000))
  ])

  return {
    content: agentResult.text,
    matches: agentResult.usedLocations ?? [],
    attachments: agentResult.attachments ?? agentResult.usedLocations ?? [],
    intent,
  }
}

/**
 * Streaming variant — calls analyzeQuery then simulates word-by-word streaming
 * via onChunk for a natural typing effect.
 *
 * @param {string} message - User query
 * @param {{ preferences?: Object, history?: Array, locations?: Array, userData?: Object }} [context]
 * @param {(chunk: string) => void} onChunk - Callback for each word chunk
 * @returns {Promise<AIResponse>}
 */
export async function analyzeQueryStream(message, context = {}, onChunk) {
  if (!message?.trim()) throw new ApiError('Message cannot be empty', 400, 'EMPTY_MESSAGE')

  const result = await analyzeQuery(message, context)

  if (onChunk && result.content) {
    onChunk('') // reset signal
    const words = result.content.split(' ')
    for (let i = 0; i < words.length; i++) {
      onChunk((i === 0 ? '' : ' ') + words[i])
      await new Promise(r => setTimeout(r, 8))
    }
  }

  return result
}
