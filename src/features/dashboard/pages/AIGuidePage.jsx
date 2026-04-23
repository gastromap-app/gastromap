import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useGastroAI, ChatInterface, ChatInputBar } from '@/shared/components/GastroAIChat'

// BottomNav: height=64px, bottom=calc(12px + safe-area-inset-bottom)
// So input sits at: 64 + 12 = 76px + safe-area-inset-bottom
const INPUT_BOTTOM = 'calc(76px + env(safe-area-inset-bottom))'
// Input bar height approx 64px — add padding so last message is visible
const MESSAGES_BOTTOM_PAD = 'calc(76px + env(safe-area-inset-bottom) + 64px)'

const AIGuidePage = () => {
    const { messages, isTyping, sendMessage } = useGastroAI()
    const shouldReduceMotion = useReducedMotion()
    const navigate = useNavigate()

    const handleCardClick = (locationId) => {
        navigate(`/location/${locationId}`)
    }

    return (
        // Full-screen — MainLayout has no pb on this route
        <div className="fixed inset-0 flex flex-col" style={{ top: 0 }}>

            {/* Aurora animation while AI is typing */}
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

            {/* Scrollable messages — fills screen minus header, leaves room for input */}
            <div
                className="flex-1 overflow-y-auto relative z-10"
                style={{ paddingBottom: MESSAGES_BOTTOM_PAD }}
            >
                <ChatInterface
                    messages={messages}
                    isTyping={isTyping}
                    onSendMessage={sendMessage}
                    onCardClick={handleCardClick}
                    transparent={true}
                    contentClassName="pt-4 px-4"
                />
            </div>

            {/* Input bar — fixed just above the BottomNav */}
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
