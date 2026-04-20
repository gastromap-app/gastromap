import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useGastroAI, ChatInterface } from '@/features/shared/components/GastroAIChat'

const AIGuidePage = () => {
    const { messages, isTyping, sendMessage } = useGastroAI()
    const shouldReduceMotion = useReducedMotion()

    return (
        <div className="flex flex-col h-full min-h-0 relative">
            {/* Aurora Animation when typing - single soft blob, respects prefers-reduced-motion */}
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

            {/* Chat messages area */}
            <div className="flex-1 overflow-y-auto relative z-10">
                <ChatInterface
                    messages={messages}
                    isTyping={isTyping}
                    onSendMessage={sendMessage}
                    transparent={true}
                    contentClassName="pt-4 pb-4 px-4"
                />
            </div>
        </div>
    )
}

export default AIGuidePage
