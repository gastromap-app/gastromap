import React from 'react'
import { motion } from 'framer-motion'
import { Hammer, AlertTriangle, MessageCircle, ArrowLeft } from 'lucide-react'
import { useAppConfigStore } from '@/store/useAppConfigStore'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'
import { Link } from 'react-router-dom'

export const MaintenanceGuard = ({ children }) => {
    const { appStatus, maintenanceMessage, downMessage } = useAppConfigStore()
    const { user } = useAuthStore()

    // Admins bypass maintenance mode
    if (user?.role === 'admin' || appStatus === 'active') {
        return children
    }

    const isDown = appStatus === 'down'

    return (
        <div className="fixed inset-0 z-[9999] bg-[#FDFDFD] dark:bg-slate-950 flex items-center justify-center p-6 text-center">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full"
            >
                <div className="w-24 h-24 bg-indigo-600 rounded-[40px] flex items-center justify-center text-white mx-auto mb-10 shadow-2xl shadow-indigo-500/30 animate-pulse">
                    {isDown ? <AlertTriangle size={40} /> : <Hammer size={40} />}
                </div>

                <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-6">
                    {isDown ? 'System temporarily' : 'Maintenance'} <br />
                    <span className="text-indigo-600">{isDown ? 'unavailable.' : 'in progress.'}</span>
                </h1>

                <p className="text-slate-500 font-medium text-lg leading-relaxed mb-10 italic">
                    "{isDown ? downMessage : maintenanceMessage}"
                </p>

                <div className="space-y-4">
                    <Link to="/" className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                        <ArrowLeft size={18} /> Back to Home
                    </Link>
                    <button className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 transition-all">
                        <MessageCircle size={18} /> Contact Support
                    </button>
                </div>

                <div className="mt-20 pt-10 border-t border-slate-100 dark:border-slate-800/50">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">GastroOS System Status</p>
                    <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
