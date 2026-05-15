import React, { useState, useEffect } from 'react'
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
    const [keyboardOpen, setKeyboardOpen] = useState(false)

    // Hide nav when virtual keyboard is open
    useEffect(() => {
        const vv = window.visualViewport
        if (!vv) return
        const update = () => {
            const kbHeight = window.innerHeight - vv.height - vv.offsetTop
            setKeyboardOpen(kbHeight > 100)
        }
        vv.addEventListener('resize', update)
        vv.addEventListener('scroll', update)
        return () => {
            vv.removeEventListener('resize', update)
            vv.removeEventListener('scroll', update)
        }
    }, [])

    const navItems = [
        { icon: Home,        label: t('nav.overview'), path: '/dashboard' },
        { icon: Map,         label: t('nav.map'),      path: '/map' },
        { icon: Sparkles,    label: t('nav.ai_guide'), path: '/ai-guide' },
        { icon: Heart,       label: t('nav.saved'),    path: '/saved' },
        { icon: CheckCircle, label: t('nav.visited'),  path: '/visited' },
    ]

    return (
        <div
            className={cn(
                "fixed left-0 right-0 z-[70] px-4 md:hidden pointer-events-none transition-opacity duration-150",
                keyboardOpen && "opacity-0 pointer-events-none"
            )}
            style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
            <nav
                className={cn(
                    "max-w-md mx-auto pointer-events-auto rounded-[28px] border backdrop-blur-2xl",
                    isDark
                        ? "bg-black/65 border-white/10 shadow-2xl shadow-black/50"
                        : "bg-white/90 border-slate-200/80 shadow-[0_4px_16px_rgba(15,23,42,0.08),0_20px_40px_rgba(15,23,42,0.1)]"
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
                                        className="absolute inset-x-1 inset-y-2 bg-[#2d7a9e]/15 dark:bg-blue-500/20 rounded-[18px]"
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
                                                    ? "text-[#2d7a9e] dark:text-blue-400 scale-110"
                                                    : "text-slate-500 dark:text-gray-500",
                                                item.path === '/ai-guide' && !isActive && "text-blue-500/80 dark:text-blue-400/80"
                                            )}
                                        />
                                    </motion.div>
                                </div>

                                {/* Label — always visible for clarity */}
                                <span
                                    className={cn(
                                        "relative z-10 text-[10px] font-medium tracking-wide transition-colors duration-200 leading-none",
                                        isActive
                                            ? "text-[#2d7a9e] dark:text-blue-400"
                                            : "text-t-tertiary"
                                    )}
                                >
                                    {item.label}
                                </span>
                            </Link>
                        )
                    })}
                </div>
            </nav>
        </div>
    )
}
