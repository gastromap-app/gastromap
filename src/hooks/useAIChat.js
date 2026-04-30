import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAIChatStore } from '@/shared/store/useAIChatStore'
import { useUserPrefsStore } from '@/features/auth/hooks/useUserPrefsStore'
import { useFavoritesStore } from '@/shared/store/useFavoritesStore'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'
import { getUserReviews } from '@/shared/api/reviews.api'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { analyzeQueryStream, analyzeQuery, getActiveAIConfig } from '@/shared/api'
import { config } from '@/shared/config/env'
import { fetchChatHistory, createChatSession, saveChatMessage } from '@/shared/api/chat.api'
import { summarizeSession } from '@/shared/api/ai/summarize-session'
import { useUserGeo } from '@/shared/hooks/useUserGeo'
import { useEffect } from 'react'
import { useGeoStore } from '@/shared/store/useGeoStore'


/**
 * useAIChat — GastroGuide conversation logic with OpenRouter API streaming.
 *
 * When VITE_OPENROUTER_API_KEY is set (or admin sets a key at runtime):
 *   • Uses analyzeQueryStream for real-time token delivery
 *   • Updates the last assistant message in-place as chunks arrive
 *   • Passes last 10 messages as multi-turn history context
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
    const { t } = useTranslation()
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
    const { city: userCity, country: userCountry, requestGeo, status } = useUserGeo({ autoRequest: true })
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

        // Build conversation history for multi-turn context (rolling window of last 10 turns)
        // (history variable removed — context.history uses messages.slice(-10) directly)

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
            userLat: useGeoStore.getState().lat || null,
            userLng: useGeoStore.getState().lng || null,
        }

        const context = { 
            preferences: prefs, 
            history: messages.slice(-10), // full message objects (with attachments, intent, etc.)
            userData,
            // Geo context for search_nearby tool
            geo: {
                lat: useGeoStore.getState().lat || null,
                lng: useGeoStore.getState().lng || null,
            },
            userId: user?.id || null,
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

                // Handle needs_geo: prompt for location access and retry once.
                if (result.needsGeo) {
                    updateLastMessage('assistant', t('ai.geo_permission_request'))
                    try {
                        await requestGeo()
                        const retryGeo = {
                            lat: useGeoStore.getState().lat,
                            lng: useGeoStore.getState().lng,
                        }
                        if (retryGeo.lat && retryGeo.lng) {
                            const retryCtx = { ...context, geo: retryGeo }
                            accumulated = ''
                            const retryResult = await analyzeQueryStream(text.trim(), retryCtx, (chunk) => {
                                accumulated += chunk
                                const display = accumulated
                                    .replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '')
                                    .replace(/\{"matches":\[.*?\]\}\s*$/s, '')
                                    .trim()
                                updateLastMessage('assistant', display || '…')
                            })
                            const retryClean = (retryResult.content || '').replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '').replace(/\{"matches":\[.*?\]\}\s*$/s, '').trim()
                            const finalMsg = updateLastMessage('assistant', retryClean || t('ai.found_places'), {
                                attachments: retryResult.attachments || retryResult.matches,
                                matches: retryResult.matches,
                                intent: retryResult.intent,
                            })
                            if (user?.id && currentSessionId && finalMsg) {
                                saveChatMessage(currentSessionId, user.id, finalMsg)
                            }
                        } else {
                            updateLastMessage('assistant', t('ai.geo_failed_with_tip'))
                        }
                    } catch {
                        updateLastMessage('assistant', t('ai.geo_unavailable'))
                    }
                    setTyping(false)
                    return
                }

                // Final update — parsed content + resolved location cards
                const cleanContent = (result.content || '')
                    .replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '')
                    .replace(/\{"matches":\[.*?\]\}\s*$/s, '')
                    .trim()

                const foundMsgText = t('ai.found_places')
                const finalMsg = updateLastMessage('assistant', cleanContent || foundMsgText, {
                    attachments: result.attachments || result.matches,
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
                    attachments: response.attachments || response.matches,
                    matches: response.matches,
                    intent: response.intent,
                })
                if (user?.id && currentSessionId && finalMsg) {
                    saveChatMessage(currentSessionId, user.id, finalMsg);
                }
            }

            trimHistory()

            // Fire-and-forget: summarize session when it grows large.
            const currentMessages = useAIChatStore.getState().messages
            const activeSessionId = useAIChatStore.getState().sessionId
            if (activeSessionId && currentMessages.length >= 15) {
                summarizeSession(activeSessionId, currentMessages, user?.id || null).catch(() => {})
            }
        } catch (err) {
            setError(err.message ?? t('ai.response_failed'))
            addMessage('assistant', t('ai.general_error'), { isError: true })
        } finally {
            setTyping(false)
        }
    }, [isTyping, prefs, messages, user, addMessage, updateLastMessage, setTyping, setError, clearError, trimHistory, favoriteIds, hasAIAccess, locations, setSessionId, userCity, userCountry, status, requestGeo])

    return {
        messages,
        isTyping,
        error,
        isStreaming: isTyping && hasAIAccess,
        sendMessage,
        clearHistory,
        geoStatus: status,
        requestGeo,
    }
}
