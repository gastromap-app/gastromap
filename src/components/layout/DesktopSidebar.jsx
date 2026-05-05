import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    Home, Map, Sparkles, Heart, CheckCircle, Globe,
    Trophy, User, PlusCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'

const navItems = [
    { icon: Home,        label: 'Dashboard',   path: '/dashboard' },
    { icon: Map,         label: 'Map',         path: '/map' },
    { icon: Sparkles,    label: 'AI Guide',    path: '/ai-guide' },
    { icon: Heart,       label: 'Saved',       path: '/saved' },
    { icon: CheckCircle, label: 'Visited',     path: '/visited' },
    { icon: Globe,       label: 'Explore',     path: '/explore' },
    { icon: Trophy,      label: 'Leaderboard', path: '/dashboard/leaderboard' },
]

export function DesktopSidebar() {
    const location = useLocation()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { t } = useTranslation()
    const [hoveredLabel, setHoveredLabel] = useState(null)

    const isActive = (path) => {
        if (path === '/explore') {
            return location.pathname.startsWith('/explore')
        }
        if (path === '/map') {
            return location.pathname === '/map' || location.pathname.startsWith('/location')
        }
        return location.pathname === path
    }

    return (
        <aside
            className={cn(
                'fixed left-0 top-0 bottom-0 z-[90] hidden md:flex flex-col items-center py-6 w-[72px] border-r transition-colors duration-300',
                isDark
                    ? 'bg-[hsl(220,20%,3%)]/95 backdrop-blur-xl border-white/[0.04]'
                    : 'bg-white/95 backdrop-blur-xl border-slate-200/60'
            )}
            style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
        >
            {/* Logo */}
            <Link
                to="/dashboard"
                className="mb-8 w-10 h-10 bg-[hsl(217,91%,60%)] rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md hover:scale-105 transition-transform"
            >
                G
            </Link>

            {/* Nav items */}
            <nav className="flex-1 flex flex-col items-center gap-2">
                {navItems.map((item) => {
                    const active = isActive(item.path)
                    return (
                        <div
                            key={item.path}
                            className="relative"
                            onMouseEnter={() => setHoveredLabel(item.label)}
                            onMouseLeave={() => setHoveredLabel(null)}
                        >
                            <Link
                                to={item.path}
                                className={cn(
                                    'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 relative',
                                    active
                                        ? isDark
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'bg-blue-50 text-blue-600'
                                        : isDark
                                            ? 'text-[hsl(220,10%,55%)] hover:bg-white/5 hover:text-white'
                                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                                )}
                                aria-label={item.label}
                                aria-current={active ? 'page' : undefined}
                            >
                                {active && (
                                    <motion.div
                                        layoutId="sidebarActive"
                                        className={cn(
                                            'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full',
                                            isDark ? 'bg-blue-400' : 'bg-blue-600'
                                        )}
                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                            </Link>

                            {/* Tooltip */}
                            {hoveredLabel === item.label && (
                                <motion.div
                                    initial={{ opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -4 }}
                                    transition={{ duration: 0.15 }}
                                    className={cn(
                                        'absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap z-[100] pointer-events-none',
                                        isDark
                                            ? 'bg-[hsl(220,20%,9%)] text-white border border-white/[0.06] shadow-xl'
                                            : 'bg-white text-slate-800 border border-slate-200 shadow-lg'
                                    )}
                                >
                                    {item.label}
                                    {/* Arrow */}
                                    <div
                                        className={cn(
                                            'absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rotate-45',
                                            isDark ? 'bg-[hsl(220,20%,9%)] border-l border-b border-white/[0.06]' : 'bg-white border-l border-b border-slate-200'
                                        )}
                                    />
                                </motion.div>
                            )}
                        </div>
                    )
                })}
            </nav>

            {/* Bottom actions */}
            <div className="flex flex-col items-center gap-2">
                <Link
                    to="/dashboard/add-place"
                    className={cn(
                        'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200',
                        isDark
                            ? 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                    )}
                    aria-label="Add a place"
                >
                    <PlusCircle size={20} />
                </Link>
                <Link
                    to="/profile"
                    className={cn(
                        'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200',
                        location.pathname.startsWith('/profile')
                            ? isDark
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-blue-50 text-blue-600'
                            : isDark
                                ? 'text-[hsl(220,10%,55%)] hover:bg-white/5 hover:text-white'
                                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                    )}
                    aria-label="Profile"
                >
                    <User size={20} />
                </Link>
            </div>
        </aside>
    )
}
