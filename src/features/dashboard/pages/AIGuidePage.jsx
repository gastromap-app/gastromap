import React, { useRef, useEffect, useLayoutEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useGastroAI, ChatInterface, ChatInputBar } from '@/shared/components/GastroAIChat'
import { useAIChatStore } from '@/shared/store/useAIChatStore'
import { useUIStore } from '@/shared/store/useUIStore'

// BottomNav: height=64px, bottom=calc(12px + env(safe-area-inset-bottom))
// Input bar sits just above it with extra breathing room
const INPUT_BOTTOM = 'calc(68px + env(safe-area-inset-bottom, 12px))'
// Physical padding for manual scrolling — ensures last message sits 15px above input
const SCROLL_PADDING_BOTTOM = 'calc(150px + env(safe-area-inset-bottom, 12px))'
// Logical offset for scrollIntoView — must be slightly larger than padding
// to account for the 13px spacing between last message and bottomRef anchor
const SCROLL_SNAP_BOTTOM = 'calc(158px + env(safe-area-inset-bottom, 12px))'
const HEADER_OFFSET = 'calc(90px + env(safe-area-inset-top))'

const AIGuidePage = () => {
    const { messages, isTyping, sendMessage, geoStatus, requestGeo } = useGastroAI()
    const { setLastScrollY } = useAIChatStore()
    const { setHeaderScrolled } = useUIStore()
    const shouldReduceMotion = useReducedMotion()
    const navigate = useNavigate()
    const scrollRef = useRef(null)
    const hasDoneInitialScroll = useRef(false)

    // INSTANT scroll to bottom when messages first appear — runs BEFORE first paint
    // so user never sees the un-scrolled state. Resets when history is cleared.
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

    // Auto-scroll on new messages or typing indicator, but ONLY if user is already near bottom
    // (respects manual scrolling when reading history)
    useEffect(() => {
        if (!scrollRef.current || !hasDoneInitialScroll.current) return

        const container = scrollRef.current
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
        const isNearBottom = distanceFromBottom < 200

        if (isNearBottom) {
            container.scrollTop = container.scrollHeight
        }
    }, [messages.length, isTyping])

    // Reset header state on mount
    useEffect(() => {
        setHeaderScrolled(false)
        return () => setHeaderScrolled(false)
    }, [setHeaderScrolled])

    const handleScroll = (e) => {
        const scrollTop = e.currentTarget.scrollTop
        
        // Sync with global header
        setHeaderScrolled(scrollTop > 10)
        
        if (scrollTop > 0) {
            setLastScrollY(scrollTop)
        }
    }

    const handleCardClick = (locationId) => {
        if (scrollRef.current) {
            setLastScrollY(scrollRef.current.scrollTop)
        }
        navigate(`/location/${locationId}`, { state: { from: 'chat' } })
    }

    return (
        <div className="fixed inset-0 md:left-[72px] flex flex-col bg-transparent overflow-hidden">
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

            {/* THE single scroll container */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                data-lenis-prevent
                className="relative z-10 flex-1 overflow-y-auto scroll-smooth overscroll-contain"
                style={{
                    paddingBottom: SCROLL_PADDING_BOTTOM,
                    scrollPaddingBottom: SCROLL_SNAP_BOTTOM
                }}
            >
                {/* Header Spacer to push content below UniversalHeader */}
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
            </div>

            {/* Input fixed just above BottomNav */}
            <div
                className="fixed left-0 right-0 md:left-[72px] z-30 px-3 pointer-events-none"
                style={{ bottom: INPUT_BOTTOM }}
            >
                <div className="max-w-4xl mx-auto w-full pointer-events-auto">
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
