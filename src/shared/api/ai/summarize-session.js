/**
 * Session Summarizer — long-term memory layer.
 *
 * After a chat session has 15+ messages, we compress the oldest turns into a
 * short summary and store it in `conversation_summaries`. On the next session
 * load, the summary is injected into the system prompt so the LLM can recall
 * what was discussed earlier.
 *
 * This file provides:
 *   - summarizeSession(sessionId, messages, userId): Generate + upsert summary
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
 * @returns {Promise<{summary: string, foodieDNA: string}|null>} Summary data, or null if failed
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
Analyze the conversation and extract:
1. A short summary paragraph (2-4 sentences) capturing key preferences, mentioned locations, and open threads.
2. "Foodie DNA": A comma-separated list of the user's PERMANENT food preferences, dietary restrictions, favorite cuisines, and vibes they like. Focus on what we learned about the user themselves.

IMPORTANT: Output your response ONLY as a valid JSON object with these keys: "summary", "foodieDNA".
No preamble, no markdown blocks, just the raw JSON.`

    try {
        const { response } = await fetchOpenRouter(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Summarize this conversation and extract DNA:\n\n${transcript}` },
            ],
            {
                stream: false,
                withTools: false,
                temperature: 0.3,
                maxTokens: 512,
                cascade: MODEL_CASCADE,
            }
        )
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content?.trim() || null
        if (!content) return null

        try {
            // Support both raw JSON and json-markdown-wrapped responses
            const jsonStr = content.replace(/^```json\s*|```$/g, '').trim()
            return JSON.parse(jsonStr)
        } catch (e) {
            console.warn('[summarize] Failed to parse JSON from LLM:', e.message)
            return { summary: content, foodieDNA: '' }
        }
    } catch (err) {
        console.warn('[summarize] LLM summary generation failed:', err.message)
        return null
    }
}

/**
 * Summarize a chat session and persist the summary to Supabase.
 * Only runs when there are enough messages to warrant compression.
 *
 * @param {string} sessionId - Chat session UUID
 * @param {Array} messages - Full message objects from the store
 * @returns {Promise<{ summary: string|null, foodieDNA: string|null, skipped: boolean }>}
 */
export async function summarizeSession(sessionId, messages, userId = null) {
    if (!supabase || !sessionId) return { summary: null, foodieDNA: null, skipped: true }
    if (!messages || messages.length < SUMMARIZE_THRESHOLD) return { summary: null, foodieDNA: null, skipped: true }

    const result = await generateSummary(messages)
    if (!result) return { summary: null, foodieDNA: null, skipped: false }

    const { summary: summaryText, foodieDNA } = result

    try {
        const { error } = await supabase
            .from('conversation_summaries')
            .upsert({
                session_id: sessionId,
                user_id: userId,
                summary: summaryText,
                foodie_dna: foodieDNA, // Store extracted DNA in history too
                covers_up_to: new Date().toISOString(),
                messages_covered: messages.length,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'session_id' })

        if (error) {
            console.warn('[summarize] Upsert failed:', error.message)
        }
    } catch (err) {
        console.warn('[summarize] DB error:', err.message)
    }

    return { summary: summaryText, foodieDNA, skipped: false }
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
