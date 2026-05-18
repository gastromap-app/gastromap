import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAIChatStore } from '@/shared/store/useAIChatStore'
import { useUserPrefsStore } from '@/shared/store/useUserPrefsStore'
import { useFavoritesStore } from '@/shared/store/useFavoritesStore'
import { useAuthStore } from '@/shared/store/useAuthStore'

import { useLocations } from '@/shared/api/queries/location.queries'
import { analyzeQueryStream, analyzeQuery } from '@/shared/api'
import { fetchChatHistory, createChatSession, saveChatMessage } from '@/shared/api/chat.api'
import { getOrCreateSession } from '@/shared/api/chat-history.api'
import { summarizeSession } from '@/shared/api/ai/summarize-session'
import { useChatSync } from '@/shared/hooks/useChatSync'
import { useChatHydration } from '@/shared/hooks/useChatHydration'
import { useUserGeo } from '@/shared/hooks/useUserGeo'
import { useEffect, useRef } from 'react'
import { log as safeLog, warn as safeWarn } from '@/shared/lib/safe-console.js'
import { useGeoStore } from '@/shared/store/useGeoStore'
import { getUserLocationHistory } from '@/shared/api/user.api'


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
        setSessionId,
        loadHistory,
    } = useAIChatStore()

    const { prefs } = useUserPrefsStore()
    const { favoriteIds } = useFavoritesStore()
    const { data: locationsResult = [] } = useLocations()
    const locations = Array.isArray(locationsResult) ? locationsResult : (locationsResult?.data ?? [])
    const { user } = useAuthStore()
    // Request geo silently on chat mount — shared with the Map component via GeoStore
    const { city: userCity, country: userCountry, requestGeo, status } = useUserGeo({ autoRequest: true })
    // hasAIAccess: always true — all requests go through server-side proxy
    const hasAIAccess = true

    // ── Sync integration (non-blocking) ─────────────────────────────────────
    const { syncStatus, pendingCount, isOnline, persistMessage, flushQueue } = useChatSync()

    // Hydrate chat history from server on mount (handles user isolation + merge)
    useChatHydration(user?.id || null, { flushQueue })

    // Track sessionId for sync persistence
    const syncSessionRef = useRef(null)

    // Get or create a session for the current user on mount
    useEffect(() => {
        if (!user?.id) {
            syncSessionRef.current = null
            return
        }
        // Use existing sessionId from store if available
        const storeSessionId = useAIChatStore.getState().sessionId
        if (storeSessionId) {
            syncSessionRef.current = storeSessionId
            return
        }
        // Otherwise get/create from server
        getOrCreateSession(user.id).then((session) => {
            if (session?.id) {
                syncSessionRef.current = session.id
                setSessionId(session.id)
            }
        }).catch((err) => {
            safeWarn('[useAIChat] Failed to get/create session for sync:', err)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])

    // Clear history when user logs out
    useEffect(() => {
        if (!user) {
            clearHistory()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

const MAX_CHAT_INPUT_LENGTH = 3000

    const sendMessage = useCallback(async (text) => {
        const cleanedText = text?.trim().slice(0, MAX_CHAT_INPUT_LENGTH)
        if (!cleanedText || isTyping) return

        clearError()
        const userMsg = addMessage('user', cleanedText)
        setTyping(true)

        // Safety timeout: if typing gets stuck for 30s, force reset
        const safetyTimeout = setTimeout(() => {
            const stillTyping = useAIChatStore.getState().isTyping
            if (stillTyping) {
                setTyping(false)
                setError('Request timed out. Please try again.')
                updateLastMessage('assistant', 'Request timed out. Please try again.', { isError: true })
            }
        }, 30000)

        // DB Persistence: Ensure session and save user message
        let currentSessionId = useAIChatStore.getState().sessionId || syncSessionRef.current;
        if (user?.id && !currentSessionId) {
            const session = await createChatSession(user.id);
            if (session) {
                setSessionId(session.id);
                currentSessionId = session.id;
                syncSessionRef.current = session.id;
                // Ensure userId is stamped in the store for isolation
                useAIChatStore.setState({ userId: user.id });
            }
        }
        if (user?.id && currentSessionId) {
            // Legacy persistence (existing behavior)
            saveChatMessage(currentSessionId, user.id, userMsg);
            // Sync persistence (non-blocking, fire-and-forget)
            persistMessage(currentSessionId, user.id, userMsg).catch(() => {});
        }

        // Build conversation history for multi-turn context (rolling window of last 10 turns)
        // (history variable removed — context.history uses messages.slice(-10) directly)

        // Fetch location history for deep personalization if authenticated
        let locationHistory = []
        if (user?.id) {
            try {
                const history = await getUserLocationHistory(user.id).catch(() => [])
                locationHistory = history.map(h => ({
                    city: h.city,
                    country: h.country,
                    visits: h.visit_count,
                    lastVisited: h.last_visited_at
                }))
            } catch {
                safeWarn('[useAIChat] Failed to fetch personalization data')
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
            locationHistory, // Injected into the prompt via buildSystemPrompt
            dietaryRestrictions: prefs.dietaryRestrictions || [],
            foodieDNA: prefs.foodieDNA || '',
            atmospherePreference: prefs.atmospherePreference || '',
            features: prefs.features || '',
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
            sessionId: currentSessionId,
            dietary: prefs.dietaryRestrictions || [],
        }

        try {
            // ── Streaming / Proxy path ───────────────────────────────────────
            // Uses OpenRouter directly (when apiKey set) OR via Supabase proxy
            // (no key but PROD). Only falls through to local engine when both fail.
            if (hasAIAccess) {
                // Add an empty assistant message that will fill with streamed chunks
                addMessage('assistant', '…')
                let accumulated = ''

                safeLog('[AI Guide] Sending context:', {
                    hasPreferences: !!context.preferences,
                    historyLength: context.history?.length,
                    locationsCount: locations?.length,
                })

                const result = await analyzeQueryStream(cleanedText, context, (chunk) => {
                    // Empty chunk = reset signal (switching from "Thinking..." to real content)
                    if (chunk === '') {
                        accumulated = ''
                        return
                    }
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
                            const retryResult = await analyzeQueryStream(cleanedText, retryCtx, (chunk) => {
                                if (chunk === '') { accumulated = ''; return }
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
                                persistMessage(currentSessionId, user.id, finalMsg).catch(() => {})
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

                // DEBUG: Log attachments to diagnose missing cards
                safeLog('[AI Guide] Result attachments:', {
                    hasAttachments: !!(result.attachments?.length),
                    hasMatches: !!(result.matches?.length),
                    attachmentsCount: result.attachments?.length || 0,
                    matchesCount: result.matches?.length || 0,
                    firstAttachment: result.attachments?.[0] ? { id: result.attachments[0].id, title: result.attachments[0].title } : null,
                })

                const foundMsgText = t('ai.found_places')
                const finalMsg = updateLastMessage('assistant', cleanContent || foundMsgText, {
                    attachments: result.attachments || result.matches,
                    matches: result.matches,
                    intent: result.intent,
                })
                
                if (user?.id && currentSessionId && finalMsg) {
                    saveChatMessage(currentSessionId, user.id, finalMsg);
                    persistMessage(currentSessionId, user.id, finalMsg).catch(() => {});
                }
            } else {
                // ── Local engine fallback (no API key, no proxy — dev only) ──
                const response = await analyzeQuery(cleanedText, context)
                const finalMsg = addMessage('assistant', response.content, {
                    attachments: response.attachments || response.matches,
                    matches: response.matches,
                    intent: response.intent,
                })
                if (user?.id && currentSessionId && finalMsg) {
                    saveChatMessage(currentSessionId, user.id, finalMsg);
                    persistMessage(currentSessionId, user.id, finalMsg).catch(() => {});
                }
            }

            trimHistory()

            // Fire-and-forget: summarize session when it grows large.
            const currentMessages = useAIChatStore.getState().messages
            const activeSessionId = useAIChatStore.getState().sessionId
            if (activeSessionId && currentMessages.length >= 10 && user?.id) {
                summarizeSession(activeSessionId, currentMessages, user.id).then(res => {
                    if (res && res.foodieDNA) {
                        // Sync to local store AND Supabase
                        const { updatePrefs } = useUserPrefsStore.getState();
                        updatePrefs({ foodie_dna: res.foodieDNA });
                        safeLog('GastroGuide: Syncing updated Foodie DNA to preferences');
                    }
                }).catch(() => {});
            }
        } catch (err) {
            if (err?.message?.includes('rate-limited') || err?.message?.includes('rate_limit') || err?.status === 429 || err?.message?.includes('All AI models')) {
                const msg = t ? t('ai.rate_limited_retry') : 'All AI models are busy. Please try again in 1 minute.';
                setError(msg)
                updateLastMessage('assistant', msg, { isError: true })
            } else {
                console.error('[useAIChat] Error details:', { message: err?.message, stack: err?.stack?.split('\n').slice(0, 3).join('\n') })
                setError(err.message ?? t('ai.response_failed'))
                updateLastMessage('assistant', t('ai.general_error'), { isError: true })
            }
        } finally {
            clearTimeout(safetyTimeout)
            setTyping(false)
        }
    }, [isTyping, prefs, messages, user, addMessage, updateLastMessage, setTyping, setError, clearError, trimHistory, favoriteIds, hasAIAccess, locations, setSessionId, userCity, userCountry, requestGeo, t, persistMessage])

    return {
        messages,
        isTyping,
        error,
        isStreaming: isTyping && hasAIAccess,
        sendMessage,
        clearHistory,
        geoStatus: status,
        requestGeo,
        // Sync status (non-blocking)
        syncStatus,
        pendingCount,
        isOnline,
    }
}
