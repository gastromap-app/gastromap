import React from 'react'
import LocationImage from '@/components/ui/LocationImage'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, Star, MapPin, ArrowRight, Compass } from 'lucide-react'
import { useSavedLocations } from '@/hooks/useSavedLocations'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'

// ─── Location card (compact horizontal) ──────────────────────────────────
function SavedCard({ favorite, index, onRemove }) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const loc = favorite.locations
    // SAVED-1 FIX: Null Pointer — location may have been deleted from DB (JOIN returns null)
    if (!loc) return null

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.35, ease: 'easeOut' }}
            className={`group relative flex gap-4 p-4 rounded-2xl transition-all active:scale-[0.98] ${
                isDark
                    ? 'bg-white/5 border border-white/10 hover:bg-white/8'
                    : 'bg-white border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_10px_rgba(15,23,42,0.05)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.06),0_10px_30px_rgba(15,23,42,0.08)]'
            }`}
        >
            {/* Image */}
            <Link to={`/location/${loc.id}`} className="flex-shrink-0">
                <div className="w-20 h-20 rounded-xl overflow-hidden">
                    <LocationImage
    src={loc.image}
    alt={loc.title}
    width={200}
    className="transition-transform duration-500 group-hover:scale-110"
/>
                </div>
            </Link>

            {/* Info */}
            <Link to={`/location/${loc.id}`} className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h3 className={`text-sm font-black truncate leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {loc.title}
                        </h3>
                        <p className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-white/50' : 'text-gray-600'}`}>
                            {loc.cuisine} · {loc.category}
                        </p>
                    </div>

                    {/* Rating pill */}
                    <div className="flex-shrink-0 flex items-center gap-1 bg-blue-600/10 px-2 py-1 rounded-xl">
                        <Star size={10} className="text-blue-600 fill-blue-600" />
                        <span className="text-[11px] font-black text-blue-600">{loc.google_rating ?? loc.rating}</span>
                    </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 mt-2">
                    {loc.price_range && (
                        <span className={`text-[11px] font-bold ${isDark ? 'text-white/40' : 'text-gray-600'}`}>
                            {loc.price_range}
                        </span>
                    )}
                    {(loc.special_labels?.[0] || loc.vibe) && (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg ${
                            isDark ? 'bg-white/8 text-white/60' : 'bg-slate-100 text-slate-700'
                        }`}>
                            {loc.special_labels?.[0] || loc.vibe}
                        </span>
                    )}
                </div>
            </Link>

            {/* Unsave button */}
            <button
                onClick={(e) => { e.stopPropagation(); onRemove(loc.id) }}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500/20 transition-colors active:scale-90"
                aria-label="Remove from saved"
            >
                <Heart size={14} className="text-red-500 fill-red-500" />
            </button>
        </motion.div>
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
            {/* Icon with glow */}
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl scale-150" />
                <div className={`relative w-24 h-24 rounded-[32px] flex items-center justify-center ${
                    isDark ? 'bg-white/5 border border-white/10' : 'bg-red-50 border border-red-100'
                }`}>
                    <Heart size={40} className="text-red-400" />
                </div>
            </div>

            <h2 className={`text-2xl font-black tracking-tight mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('saved.empty_title')}
            </h2>
            <p className={`text-sm font-medium leading-relaxed mb-8 max-w-xs ${isDark ? 'text-white/50' : 'text-slate-600'}`}>
                {t('saved.empty_desc')}
            </p>

            <Link
                to="/explore"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-500/25"
            >
                <Compass size={16} />
                {t('saved.explore_cta')}
                <ArrowRight size={14} />
            </Link>
        </motion.div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────
const SavedPage = () => {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const { favorites, isLoading, remove } = useSavedLocations()

    return (
        <div className="w-full max-w-2xl mx-auto px-4 pb-32 min-h-[100dvh] relative z-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 5rem)' }}>
            {/* Header */}
            <div className="mb-6">
                <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t('saved.title')}
                </h1>
                {isLoading && (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className={`flex gap-4 p-4 rounded-2xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                                <div className={`w-20 h-20 rounded-xl flex-shrink-0 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                                <div className="flex-1 space-y-2 py-1">
                                    <div className={`h-4 rounded w-3/4 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                                    <div className={`h-3 rounded w-1/2 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                                    <div className={`h-3 rounded w-1/4 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {!isLoading && favorites.length > 0 && (
                    <p className={`text-sm font-medium mt-1 ${isDark ? 'text-white/50' : 'text-slate-600'}`}>
                        {t('saved.places_saved', { count: favorites.length })}
                    </p>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-24">
                    <div className={`w-8 h-8 border-2 border-t-blue-600 rounded-full animate-spin ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
                </div>
            ) : favorites.length === 0 ? (
                <EmptyState isDark={isDark} />
            ) : (
                <div className="space-y-3">
                    {favorites.map((favorite, i) => (
                        <SavedCard
                            key={favorite.location_id}
                            favorite={favorite}
                            index={i}
                            onRemove={remove}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default SavedPage
