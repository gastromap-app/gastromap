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
 * @property {'user'|'assistant'} role
 * @property {string}  content
 * @property {Array}   [matches] - Location recommendations attached to message
 * @property {number}  timestamp - Unix ms
 */

export const useAIChatStore = create(
    persist(
        (set, _get) => ({
            messages: [],          // ChatMessage[]
            isTyping: false,       // assistant is generating
            error: null,

            // ─── Actions ─────────────────────────────────────────────────

            addMessage: (role, content, extras = {}) => {
                const message = {
                    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    role,
                    content,
                    timestamp: Date.now(),
                    ...extras,
                }
                set((state) => ({ messages: [...state.messages, message] }))
                return message
            },

            /**
             * Update the last message in the list — used for streaming token delivery.
             * Finds the most recent message with the given role and replaces its content.
             */
            updateLastMessage: (role, content, extras = {}) => {
                set((state) => {
                    const messages = [...state.messages]
                    // Walk from end to find the last message with this role
                    for (let i = messages.length - 1; i >= 0; i--) {
                        if (messages[i].role === role) {
                            messages[i] = { ...messages[i], content, ...extras }
                            break
                        }
                    }
                    return { messages }
                })
            },

            setTyping: (isTyping) => set({ isTyping }),

            setError: (error) => set({ error }),

            clearError: () => set({ error: null }),

            clearHistory: () => set({ messages: [], error: null }),

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
            // Only persist messages, not transient states
            partialize: (state) => ({ messages: state.messages }),
        }
    )
)
