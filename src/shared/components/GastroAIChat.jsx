import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChefHat, MoveUp, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAIChat } from '@/hooks/useAIChat'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'
import { useTheme } from '@/hooks/useTheme'

/**
 * useGastroAI - backward-compatible wrapper around the new useAIChat hook.
 * Returns REAL persisted chat history. Empty state is handled by the UI itself.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useGastroAI = () => {
    const { messages, isTyping, sendMessage, clearHistory } = useAIChat()
    return { messages, isTyping, sendMessage, clearHistory }
}

/**
 * ChatInputBar — standalone input bar for placing anywhere (e.g. fixed bottom).
 */
export function ChatInputBar({ onSendMessage, isTyping, transparent = false, className = '' }) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const [input, setInput] = useState('')

    const handleSend = (e) => {
        e.preventDefault()
        if (!input.trim()) return
        onSendMessage(input)
        setInput('')
    }

    return (
        <form
            onSubmit={handleSend}
            className={`px-3 py-2 ${className}`}
        >
            <div
                className={`relative flex items-center rounded-full border transition-all ${
                    transparent
                        ? isDark
                            ? 'bg-white/10 border-white/20 focus-within:border-white/40 focus-within:bg-white/15 backdrop-blur-xl'
                            : 'bg-white/80 border-white/50 focus-within:border-white/80 focus-within:bg-white/95 backdrop-blur-xl'
                        : 'bg-gray-100/50 dark:bg-gray-800/50 border-transparent focus-within:border-indigo-200 focus-within:bg-white dark:focus-within:bg-gray-800'
                }`}
            >
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Message GastroGuide..."
                    className={`bg-transparent border-none shadow-none focus-visible:ring-0 text-base py-5 md:py-6 pl-5 pr-12 placeholder:font-medium ${
                        transparent
                            ? isDark
                                ? 'text-white placeholder:text-gray-400'
                                : 'text-gray-900 placeholder:text-gray-500'
                            : 'text-gray-900 dark:text-white placeholder:text-gray-400'
                    }`}
                />
                <Button
                    type="submit"
                    size="icon"
                    className={`absolute right-2 w-9 h-9 rounded-full transition-all ${
                        input.trim()
                            ? 'bg-gradient-to-tr from-indigo-500 to-violet-500 text-white scale-100 hover:scale-110'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 scale-90'
                    }`}
                    disabled={!input.trim() || isTyping}
                >
                    <MoveUp className="h-4 w-4" />
                </Button>
            </div>
        </form>
    )
}

// --- Unified Chat Interface Component ---

