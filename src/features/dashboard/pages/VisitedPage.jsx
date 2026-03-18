import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Star, MapPin, ArrowRight, Compass, Clock } from 'lucide-react'
import { useUserPrefsStore } from '@/features/auth/hooks/useUserPrefsStore'
import { useLocationsStore } from '@/features/public/hooks/useLocationsStore'
import { useTheme } from '@/hooks/useTheme'

// ─── Visited card ─────────────────────────────────────────────────────────
function VisitedCard({ loc, index }) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.35, ease: 'easeOut' }}
        >
            <Link
                to={`/location/${loc.id}`}
                className={`group flex gap-4 p-4 rounded-2xl transition-all active:scale-[0.98] ${
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
                            <p className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                                {loc.cuisine} · {loc.category}
                            </p>
                        </div>

                        <div className="flex-shrink-0 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-xl">
                            <Star size={10} className="text-emerald-500 fill-emerald-500" />
                            <span className="text-[11px] font-black text-emerald-600">{loc.rating}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                        <span className={`text-[11px] font-bold ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                            {loc.priceLevel}
                        </span>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg ${
                            isDark ? 'bg-white/8 text-white/50' : 'bg-gray-100 text-gray-500'
                        }`}>
                            {loc.vibe}
                        </span>
                        {loc.openingHours && (
                            <span className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                                <Clock size={10} />
                                {loc.openingHours}
                            </span>
                        )}
                    </div>
                </div>
            </Link>
        </motion.div>
    )
}

// ─── Stats banner ─────────────────────────────────────────────────────────
function VisitedStats({ count, isDark }) {
    return (
        <div className={`flex items-center gap-4 p-4 rounded-2xl mb-6 ${
            isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-100'
        }`}>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle size={22} className="text-white" />
            </div>
            <div>
                <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {count} {count === 1 ? 'place' : 'places'}
                </p>
                <p className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    visited so far — keep exploring!
                </p>
            </div>
        </div>
    )
}

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyState({ isDark }) {
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
                No visits yet
            </h2>
            <p className={`text-sm font-medium leading-relaxed mb-8 max-w-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                Open a place and tap "Mark as Visited" to track your food journey.
            </p>

            <Link
                to="/explore"
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
            >
                <Compass size={16} />
                Start exploring
                <ArrowRight size={14} />
            </Link>
        </motion.div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────
const VisitedPage = () => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    const { prefs } = useUserPrefsStore()
    const { locations } = useLocationsStore()

    // lastVisited is an array of location IDs in order of visit
    const visitedLocations = (prefs.lastVisited ?? [])
        .map((id) => locations.find((loc) => loc.id === id))
        .filter(Boolean)

    return (
        <div className="w-full max-w-2xl mx-auto px-4 pb-32 pt-24 min-h-[100dvh] relative z-10">
            {/* Header */}
            <div className="mb-6">
                <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Visited
                </h1>
                {visitedLocations.length > 0 && (
                    <p className={`text-sm font-medium mt-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                        Your personal food diary
                    </p>
                )}
            </div>

            {visitedLocations.length === 0 ? (
                <EmptyState isDark={isDark} />
            ) : (
                <>
                    <VisitedStats count={visitedLocations.length} isDark={isDark} />
                    <div className="space-y-3">
                        {visitedLocations.map((loc, i) => (
                            <VisitedCard key={loc.id} loc={loc} index={i} />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export default VisitedPage
