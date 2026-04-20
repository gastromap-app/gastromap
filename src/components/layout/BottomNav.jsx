import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Map, Sparkles, Heart, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'

export function BottomNav() {
    const location = useLocation()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { t } = useTranslation()

    const navItems = [
        { icon: Home,        label: t('nav.overview'), path: '/dashboard' },
        { icon: Map,         label: t('nav.map'),      path: '/map' },
        { icon: Sparkles,    label: t('nav.ai_guide'), path: '/ai-guide' },
        { icon: Heart,       label: t('nav.saved'),    path: '/saved' },
        { icon: CheckCircle, label: t('nav.visited'),  path: '/visited' },
    ]

    // Hide bottom nav on AI Guide page — AnimatedInputBar replaces it
    const isHidden = location.pathname === '/ai-guide'

    return (
        <AnimatePresence mode="wait">
            {!isHidden && (
                <motion.div
                    key="bottom-nav"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                    className="fixed left-0 right-0 z-[70] px-4 md:hidden pointer-events-none"
                    style={{ bottom: 'calc(12px + env(safe-area-inset-bottom))' }}
                >
                    <nav
                        className={cn(
                            "max-w-md mx-auto pointer-events-auto rounded-[28px] border backdrop-blur-2xl shadow-2xl",
                            isDark
                                ? "bg-black/65 border-white/10 shadow-black/50"
                                : "bg-white/75 border-white/50 shadow-blue-500/8"
                        )}
                        style={{ height: 64 }}
                    >
                        <div className="flex justify-around items-center h-full px-1">
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.path
                                    || (item.path === '/map' && location.pathname.startsWith('/location'))

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        aria-label={item.label}
                                        aria-current={isActive ? 'page' : undefined}
                                        className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 relative group"
                                    >
                                        {/* Active pill background */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="navActivePill"
                                                className="absolute inset-x-1 inset-y-2 bg-blue-600/15 dark:bg-blue-500/20 rounded-[18px]"
                                                transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
                                            />
                                        )}

                                        {/* Icon */}
                                        <div className="relative z-10">
                                            <motion.div
                                                animate={item.path === '/ai-guide' && !isActive
                                                    ? { opacity: [0.5, 1, 0.5], scale: [0.95, 1.05, 0.95] }
                                                    : {}}
                                                transition={item.path === '/ai-guide'
                                                    ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }
                                                    : {}}
                                            >
                                                <item.icon
                                                    className={cn(
                                                        "w-[19px] h-[19px] transition-all duration-200",
                                                        isActive
                                                            ? "text-blue-600 dark:text-blue-400 scale-110"
                                                            : "text-gray-400 dark:text-gray-500",
                                                        item.path === '/ai-guide' && !isActive && "text-blue-400/80"
                                                    )}
                                                />
                                            </motion.div>
                                        </div>

                                        {/* Label — always visible for clarity */}
                                        <span
                                            className={cn(
                                                "relative z-10 text-[9.5px] font-semibold tracking-wide transition-colors duration-200 leading-none",
                                                isActive
                                                    ? "text-blue-600 dark:text-blue-400"
                                                    : "text-gray-400 dark:text-gray-500"
                                            )}
                                        >
                                            {item.label}
                                        </span>
                                    </Link>
                                )
                            })}
                        </div>
                    </nav>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
