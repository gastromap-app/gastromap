/**
 * ReportDinerModal — report a diner for safety concerns.
 *
 * Options: harassment, spam, inappropriate, other
 * With optional details textarea.
 */
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag, X, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { useMutation } from '@tanstack/react-query'

const REASONS = ['harassment', 'spam', 'inappropriate', 'other']

export function ReportDinerModal({ dinerId, dinerName, onClose }) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const [reason, setReason] = useState('')
    const [details, setDetails] = useState('')
    const [submitted, setSubmitted] = useState(false)

    const reportMutation = useMutation({
        mutationFn: async () => {
            const { reportDiner } = await import('../api/dinewithme.api')
            return reportDiner({ reportedId: dinerId, reason, details })
        },
        onSuccess: () => {
            setSubmitted(true)
            setTimeout(onClose, 2000)
        },
    })

    const canSubmit = reason && !reportMutation.isPending

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60" onClick={onClose} />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className={`
                        relative w-full max-w-sm
                        rounded-2xl overflow-hidden p-6
                        ${isDark ? 'bg-[#1c1c1e] text-white' : 'bg-white text-gray-900'}
                        shadow-2xl
                    `}
                >
                    {submitted ? (
                        <div className="text-center py-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                                <Check className="w-6 h-6 text-emerald-500" />
                            </div>
                            <p className="text-sm font-medium">{t('dine.report_success')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                        <Flag className="w-5 h-5 text-red-500" />
                                    </div>
                                    <h3 className="text-sm font-bold">{t('dine.report_title')}</h3>
                                </div>
                                <button
                                    onClick={onClose}
                                    className={`p-1.5 rounded-lg ${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-400 hover:bg-gray-100'}`}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('dine.report_about', { name: dinerName })}
                            </p>

                            {/* Reason selection */}
                            <div className="space-y-2 mb-4">
                                {REASONS.map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setReason(r)}
                                        className={`
                                            w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all
                                            ${reason === r
                                                ? isDark
                                                    ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                                                    : 'bg-red-50 border border-red-200 text-red-600'
                                                : isDark
                                                    ? 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                                                    : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                                            }
                                        `}
                                    >
                                        {t(`dine.report_reason_${r}`)}
                                    </button>
                                ))}
                            </div>

                            {/* Details */}
                            <textarea
                                value={details}
                                onChange={e => setDetails(e.target.value.slice(0, 500))}
                                placeholder={t('dine.report_details_placeholder')}
                                rows={2}
                                className={`
                                    w-full px-4 py-3 rounded-xl text-sm resize-none mb-4
                                    ${isDark
                                        ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-red-500/50'
                                        : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-red-500'
                                    }
                                    outline-none transition-colors
                                `}
                            />

                            {/* Submit */}
                            <button
                                onClick={() => reportMutation.mutate()}
                                disabled={!canSubmit}
                                className={`
                                    w-full py-3 rounded-xl text-sm font-bold transition-all
                                    ${canSubmit
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : isDark ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }
                                `}
                            >
                                {t('dine.report_submit')}
                            </button>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    )
}
