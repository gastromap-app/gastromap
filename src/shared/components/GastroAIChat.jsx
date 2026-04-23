import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, MoveUp, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAIChat } from '@/hooks/useAIChat'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'
import { useTheme } from '@/hooks/useTheme'

/**
 * useGastroAI - backward-compatible wrapper around useAIChat.
 * Returns REAL persisted chat history. Empty state handled by UI.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useGastroAI = () => {
    const { messages, isTyping, sendMessage, clearHistory } = useAIChat()
    return { messages, isTyping, sendMessage, clearHistory }
}

// ─── Modern typing indicator ──────────────────────────────────────────────────
function TypingBubble({ transparent, isDark }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-2"
        >
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                transparent
                    ? 'bg-white/20 dark:bg-white/10 border border-white/30'
                    : 'bg-indigo-100 dark:bg-indigo-500/20'
            }`}>
                <Sparkles className={`w-3.5 h-3.5 ${transparent ? 'text-white/80' : 'text-indigo-500'}`} />
            </div>

            {/* Bubble */}
            <div className={`px-4 py-3 rounded-2xl rounded-bl-none inline-flex items-center gap-1.5 ${
                transparent
                    ? 'bg-white/80 dark:bg-black/60 border border-white/30 dark:border-white/20'
                    : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'
            }`}>
                {[0, 1, 2].map((i) => (
                    <motion.span
                        key={i}
                        className={`block w-2 h-2 rounded-full ${
                            transparent
                                ? isDark ? 'bg-white/70' : 'bg-gray-500/80'
                                : 'bg-gray-400 dark:bg-gray-500'
                        }`}
                        animate={{ y: [0, -5, 0] }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: i * 0.15,
                        }}
                    />
                ))}
            </div>
        </motion.div>
    )
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
        if (!input.trim() || isTyping) return
        onSendMessage(input)
        setInput('')
    }

    return (
        <form onSubmit={handleSend} className={`px-3 py-2 ${className}`}>
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
                    className={`bg-transparent border-none shadow-none focus-visible:ring-0 text-base py-5 pl-5 pr-12 placeholder:font-medium ${
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
                        input.trim() && !isTyping
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

// ─── Unified Chat Interface Component ────────────────────────────────────────

export function ChatInterface({
    messages,
    isTyping,
    onSendMessage,
    onCardClick,
    transparent = false,
    className = '',
    contentClassName = '',
    // External scroll container ref — when parent owns the scroll
    scrollContainerRef = null,
}) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { user } = useAuthStore()
    // Anchor element at the very end — always scroll this into view
    const bottomRef = useRef(null)
    // Internal scroll ref — only used when no external scrollContainerRef
    const internalScrollRef = useRef(null)

    // Scroll to bottom whenever messages change or typing starts/stops
    useEffect(() => {
        const scrollEl = scrollContainerRef?.current ?? internalScrollRef.current
        if (!scrollEl) return

        // Use requestAnimationFrame to wait for DOM paint
        requestAnimationFrame(() => {
            scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' })
        })
    }, [messages, isTyping, scrollContainerRef])

    return (
        <div
            ref={scrollContainerRef ? undefined : internalScrollRef}
            data-lenis-prevent
            className={`flex flex-col space-y-4 p-4 md:p-6 ${contentClassName} ${className}`}
        >
            {/* Empty state */}
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-6">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                            transparent
                                ? 'bg-white/20 dark:bg-white/10 backdrop-blur-xl border border-white/30'
                                : 'bg-indigo-50 dark:bg-indigo-500/20'
                        }`}
                    >
                        <Sparkles className={`w-7 h-7 ${transparent ? 'text-white' : 'text-indigo-500'}`} />
                    </motion.div>
                    <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
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
                    </motion.div>
                    <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-wrap gap-2 justify-center"
                    >
                        {['Best spots for a date 🕯️', 'Vegan breakfast 🥑', 'Cozy coffee ☕'].map(hint => (
                            <button
                                key={hint}
                                onClick={() => onSendMessage?.(hint)}
                                className={`text-xs px-3 py-2 rounded-full border transition-all active:scale-95 ${
                                    transparent
                                        ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                {hint}
                            </button>
                        ))}
                    </motion.div>
                </div>
            )}

            {/* Messages list */}
            <AnimatePresence initial={false}>
                {messages.map((msg) => {
                    const isUser = msg.role === 'user'
                    const attachments = msg.attachments ?? msg.matches ?? []
                    const validCards = attachments.filter(loc =>
                        loc?.id && loc?.title && loc.id.length > 10
                    )

                    return (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 12, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
                        >
                            <div
                                className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed max-w-[85%] ${
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

                            {/* Location cards */}
                            {validCards.length > 0 && (
                                <div className="mt-2 space-y-3 w-full max-w-[85%]">
                                    {validCards.map((loc) => (
                                        <motion.div
                                            key={loc.id}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`Open ${loc.title}`}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            onClick={() => onCardClick?.(loc.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault()
                                                    onCardClick?.(loc.id)
                                                }
                                            }}
                                            className={`rounded-2xl p-3 flex gap-3 items-center cursor-pointer group transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                                transparent
                                                    ? 'bg-white/90 dark:bg-black/70 border border-white/40 dark:border-white/20'
                                                    : 'bg-white border border-gray-100'
                                            }`}
                                        >
                                            <img
                                                src={loc.image || loc.image_url}
                                                alt={loc.title}
                                                className="w-14 h-14 rounded-xl object-cover"
                                                loading="lazy"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`font-bold text-sm truncate ${
                                                    transparent ? 'text-gray-900 dark:text-white' : 'text-gray-900'
                                                }`}>
                                                    {loc.title}
                                                </h4>
                                                <p className={`text-xs flex items-center gap-1 mt-1 ${
                                                    transparent ? 'text-gray-700 dark:text-gray-300' : 'text-muted-foreground'
                                                }`}>
                                                    <ChefHat className="h-3 w-3" /> {loc.category} • ⭐ {loc.rating}
                                                </p>
                                            </div>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                                                transparent
                                                    ? 'bg-gray-100/50 dark:bg-white/10 group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black'
                                                    : 'bg-gray-50 group-hover:bg-black group-hover:text-white'
                                            }`}>
                                                <MoveUp className="h-4 w-4 rotate-45" />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )
                })}
            </AnimatePresence>

            {/* Typing indicator */}
            <AnimatePresence>
                {isTyping && <TypingBubble transparent={transparent} isDark={isDark} />}
            </AnimatePresence>

            {/* Scroll anchor — always at the bottom */}
            <div ref={bottomRef} className="h-1 shrink-0" />
        </div>
    )
}

export default ChatInterface
