import React, { useRef, useEffect, useLayoutEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useGastroAI, ChatInterface, ChatInputBar } from '@/shared/components/GastroAIChat'
import { useAIChatStore } from '@/shared/store/useAIChatStore'
import { useUIStore } from '@/shared/store/useUIStore'

// BottomNav: height=64px, bottom=max(12px, env(safe-area-inset-bottom))
// Total nav footprint from screen bottom: ~76px
// Input bar sits just above it with 2px breathing room
const INPUT_BOTTOM_DEFAULT = 'calc(58px + env(safe-area-inset-bottom, 0px))'
// Physical padding for manual scrolling — ensures last message sits above input
const SCROLL_PADDING_BOTTOM = 'calc(150px + env(safe-area-inset-bottom, 0px))'
// Logical offset for scrollIntoView — must be slightly larger than padding
const SCROLL_SNAP_BOTTOM = 'calc(158px + env(safe-area-inset-bottom, 0px))'
const HEADER_OFFSET = 'calc(90px + env(safe-area-inset-top))'

/**
 * Cross-browser keyboard detection hook.
 * Works on: Safari iOS, Chrome iOS, Chrome Android, Samsung Browser, Firefox Android.
 * Uses visualViewport API + window.resize + focusin/focusout as fallbacks.
 */
function useKeyboardOffset() {
    const [keyboardOpen, setKeyboardOpen] = useState(false)
    const [bottomOffset, setBottomOffset] = useState(0)

    useEffect(() => {
        const vv = window.visualViewport
        let rafId = null
        let focusedEl = null
        // Store initial height on mount (before any keyboard)
        const initialHeight = window.innerHeight

        const check = () => {
            let kbHeight = 0

            if (vv) {
                kbHeight = window.innerHeight - vv.height - vv.offsetTop
            } else {
                // Android Chrome fallback: window.innerHeight shrinks
                kbHeight = initialHeight - window.innerHeight
            }

            const isOpen = kbHeight > 100
            setKeyboardOpen(isOpen)
            setBottomOffset(isOpen ? kbHeight : 0)
        }

        const scheduleCheck = () => {
            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(check)
        }

        if (vv) {
            vv.addEventListener('resize', scheduleCheck)
            vv.addEventListener('scroll', scheduleCheck)
        }
        window.addEventListener('resize', scheduleCheck)

        const onFocusIn = (e) => {
            focusedEl = e.target
            setTimeout(scheduleCheck, 150)
            setTimeout(scheduleCheck, 350)
        }
        const onFocusOut = () => {
            focusedEl = null
            setTimeout(scheduleCheck, 100)
            setTimeout(scheduleCheck, 300)
        }
        document.addEventListener('focusin', onFocusIn)
        document.addEventListener('focusout', onFocusOut)

        return () => {
            if (rafId) cancelAnimationFrame(rafId)
            if (vv) {
                vv.removeEventListener('resize', scheduleCheck)
                vv.removeEventListener('scroll', scheduleCheck)
            }
            window.removeEventListener('resize', scheduleCheck)
            document.removeEventListener('focusin', onFocusIn)
            document.removeEventListener('focusout', onFocusOut)
        }
    }, [])

    return { keyboardOpen, bottomOffset }
}

const AIGuidePage = () => {
    const { messages, isTyping, sendMessage, geoStatus, requestGeo } = useGastroAI()
    const { setLastScrollY } = useAIChatStore()
    const { setHeaderScrolled } = useUIStore()
    const shouldReduceMotion = useReducedMotion()
    const navigate = useNavigate()
    const scrollRef = useRef(null)
    const hasDoneInitialScroll = useRef(false)
    const { keyboardOpen, bottomOffset } = useKeyboardOffset()

    // Compute input bar bottom position:
    // - Keyboard closed: above BottomNav with minimal gap (58px + safe area)
    // - Keyboard open: flush to keyboard top (0px gap)
    const inputBottom = keyboardOpen
        ? `${bottomOffset}px`
        : INPUT_BOTTOM_DEFAULT

    // Adjust scroll padding when keyboard is open
    const scrollPadding = keyboardOpen
        ? `${bottomOffset + 64}px`
        : SCROLL_PADDING_BOTTOM

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

    // Scroll to bottom when keyboard opens (so user sees latest messages)
    useEffect(() => {
        if (keyboardOpen && scrollRef.current) {
            setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
                }
            }, 100)
        }
    }, [keyboardOpen])

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
        <div className="fixed inset-0 md:left-[72px] flex flex-col bg-transparent overflow-hidden" style={{ height: '100dvh' }}>
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
                    paddingBottom: scrollPadding,
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

            {/* Input fixed just above BottomNav (or above keyboard when open) */}
            <div
                className="fixed left-0 right-0 md:left-[72px] z-30 px-3 pointer-events-none transition-[bottom] duration-200 ease-out"
                style={{ bottom: inputBottom }}
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
