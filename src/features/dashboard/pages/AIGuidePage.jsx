import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useGastroAI, ChatInterface, ChatInputBar } from '@/shared/components/GastroAIChat'
import { useAIChatStore } from '@/shared/store/useAIChatStore'
import { useUIStore } from '@/shared/store/useUIStore'

const HEADER_OFFSET = 'calc(90px + env(safe-area-inset-top))'

/**
 * Hook to detect mobile virtual keyboard.
 * Returns { keyboardOpen, keyboardHeight } using visualViewport API.
 */
function useKeyboard() {
    const [keyboardOpen, setKeyboardOpen] = useState(false)
    const [keyboardHeight, setKeyboardHeight] = useState(0)

    useEffect(() => {
        const vv = window.visualViewport
        if (!vv) return

        const update = () => {
            const kbHeight = window.innerHeight - vv.height - vv.offsetTop
            const isOpen = kbHeight > 100
            setKeyboardOpen(isOpen)
            setKeyboardHeight(isOpen ? kbHeight : 0)
        }

        vv.addEventListener('resize', update)
        vv.addEventListener('scroll', update)
        return () => {
            vv.removeEventListener('resize', update)
            vv.removeEventListener('scroll', update)
        }
    }, [])

    return { keyboardOpen, keyboardHeight }
}

const AIGuidePage = () => {
    const { messages, isTyping, sendMessage, geoStatus, requestGeo } = useGastroAI()
    const { setLastScrollY } = useAIChatStore()
    const { setHeaderScrolled } = useUIStore()
    const shouldReduceMotion = useReducedMotion()
    const navigate = useNavigate()
    const scrollRef = useRef(null)
    const hasDoneInitialScroll = useRef(false)
    const { keyboardOpen, keyboardHeight } = useKeyboard()

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

    // Scroll to bottom when keyboard opens
    useEffect(() => {
        if (keyboardOpen && scrollRef.current) {
            setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }, 150)
        }
    }, [keyboardOpen])

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

    // Bottom offset for the input bar:
    // - Keyboard open: just above keyboard (8px gap)
    // - Keyboard closed: above BottomNav (76px = 64px nav + 12px bottom)
    const inputBottomOffset = keyboardOpen
        ? keyboardHeight + 8
        : 76 + (typeof CSS !== 'undefined' ? 0 : 0) // BottomNav height + gap

    return (
        <>
            {/* Main chat container — NOT overflow-hidden, uses the page's natural flow */}
            <div className="fixed inset-0 md:left-[72px] flex flex-col bg-transparent">
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

                {/* Scrollable messages area */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    data-lenis-prevent
                    className="relative z-10 flex-1 overflow-y-auto overscroll-contain"
                    style={{ paddingBottom: `${inputBottomOffset + 70}px` }}
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
                </div>
            </div>

            {/* Input bar — OUTSIDE the overflow container, truly fixed to viewport */}
            <div
                className="fixed left-0 right-0 md:left-[72px] z-[80] px-3 pointer-events-none"
                style={{ bottom: `${inputBottomOffset}px` }}
            >
                <div className="max-w-4xl mx-auto w-full pointer-events-auto">
                    <ChatInputBar
                        onSendMessage={sendMessage}
                        isTyping={isTyping}
                        transparent={true}
                    />
                </div>
            </div>
        </>
    )
}

export default AIGuidePage
