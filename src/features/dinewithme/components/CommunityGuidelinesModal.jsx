/**
 * CommunityGuidelinesModal — first-time safety acknowledgment.
 * Shown when a user activates Dine With Me for the first time.
 * Must be acknowledged before proceeding to PresenceSetupSheet.
 */
import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Eye, Clock, Flag, Heart, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'

const GUIDELINES = [
    { icon: Eye, key: 'privacy' },
    { icon: Clock, key: 'auto_expire' },
    { icon: Heart, key: 'respectful' },
    { icon: Shield, key: 'venue_only' },
    { icon: Flag, key: 'report' },
]

export function CommunityGuidelinesModal({ isOpen, onAccept, onClose }) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    if (!isOpen) return null

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-end md:items-center justify-center"
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

                {/* Modal */}
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className={`
                        relative w-full max-w-md mx-4 mb-4 md:mb-0
                        rounded-3xl overflow-hidden
                        bg-white/[0.08] dark:bg-white/[0.05]
                        backdrop-blur-2xl
                        border border-white/20 dark:border-white/10
                        text-gray-900 dark:text-white
                        shadow-2xl
                    `}
                >
                    {/* Header */}
                    <div className="relative px-6 pt-6 pb-4">
                        <button
                            onClick={onClose}
                            className={`
                                absolute top-4 right-4 p-2 rounded-xl
                                ${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-400 hover:bg-gray-100'}
                            `}
                        >
                            <X size={18} />
                        </button>

                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                            <Shield className="w-6 h-6 text-emerald-500" />
                        </div>

                        <h2 className="text-lg font-bold">{t('dine.guidelines_title')}</h2>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('dine.guidelines_subtitle')}
                        </p>
                    </div>

                    {/* Guidelines list */}
                    <div className="px-6 pb-4 space-y-3">
                        {GUIDELINES.map(({ icon: Icon, key }) => (
                            <div
                                key={key}
                                className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}
                            >
                                <Icon size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {t(`dine.guideline_${key}`)}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Accept button */}
                    <div className="px-6 pb-6 pt-2">
                        <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={onAccept}
                            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors shadow-lg shadow-emerald-500/30"
                        >
                            {t('dine.guidelines_accept')}
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    )
}
