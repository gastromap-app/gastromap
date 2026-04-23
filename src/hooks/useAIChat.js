import { useCallback } from 'react'
import { useAIChatStore } from '@/shared/hooks/useAIChatStore'
import { useUserPrefsStore } from '@/features/auth/hooks/useUserPrefsStore'
import { useFavoritesStore } from '@/features/dashboard/hooks/useFavoritesStore'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'
import { getUserReviews } from '@/shared/api/reviews.api'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { analyzeQueryStream, analyzeQuery, getActiveAIConfig } from '@/shared/api'
import { config } from '@/shared/config/env'
import { fetchChatHistory, createChatSession, saveChatMessage } from '@/shared/api/chat.api'
import { useUserGeo } from '@/shared/hooks/useUserGeo'
import { useEffect } from 'react'

/**
 * useAIChat — GastroGuide conversation logic with OpenRouter API streaming.
 *
 * When VITE_OPENROUTER_API_KEY is set (or admin sets a key at runtime):
 *   • Uses analyzeQueryStream for real-time token delivery
 *   • Updates the last assistant message in-place as chunks arrive
 *   • Passes last 8 messages as multi-turn history context
 *   • Supports 300+ models via OpenRouter (default: DeepSeek V3.2 Free)
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
        _sessionId,
        setSessionId,
        loadHistory,
    } = useAIChatStore()

    const { prefs } = useUserPrefsStore()
    const { favoriteIds } = useFavoritesStore()
    const { locations } = useLocationsStore()
    const { user } = useAuthStore()
    // Request geo silently on chat mount — shared with the Map component via GeoStore
    const { city: userCity, country: userCountry, requestGeo } = useUserGeo({ autoRequest: true })
    // Use centralized AI configuration logic (Runtime Admin key > Env key)
    const { apiKey: activeApiKey, useProxy } = getActiveAIConfig()
    // hasAIAccess: true when either a direct key OR a proxy (prod environment) is available
    const hasAIAccess = Boolean(activeApiKey) || useProxy || config.ai.useProxy

    // Fetch chat history on mount or when user changes
    useEffect(() => {
        let mounted = true;
        if (user?.id) {
            fetchChatHistory(user.id).then(history => {
                if (mounted && history?.sessionId) {
                    const currentMessages = useAIChatStore.getState().messages;
                    // Overwrite if local is empty or we have a different session
                    if (currentMessages.length === 0 || useAIChatStore.getState().sessionId !== history.sessionId) {
                        loadHistory(history.sessionId, history.messages);
                    }
                }
            }).catch(err => console.error('Failed to load chat history', err));
        }
        return () => { mounted = false };
    }, [user?.id, loadHistory]);

    const sendMessage = useCallback(async (text) => {
        if (!text?.trim() || isTyping) return

        clearError()
        const userMsg = addMessage('user', text.trim())
        setTyping(true)

        // DB Persistence: Ensure session and save user message
        let currentSessionId = useAIChatStore.getState().sessionId;
        if (user?.id && !currentSessionId) {
            const session = await createChatSession(user.id);
            if (session) {
                currentSessionId = session.id;
                setSessionId(currentSessionId);
            }
        }
        if (user?.id && currentSessionId) {
            saveChatMessage(currentSessionId, user.id, userMsg);
        }

        // Build conversation history for multi-turn context
        const history = messages
            .slice(-8)
            .map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content,
            }))

        // Fetch user reviews for deep personalization if authenticated
        let userExperience = []
        if (user?.id) {
            try {
                const reviews = await getUserReviews(user.id)
                userExperience = reviews.map(r => ({
                    location: r.locations?.title,
                    rating: r.rating,
                    text: r.review_text?.slice(0, 100) // Keep it concise for prompt
                }))
            } catch {
                console.warn('[useAIChat] Failed to fetch user reviews for context')
            }
        }

        const userData = {
            visitedCount: prefs.lastVisited?.length || 0,
            visitedNames: locations
                .filter(l => (prefs.lastVisited || []).includes(l.id))
                .map(l => l.title),
            favoritesNames: locations
                .filter(l => favoriteIds.includes(l.id))
                .map(l => l.title),
            recentInterests: prefs.frequentSearches || [],
            userExperience,
            foodieDNA: prefs.foodieDNA || '',
            // Geolocation context — filled when user grants browser permission
            userCity: userCity || null,
            userCountry: userCountry || null,
        }

        const context = { 
            preferences: prefs, 
            history,
            userData 
        }

        try {
            // ── Streaming / Proxy path ───────────────────────────────────────
            // Uses OpenRouter directly (when apiKey set) OR via Supabase proxy
            // (no key but PROD). Only falls through to local engine when both fail.
            if (hasAIAccess) {
                // Add an empty assistant message that will fill with streamed chunks
                addMessage('assistant', '…')
                let accumulated = ''

                console.log('[AI Guide] Sending context:', {
                    hasPreferences: !!context.preferences,
                    hasFoodieDNA: !!context.userData?.foodieDNA,
                    visitedCount: context.userData?.visitedCount,
                    favoritesCount: context.userData?.favoritesNames?.length,
                    historyLength: context.history?.length,
                    locationsCount: locations?.length,
                })

                const result = await analyzeQueryStream(text.trim(), context, (chunk) => {
                    accumulated += chunk
                    // Strip all tool-call artifacts from live display
                    const display = accumulated
                        .replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '')
                        .replace(/\{"matches":\[.*?\]\}\s*$/s, '')
                        .trim()
                    updateLastMessage('assistant', display || '…')
                })

                // Final update — parsed content + resolved location cards
                const finalMsg = updateLastMessage('assistant', result.content, {
                    matches: result.matches,
                    intent: result.intent,
                })
                
                if (user?.id && currentSessionId && finalMsg) {
                    saveChatMessage(currentSessionId, user.id, finalMsg);
                }
            } else {
                // ── Local engine fallback (no API key, no proxy — dev only) ──
                const response = await analyzeQuery(text.trim(), context)
                const finalMsg = addMessage('assistant', response.content, {
                    matches: response.matches,
                    intent: response.intent,
                })
                if (user?.id && currentSessionId && finalMsg) {
                    saveChatMessage(currentSessionId, user.id, finalMsg);
                }
            }

            trimHistory()
        } catch (err) {
            setError(err.message ?? 'GastroGuide не отвечает. Попробуйте ещё раз.')
            addMessage('assistant', 'Произошла ошибка. Попробуйте ещё раз.', { isError: true })
        } finally {
            setTyping(false)
        }
    }, [isTyping, prefs, messages, user, addMessage, updateLastMessage, setTyping, setError, clearError, trimHistory, favoriteIds, hasAIAccess, locations, setSessionId])

    return {
        messages,
        isTyping,
        error,
        isStreaming: isTyping && hasAIAccess,
        sendMessage,
        clearHistory,
    }
}
