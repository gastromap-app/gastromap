import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGastroAI, ChatInterface } from '@/features/shared/components/GastroAIChat'
import { AnimatedInputBar } from '@/components/layout/AnimatedInputBar'

const AIGuidePage = () => {
    const { t } = useTranslation()
    const { messages, isTyping, sendMessage } = useGastroAI()
    const [input, setInput] = useState('')
    const navigate = useNavigate()
    const shouldReduceMotion = useReducedMotion()

    const handleSend = (e) => {
        e.preventDefault()
        // AI-3 FIX: prevent spam while AI is responding
        if (!input.trim() || isTyping) return
        sendMessage(input)
        setInput('')
    }

    return (
        <div className="w-full h-[100dvh] flex flex-col relative">
            {/* Aurora Animation when typing - single soft blob, respects prefers-reduced-motion */}
            {isTyping && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                    <div className="absolute bottom-[-10%] left-[-10%] w-[120%] h-[50%] bg-gradient-to-t from-indigo-500/15 via-indigo-500/8 to-transparent blur-[60px]" />
                    {!shouldReduceMotion && (
                        <motion.div
                            animate={{
                                scale: [1, 1.15, 1],
                                opacity: [0.25, 0.4, 0.25],
                            }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-blue-500/15 rounded-full blur-[60px]"
                        />
                    )}
                </div>
            )}

            {/* Back button — visible on mobile where BottomNav is hidden on this page */}
            <button
                onClick={() => navigate(-1)}
                className="md:hidden absolute left-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-black/30 backdrop-blur-md text-white text-[13px] font-bold border border-white/10 active:scale-95 transition-transform" style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
            >
                <ArrowLeft size={16} />
                {t('common.back')}
            </button>

            {/* Chat Interface - Positioned to fill screen under the new Global Header */}
            <div className="absolute inset-0 z-0">
                <ChatInterface
                    messages={messages}
                    isTyping={isTyping}
                    onSendMessage={sendMessage}
                    className="[&_form]:hidden md:[&_form]:block"
                    transparent={true}
                    contentClassName="pt-[calc(env(safe-area-inset-top)+6rem)] md:pt-48"
                />
            </div>

            {/* Animated Input Bar - Replaces Bottom Nav on Mobile */}
            <AnimatedInputBar
                input={input}
                onInputChange={(e) => setInput(e.target.value)}
                onSubmit={handleSend}
                isTyping={isTyping}
            />
        </div>
    )
}

export default AIGuidePage
