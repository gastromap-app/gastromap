import React, { useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useGastroAI, ChatInterface, ChatInputBar } from '@/shared/components/GastroAIChat'

// BottomNav: height=64px, bottom=calc(12px + safe-area-inset-bottom)
// Input sits just above it: 64 + 12 = 76px + safe-area
const INPUT_BOTTOM = 'calc(76px + env(safe-area-inset-bottom))'
// Reserve space at bottom of scroll area so last message is never hidden behind input
const SCROLL_PADDING_BOTTOM = 'calc(76px + env(safe-area-inset-bottom) + 72px)'

const AIGuidePage = () => {
    const { messages, isTyping, sendMessage } = useGastroAI()
    const shouldReduceMotion = useReducedMotion()
    const navigate = useNavigate()
    // THIS is the single scroll container — ChatInterface renders content inside it
    const scrollRef = useRef(null)

    const handleCardClick = (locationId) => {
        navigate(`/location/${locationId}`)
    }

    return (
        <div className="fixed inset-0 flex flex-col">

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
                data-lenis-prevent
                className="relative z-10 flex-1 overflow-y-auto"
                style={{ paddingBottom: SCROLL_PADDING_BOTTOM }}
            >
                <ChatInterface
                    messages={messages}
                    isTyping={isTyping}
                    onSendMessage={sendMessage}
                    onCardClick={handleCardClick}
                    transparent={true}
                    scrollContainerRef={scrollRef}
                    contentClassName="pt-4 px-4"
                />
            </div>

            {/* Input fixed just above BottomNav */}
            <div
                className="fixed left-0 right-0 z-20 px-3"
                style={{ bottom: INPUT_BOTTOM }}
            >
                <ChatInputBar
                    onSendMessage={sendMessage}
                    isTyping={isTyping}
                    transparent={true}
                />
            </div>
        </div>
    )
}

export default AIGuidePage
