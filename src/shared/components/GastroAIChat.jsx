import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, MoveUp, Sparkles, MapPin } from 'lucide-react'
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
    const { messages, isTyping, sendMessage, clearHistory, geoStatus, requestGeo } = useAIChat()
    return { messages, isTyping, sendMessage, clearHistory, geoStatus, requestGeo }
}

// ─── Modern typing indicator ──────────────────────────────────────────────────
function TypingDots({ colorClass = 'bg-indigo-500' }) {
    return (
        <div className="flex gap-1.5 px-1">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${colorClass}`}
                    animate={{ 
                        opacity: [0.3, 1, 0.3],
                        scale: [0.8, 1.2, 0.8],
                    }}
                    transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: "easeInOut"
                    }}
                />
            ))}
        </div>
    )
}

function TypingBubble({ transparent, isDark }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 px-1 py-1"
        >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                transparent
                    ? isDark ? 'bg-white/10' : 'bg-black/5'
                    : 'bg-gray-100 dark:bg-gray-800'
            }`}>
                <Sparkles className={`w-4 h-4 ${transparent ? (isDark ? 'text-white' : 'text-indigo-600') : 'text-indigo-500'}`} />
            </div>
            <div className={`flex items-center p-3 rounded-2xl rounded-bl-none backdrop-blur-md border h-[42px] ${
                transparent
                    ? isDark
                        ? 'bg-white/15 border-white/20'
                        : 'bg-white/80 border-black/10'
                    : 'bg-white/80 dark:bg-black/40 border-gray-100 dark:border-white/10'
            }`}>
                <TypingDots colorClass={isDark ? 'bg-white' : 'bg-indigo-500'} />
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
        <form onSubmit={handleSend} className={`px-2 py-2 ${className}`}>
            <div
                className={`relative flex items-center rounded-2xl border transition-all shadow-none ring-0 ${
                    transparent
                        ? isDark
                            ? 'bg-black/40 border-white/10 focus-within:border-white/20 backdrop-blur-2xl'
                            : 'bg-white/70 border-white/40 focus-within:border-white/60 backdrop-blur-2xl'
                        : 'bg-gray-100/80 dark:bg-gray-800/80 border-transparent focus-within:border-indigo-500/30 focus-within:bg-white dark:focus-within:bg-gray-800'
                }`}
            >
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about places..."
                    className={`bg-transparent border-none shadow-none focus-visible:ring-0 text-[16px] py-6 pl-4 pr-12 placeholder:font-normal ${
                        transparent
                            ? isDark
                                ? 'text-white placeholder:text-gray-500'
                                : 'text-gray-900 placeholder:text-gray-400'
                            : 'text-gray-900 dark:text-white placeholder:text-gray-400'
                    }`}
                />
                <Button
                    type="submit"
                    size="icon"
                    className={`absolute right-2 w-10 h-10 rounded-xl transition-all shadow-none ${
                        input.trim() && !isTyping
                            ? 'bg-indigo-600 text-white scale-100 hover:scale-105 active:scale-95'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 scale-90'
                    }`}
                    disabled={!input.trim() || isTyping}
                >
                    <MoveUp className="h-5 w-5" />
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
    geoStatus = 'idle',
    requestGeo = () => {},
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
        const scrollToBottom = () => {
            if (bottomRef.current) {
                // Determine if we should use smooth scroll (for AI response) or instant (for history load)
                const behavior = messages.length > 5 ? 'smooth' : 'auto'
                bottomRef.current.scrollIntoView({ behavior, block: 'end' })
            }
        }

        // Multiple triggers to ensure scroll happens after DOM settles
        const timer1 = setTimeout(scrollToBottom, 50)
        const timer2 = setTimeout(scrollToBottom, 300)
        
        return () => {
            clearTimeout(timer1)
            clearTimeout(timer2)
        }
    }, [messages.length, isTyping]) // length check is more robust for message lists

    return (
        <div
            ref={scrollContainerRef ? undefined : internalScrollRef}
            data-lenis-prevent
            className={`flex flex-col space-y-3 p-2 md:p-4 ${contentClassName} ${className}`}
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
                    
                    {/* Geo Hint */}
                    {geoStatus !== 'granted' && (
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={requestGeo}
                            className={`flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-full border transition-all ${
                                transparent
                                    ? 'bg-blue-600/20 border-blue-400/30 text-white hover:bg-blue-600/30'
                                    : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100'
                            }`}
                        >
                            <MapPin className="w-3.5 h-3.5" />
                            {geoStatus === 'denied' ? 'Permission denied. Click to try again' : 'Share location for better results'}
                        </motion.button>
                    )}
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
                            <motion.div
                                layout
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed flex items-center min-h-[42px] ${
                                    isUser
                                        ? transparent
                                            ? 'bg-indigo-600 text-white rounded-br-sm border border-white/20 ml-auto'
                                            : 'bg-indigo-600 text-white rounded-br-sm ml-auto'
                                        : transparent
                                            ? isDark
                                                ? 'bg-black/50 text-white border border-white/10 rounded-bl-sm backdrop-blur-md mr-auto'
                                                : 'bg-white/85 text-gray-900 border border-black/10 rounded-bl-sm backdrop-blur-md mr-auto shadow-sm'
                                            : 'bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm mr-auto shadow-sm'
                                }`}
                                style={{ 
                                    maxWidth: '88%'
                                }}
                            >
                                {msg.content === '…' ? (
                                    <TypingDots colorClass={isUser ? 'bg-white' : (isDark ? 'bg-white' : 'bg-indigo-500')} />
                                ) : (
                                    msg.content ?? ''
                                )}
                            </motion.div>



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
                                                    <ChefHat className="h-3 w-3" /> {loc.category} • ⭐ {loc.google_rating ?? loc.rating}
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
                {isTyping && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                    <TypingBubble transparent={transparent} isDark={isDark} />
                )}
            </AnimatePresence>

            {/* Scroll anchor — always at the bottom */}
            <div ref={bottomRef} className="h-1 shrink-0" />
        </div>
    )
}

export default ChatInterface
