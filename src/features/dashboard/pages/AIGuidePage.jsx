import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useGastroAI, ChatInterface, ChatInputBar } from '@/shared/components/GastroAIChat'
import { useAIChatStore } from '@/shared/store/useAIChatStore'
import { useUIStore } from '@/shared/store/useUIStore'

const HEADER_OFFSET = 'calc(90px + env(safe-area-inset-top))'

/**
 * AIGuidePage — WhatsApp-style chat layout.
 *
 * Architecture (like WhatsApp/Telegram):
 * - Container fills the VISUAL viewport (not layout viewport)
 * - Uses visualViewport API to dynamically resize when keyboard opens
 * - Input is part of the flex column (not position:fixed)
 * - No fixed positioning for input = no iOS Safari scroll issues
 * - BottomNav hides via focus detection (handled in BottomNav component)
 */
const AIGuidePage = () => {
    const { messages, isTyping, sendMessage, geoStatus, requestGeo } = useGastroAI()
    const { setLastScrollY } = useAIChatStore()
    const { setHeaderScrolled } = useUIStore()
    const shouldReduceMotion = useReducedMotion()
    const navigate = useNavigate()
    const scrollRef = useRef(null)
    const containerRef = useRef(null)
    const hasDoneInitialScroll = useRef(false)

    // Dynamic viewport height — tracks visualViewport to resize container
    // This is the key to WhatsApp-like behavior on iOS Safari
    const [viewportHeight, setViewportHeight] = useState('100dvh')

    useEffect(() => {
        const vv = window.visualViewport
        if (!vv) return

        const update = () => {
            // Set container height to exactly the visible viewport
            // This shrinks the chat when keyboard opens — no overflow, no black gap
            setViewportHeight(`${vv.height}px`)

            // Also adjust container top to account for Safari's URL bar scroll
            if (containerRef.current) {
                containerRef.current.style.top = `${vv.offsetTop}px`
            }
        }

        vv.addEventListener('resize', update)
        vv.addEventListener('scroll', update)
        // Initial set
        update()

        return () => {
            vv.removeEventListener('resize', update)
            vv.removeEventListener('scroll', update)
        }
    }, [])

    // INSTANT scroll to bottom when messages first appear
    useLayoutEffect(() => {
        if (!scrollRef.current) return
        if (messages.length === 0) {
            hasDoneInitialScroll.current = false
            return
        }
        if (hasDoneInitialScroll.current) return
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        hasDoneInitialScroll.current = true
    }, [messages.length])

    // Auto-scroll on new messages (only if near bottom)
    useEffect(() => {
        if (!scrollRef.current || !hasDoneInitialScroll.current) return
        const container = scrollRef.current
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
        if (distanceFromBottom < 200) {
            container.scrollTop = container.scrollHeight
        }
    }, [messages.length, isTyping])

    // Scroll to bottom when viewport shrinks (keyboard opens)
    useEffect(() => {
        // Small delay to let layout settle after resize
        const timer = setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }
        }, 150)
        return () => clearTimeout(timer)
    }, [viewportHeight])

    // Reset header state on mount
    useEffect(() => {
        setHeaderScrolled(false)
        return () => setHeaderScrolled(false)
    }, [setHeaderScrolled])

    const handleScroll = useCallback((e) => {
        const scrollTop = e.currentTarget.scrollTop
        setHeaderScrolled(scrollTop > 10)
        if (scrollTop > 0) setLastScrollY(scrollTop)
    }, [setHeaderScrolled, setLastScrollY])

    const handleCardClick = useCallback((locationId) => {
        if (scrollRef.current) setLastScrollY(scrollRef.current.scrollTop)
        navigate(`/location/${locationId}`, { state: { from: 'chat' } })
    }, [navigate, setLastScrollY])

    return (
        <div
            ref={containerRef}
            className="fixed left-0 right-0 md:left-[72px] flex flex-col overflow-hidden"
            style={{
                height: viewportHeight,
                top: 0,
                // Prevent iOS rubber-band revealing content behind
                overscrollBehavior: 'none',
            }}
        >
            {/* Aurora while typing */}
            {isTyping && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className="absolute bottom-0 left-[-10%] w-[120%] h-[50%] bg-gradient-to-t from-indigo-500/15 via-indigo-500/8 to-transparent blur-[60px]" />
                    {!shouldReduceMotion && (
                        <motion.div
                            animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-blue-500/15 rounded-full blur-[60px]"
                        />
                    )}
                </div>
            )}

            {/* Messages scroll area — flex-1 takes all available space */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                data-lenis-prevent
                className="relative z-10 flex-1 overflow-y-auto overscroll-contain"
            >
                {/* Header spacer */}
                <div style={{ height: HEADER_OFFSET }} className="w-full flex-shrink-0" />

                <div className="max-w-7xl mx-auto w-full px-6 lg:px-8">
                    <ChatInterface
                        messages={messages}
                        isTyping={isTyping}
                        onSendMessage={sendMessage}
                        onCardClick={handleCardClick}
                        transparent={true}
                        scrollContainerRef={scrollRef}
                        contentClassName=""
                        geoStatus={geoStatus}
                        requestGeo={requestGeo}
                        autoScroll={false}
                    />
                </div>

                {/* Bottom spacer — space for input bar when keyboard is closed */}
                <div className="h-4 flex-shrink-0" />
            </div>

            {/* Input bar — part of flex column, NOT fixed.
                When keyboard opens, container shrinks → input stays at bottom naturally */}
            <div className="relative z-30 px-3 pb-2 flex-shrink-0">
                <div className="max-w-4xl mx-auto w-full">
                    <ChatInputBar
                        onSendMessage={sendMessage}
                        isTyping={isTyping}
                        transparent={true}
                    />
                </div>
            </div>
        </div>
    )
}

export default AIGuidePage
