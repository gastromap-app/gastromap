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

    // Cross-browser keyboard detection (Safari iOS, Chrome iOS, Chrome Android, Samsung Browser)
    useEffect(() => {
        // Strategy 1: visualViewport API (best, supported iOS 13+, Chrome 62+)
        const vv = window.visualViewport
        let rafId = null
        let focusedElement = null

        const checkKeyboard = () => {
            let isOpen = false

            if (vv) {
                // visualViewport.height shrinks when keyboard opens
                // offsetTop accounts for Safari's URL bar
                const kbHeight = window.innerHeight - vv.height - vv.offsetTop
                isOpen = kbHeight > 100
            } else {
                // Strategy 2: Fallback for older browsers — compare window heights
                // On Android Chrome, window.innerHeight shrinks when keyboard opens
                const initialHeight = window.screen.height * 0.7
                isOpen = window.innerHeight < initialHeight
            }

            // Strategy 3: If visualViewport says no keyboard but an input is focused,
            // use a heuristic — on mobile, focused input almost always means keyboard
            if (!isOpen && focusedElement) {
                const tag = focusedElement.tagName?.toLowerCase()
                const type = focusedElement.type?.toLowerCase()
                const isTextInput = (tag === 'input' && !['checkbox', 'radio', 'submit', 'button', 'file', 'hidden', 'range'].includes(type)) || tag === 'textarea'
                if (isTextInput && window.innerWidth < 768) {
                    // Double-check with a slight delay — visualViewport may not have updated yet
                    // Don't force isOpen here, let the delayed re-check handle it
                }
            }

            setKeyboardOpen(isOpen)
        }

        // Throttled check using rAF to avoid layout thrashing
        const scheduleCheck = () => {
            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(checkKeyboard)
        }

        // visualViewport events
        if (vv) {
            vv.addEventListener('resize', scheduleCheck)
            vv.addEventListener('scroll', scheduleCheck)
        }

        // Window resize fallback (Android Chrome shrinks window on keyboard)
        window.addEventListener('resize', scheduleCheck)

        // Focus tracking — critical for Safari iOS which may not fire visualViewport resize
        const onFocusIn = (e) => {
            focusedElement = e.target
            // Delay to allow keyboard animation to complete and viewport to update
            setTimeout(scheduleCheck, 150)
            setTimeout(scheduleCheck, 350) // Second check for slow keyboards
        }
        const onFocusOut = (e) => {
            focusedElement = null
            // Delay to allow keyboard dismiss animation
            setTimeout(scheduleCheck, 100)
            setTimeout(scheduleCheck, 300)
        }
        document.addEventListener('focusin', onFocusIn)
        document.addEventListener('focusout', onFocusOut)

        return () => {
            if (rafId) cancelAnimationFrame(rafId)
            if (vv) {
                vv.removeEventListener('resize', scheduleCheck)
                vv.removeEventListener('scroll', scheduleCheck)
            }
            window.removeEventListener('resize', scheduleCheck)
            document.removeEventListener('focusin', onFocusIn)
            document.removeEventListener('focusout', onFocusOut)
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
                "fixed left-0 right-0 z-[70] px-4 md:hidden pointer-events-none transition-all duration-200",
                keyboardOpen && "opacity-0 pointer-events-none translate-y-full"
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
