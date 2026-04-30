import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGastroAI, ChatInterface, ChatInputBar } from '@/shared/components/GastroAIChat'
import { useAIChatStore } from '@/shared/store/useAIChatStore'

export default function GastroGuideChat({ isOpen, onClose }) {
    const { messages, isTyping, sendMessage, geoStatus, requestGeo } = useGastroAI()
    const { lastScrollY, setLastScrollY } = useAIChatStore()
    const navigate = useNavigate()
    const scrollContainerRef = React.useRef(null)

    // Restore scroll on mount
    React.useEffect(() => {
        if (isOpen && scrollContainerRef.current && lastScrollY > 0) {
            const container = scrollContainerRef.current
            // Use a small delay to ensure content is rendered
            requestAnimationFrame(() => {
                container.scrollTop = lastScrollY
            })
        }
    }, [isOpen, lastScrollY])

    const handleScroll = (e) => {
        const scrollTop = e.currentTarget.scrollTop
        if (scrollTop > 0) {
            setLastScrollY(scrollTop)
        }
    }

    const handleCardClick = (locationId) => {
        // Position is already being saved by handleScroll, but let's be sure
        if (scrollContainerRef.current) {
            setLastScrollY(scrollContainerRef.current.scrollTop)
        }
        navigate(`/location/${locationId}`, { state: { from: 'chat' } })
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="fixed inset-0 z-[100] flex flex-col items-center justify-center md:inset-auto md:right-6 md:bottom-24 md:w-[420px] md:h-[650px] p-4 md:p-0 pointer-events-none"
            >
                {/* The "Siri" Glow Container */}
                <div className={`pointer-events-auto relative w-full h-full md:max-h-[650px] bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-[32px] shadow-2xl border border-white/50 dark:border-gray-700/50 overflow-hidden flex flex-col ${isTyping ? 'ring-2 ring-indigo-400/50' : ''}`}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-black/5 dark:border-white/5 bg-white/50 dark:bg-gray-900/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Sparkles className="h-4 w-4 text-white" />
                            </div>
                            <span className="font-semibold text-sm tracking-tight text-gray-900 dark:text-white">GastroGuide</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-black/5 dark:hover:bg-white/5 w-8 h-8">
                            <X className="h-4 w-4 opacity-50" />
                        </Button>
                    </div>

                    {/* Chat Interface - Scrollable Messages */}
                    <div 
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto"
                    >
                        <ChatInterface
                            messages={messages}
                            isTyping={isTyping}
                            onSendMessage={sendMessage}
                            onCardClick={handleCardClick}
                            geoStatus={geoStatus}
                            requestGeo={requestGeo}
                            scrollContainerRef={scrollContainerRef}
                        />
                    </div>

                    {/* Chat Input Bar */}
                    <div className="p-2 border-t border-black/5 dark:border-white/5">
                        <ChatInputBar
                            onSendMessage={sendMessage}
                            isTyping={isTyping}
                        />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}

