import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Sparkles, Share } from 'lucide-react'
import { usePWA } from '@/hooks/usePWA'
import { useTranslation } from 'react-i18next'

/**
 * InstallPrompt — smart PWA install banner.
 *
 * Shows after the 3rd app session (counted in sessionStorage so it resets
 * per browser tab, but localStorage tracks total sessions across tabs).
 * Disappears permanently once dismissed or installed.
 */
export function InstallPrompt() {
    const { t } = useTranslation()
    const { isInstallable, isInstalled, installPWA } = usePWA()
    const [visible, setVisible] = useState(false)
    const [isDismissed, setIsDismissed] = useState(false)
    const [isIOS, setIsIOS] = useState(false)

    useEffect(() => {
        // Detect iOS Safari (no beforeinstallprompt, needs manual instruction)
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsIOS(ios)

        // Don't show if already installed
        if (isInstalled) return

        // Track session count in localStorage
        const dismissed = localStorage.getItem('pwa-install-dismissed')
        if (dismissed) return

        const sessions = parseInt(localStorage.getItem('pwa-sessions') ?? '0', 10) + 1
        localStorage.setItem('pwa-sessions', String(sessions))

        // Show after 2nd session (sessions >= 2)
        if (sessions >= 2 && (isInstallable || ios)) {
            const timer = setTimeout(() => setVisible(true), 3000)
            return () => clearTimeout(timer)
        }
    }, [isInstallable, isInstalled])

    const handleInstall = async () => {
        if (!isIOS) {
            await installPWA()
        }
        // iOS: user follows the manual steps shown in the banner
        setVisible(false)
    }

    const handleDismiss = () => {
        setVisible(false)
        setIsDismissed(true)
        localStorage.setItem('pwa-install-dismissed', '1')
    }

    return (
        <AnimatePresence>
            {visible && !isDismissed && (
                <motion.div
                    initial={{ y: 80, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 80, opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                    className="fixed bottom-24 left-4 right-4 z-[9998] md:left-auto md:right-6 md:w-[360px]"
                >
                    <div className="bg-[#0A0A0A]/95 backdrop-blur-2xl border border-white/10 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
                        {/* Gradient top accent */}
                        <div className="h-[2px] bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-600" />

                        <div className="p-5">
                            <div className="flex items-start gap-4">
                                {/* App icon */}
                                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/20">
                                    <Sparkles size={24} className="text-white" />
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-white text-[15px] leading-tight tracking-tight">
                                        {t('pwa.install_title')}
                                    </h3>
                                    <p className="text-white/40 text-[12px] font-light mt-1.5 leading-relaxed">
                                        {isIOS
                                            ? t('pwa.install_ios')
                                            : t('pwa.install_desc')}
                                    </p>
                                </div>

                                {/* Dismiss */}
                                <button
                                    onClick={handleDismiss}
                                    className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                                    aria-label="Dismiss"
                                >
                                    <X size={14} className="text-white/40" />
                                </button>
                            </div>

                            {/* iOS instruction */}
                            {isIOS && (
                                <div className="mt-4 flex items-center gap-3 bg-white/[0.04] rounded-xl p-3.5 border border-white/[0.08]">
                                    <Share size={16} className="text-blue-400 flex-shrink-0" />
                                    <p className="text-[12px] text-white/50 font-light leading-relaxed">
                                        Tap <span className="text-white font-medium">Share</span> in the menu bar below, then{' '}
                                        <span className="text-white font-medium">Add to Home Screen</span>
                                    </p>
                                </div>
                            )}

                            {/* CTA buttons */}
                            {!isIOS && (
                                <div className="mt-4 flex gap-2">
                                    <button
                                        onClick={handleInstall}
                                        className="flex-1 flex items-center justify-center gap-2 bg-white text-black font-medium text-[12px] py-3 rounded-xl transition-all active:scale-95 hover:bg-white/90"
                                    >
                                        <Download size={14} />
                                        {t('pwa.install_btn')}
                                    </button>
                                    <button
                                        onClick={handleDismiss}
                                        className="px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white/40 text-[12px] font-medium transition-colors border border-white/[0.08]"
                                    >
                                        {t('pwa.later')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
