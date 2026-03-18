import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Wifi } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * OfflineIndicator — thin banner that appears when the user loses connectivity.
 *
 * Shows a "Back online" message for 3 seconds after reconnecting, then hides.
 * Mounts invisibly on the top edge to avoid layout shift.
 */
export function OfflineIndicator() {
    const { t } = useTranslation()
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [showBackOnline, setShowBackOnline] = useState(false)

    useEffect(() => {
        let backOnlineTimer

        const handleOnline = () => {
            setIsOnline(true)
            setShowBackOnline(true)
            backOnlineTimer = setTimeout(() => setShowBackOnline(false), 3000)
        }

        const handleOffline = () => {
            setIsOnline(false)
            setShowBackOnline(false)
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            clearTimeout(backOnlineTimer)
        }
    }, [])

    const visible = !isOnline || showBackOnline

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-widest ${
                        isOnline
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-500 text-white'
                    }`}
                    role="status"
                    aria-live="polite"
                >
                    {isOnline ? (
                        <>
                            <Wifi size={13} />
                            {t('pwa.back_online')}
                        </>
                    ) : (
                        <>
                            <WifiOff size={13} />
                            {t('pwa.offline')}
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    )
}
