import React, { useState, useEffect } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const PublicLayout = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    return (
        <div className={`min-h-screen font-sans flex flex-col ${isDark ? 'bg-black text-white' : 'bg-[#F5F5F7] text-gray-900'}`}>
            {/* Navbar — LandingPageV3 style */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? (isDark ? 'bg-black/80 backdrop-blur-xl border-b border-white/5' : 'bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm') : ''}`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
                <div className="max-w-7xl mx-auto px-6 md:px-10 h-14 md:h-20 flex items-center justify-between">
                    <Link to="/" className={`text-lg font-medium tracking-tight transition-colors ${isDark ? 'text-white' : scrolled ? 'text-gray-900' : 'text-gray-900'}`}>GastroMap</Link>
                    <Link to="/auth/signup" className={`h-9 px-5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${isDark ? 'bg-white text-black hover:bg-white/90' : scrolled ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                        Get Started <ArrowUpRight size={14} />
                    </Link>
                </div>
            </nav>

            {/* Content */}
            <main className="flex-grow pt-14 md:pt-20">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className={`py-12 border-t ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
                <div className="max-w-4xl mx-auto px-6 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-4 text-sm">
                        <Link to="/terms" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Terms</Link>
                        <Link to="/privacy" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Privacy</Link>
                    </div>
                    <p className="text-sm text-gray-400">© 2025 GastroMap. All rights reserved.</p>
                </div>
            </footer>
        </div>
    )
}

export default PublicLayout
