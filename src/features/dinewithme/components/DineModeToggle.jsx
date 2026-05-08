/**
 * DineModeToggle — floating button on the map to enter/exit Dine With Me mode.
 *
 * States: off (default) → active (green glow) → setting up (loading)
 * Positioned near the locate-me button on MapTab.
 */
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, X, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'

export function DineModeToggle({ isActive, isLoading, onToggle, dinerCount = 0 }) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    return (
        <div className="absolute bottom-44 right-4 z-[1000] md:bottom-20 md:right-6 pointer-events-auto">
            <motion.button
                onClick={onToggle}
                disabled={isLoading}
                whileTap={{ scale: 0.9 }}
                className={`
                    relative flex items-center justify-center
                    w-12 h-12 rounded-2xl
                    backdrop-blur-xl border
                    shadow-[0_8px_32px_rgba(0,0,0,0.15)]
                    transition-all duration-300 group cursor-pointer
                    ${isActive
                        ? isDark
                            ? 'bg-emerald-500/90 border-emerald-400/40 text-white shadow-emerald-500/30'
                            : 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/30'
                        : isDark
                            ? 'bg-gray-900/90 border-gray-800 text-white hover:bg-gray-800/90'
                            : 'bg-white/90 border-white/20 text-gray-800 hover:bg-white'
                    }
                    ${isLoading ? 'opacity-80 cursor-wait' : ''}
                `}
                title={isActive ? t('dine.go_invisible') : t('dine.toggle')}
            >
                {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : isActive ? (
                    <X className="w-5 h-5" />
                ) : (
                    <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
                )}

                {/* Active pulse ring */}
                {isActive && !isLoading && (
                    <motion.div
                        className="absolute inset-0 rounded-2xl border-2 border-emerald-400/60"
                        animate={{
                            scale: [1, 1.15, 1],
                            opacity: [0.6, 0, 0.6],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    />
                )}

                {/* Diner count badge */}
                <AnimatePresence>
                    {isActive && dinerCount > 0 && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className={`
                                absolute -top-1.5 -right-1.5
                                min-w-[18px] h-[18px] px-1
                                rounded-full flex items-center justify-center
                                text-[9px] font-black
                                bg-blue-500 text-white
                                ring-2 ${isDark ? 'ring-gray-900' : 'ring-white'}
                            `}
                        >
                            {dinerCount}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Label */}
                <div className={`
                    absolute right-full mr-3 top-1/2 -translate-y-1/2
                    px-2.5 py-1 rounded-lg
                    text-[10px] font-bold tracking-wide uppercase whitespace-nowrap
                    ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}
                    shadow-lg opacity-0 group-hover:opacity-100
                    transition-opacity pointer-events-none
                `}>
                    {isActive ? t('dine.go_invisible') : t('dine.toggle')}
                </div>
            </motion.button>
        </div>
    )
}
