import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { WifiOff, Wifi } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * OfflineIndicator — thin banner that appears when the user loses connectivity.
 * Shows a "Back online" message for 3 seconds after reconnecting, then hides.
 * Respects OS reduced-motion setting via useReducedMotion().
 */
export function OfflineIndicator() {
    const { t } = useTranslation()
    const shouldReduceMotion = useReducedMotion()
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [showBackOnline, setShowBackOnline] = useState(false)

    useEffect(() => {
        let timer
        const handleOnline = () => {
            setIsOnline(true)
            setShowBackOnline(true)
            timer = setTimeout(() => setShowBackOnline(false), 3000)
        }
        const handleOffline = () => {
            setIsOnline(false)
            setShowBackOnline(false)
        }
        window.addEventListener('online',  handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
            window.removeEventListener('online',  handleOnline)
            window.removeEventListener('offline', handleOffline)
            clearTimeout(timer)
        }
    }, [])

    const visible = !isOnline || showBackOnline

    // GPU-friendly: only opacity + transform, no layout shifts
    const springTransition = shouldReduceMotion
        ? { duration: 0.15 }
        : { type: 'spring', stiffness: 450, damping: 32, mass: 0.6 }

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="offline-indicator"
                    initial={{ y: -44, opacity: 0 }}
                    animate={{ y: 0,    opacity: 1 }}
                    exit={{   y: -44,  opacity: 0 }}
                    transition={springTransition}
                    style={{ willChange: 'transform, opacity' }}
                    className={[
                        'fixed top-0 left-0 right-0 z-[9999]',
                        'flex items-center justify-center gap-2 py-2',
                        'text-xs font-black uppercase tracking-widest',
                        isOnline ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white',
                    ].join(' ')}
                    role="status"
                    aria-live="polite"
                >
                    {isOnline ? (
                        <><Wifi size={13} />{t('pwa.back_online')}</>
                    ) : (
                        <><WifiOff size={13} />{t('pwa.offline')}</>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    )
}
