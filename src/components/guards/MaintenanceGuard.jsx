import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Hammer, AlertTriangle, MessageCircle, ArrowLeft, LogOut } from 'lucide-react'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { MaintenanceCarousel } from './MaintenanceCarousel'
// Note: we intentionally use window.location.href instead of useNavigate
// so a full page reload clears all in-memory state after sign-out.

export const MaintenanceGuard = ({ children }) => {
    const { appStatus, maintenanceMessage, downMessage } = useAppConfigStore()
    const { user, logout } = useAuthStore()
    const [signingOut, setSigningOut] = useState(false)

    // Admins bypass maintenance mode
    if (user?.role === 'admin' || appStatus === 'active') {
        return children
    }

    const isDown = appStatus === 'down'

    const handleSignOut = async () => {
        setSigningOut(true)
        try {
            await logout()
        } finally {
            // Hard redirect — guarantees a clean app re-mount and avoids
            // any React Router / auth-listener race conditions.
            window.location.href = '/login'
        }
    }

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col md:flex-row">
            {/* Carousel — full background on mobile, left panel on desktop */}
            <div className="absolute inset-0 md:relative md:w-1/2 md:h-full">
                <MaintenanceCarousel />
            </div>

            {/* Content panel — glassmorphism overlay on mobile, right panel on desktop */}
            <div className="relative z-10 flex items-center justify-center w-full h-full md:w-1/2 md:bg-[#FDFDFD] md:dark:bg-[hsl(220,20%,3%)] p-6">
                {/* Mobile glassmorphism backdrop */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm md:hidden" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 max-w-md w-full bg-white/80 dark:bg-[hsl(220,20%,6%)]/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20 dark:border-white/[0.06] md:bg-white md:dark:bg-[hsl(220,20%,6%)] md:backdrop-blur-none md:shadow-xl md:border-slate-100 md:dark:border-white/[0.06]"
                >
                    <div className="text-center">
                        <div className="w-20 h-20 bg-indigo-600 rounded-[32px] flex items-center justify-center text-white mx-auto mb-8 shadow-2xl shadow-indigo-500/30 animate-pulse">
                            {isDown ? <AlertTriangle size={36} /> : <Hammer size={36} />}
                        </div>

                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-5">
                            {isDown ? 'System temporarily' : 'Maintenance'} <br />
                            <span className="text-indigo-600">{isDown ? 'unavailable.' : 'in progress.'}</span>
                        </h1>

                        <p className="text-slate-500 dark:text-slate-400 font-medium text-base leading-relaxed mb-8 italic">
                            "{isDown ? downMessage : maintenanceMessage}"
                        </p>
                    </div>

                    <div className="space-y-3">
                        <a href="/" className="w-full h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all no-underline">
                            <ArrowLeft size={16} /> Back to Home
                        </a>
                        <a href="/contact" className="w-full h-12 bg-white/90 dark:bg-[hsl(220,20%,8%)] border border-slate-200 dark:border-white/[0.06] text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 hover:bg-white dark:hover:bg-[hsl(220,20%,12%)] transition-all no-underline">
                            <MessageCircle size={16} /> Contact Support
                        </a>
                        {user && (
                            <button
                                onClick={handleSignOut}
                                disabled={signingOut}
                                className="w-full h-12 bg-white/90 dark:bg-[hsl(220,20%,8%)] border border-red-100 dark:border-red-900/40 text-red-400 font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {signingOut
                                    ? <span className="w-4 h-4 rounded-full border-2 border-red-300 border-t-transparent animate-spin" />
                                    : <LogOut size={16} />
                                }
                                {signingOut ? 'Signing out…' : 'Sign Out'}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
