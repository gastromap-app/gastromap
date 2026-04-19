import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Moon, Sun, ShieldCheck, Download, PlusCircle, Sparkles, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { usePWA } from '@/hooks/usePWA'

export function UniversalHeader() {
    const { t } = useTranslation()
    const { theme, toggleTheme } = useTheme()
    const navigate = useNavigate()
    const { user: authUser } = useAuthStore()
    const { isInstallable, installPWA } = usePWA()
    const location = useLocation()
    const user = authUser || null
    const isAdmin = authUser?.role === 'admin'
    const isDark = theme === 'dark'

    const [isScrolled, setIsScrolled] = useState(false)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const menuRef = useRef(null)

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
        if (!isMenuOpen) return
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setIsMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('touchstart', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
        }
    }, [isMenuOpen])

    const glassStyle = isDark
        ? "bg-black/20 border-white/5 text-white hover:bg-white/10"
        : "bg-white/20 border-white/20 text-gray-900 hover:bg-gray-100/50"

    const textStyle = isDark ? "text-white" : "text-gray-900"

    const isAIGuide = location.pathname === '/ai-guide'

    const headerBgClass = isScrolled || isAIGuide
        ? (isDark
            ? 'bg-gradient-to-b from-black/90 via-black/80 to-transparent backdrop-blur-xl'
            : 'bg-gradient-to-b from-white/90 via-white/80 to-transparent backdrop-blur-xl')
        : 'bg-transparent'

    return (
        <header
            className="fixed top-0 left-0 right-0 z-[100] transition-none"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            {/* Background Layer with Smooth Mask */}
            <div
                className={`absolute inset-0 w-full h-full transition-all duration-700 pointer-events-none ${headerBgClass}`}
                style={{
                    maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)'
                }}
            />

            <div className="max-w-[1400px] mx-auto relative min-h-[40px] px-[2.5vw] md:px-[20px] pt-2 pb-4 md:py-4">
                <AnimatePresence mode="wait">
                    {!isAIGuide ? (
                        <motion.div
                            key="standard-header"
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -10, opacity: 0 }}
                            className="flex justify-between items-center w-full h-10"
                        >
                            {/* Logo Capsule */}
                            <Link to="/dashboard" className={`flex items-center gap-2 hover:scale-105 transition-all backdrop-blur-md px-3 py-1.5 rounded-full border shadow-sm ${isDark ? 'bg-white/10 border-white/10' : 'bg-white/40 border-white/40'}`}>
                                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-inner">G</div>
                                <span className={`font-bold text-xs md:text-sm tracking-tight ${textStyle}`}>GastroMap</span>
                            </Link>

                            {/* Actions */}
                            <div className="flex items-center gap-2 md:gap-3">
                                {isInstallable && (
                                    <button
                                        onClick={installPWA}
                                        aria-label="Download GastroMap app"
                                        className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-md transition-all border group bg-blue-600 border-blue-500/50 text-white shadow-[0_4px_15px_rgba(37,99,235,0.3)] hover:scale-105 active:scale-95`}
                                    >
                                        <Download size={16} className="group-hover:bounce" />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">Download</span>
                                    </button>
                                )}
                                {isAdmin && (
                                    <Link to="/admin" aria-label="Admin panel" className={`hidden sm:flex p-2.5 rounded-full backdrop-blur-md transition-all border ${glassStyle}`}>
                                        <ShieldCheck size={18} className="text-blue-500" />
                                    </Link>
                                )}
                                <button onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className={`hidden sm:block p-2.5 rounded-full backdrop-blur-md transition-all border ${glassStyle}`}>
                                    {isDark ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-gray-600" />}
                                </button>

                                {/* Mobile overflow menu */}
                                <div className="relative sm:hidden" ref={menuRef}>
                                    <button
                                        onClick={() => setIsMenuOpen(v => !v)}
                                        aria-label="More options"
                                        aria-expanded={isMenuOpen}
                                        className={`w-11 h-11 flex items-center justify-center rounded-full backdrop-blur-md transition-all border ${glassStyle}`}
                                    >
                                        <MoreHorizontal size={18} />
                                    </button>
                                    <AnimatePresence>
                                        {isMenuOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                                transition={{ duration: 0.15 }}
                                                className={`absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden border backdrop-blur-xl shadow-xl ${isDark ? 'bg-black/80 border-white/10' : 'bg-white/90 border-gray-200'}`}
                                            >
                                                <button
                                                    onClick={() => { toggleTheme(); setIsMenuOpen(false) }}
                                                    className={`w-full min-h-11 flex items-center gap-3 px-4 py-3 text-sm font-semibold ${isDark ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-gray-100'}`}
                                                >
                                                    {isDark ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-gray-600" />}
                                                    {isDark ? 'Light mode' : 'Dark mode'}
                                                </button>
                                                {isAdmin && (
                                                    <Link
                                                        to="/admin"
                                                        onClick={() => setIsMenuOpen(false)}
                                                        className={`w-full min-h-11 flex items-center gap-3 px-4 py-3 text-sm font-semibold ${isDark ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-gray-100'}`}
                                                    >
                                                        <ShieldCheck size={18} className="text-blue-500" />
                                                        Admin
                                                    </Link>
                                                )}
                                                {isInstallable && (
                                                    <button
                                                        onClick={() => { installPWA(); setIsMenuOpen(false) }}
                                                        className={`w-full min-h-11 flex items-center gap-3 px-4 py-3 text-sm font-semibold ${isDark ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-gray-100'}`}
                                                    >
                                                        <Download size={18} className="text-blue-500" />
                                                        Install app
                                                    </button>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <Link to="/dashboard/add-place" aria-label={t('profile.add_place')} className="flex items-center gap-1.5 px-2.5 py-1.5 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 border border-indigo-500/40">
                                    <PlusCircle size={14} />
                                    <span>Place</span>
                                </Link>
                                <Link
                                    to="/profile"
                                    aria-label={user ? `Profile for ${user.name}` : 'Sign in'}
                                    className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-md border-2 border-white/20 hover:scale-110 transition-transform"
                                >
                                    {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                                </Link>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="ai-header"
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -10, opacity: 0 }}
                            className="w-full flex flex-col items-center pt-1 pb-2"
                        >
                            {/* Level 1: Branding - Compact */}
                            <div className="flex items-center gap-2 mb-0.5">
                                <Sparkles size={18} className="text-blue-500" />
                                <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    {t('nav.ai_guide')}
                                </h1>
                            </div>

                            {/* Level 2: Navigation - Compact Height */}
                            <div className="flex justify-between items-center w-full px-4 h-10 relative overflow-visible">
                                {/* Dashboard Hint (Left) */}
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => navigate('/dashboard')}
                                    aria-label="Back to dashboard"
                                    className="relative flex items-center gap-2 pr-8 group pointer-events-auto h-full"
                                >
                                    {/* Natural Glow - No clipping */}
                                    <div className={`absolute -left-10 inset-y-0 w-32 bg-gradient-to-r ${isDark ? 'from-blue-600/30' : 'from-blue-500/20'} to-transparent blur-xl pointer-events-none`} />
                                    <div className="relative z-10 flex flex-col items-start">
                                        <ChevronLeft className="w-5 h-5 text-blue-500 animate-pulse" />
                                        <span className="text-[7px] font-black uppercase tracking-tighter text-blue-500/60 leading-none">{t('common.back')}</span>
                                    </div>
                                </motion.button>

                                {/* Saved Hint (Right) */}
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => navigate('/saved')}
                                    aria-label="Go to saved locations"
                                    className="relative flex items-center gap-2 pl-8 group pointer-events-auto text-right h-full"
                                >
                                    {/* Natural Glow - No clipping */}
                                    <div className={`absolute -right-10 inset-y-0 w-32 bg-gradient-to-l ${isDark ? 'from-indigo-600/30' : 'from-indigo-500/20'} to-transparent blur-xl pointer-events-none`} />
                                    <div className="relative z-10 flex flex-col items-end">
                                        <ChevronRight className="w-5 h-5 text-indigo-500 animate-pulse" />
                                        <span className="text-[7px] font-black uppercase tracking-tighter text-indigo-500/60 leading-none">{t('nav.saved')}</span>
                                    </div>
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </header>
    )
}
