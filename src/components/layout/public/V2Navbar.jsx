import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useAuthStore } from '@/shared/store/useAuthStore'

const CUBIC = [0.86, 0, 0.07, 1]

const V2Navbar = () => {
    const [scrolled, setScrolled] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const { isAuthenticated, user } = useAuthStore()

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    const navLinks = [
        { label: 'Features', to: '/features' },
        { label: 'Pricing', to: '/pricing' },
        { label: 'About', to: '/about' },
        { label: 'Contact', to: '/contact' },
    ]

    return (
        <>
            <motion.nav
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: CUBIC }}
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
                    scrolled
                        ? 'bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-[#E5E5E5] dark:border-white/10'
                        : 'bg-transparent'
                }`}
                style={{ paddingTop: 'max(env(safe-area-inset-top), 0px)' }}
            >
                <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-20">
                    <div className="flex items-center justify-between h-16 md:h-20">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2.5 group">
                            <img src="/pwa-icon-192.png" alt="GastroMap" className="w-8 h-8 rounded-full" />
                            <span className={`text-sm font-semibold tracking-tight transition-colors ${scrolled ? 'text-[#0A0A0A] dark:text-white' : 'text-white'}`}>
                                GastroMap
                            </span>
                        </Link>

                        {/* Desktop links */}
                        <div className="hidden md:flex items-center gap-8">
                            {navLinks.map(link => (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    className={`text-[11px] font-medium uppercase tracking-widest transition-colors hover:opacity-70 ${
                                        scrolled ? 'text-[#0A0A0A]/60 dark:text-white/60' : 'text-white/60'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>

                        {/* Desktop CTA */}
                        <div className="hidden md:flex items-center gap-3">
                            {isAuthenticated ? (
                                <Link
                                    to={user?.role === 'admin' ? '/admin' : '/dashboard'}
                                    className={`h-9 px-5 rounded-full text-xs font-semibold flex items-center justify-center transition-colors ${
                                        scrolled
                                            ? 'bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] hover:opacity-90'
                                            : 'bg-white text-[#0A0A0A] hover:bg-white/90'
                                    }`}
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        className={`text-[11px] font-medium uppercase tracking-widest transition-colors hover:opacity-70 ${
                                            scrolled ? 'text-[#0A0A0A]/60 dark:text-white/60' : 'text-white/60'
                                        }`}
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        to="/auth/signup"
                                        className={`h-9 px-5 rounded-full text-xs font-semibold flex items-center justify-center transition-colors ${
                                            scrolled
                                                ? 'bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] hover:opacity-90'
                                                : 'bg-white text-[#0A0A0A] hover:bg-white/90'
                                        }`}
                                    >
                                        Get Started
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            className={`md:hidden p-2 transition-colors ${scrolled ? 'text-[#0A0A0A] dark:text-white' : 'text-white'}`}
                        >
                            {menuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>
            </motion.nav>

            {/* Mobile menu overlay */}
            <AnimatePresence>
                {menuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-40 bg-white dark:bg-[#0A0A0A] md:hidden"
                    >
                        <div className="flex flex-col items-center justify-center h-full gap-8">
                            {navLinks.map(link => (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    onClick={() => setMenuOpen(false)}
                                    className="text-2xl font-medium tracking-tight text-[#0A0A0A] dark:text-white"
                                >
                                    {link.label}
                                </Link>
                            ))}
                            {isAuthenticated ? (
                                <Link
                                    to={user?.role === 'admin' ? '/admin' : '/dashboard'}
                                    onClick={() => setMenuOpen(false)}
                                    className="mt-4 h-12 px-8 rounded-full bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-sm font-semibold flex items-center justify-center"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        onClick={() => setMenuOpen(false)}
                                        className="text-lg text-[#737373] dark:text-white/50"
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        to="/auth/signup"
                                        onClick={() => setMenuOpen(false)}
                                        className="h-12 px-8 rounded-full bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-sm font-semibold flex items-center justify-center"
                                    >
                                        Get Started
                                    </Link>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

export default V2Navbar
