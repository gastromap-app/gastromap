import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useGastroAI, ChatInterface, ChatInputBar } from '@/shared/components/GastroAIChat'
import { useAIChatStore } from '@/shared/store/useAIChatStore'
import { useUIStore } from '@/shared/store/useUIStore'

const HEADER_OFFSET = 'calc(90px + env(safe-area-inset-top))'

/**
 * Detects mobile virtual keyboard via visualViewport API.
 * 
 * KEY INSIGHT: In PWA (standalone) mode, iOS resizes the viewport normally.
 * In Safari browser mode, iOS does NOT resize the layout viewport — it scrolls
 * the visual viewport up instead. We handle both cases.
 */
function useKeyboard() {
    const [keyboardVisible, setKeyboardVisible] = useState(false)
    const [keyboardHeight, setKeyboardHeight] = useState(0)

    useEffect(() => {
        const vv = window.visualViewport
        if (!vv) return // Desktop

        let rafId = null

        const update = () => {
            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => {
                // Total keyboard height = full window - visible area - any scroll offset
                const kbH = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
                const isOpen = kbH > 80
                setKeyboardVisible(isOpen)
                setKeyboardHeight(isOpen ? kbH : 0)
            })
        }

        vv.addEventListener('resize', update)
        vv.addEventListener('scroll', update)
        // Also listen to focus/blur on inputs as a fallback
        const onFocus = (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') setTimeout(update, 300) }
        const onBlur = () => setTimeout(update, 100)
        document.addEventListener('focusin', onFocus)
        document.addEventListener('focusout', onBlur)

        return () => {
            vv.removeEventListener('resize', update)
            vv.removeEventListener('scroll', update)
            document.removeEventListener('focusin', onFocus)
            document.removeEventListener('focusout', onBlur)
            if (rafId) cancelAnimationFrame(rafId)
        }
    }, [])

    return { keyboardVisible, keyboardHeight }
}

const AIGuidePage = () => {
    const { messages, isTyping, sendMessage, geoStatus, requestGeo } = useGastroAI()
    const { setLastScrollY } = useAIChatStore()
    const { setHeaderScrolled } = useUIStore()
    const shouldReduceMotion = useReducedMotion()
    const navigate = useNavigate()
    const scrollRef = useRef(null)
    const hasDoneInitialScroll = useRef(false)
    const { keyboardVisible, keyboardHeight } = useKeyboard()

    // ─── Scroll management ────────────────────────────────────────────────────

    useLayoutEffect(() => {
        if (!scrollRef.current) return
        if (messages.length === 0) { hasDoneInitialScroll.current = false; return }
        if (hasDoneInitialScroll.current) return
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        hasDoneInitialScroll.current = true
    }, [messages.length])

    useEffect(() => {
        if (!scrollRef.current || !hasDoneInitialScroll.current) return
        const el = scrollRef.current
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
            el.scrollTop = el.scrollHeight
        }
    }, [messages.length, isTyping])

    useEffect(() => {
        if (keyboardVisible && scrollRef.current) {
            setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, 150)
        }
    }, [keyboardVisible])

    useEffect(() => {
        setHeaderScrolled(false)
        return () => setHeaderScrolled(false)
    }, [setHeaderScrolled])

    const handleScroll = useCallback((e) => {
        const y = e.currentTarget.scrollTop
        setHeaderScrolled(y > 10)
        if (y > 0) setLastScrollY(y)
    }, [setHeaderScrolled, setLastScrollY])

    const handleCardClick = useCallback((locationId) => {
        if (scrollRef.current) setLastScrollY(scrollRef.current.scrollTop)
        navigate(`/location/${locationId}`, { state: { from: 'chat' } })
    }, [navigate, setLastScrollY])

    // ─── Layout calculations ──────────────────────────────────────────────────
    // 
    // The input bar is rendered as a SIBLING to the page container (via Fragment),
    // so it's truly fixed to the browser viewport — never clipped by overflow.
    //
    // When keyboard is CLOSED:
    //   bottom = BottomNav height (64px) + BottomNav bottom offset (12px + safe-area) + 4px gap
    //   ≈ 80px + safe-area-inset-bottom
    //
    // When keyboard is OPEN:
    //   bottom = keyboardHeight + 6px (tight gap, no wasted space)
    //   BottomNav is hidden by its own keyboard detection

    const inputBottom = keyboardVisible
        ? `${keyboardHeight + 6}px`
        : `calc(80px + env(safe-area-inset-bottom, 0px))`

    // Scroll container needs enough bottom padding so last message isn't hidden behind input
    const scrollPaddingBottom = keyboardVisible
        ? `${keyboardHeight + 80}px`
        : `calc(160px + env(safe-area-inset-bottom, 0px))`

    return (
        <>
            {/* ─── Page container ─── */}
            <div className="fixed inset-0 md:left-[72px] flex flex-col bg-transparent h-[100dvh]">
                {/* Aurora effect while AI is typing */}
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

                {/* ─── Scrollable messages ─── */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    data-lenis-prevent
                    className="relative z-10 flex-1 overflow-y-auto overscroll-contain"
                    style={{ paddingBottom: scrollPaddingBottom }}
                >
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

            {/* ─── Input bar — OUTSIDE page container, fixed to viewport ─── */}
            <div
                className="fixed left-0 right-0 md:left-[72px] z-[80] px-3"
                style={{ bottom: inputBottom, transition: 'bottom 0.15s ease-out' }}
            >
                <div className="max-w-4xl mx-auto w-full">
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
