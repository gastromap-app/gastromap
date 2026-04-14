import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'

const PublicNavbar = () => {
    const { isAuthenticated, user } = useAuthStore()

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 py-4 w-full px-4 md:px-8 pointer-events-none">
            <div className="w-full pointer-events-auto">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 p-2 rounded-[20px] md:rounded-full flex items-center justify-between gap-4 shadow-sm">
                    <Link to="/" className="flex items-center gap-3 hover:scale-105 transition-transform text-base-content group">
                        <img src="/pwa-icon-192.png" alt="GastroMap Logo" className="w-8 h-8 md:w-10 md:h-10 object-cover rounded-full" />
                        <span className="font-bold text-sm md:text-lg tracking-tight">GastroMap</span>
                    </Link>

                    <div className="flex items-center gap-2 md:gap-4">
                        <Link to="/explore" className="hidden md:block text-[11px] font-bold uppercase tracking-widest text-base-content/40 hover:text-base-content transition-colors px-2">
                            Browse
                        </Link>
                        {isAuthenticated ? (
                            <Link to={user?.role === 'admin' ? '/admin' : '/dashboard'}>
                                <Button className="rounded-[18px] md:rounded-full hover:scale-105 active:scale-95 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs md:text-sm font-bold px-4 md:px-6 h-9 md:h-10">
                                    Dashboard
                                </Button>
                            </Link>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link to="/login" className="hidden md:block text-[11px] font-bold uppercase tracking-widest text-base-content/60 hover:text-base-content transition-colors px-2">
                                    Sign In
                                </Link>
                                <Link to="/auth/signup">
                                    <Button className="rounded-[18px] md:rounded-full hover:scale-105 active:scale-95 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs md:text-sm font-bold px-4 md:px-6 h-9 md:h-10">
                                        Get Started
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    )
}

export default PublicNavbar
