import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { UniversalHeader } from './UniversalHeader'
import GastroGuideChat from '@/features/public/components/GastroGuideChat'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import AuroraBackground from '@/components/ui/aurora-background'
import { useTheme } from '@/hooks/useTheme'

export function MainLayout() {
    const { theme } = useTheme()
    const [isChatOpen, setIsChatOpen] = useState(false)
    const location = useLocation()
    const isMap = location.pathname === '/map'
    const isAIGuide = location.pathname === '/ai-guide'
    // Full-screen pages: no extra bottom padding (they handle their own layout)
    const isFullScreen = isMap || isAIGuide

    return (
        <AuroraBackground theme={theme}>
            <div className="flex flex-col min-h-screen text-foreground relative">
                <UniversalHeader />
                <main
                    className={`flex-1 relative transition-all duration-300 ${isFullScreen ? '' : 'pb-24'} md:pb-0`}
                    style={!isFullScreen ? { paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' } : undefined}
                >
                    {/* Map page uses fixed inset-0 and renders above this container */}
                    <Outlet />
                </main>
                <BottomNav />

                {/* AI Floating Action Button (Desktop Only) */}
                {!isChatOpen && (
                    <Button
                        size="lg"
                        className="fixed bottom-8 right-8 z-40 rounded-full w-14 h-14 shadow-xl shadow-primary/30 bg-primary hover:bg-primary/90 hover:scale-105 transition-all duration-300 hidden md:flex"
                        onClick={() => setIsChatOpen(true)}
                    >
                        <Sparkles className="h-6 w-6 text-white" />
                    </Button>
                )}

                <GastroGuideChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            </div>
        </AuroraBackground>
    )
}
