/**
 * DinerCard — info card shown when a diner pin is tapped.
 *
 * Shows: avatar, name (first + last initial), venue, status, message,
 * contact info, distance, "Wave" button, "Report" link.
 *
 * Rendered as a Leaflet Popup or a bottom sheet (mobile).
 */
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Hand, Flag, Clock, Users, MapPin, MessageCircle, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { formatDistance } from '@/lib/geo'
import { useMutation } from '@tanstack/react-query'
import { ReportDinerModal } from './ReportDinerModal'

const STATUS_CONFIG = {
    looking:   { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', dot: 'bg-emerald-500' },
    eating:    { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 dark:bg-blue-500/20', dot: 'bg-blue-500' },
    heading_to: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 dark:bg-amber-500/20', dot: 'bg-amber-500' },
}

export function DinerCard({ diner, userLat, userLng, onWaveSent, isOwn, onDelete }) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const [showReport, setShowReport] = useState(false)

    const statusKey = diner.status || 'looking'
    const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.looking

    // Distance from user to diner's venue
    const distanceKm = diner._distance != null ? diner._distance / 1000 : null

    // Wave mutation
    const waveMutation = useMutation({
        mutationFn: async () => {
            const { waveAtDiner } = await import('../api/dinewithme.api')
            return waveAtDiner(diner.user_id, diner.venueName)
        },
        onSuccess: () => {
            onWaveSent?.()
        },
    })

    return (
        <div className={`
            w-[280px] rounded-2xl overflow-hidden
            ${isDark ? 'bg-[#1c1c1e] text-white' : 'bg-white text-gray-900'}
            shadow-xl
        `}>
            {/* Header: Avatar + Name + Status */}
            <div className="p-4 pb-3">
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={`
                        w-11 h-11 rounded-full overflow-hidden flex-shrink-0
                        border-2 ${isDark ? 'border-white/10' : 'border-gray-200'}
                    `}>
                        {diner.avatarUrl ? (
                            <img
                                src={diner.avatarUrl}
                                alt={diner.displayName}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none' }}
                            />
                        ) : (
                            <div className={`w-full h-full flex items-center justify-center ${statusCfg.bg} ${statusCfg.color} font-bold text-sm`}>
                                {diner.displayName?.[0] || '?'}
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold truncate">{diner.displayName}</h3>
                            {isOwn && (
                                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {t('dine.your_meetup', 'Your Meetup')}
                                </span>
                            )}
                        </div>
                        <div className={`flex items-center gap-1.5 mt-0.5`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                            <span className={`text-[11px] font-semibold ${statusCfg.color}`}>
                                {t(`dine.status_${statusKey}`)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Venue + Distance */}
            <div className={`px-4 pb-2 space-y-1.5`}>
                <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-blue-500 flex-shrink-0" />
                    <span className="text-xs font-semibold truncate">{diner.venueName}</span>
                    {distanceKm != null && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-auto flex-shrink-0">
                            {formatDistance(distanceKm)}
                        </span>
                    )}
                </div>

                {/* Arriving at */}
                {diner.arriving_at && (
                    <div className="flex items-center gap-2">
                        <Clock size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {new Date(diner.arriving_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                )}

                {/* Party size */}
                {diner.party_size > 1 && (
                    <div className="flex items-center gap-2">
                        <Users size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {t('dine.party_size')}: {diner.party_size}
                        </span>
                    </div>
                )}
            </div>

            {/* Message */}
            {diner.message && (
                <div className={`mx-4 mb-2 px-3 py-2 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex items-start gap-2">
                        <MessageCircle size={12} className="text-gray-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
                            {diner.message}
                        </p>
                    </div>
                </div>
            )}

            {/* Contact info */}
            {diner.contact_info && (
                <div className={`mx-4 mb-3 px-3 py-2 rounded-xl ${isDark ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-emerald-50 border border-emerald-100'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                        Contact
                    </p>
                    <p className="text-[11px] text-gray-700 dark:text-gray-300">
                        {diner.contact_info}
                    </p>
                </div>
            )}

            {/* Actions */}
            <div className={`px-4 pb-4 pt-1 flex items-center gap-2`}>
                {isOwn ? (
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onDelete?.()}
                        className={`
                            flex-1 flex items-center justify-center gap-1.5
                            py-2.5 rounded-xl text-xs font-bold transition-all
                            bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20
                        `}
                    >
                        <Trash2 size={14} />
                        {t('dine.delete_meetup', 'Delete Meetup')}
                    </motion.button>
                ) : (
                    <>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => waveMutation.mutate()}
                            disabled={waveMutation.isPending || waveMutation.isSuccess}
                            className={`
                                flex-1 flex items-center justify-center gap-1.5
                                py-2.5 rounded-xl text-xs font-bold transition-all
                                ${waveMutation.isSuccess
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
                                }
                            `}
                        >
                            {waveMutation.isSuccess ? (
                                t('dine.wave_sent')
                            ) : (
                                <>
                                    <Hand size={14} />
                                    {t('dine.wave_btn', 'Wave')}
                                </>
                            )}
                        </motion.button>

                        <button
                            onClick={() => setShowReport(true)}
                            className={`
                                p-2.5 rounded-xl text-xs transition-colors
                                ${isDark ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}
                            `}
                            title={t('dine.report_title')}
                        >
                            <Flag size={14} />
                        </button>
                    </>
                )}
            </div>

            {/* Error */}
            {waveMutation.isError && (
                <div className="px-4 pb-3">
                    <p className="text-[10px] text-red-500">
                        {waveMutation.error?.code === 'WAVE_RATE_LIMIT'
                            ? t('dine.wave_limit')
                            : waveMutation.error?.message || 'Error'}
                    </p>
                </div>
            )}

            {/* Report modal */}
            {showReport && (
                <ReportDinerModal
                    dinerId={diner.user_id}
                    dinerName={diner.displayName}
                    onClose={() => setShowReport(false)}
                />
            )}
        </div>
    )
}
