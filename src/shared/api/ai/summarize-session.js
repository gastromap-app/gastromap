/**
 * Session Summarizer — long-term memory layer.
 *
 * After a chat session has 15+ messages, we compress the oldest turns into a
 * short summary and store it in `conversation_summaries`. On the next session
 * load, the summary is injected into the system prompt so the LLM can recall
 * what was discussed earlier.
 *
 * This file provides:
 *   - summarizeSession(sessionId, messages): Generate + upsert summary
 *   - fetchSessionSummary(sessionId): Read existing summary
 */

import { supabase } from '../client'
import { fetchOpenRouter } from './openrouter'
import { MODEL_CASCADE } from './constants'

const SUMMARIZE_THRESHOLD = 15 // Only summarize when there are 15+ messages

/**
 * Generate a summary of the given messages using the LLM.
 * Returns a concise paragraph with key preferences, mentioned locations, and open threads.
 *
 * @param {Array} messages - Full message objects from the store
 * @returns {Promise<string|null>} Summary text, or null if failed
 */
async function generateSummary(messages) {
    if (!messages?.length) return null

    // Build a compact transcript (role: content) to summarize.
    const transcript = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => {
            const locations = (m.attachments || m.matches || [])
                .map(a => a.title || a.name)
                .filter(Boolean)
            const locStr = locations.length ? ` [mentioned: ${locations.join(', ')}]` : ''
            return `${m.role}: ${m.content?.slice(0, 300)}${locStr}`
        })
        .join('\n')

    const systemPrompt = `You are a concise summarizer for a food/restaurant chatbot conversation.
Produce a short paragraph (2-4 sentences) capturing:
  1. The user's preferences and dietary restrictions mentioned.
  2. Specific locations discussed (with names).
  3. Any open questions or unresolved needs.
  4. The language the user spoke (ru/en/pl/ua).
Output ONLY the summary paragraph, no preamble.`

    try {
        const { response } = await fetchOpenRouter(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Summarize this conversation:\n\n${transcript}` },
            ],
            {
                stream: false,
                withTools: false,
                temperature: 0.3,
                maxTokens: 256,
                cascade: MODEL_CASCADE,
            }
        )
        const data = await response.json()
        return data.choices?.[0]?.message?.content?.trim() || null
    } catch (err) {
        console.warn('[summarize] LLM summary generation failed:', err.message)
        return null
    }
}

/**
 * Extract mentioned location IDs from a message list.
 */
function extractLocationIds(messages) {
    const ids = new Set()
    for (const m of messages) {
        const cards = m.attachments || m.matches || []
        for (const c of cards) {
            if (c?.id) ids.add(c.id)
        }
        if (Array.isArray(m.mentionedLocationIds)) {
            for (const id of m.mentionedLocationIds) ids.add(id)
        }
    }
    return [...ids]
}

/**
 * Summarize a chat session and persist the summary to Supabase.
 * Only runs when there are enough messages to warrant compression.
 *
 * @param {string} sessionId - Chat session UUID
 * @param {Array} messages - Full message objects from the store
 * @returns {Promise<{ summary: string|null, skipped: boolean }>}
 */
export async function summarizeSession(sessionId, messages) {
    if (!supabase || !sessionId) return { summary: null, skipped: true }
    if (!messages || messages.length < SUMMARIZE_THRESHOLD) return { summary: null, skipped: true }

    const summaryText = await generateSummary(messages)
    if (!summaryText) return { summary: null, skipped: false }

    const locationIds = extractLocationIds(messages)

    try {
        const { error } = await supabase
            .from('conversation_summaries')
            .upsert({
                session_id: sessionId,
                summary: summaryText,
                mentioned_location_ids: locationIds,
                message_count: messages.length,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'session_id' })

        if (error) {
            console.warn('[summarize] Upsert failed:', error.message)
        }
    } catch (err) {
        console.warn('[summarize] DB error:', err.message)
    }

    return { summary: summaryText, skipped: false }
}

/**
 * Fetch a previously stored session summary.
 *
 * @param {string} sessionId
 * @returns {Promise<string|null>} Summary text, or null if none exists
 */
export async function fetchSessionSummary(sessionId) {
    if (!supabase || !sessionId) return null

    try {
        const { data, error } = await supabase
            .from('conversation_summaries')
            .select('summary')
            .eq('session_id', sessionId)
            .maybeSingle()

        if (error) {
            console.warn('[summarize] Fetch summary error:', error.message)
            return null
        }
        return data?.summary || null
    } catch {
        return null
    }
}
