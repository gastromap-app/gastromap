import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { useGastroAI, ChatInterface, ChatInputBar } from '@/shared/components/GastroAIChat'
import { useAIChatStore } from '@/shared/store/useAIChatStore'
import { useUIStore } from '@/shared/store/useUIStore'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'

const HEADER_HEIGHT = 'calc(56px + env(safe-area-inset-top))'

const AIGuidePage = () => {
    const { messages, isTyping, sendMessage, geoStatus, requestGeo } = useGastroAI()
    const { setLastScrollY } = useAIChatStore()
    const { setHeaderScrolled } = useUIStore()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { t } = useTranslation()
    const shouldReduceMotion = useReducedMotion()
    const navigate = useNavigate()
    const scrollRef = useRef(null)
    const containerRef = useRef(null)
    const hasDoneInitialScroll = useRef(false)

    // BottomNav and UniversalHeader are hidden via MainLayout (isAIGuide check)

    // Track visualViewport to dynamically resize chat container
    useEffect(() => {
        const vv = window.visualViewport
        if (!vv) return

        const update = () => {
            if (!containerRef.current) return
            containerRef.current.style.height = `${vv.height}px`
            containerRef.current.style.top = `${vv.offsetTop}px`
        }

        vv.addEventListener('resize', update)
        vv.addEventListener('scroll', update)
        update()

        return () => {
            vv.removeEventListener('resize', update)
            vv.removeEventListener('scroll', update)
        }
    }, [])

    // INSTANT scroll to bottom on first messages
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

    // Auto-scroll on new messages (if near bottom)
    useEffect(() => {
        if (!scrollRef.current || !hasDoneInitialScroll.current) return
        const container = scrollRef.current
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
        if (distanceFromBottom < 200) {
            container.scrollTop = container.scrollHeight
        }
    }, [messages.length, isTyping])

    useEffect(() => {
        setHeaderScrolled(false)
        return () => setHeaderScrolled(false)
    }, [setHeaderScrolled])

    const handleScroll = useCallback((e) => {
        const scrollTop = e.currentTarget.scrollTop
        if (scrollTop > 0) setLastScrollY(scrollTop)
    }, [setLastScrollY])

    const handleCardClick = useCallback((locationId) => {
        if (scrollRef.current) setLastScrollY(scrollRef.current.scrollTop)
        navigate(`/location/${locationId}`, { state: { from: 'chat' } })
    }, [navigate, setLastScrollY])

    const handleBack = () => {
        // Go back if there's history, otherwise to dashboard
        if (window.history.length > 1) {
            navigate(-1)
        } else {
            navigate('/dashboard')
        }
    }

    return (
        <>
            {/* Background fill — prevents black gap on iOS Safari */}
            <div className="fixed inset-0 bg-background md:left-[72px]" style={{ zIndex: -1 }} />

            <div
                ref={containerRef}
                className="fixed left-0 right-0 md:left-[72px] flex flex-col overflow-hidden"
                style={{
                    height: '100dvh',
                    top: 0,
                    overscrollBehavior: 'none',
                }}
            >
                {/* Custom chat header with back button (mobile only) */}
                <header
                    className="md:hidden flex-shrink-0 flex items-center px-3 z-50 relative"
                    style={{
                        paddingTop: 'env(safe-area-inset-top)',
                        height: HEADER_HEIGHT,
                    }}
                >
                    <button
                        onClick={handleBack}
                        aria-label={t('common.back', 'Back')}
                        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all active:scale-95 ${
                            isDark
                                ? 'bg-white/[0.06] hover:bg-white/[0.10] text-white border border-white/10'
                                : 'bg-white/80 hover:bg-white text-gray-900 border border-slate-200 shadow-sm'
                        }`}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2 ml-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center">
                            <Sparkles size={16} className="text-blue-500" />
                        </div>
                        <div>
                            <h1 className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {t('ai.chat_button', 'GastroGuide AI')}
                            </h1>
                            <p className={`text-[10px] leading-tight ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                                {t('ai.subtitle', 'Your dining assistant')}
                            </p>
                        </div>
                    </div>
                </header>

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

                {/* Messages scroll area */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    data-lenis-prevent
                    className="relative z-10 flex-1 overflow-y-auto overscroll-contain"
                >
                    {/* Desktop spacer for global header */}
                    <div className="hidden md:block w-full flex-shrink-0" style={{ height: 'calc(90px + env(safe-area-inset-top))' }} />

                    <div className="max-w-7xl mx-auto w-full px-4 md:px-8">
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

                    <div className="h-2 flex-shrink-0" />
                </div>

                {/* Input bar — same dimensions/style as BottomNav (64px height, rounded-[28px]) */}
                <div
                    className="relative z-30 px-4 flex-shrink-0"
                    style={{
                        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
                    }}
                >
                    <div className={`max-w-md md:max-w-4xl mx-auto rounded-[28px] border backdrop-blur-2xl ${
                        isDark
                            ? 'bg-black/65 border-white/10 shadow-2xl shadow-black/50'
                            : 'bg-white/90 border-slate-200/80 shadow-[0_4px_16px_rgba(15,23,42,0.08),0_20px_40px_rgba(15,23,42,0.1)]'
                    }`}>
                        <ChatInputBar
                            onSendMessage={sendMessage}
                            isTyping={isTyping}
                            transparent={true}
                            className="!px-2 !py-1"
                        />
                    </div>
                </div>
            </div>
        </>
    )
}

export default AIGuidePage
