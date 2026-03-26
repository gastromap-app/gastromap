import { useCallback } from 'react'
import { useAIChatStore } from '@/features/shared/hooks/useAIChatStore'
import { useUserPrefsStore } from '@/features/auth/hooks/useUserPrefsStore'
import { analyzeQueryStream, analyzeQuery } from '@/shared/api/ai.api'
import { config } from '@/shared/config/env'

/**
 * useAIChat — GastroGuide conversation logic with OpenRouter streaming.
 *
 * When VITE_OPENROUTER_API_KEY is set:
 *   • Uses analyzeQueryStream with word-by-word streaming effect
 *   • Model calls search_locations / get_location_details tools first,
 *     then generates a response using retrieved data
 *   • Passes last 8 messages as multi-turn history context
 *
 * When no API key:
 *   • Falls back to local gastroIntelligence scoring engine (zero API cost)
 *
 * @returns {{
 *   messages: Array,
 *   isTyping: boolean,
 *   error: string|null,
 *   isStreaming: boolean,
 *   sendMessage: (text: string) => Promise<void>,
 *   clearHistory: () => void,
 * }}
 */
export function useAIChat() {
    const {
        messages,
        isTyping,
        error,
        addMessage,
        updateLastMessage,
        setTyping,
        setError,
        clearError,
        clearHistory,
        trimHistory,
    } = useAIChatStore()

    const { prefs } = useUserPrefsStore()

    const sendMessage = useCallback(async (text) => {
        if (!text?.trim() || isTyping) return

        clearError()
        addMessage('user', text.trim())
        setTyping(true)

        // Build conversation history for multi-turn context
        const history = messages
            .slice(-8)
            .map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
            }))

        const context = { preferences: prefs, history }

        try {
            if (config.ai.openRouterKey) {
                // ── Streaming path (Claude API) ──────────────────────────────
                // Add an empty assistant message that will fill with streamed chunks
                addMessage('assistant', '…')
                let accumulated = ''

                const result = await analyzeQueryStream(text.trim(), context, (chunk) => {
                    accumulated += chunk
                    // Strip the trailing JSON block from live display
                    const display = accumulated.replace(/\{"matches":\[.*?\]\}\s*$/s, '').trim()
                    updateLastMessage('assistant', display || '…')
                })

                // Final update — parsed content + resolved location cards
                updateLastMessage('assistant', result.content, {
                    matches: result.matches,
                    intent: result.intent,
                })
            } else {
                // ── Non-streaming fallback (local engine) ────────────────────
                const response = await analyzeQuery(text.trim(), context)
                addMessage('assistant', response.content, {
                    matches: response.matches,
                    intent: response.intent,
                })
            }

            trimHistory()
        } catch (err) {
            setError(err.message ?? 'GastroGuide не отвечает. Попробуйте ещё раз.')
            addMessage('assistant', 'Произошла ошибка. Попробуйте ещё раз.', { isError: true })
        } finally {
            setTyping(false)
        }
    }, [isTyping, prefs, messages, addMessage, updateLastMessage, setTyping, setError, clearError, trimHistory])

    return {
        messages,
        isTyping,
        error,
        isStreaming: isTyping && Boolean(config.ai.openRouterKey),
        sendMessage,
        clearHistory,
    }
}
