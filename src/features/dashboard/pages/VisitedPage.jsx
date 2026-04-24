import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Star, MapPin, ArrowRight, Compass, Clock, Trash2 } from 'lucide-react'
import { useUserVisitsWithLocations, useDeleteVisitMutation } from '@/shared/api/queries'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'

// ─── Visited card ─────────────────────────────────────────────────────────
function VisitedCard({ visit, index, onDelete }) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const loc = visit.locations
    // VISIT-1 FIX: Null Pointer — location deleted from DB (LEFT JOIN returns null)
    if (!loc) return null

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.35, ease: 'easeOut' }}
        >
            <Link
                to={`/location/${loc.id}`}
                className={`group relative flex gap-4 p-4 rounded-2xl transition-all active:scale-[0.98] ${
                    isDark
                        ? 'bg-white/5 border border-white/10 hover:bg-white/8'
                        : 'bg-white border border-gray-100 hover:shadow-md'
                }`}
            >
                {/* Image with visited badge */}
                <div className="flex-shrink-0 relative">
                    <div className="w-20 h-20 rounded-xl overflow-hidden">
                        <img
                            src={loc.image}
                            alt={loc.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 grayscale-[20%]"
                        />
                    </div>
                    {/* Visited checkmark overlay */}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-gray-900">
                        <CheckCircle size={12} className="text-white fill-white" />
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className={`text-sm font-black truncate leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {loc.title}
                            </h3>
                            <p className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-500 dark:text-gray-400'}`}>
                                {loc.category}
                            </p>
                        </div>

                        <div className="flex-shrink-0 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-xl">
                            <Star size={10} className="text-emerald-500 fill-emerald-500" />
                            <span className="text-[11px] font-black text-emerald-600">{visit.rating || loc.google_rating || loc.rating}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                        <span className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-white/30' : 'text-gray-500 dark:text-gray-400'}`}>
                            <Clock size={10} />
                            {visit.visited_at ? new Date(visit.visited_at).toLocaleDateString() : '—'}
                        </span>
                        {visit.review_text && (
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg line-clamp-1 ${
                                isDark ? 'bg-white/8 text-white/50' : 'bg-gray-100 text-gray-500'
                            }`}>
                                {visit.review_text}
                            </span>
                        )}
                    </div>
                </div>

                {/* Delete button */}
                <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(visit.id) }}
                    className={`absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full transition-colors active:scale-90 ${
                        isDark ? 'bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400' : 'bg-gray-100 hover:bg-red-50 text-gray-500 dark:text-gray-400 hover:text-red-500'
                    }`}
                    aria-label="Delete visit"
                >
                    <Trash2 size={14} />
                </button>
            </Link>
        </motion.div>
    )
}

// ─── Stats banner ─────────────────────────────────────────────────────────
function VisitedStats({ count, isDark }) {
    const { t } = useTranslation()
    return (
        <div className={`flex items-center gap-4 p-4 rounded-2xl mb-6 ${
            isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-100'
        }`}>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle size={22} className="text-white" />
            </div>
            <div>
                <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t(count === 1 ? 'visited.count_one' : 'visited.count_other', { count })}
                </p>
            </div>
        </div>
    )
}

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyState({ isDark }) {
    const { t } = useTranslation()
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center text-center py-24 px-6"
        >
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl scale-150" />
                <div className={`relative w-24 h-24 rounded-[32px] flex items-center justify-center ${
                    isDark ? 'bg-white/5 border border-white/10' : 'bg-emerald-50 border border-emerald-100'
                }`}>
                    <MapPin size={40} className="text-emerald-400" />
                </div>
            </div>

            <h2 className={`text-2xl font-black tracking-tight mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('visited.empty_title')}
            </h2>
            <p className={`text-sm font-medium leading-relaxed mb-8 max-w-xs ${isDark ? 'text-white/40' : 'text-gray-500 dark:text-gray-400'}`}>
                {t('visited.empty_desc')}
            </p>

            <Link
                to="/explore"
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
            >
                <Compass size={16} />
                {t('visited.start_cta')}
                <ArrowRight size={14} />
            </Link>
        </motion.div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────
const VisitedPage = () => {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const { user } = useAuthStore()
    const { data: visits = [], isLoading } = useUserVisitsWithLocations(user?.id)
    const deleteVisitMutation = useDeleteVisitMutation()

    const handleDelete = (visitId) => {
        deleteVisitMutation.mutate({ visitId, userId: user.id })
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="w-full max-w-2xl mx-auto px-4 pb-32 min-h-[100dvh] relative z-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 5rem)' }}>
                <div className="mb-6">
                    <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {t('visited.title')}
                    </h1>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={`flex gap-4 p-4 rounded-2xl ${
                                isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100'
                            }`}
                        >
                            <div className={`w-20 h-20 rounded-xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
                            <div className="flex-1 space-y-2">
                                <div className={`h-4 w-32 rounded animate-pulse ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
                                <div className={`h-3 w-20 rounded animate-pulse ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-2xl mx-auto px-4 pb-32 min-h-[100dvh] relative z-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 5rem)' }}>
            {/* Header */}
            <div className="mb-6">
                <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t('visited.title')}
                </h1>
                {visits.length > 0 && (
                    <p className={`text-sm font-medium mt-1 ${isDark ? 'text-white/40' : 'text-gray-500 dark:text-gray-400'}`}>
                        {t('visited.diary')}
                    </p>
                )}
            </div>

            {visits.length === 0 ? (
                <EmptyState isDark={isDark} />
            ) : (
                <>
                    <VisitedStats count={visits.length} isDark={isDark} />
                    <div className="space-y-3">
                        {visits.map((visit, i) => (
                            <VisitedCard key={visit.id} visit={visit} index={i} onDelete={handleDelete} />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export default VisitedPage
