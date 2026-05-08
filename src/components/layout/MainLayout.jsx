import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BottomNav } from './BottomNav'
import { UniversalHeader } from './UniversalHeader'
import { DesktopSidebar } from './DesktopSidebar'
import GastroGuideChat from '@/features/public/components/GastroGuideChat'
import { Sparkles } from 'lucide-react'
import AuroraBackground from '@/components/ui/aurora-background'
import { useTheme } from '@/hooks/useTheme'
import { useAIChatStore } from '@/shared/store/useAIChatStore'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useTranslation } from 'react-i18next'

export function MainLayout() {
    const { theme } = useTheme()
    const { user } = useAuthStore()
    const { isChatOpen, setIsChatOpen } = useAIChatStore()
    const { t } = useTranslation()
    const location = useLocation()
    const isMap = location.pathname === '/map'
    const isAIGuide = location.pathname === '/ai-guide'
    // Location detail page has its own scroll-aware header (Apple Maps pattern)
    // so the global header is hidden to avoid overlapping the hero image.
    const isLocationDetail = location.pathname.startsWith('/location/')
    // Full-screen pages: no extra bottom padding (they handle their own layout)
    const isFullScreen = isMap || isAIGuide

    return (
        <AuroraBackground theme={theme}>
            <div className="flex min-h-dvh text-foreground relative">
                {/* Desktop Sidebar Navigation */}
                <DesktopSidebar />

                <div className="flex-1 flex flex-col md:ml-[72px] min-w-0">
                    {!isLocationDetail && <UniversalHeader />}
                    <main
                        className={`flex-1 relative transition-all duration-300 ${isFullScreen ? '' : 'pb-24 md:pb-6'}`}
                    >
                        {/* Map page uses fixed inset-0 and renders above this container */}
                        <Outlet />
                    </main>
                    <BottomNav />

                    {/* AI Chat Pill Button — center-bottom glass pill, desktop only */}
                    {!isAIGuide && (
                        <AnimatePresence>
                            {!isChatOpen && (
                                <motion.button
                                    key="ai-pill"
                                    initial={{ opacity: 0, y: 40, scale: 0.8 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                    onClick={() => setIsChatOpen(true)}
                                    className="
                                        fixed z-40 hidden md:flex
                                        bottom-8 left-0 right-0 mx-auto w-fit
                                        items-center gap-2.5
                                        px-6 h-12
                                        bg-white/10 dark:bg-white/[0.06]
                                        backdrop-blur-2xl
                                        border border-white/20 dark:border-white/10
                                        rounded-full
                                        shadow-[0_8px_32px_rgba(0,0,0,0.12)]
                                        hover:bg-white/20 dark:hover:bg-white/10
                                        hover:shadow-[0_8px_40px_rgba(59,130,246,0.15)]
                                        hover:border-blue-400/30
                                        active:scale-[0.97]
                                        transition-all duration-300
                                        cursor-pointer group
                                    "
                                >
                                    <div className="w-7 h-7 rounded-full bg-blue-500/80 group-hover:bg-blue-500 flex items-center justify-center shrink-0 transition-colors">
                                        <Sparkles className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-800 dark:text-white/90 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                                        {t('ai.chat_button', 'GastroGuide AI')}
                                    </span>
                                </motion.button>
                            )}
                        </AnimatePresence>
                    )}

                    {!isAIGuide && !isLocationDetail && <GastroGuideChat key={user?.id || 'guest'} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />}
                </div>
            </div>
        </AuroraBackground>
    )
}
