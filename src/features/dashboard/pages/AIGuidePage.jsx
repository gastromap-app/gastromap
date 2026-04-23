import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useGastroAI, ChatInterface, ChatInputBar } from '@/shared/components/GastroAIChat'

const AIGuidePage = () => {
    const { messages, isTyping, sendMessage } = useGastroAI()
    const shouldReduceMotion = useReducedMotion()
    const navigate = useNavigate()

    const handleCardClick = (locationId) => {
        navigate(`/location/${locationId}`)
    }

    return (
        // The parent layout provides h-full. We fill it and keep input at the very bottom.
        <div className="flex flex-col h-full min-h-0 relative">

            {/* Aurora animation while AI is typing */}
            {isTyping && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
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

            {/* Scrollable messages area — fills available space */}
            <div className="flex-1 overflow-y-auto relative z-10 min-h-0">
                <ChatInterface
                    messages={messages}
                    isTyping={isTyping}
                    onSendMessage={sendMessage}
                    onCardClick={handleCardClick}
                    transparent={true}
                    contentClassName="pt-4 pb-4 px-4"
                />
            </div>

            {/* Input bar — sticks to bottom, just above the nav bar */}
            <div className="relative z-20 flex-shrink-0 px-3 pb-3 pt-2 backdrop-blur-xl bg-gradient-to-t from-[rgba(15,23,42,0.85)] to-transparent dark:from-[rgba(10,10,20,0.9)]">
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
