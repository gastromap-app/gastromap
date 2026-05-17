import React, { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'

function ReloadPrompt() {
    const swRegRef = useRef(null)
    const autoReloadTimer = useRef(null)

    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(_swUrl, r) {
            if (!r) return
            swRegRef.current = r

            // Check for updates every 5 minutes (not 1 hour — faster detection)
            const intervalId = setInterval(() => r.update(), 5 * 60 * 1000)
            swRegRef.current.__intervalId = intervalId
        },
    })

    // Auto-reload 3 seconds after update is detected
    // This prevents the "stale chunks" problem where old JS files are gone
    // but the page hasn't reloaded yet → skeleton/white screen
    useEffect(() => {
        if (needRefresh) {
            autoReloadTimer.current = setTimeout(() => {
                updateServiceWorker(true)
            }, 3000)
        }
        return () => {
            if (autoReloadTimer.current) clearTimeout(autoReloadTimer.current)
        }
    }, [needRefresh, updateServiceWorker])

    // Cleanup interval on unmount to prevent memory leak
    useEffect(() => {
        return () => {
            if (swRegRef.current?.__intervalId) {
                clearInterval(swRegRef.current.__intervalId)
            }
        }
    }, [])

    // Ключевой фикс для iOS PWA:
    // При открытии PWA с home screen iOS восстанавливает страницу из памяти
    // (resume), а не перезагружает её — SW не успевает проверить обновления.
    // visibilitychange срабатывает при каждом выходе приложения на передний план.
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && swRegRef.current) {
                swRegRef.current.update()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [])

    // NOTE: auto-reload removed — it was interrupting active user flows (login,
    // form submission) by reloading the page without warning. The banner already
    // provides a manual "Now" button; the user decides when to reload.

    return (
        <AnimatePresence>
            {needRefresh && (
                <motion.div
                    initial={{ y: 50, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 50, opacity: 0, scale: 0.9 }}
                    className="fixed bottom-24 left-4 right-4 z-[9999] p-5 bg-slate-900/90 text-white rounded-[32px] shadow-[0_20px_50px_rgba(37,99,235,0.3)] flex items-center justify-between gap-4 border border-white/10 backdrop-blur-xl"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-orange-400 to-orange-600 p-3 rounded-2xl shadow-lg">
                            <RefreshCw size={24} className={'animate-spin'} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-black tracking-tight leading-tight">
                                Update available!
                            </span>
                            <span className="text-[11px] opacity-70 font-bold uppercase tracking-widest mt-0.5">
                                Updating in 3 sec...
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => updateServiceWorker(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl text-xs font-black shadow-[0_4px_15px_rgba(37,99,235,0.4)] active:scale-95 transition-all hover:brightness-110"
                        >
                            Now
                        </button>
                        <button
                            onClick={() => setNeedRefresh(false)}
                            aria-label="Dismiss"
                            className="p-2.5 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors border border-white/5"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default ReloadPrompt
