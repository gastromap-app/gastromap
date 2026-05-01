import React, { useState, useRef, useEffect } from 'react'
import { useClickOutside } from '@/hooks/useClickOutside'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Moon, Sun, ShieldCheck, Download, PlusCircle, Sparkles, ChevronLeft, ChevronRight, MoreHorizontal, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { usePWA } from '@/hooks/usePWA'
import { LanguageSelector } from '@/features/shared/components/LanguageSelector'
import { useUIStore } from '@/shared/store/useUIStore'

export function UniversalHeader() {
    const { t } = useTranslation()
    const { theme, toggleTheme } = useTheme()
    const { user: authUser, logout } = useAuthStore()
    const { isInstallable, installPWA } = usePWA()
    const { isHeaderScrolled: storeIsScrolled, setHeaderScrolled } = useUIStore()
    const user = authUser || null
    const isAdmin = authUser?.role === 'admin'
    const isDark = theme === 'dark'

    const [localIsScrolled, setLocalIsScrolled] = useState(false)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const menuRef = useRef(null)

    // Sync local and store scroll states
    const isScrolled = storeIsScrolled || localIsScrolled

    useEffect(() => {
        const handleScroll = () => {
            const scrolled = window.scrollY > 20
            setLocalIsScrolled(scrolled)
            // We don't necessarily update the store here to avoid loops, 
            // but we could if we wanted to broadcast window scroll.
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll()
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    useClickOutside(menuRef, () => setIsMenuOpen(false), isMenuOpen)

    const glassStyle = isDark
        ? "bg-white/[0.04] border-white/[0.06] text-[hsl(220,20%,96%)] hover:bg-white/[0.08]"
        : "bg-white/70 border-slate-200/80 text-gray-900 hover:bg-white shadow-sm"

    const textStyle = isDark ? "text-[hsl(220,20%,96%)]" : "text-gray-900"

    // Premium header background — subtle lift on scroll
    const headerBgClass = isScrolled
        ? (isDark
            ? 'bg-[hsl(220,20%,3%)]/80 backdrop-blur-xl border-b border-white/[0.04]'
            : 'bg-white/75 backdrop-blur-xl border-b border-slate-200/60 shadow-sm')
        : ''

    return (
        <header
            className="fixed top-0 left-0 right-0 z-[100] transition-none"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            {/* Background Layer */}
            <div
                className={`absolute inset-0 w-full h-full transition-all duration-500 pointer-events-none ${headerBgClass}`}
            />

            <div className="max-w-[1400px] mx-auto relative min-h-[40px] px-[2.5vw] md:px-[20px] pt-2 pb-4 md:py-4">
                <AnimatePresence mode="wait">
                    <motion.div
                        key="standard-header"
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -10, opacity: 0 }}
                        className="flex justify-between items-center w-full h-10"
                    >
                            {/* Logo Capsule */}
                            <Link to="/dashboard" className={`flex items-center gap-2 hover:scale-105 transition-all px-3 py-1.5 rounded-full border ${isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-white/80 border-slate-200/80 shadow-sm'}`}>
                                <div className="w-7 h-7 bg-[hsl(217,91%,60%)] rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-inner">G</div>
                                <span className={`font-bold text-xs md:text-sm tracking-tight ${textStyle}`}>GastroMap</span>
                            </Link>

                            {/* Actions */}
                            <div className="flex items-center gap-2 md:gap-3">
                                {isInstallable && (
                                    <button
                                        onClick={installPWA}
                                        aria-label={t('header.download_aria')}
                                        className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-md transition-all border group bg-blue-600 border-blue-500/50 text-white shadow-[0_4px_15px_rgba(37,99,235,0.3)] hover:scale-105 active:scale-95`}
                                    >
                                        <Download size={16} className="group-hover:bounce" />
                                        <span className="text-[10px] font-black uppercase tracking-tighter">{t('header.download')}</span>
                                    </button>
                                )}
                                {isAdmin && (
                                    <Link to="/admin" aria-label={t('header.admin_aria')} className={`hidden sm:flex p-2.5 rounded-full backdrop-blur-md transition-all border ${glassStyle}`}>
                                        <ShieldCheck size={18} className="text-blue-500" />
                                    </Link>
                                )}
                                <button onClick={toggleTheme} aria-label={isDark ? t('header.switch_to_light') : t('header.switch_to_dark')} className={`hidden sm:block p-2.5 rounded-full backdrop-blur-md transition-all border ${glassStyle}`}>
                                    {isDark ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-gray-600" />}
                                </button>
                                <div className="hidden sm:block">
                                    <LanguageSelector className="" />
                                </div>

                                {/* Desktop Sign Out */}
                                <button
                                    onClick={async () => {
                                        await logout();
                                        window.location.href = '/login';
                                    }}
                                    className={`hidden sm:flex items-center gap-2 p-2.5 rounded-full backdrop-blur-md transition-all border ${glassStyle} text-red-500 hover:bg-red-500/10`}
                                    title={t('profile.sign_out')}
                                >
                                    <LogOut size={18} />
                                </button>

                                {/* Mobile overflow menu */}
                                <div className="relative sm:hidden" ref={menuRef}>
                                    <button
                                        onClick={() => setIsMenuOpen(v => !v)}
                                        aria-label={t('header.more_options')}
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
                                                className={`absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden border backdrop-blur-xl shadow-xl ${isDark ? 'bg-[hsl(222,14%,11%)] border-white/[0.06]' : 'bg-white/90 border-gray-200'}`}
                                            >
                                                <button
                                                    onClick={() => { toggleTheme(); setIsMenuOpen(false) }}
                                                    className={`w-full min-h-11 flex items-center gap-3 px-4 py-3 text-sm font-semibold ${isDark ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-gray-100'}`}
                                                >
                                                    {isDark ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-gray-600" />}
                                                    {isDark ? t('header.light_mode') : t('header.dark_mode')}
                                                </button>
                                                {isAdmin && (
                                                    <Link
                                                        to="/admin"
                                                        onClick={() => setIsMenuOpen(false)}
                                                        className={`w-full min-h-11 flex items-center gap-3 px-4 py-3 text-sm font-semibold ${isDark ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-gray-100'}`}
                                                    >
                                                        <ShieldCheck size={18} className="text-blue-500" />
                                                        {t('header.admin')}
                                                    </Link>
                                                )}
                                                {isInstallable && (
                                                    <button
                                                        onClick={() => { installPWA(); setIsMenuOpen(false) }}
                                                        className={`w-full min-h-11 flex items-center gap-3 px-4 py-3 text-sm font-semibold ${isDark ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-gray-100'}`}
                                                    >
                                                        <Download size={18} className="text-blue-500" />
                                                        {t('header.install_app')}
                                                    </button>
                                                )}
                                                <LanguageSelector variant="menuItem" isDark={isDark} />
                                                <div className={`h-px my-1 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
                                                <button
                                                    onClick={async () => {
                                                        setIsMenuOpen(false);
                                                        await logout();
                                                        window.location.href = '/login';
                                                    }}
                                                    className={`w-full min-h-11 flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}
                                                >
                                                    <LogOut size={18} />
                                                    {t('profile.sign_out')}
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <Link to="/dashboard/add-place" aria-label={t('profile.add_place')} className="flex items-center gap-1.5 px-2.5 py-1.5 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 border border-indigo-500/40">
                                    <PlusCircle size={14} />
                                    <span>{t('header.place')}</span>
                                </Link>
                                <Link
                                    to="/profile"
                                    aria-label={user ? `${t('header.profile_aria')}: ${user.name}` : t('header.sign_in')}
                                    className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-md border-2 border-white/20 hover:scale-110 transition-transform"
                                >
                                    {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                                </Link>
                            </div>
                        </motion.div>
                </AnimatePresence>
            </div>
        </header>
    )
}
