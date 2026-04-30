import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * OfflineBanner — показывается когда пользователь теряет соединение.
 * Исчезает автоматически когда сеть восстанавливается.
 */
export const OfflineBanner = () => {
    const { t } = useTranslation('pwa')
    const [isOffline, setIsOffline] = useState(!navigator.onLine)

    useEffect(() => {
        const setOffline = () => setIsOffline(true)
        const setOnline  = () => setIsOffline(false)

        window.addEventListener('offline', setOffline)
        window.addEventListener('online',  setOnline)
        return () => {
            window.removeEventListener('offline', setOffline)
            window.removeEventListener('online',  setOnline)
        }
    }, [])

    return (
        <AnimatePresence>
            {isOffline && (
                <motion.div
                    key="offline-banner"
                    initial={{ y: -60, opacity: 0 }}
                    animate={{ y: 0,   opacity: 1 }}
                    exit={{   y: -60, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2.5"
                    style={{
                        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                        borderBottom: '1px solid rgba(249,115,22,0.3)',
                        paddingTop: 'calc(env(safe-area-inset-top) + 0.625rem)',
                    }}
                >
                    <WifiOff size={15} className="text-orange-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-200">
                        {t('offline')}
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
