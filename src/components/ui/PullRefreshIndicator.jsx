import React from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '@/hooks/useTheme'

/**
 * PullRefreshIndicator — spinning wheel that appears on pull-to-refresh.
 * progress: 0–1 (fill during pull), isRefreshing: spinning state.
 */
export function PullRefreshIndicator({ progress, isRefreshing, pullDistance }) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const visible = progress > 0.05 || isRefreshing
    if (!visible) return null

    const size = 36
    const radius = 14
    const circumference = 2 * Math.PI * radius
    const strokeDash = circumference * Math.min(progress, 1)

    return (
        <motion.div
            initial={false}
            animate={{ 
                y: isRefreshing ? 0 : Math.min(pullDistance * 0.9, 52),
                opacity: Math.min(progress * 2, 1),
            }}
            className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center justify-center"
            style={{ top: 'calc(env(safe-area-inset-top) + 4.5rem)', pointerEvents: 'none' }}
        >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md border ${
                isDark 
                    ? 'bg-black/70 border-white/10' 
                    : 'bg-white/90 border-gray-100'
            }`}>
                {isRefreshing ? (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent"
                    />
                ) : (
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                        {/* Track */}
                        <circle
                            cx={size / 2} cy={size / 2} r={radius}
                            fill="none"
                            stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
                            strokeWidth="2.5"
                        />
                        {/* Progress arc */}
                        <circle
                            cx={size / 2} cy={size / 2} r={radius}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeDasharray={`${strokeDash} ${circumference}`}
                        />
                    </svg>
                )}
            </div>
        </motion.div>
    )
}