export function ChatInterface({
    messages,
    isTyping,
    onSendMessage,
    onCardClick,
    transparent = false,
    hideInput = false,
    className = '',
    contentClassName = '',
}) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const [input, setInput] = useState('')
    const { user } = useAuthStore()
    const scrollRef = useRef(null)

    // Auto-scroll to latest message
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isTyping])

    const handleSend = (e) => {
        e.preventDefault()
        if (!input.trim()) return
        onSendMessage(input)
        setInput('')
    }

    return (
        <div className={`flex flex-col h-full relative ${className}`}>
            {/* Top fade mask */}
            {transparent && (
                <div
                    className="absolute top-0 left-0 right-0 h-40 z-20 pointer-events-none"
                    style={{
                        background: `linear-gradient(to bottom, ${isDark ? '#0f172a' : '#f8faff'} 0%, ${isDark ? 'rgba(15,23,42,0.8)' : 'rgba(248,250,255,0.8)'} 40%, transparent 100%)`,
                    }}
                />
            )}

            {/* Messages */}
            <div
                data-lenis-prevent
                className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-4 relative ${contentClassName}`}
                ref={scrollRef}
            >
                {/* Empty state — real welcome, no fake dialog */}
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-16 px-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                            transparent
                                ? 'bg-white/20 dark:bg-white/10 backdrop-blur-xl border border-white/30'
                                : 'bg-indigo-50 dark:bg-indigo-500/20'
                        }`}>
                            <Sparkles className={`w-7 h-7 ${
                                transparent ? 'text-white' : 'text-indigo-500'
                            }`} />
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold mb-1 ${
                                transparent ? 'text-white' : 'text-gray-900 dark:text-white'
                            }`}>
                                Hi{user?.name ? `, ${user.name}` : ''}! I'm GastroGuide
                            </h3>
                            <p className={`text-sm leading-relaxed max-w-xs ${
                                transparent ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                                Ask me anything about restaurants, cafes, and hidden dining gems near you.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {['Best spots for a date 🕯️', 'Vegan breakfast 🥑', 'Cozy coffee ☕'].map(hint => (
                                <button
                                    key={hint}
                                    onClick={() => onSendMessage?.(hint)}
                                    className={`text-xs px-3 py-2 rounded-full border transition-all ${
                                        transparent
                                            ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {hint}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg) => {
                    const isUser = msg.role === 'user'
                    // Support both 'ai' (legacy) and 'assistant' (new store)
                    const attachments = msg.attachments ?? msg.matches ?? []
                    const validCards = attachments.filter(loc =>
                        loc?.id && loc?.title && loc.id.length > 10  // Only real DB locations have UUID-length IDs
                    )

                    return (
                        <div
                            key={msg.id}
                            className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
                        >
                            <div
                                className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed max-w-[85%] shadow-lg backdrop-blur-sm ${
                                    isUser
                                        ? transparent
                                            ? 'bg-white/90 dark:bg-white/95 text-gray-900 rounded-br-none border border-white/40'
                                            : 'bg-black text-white rounded-br-none'
                                        : transparent
                                        ? 'bg-white/80 dark:bg-black/60 text-gray-900 dark:text-white rounded-bl-none border border-white/30 dark:border-white/20'
                                        : 'bg-white border border-black/5 text-gray-800 rounded-bl-none'
                                }`}
                            >
                                {msg.content ?? ''}
                            </div>

                            {/* Location recommendation cards */}
                            {validCards.length > 0 && (
                                <div className="mt-2 space-y-3 w-full max-w-[85%]">
                                    {validCards.map((loc) => (
                                        <motion.div
                                            key={loc.id}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`Open ${loc.title}`}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            onClick={() => onCardClick?.(loc.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault()
                                                    onCardClick?.(loc.id)
                                                }
                                            }}
                                            className={`rounded-2xl p-3 flex gap-3 items-center shadow-lg backdrop-blur-sm cursor-pointer group transition-all hover:scale-[1.02] ${
                                                transparent
                                                    ? 'bg-white/90 dark:bg-black/70 border border-white/40 dark:border-white/20'
                                                    : 'bg-white border border-gray-100'
                                            } ${onCardClick ? 'active:scale-[0.98]' : ''}`}
                                        >
                                            <img
                                                src={loc.image || loc.image_url}
                                                alt={loc.title}
                                                className="w-14 h-14 rounded-xl object-cover shadow-sm"
                                                loading="lazy"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <h4
                                                    className={`font-bold text-sm truncate ${
                                                        transparent ? 'text-gray-900 dark:text-white' : 'text-gray-900'
                                                    }`}
                                                >
                                                    {loc.title}
                                                </h4>
                                                <p
                                                    className={`text-xs flex items-center gap-1 mt-1 ${
                                                        transparent ? 'text-gray-700 dark:text-gray-300' : 'text-muted-foreground'
                                                    }`}
                                                >
                                                    <ChefHat className="h-3 w-3" /> {loc.category} • ⭐ {loc.rating}
                                                </p>
                                            </div>
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                                    transparent
                                                        ? 'bg-gray-100/50 dark:bg-white/10 group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black'
                                                        : 'bg-gray-50 group-hover:bg-black group-hover:text-white'
                                                }`}
                                            >
                                                <MoveUp className="h-4 w-4 rotate-45" />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Typing indicator */}
                {isTyping && (
                    <div className="flex gap-1 px-2">
                        {[0, 100, 200].map((delay) => (
                            <div
                                key={delay}
                                className={`w-2 h-2 rounded-full animate-bounce ${
                                    transparent ? (isDark ? 'bg-white/80' : 'bg-gray-500') : 'bg-gray-400'
                                }`}
                                style={{ animationDelay: `${delay}ms` }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default ChatInterface

