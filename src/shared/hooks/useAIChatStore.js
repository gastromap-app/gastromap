import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config } from '@/shared/config/env'

/**
 * useAIChatStore — GastroGuide conversation state.
 *
 * Separated from auth so the chat history persists independently
 * and can be cleared without logging out.
 *
 * @typedef {Object} ChatMessage
 * @property {string}  id        - Unique message ID
 * @property {'user'|'assistant'|'tool'} role
 * @property {string}  content
 * @property {number}  timestamp - Unix ms
 * @property {Array}   [attachments]          - First-class location cards attached to the message
 * @property {Object}  [metadata]             - Free-form extras (geo snapshot, model, etc.)
 * @property {string}  [intent]               - search_nearby | search_by_filter | follow_up | compare | card_request | meta
 * @property {string}  [language]             - Language used for this turn
 * @property {string[]}[mentionedLocationIds] - Location UUIDs referenced by the turn
 * @property {Array}   [toolCalls]            - Raw tool_calls payload (assistant messages)
 * @property {string}  [toolCallId]           - Back-reference on tool-role messages
 * @property {Array}   [matches]              - @deprecated alias of attachments, kept for back-compat
 */

/**
 * Normalize a message so both legacy (`matches`) and new (`attachments`) callers
 * see consistent fields. Ensures attachments is always an array.
 */
function normalizeMessage(msg) {
    if (!msg) return msg
    const attachments = Array.isArray(msg.attachments) && msg.attachments.length
        ? msg.attachments
        : Array.isArray(msg.matches)
            ? msg.matches
            : []
    return {
        ...msg,
        attachments,
        matches: attachments, // keep alias hot for existing readers
    }
}

export const useAIChatStore = create(
    persist(
        (set) => ({
            messages: [],          // ChatMessage[]
            isTyping: false,       // assistant is generating
            error: null,
            sessionId: null,
            isChatOpen: false,    // UI visibility state

            // ─── Actions ─────────────────────────────────────────────────

            setSessionId: (sessionId) => set({ sessionId }),

            setIsChatOpen: (isChatOpen) => set({ isChatOpen }),

            toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

            loadHistory: (sessionId, messages) => set({
                sessionId,
                messages: (messages || []).map(normalizeMessage),
            }),

            /**
             * Append a new message. Accepts first-class extras:
             *   attachments, metadata, intent, language,
             *   mentionedLocationIds, toolCalls, toolCallId.
             * Also preserves any other keys on `extras` for future extensibility.
             */
            addMessage: (role, content, extras = {}) => {
                const message = normalizeMessage({
                    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    role,
                    content,
                    timestamp: Date.now(),
                    attachments: extras.attachments || extras.matches || [],
                    metadata: extras.metadata || {},
                    intent: extras.intent || null,
                    language: extras.language || null,
                    mentionedLocationIds: extras.mentionedLocationIds || [],
                    toolCalls: extras.toolCalls || null,
                    toolCallId: extras.toolCallId || null,
                    ...extras,
                })
                set((state) => ({ messages: [...state.messages, message] }))
                return message
            },

            /**
             * Update the last message in the list — used for streaming token delivery.
             * Finds the most recent message with the given role and merges content + extras.
             */
            updateLastMessage: (role, content, extras = {}) => {
                let updatedMessage = null
                set((state) => {
                    const messages = [...state.messages]
                    for (let i = messages.length - 1; i >= 0; i--) {
                        if (messages[i].role === role) {
                            const merged = {
                                ...messages[i],
                                content,
                                ...extras,
                            }
                            // If extras carries attachments (or legacy matches), keep them in sync
                            if (extras.attachments || extras.matches) {
                                const next = extras.attachments || extras.matches
                                merged.attachments = next
                                merged.matches = next
                            }
                            messages[i] = normalizeMessage(merged)
                            updatedMessage = messages[i]
                            break
                        }
                    }
                    return { messages }
                })
                return updatedMessage
            },

            setTyping: (isTyping) => set({ isTyping }),

            setError: (error) => set({ error }),

            clearError: () => set({ error: null }),

            clearHistory: () => set({ messages: [], error: null, sessionId: null }),

            /**
             * Keep only the last N messages to avoid hitting context limits.
             * Call after adding a new exchange.
             */
            trimHistory: () => {
                const max = config.ai.maxHistoryLength
                set((state) => ({
                    messages: state.messages.slice(-max),
                }))
            },
        }),
        {
            name: 'ai-chat-storage',
            version: 2,
            // Only persist messages and sessionId
            partialize: (state) => ({ 
                messages: state.messages, 
                sessionId: state.sessionId,
                isChatOpen: state.isChatOpen 
            }),
            migrate: (persistedState, version) => {
                if (!persistedState) return persistedState
                // v1 → v2: move legacy `matches` into `attachments`
                if (version < 2 && Array.isArray(persistedState.messages)) {
                    persistedState.messages = persistedState.messages.map(normalizeMessage)
                }
                return persistedState
            },
        }
    )
)
