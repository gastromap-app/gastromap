import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
    Users, MapPin, CreditCard, TrendingUp,
    ArrowUpRight, Calendar, Star, Activity, Eye,
    MessageSquare, Utensils, BarChart3, Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'
import AdminPageHeader from '../components/AdminPageHeader'
import {
    useCategoryStats, useTopLocations,
    useEngagementStats, usePaymentStats, useAdminStats,
    useCityStats, useReviewsTimeline, useUserGrowth,
} from '@/shared/api/queries'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n, fallback = '—') => (n == null ? fallback : Number(n).toLocaleString())
// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ className }) => (
    <div className={cn('animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl', className)} />
)

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon, color = 'indigo', delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay * 0.1 }}
        className="bg-white dark:bg-slate-900 p-4 lg:p-6 rounded-[20px] lg:rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/20 transition-colors"
    >
        <div className={cn(
            'absolute -top-4 -right-4 w-24 h-24 rounded-full blur-[50px] opacity-10 group-hover:opacity-20 transition-opacity',
            color === 'indigo' ? 'bg-indigo-500' : color === 'emerald' ? 'bg-emerald-500' : color === 'amber' ? 'bg-amber-500' : 'bg-orange-500'
        )} />
        <div className="flex justify-between items-start mb-4 relative z-10">
            <div className={cn(
                'p-2.5 rounded-xl shadow-inner',
                color === 'indigo' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    : color === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : color === 'amber' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
            )}>
                <Icon size={20} />
            </div>
        </div>
        <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1">{label}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{value}</h3>
            {sub && <p className="text-[11px] text-slate-400 mt-1 font-medium">{sub}</p>}
        </div>
    </motion.div>
)

// ─── Mini Bar Chart ────────────────────────────────────────────────────────────
const MiniBarChart = ({ data, valueKey, labelKey, colorClass = 'bg-indigo-500', maxBars = 7 }) => {
    const visible = data.slice(-maxBars)
    const max = Math.max(...visible.map(d => d[valueKey] || 0), 1)
    return (
        <div className="flex items-end gap-1 h-16 w-full">
            {visible.map((d, i) => {
                const pct = ((d[valueKey] || 0) / max) * 100
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-900 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap z-10">
                            {d[labelKey]}: {d[valueKey]}
                        </div>
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(pct, 4)}%` }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                            className={cn('w-full rounded-t-md', colorClass, pct === 0 ? 'opacity-20' : '')}
                            style={{ minHeight: '3px' }}
                        />
                    </div>
                )
            })}
        </div>
    )
}

// ─── AdminStatsPage ───────────────────────────────────────────────────────────
const AdminStatsPage = () => {
    const [period, setPeriod] = useState(30)

    const { data: adminStats = {}, isLoading: loadingStats } = useAdminStats()
    const { data: topLocations = [], isLoading: loadingTop } = useTopLocations(8)
    const { data: engagement = {}, isLoading: loadingEng } = useEngagementStats()
    usePaymentStats()
    const { data: categoryStats = [], isLoading: loadingCats } = useCategoryStats()
    const { data: cityStats = [], isLoading: loadingCities } = useCityStats()
    const { data: reviewsTimeline = [], isLoading: loadingRev } = useReviewsTimeline(period)
    const { data: userGrowth = [], isLoading: loadingGrowth } = useUserGrowth(period)

    const isLoading = loadingStats || loadingEng

    const mainStats = [
        {
            label: 'Локации',
            value: fmt(adminStats?.locations?.total),
            sub: adminStats?.locations?.pending ? `${adminStats.locations.pending} на модерации` : 'Все активны',
            icon: MapPin, color: 'indigo',
        },
        {
            label: 'Пользователи',
            value: fmt(adminStats?.users?.total),
            sub: adminStats?.users?.this_month ? `+${adminStats.users.this_month} за месяц` : null,
            icon: Users, color: 'emerald',
        },
        {
            label: 'Отзывы',
            value: fmt(engagement?.total_reviews),
            sub: engagement?.pending_reviews ? `${engagement.pending_reviews} ожидают` : 'Все проверены',
            icon: MessageSquare, color: 'amber',
        },
        {
            label: 'Средний рейтинг',
            value: engagement?.avg_rating ? `${engagement.avg_rating} ★` : '—',
            sub: `из ${fmt(engagement?.approved_reviews)} одобренных отзывов`,
            icon: Star, color: 'orange',
        },
    ]

    const maxTopScore = topLocations.length > 0
        ? Math.max(...topLocations.map(l => (l.review_count || 0) + (l.visit_count || 0) + 1))
        : 1

    return (
        <div className="space-y-6 lg:space-y-8 pb-10 font-sans">

            {/* Header */}
            <AdminPageHeader
                eyebrow="Admin"
                title="Аналитика"
                subtitle="Данные из Supabase в реальном времени."
                actions={
                    <div className="flex gap-1.5">
                        {[7, 30, 90].map(d => (
                            <button key={d} onClick={() => setPeriod(d)}
                                className={cn(
                                    'h-9 px-3 rounded-[12px] text-[10px] font-bold uppercase tracking-widest transition-all',
                                    period === d
                                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                                        : 'bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                                )}
                            >{d}д</button>
                        ))}
                    </div>
                }
            />

            {/* Main Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
                {isLoading
                    ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-[20px]" />)
                    : mainStats.map((s, i) => <StatCard key={i} {...s} delay={i} />)
                }
            </div>

            {/* Middle: Top Locations + Engagement breakdown */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Top Locations */}
                <div className="xl:col-span-2 bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Топ локаций</h2>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">по отзывам + посещениям</span>
                    </div>

                    {loadingTop ? (
                        <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                    ) : topLocations.length === 0 ? (
                        <div className="py-10 text-center text-slate-400">
                            <MapPin size={28} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Нет активных локаций</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {topLocations.map((loc, i) => {
                                const score = (loc.review_count || 0) + (loc.visit_count || 0)
                                const pct = maxTopScore > 0 ? (score / maxTopScore) * 100 : 0
                                return (
                                    <div key={loc.id || i}>
                                        <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-slate-300 dark:text-slate-600 shrink-0">#{i + 1}</span>
                                                <span className="text-slate-700 dark:text-slate-300 truncate">{loc.title}</span>
                                                <span className="text-[10px] text-slate-400 font-normal shrink-0">{loc.city}</span>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0 ml-2">
                                                {(loc.google_rating ?? loc.rating) > 0 && (
                                                     <span className="flex items-center gap-0.5 text-amber-500">
                                                         <Star size={10} className="fill-current" /> {loc.google_rating ?? loc.rating}
                                                     </span>
                                                 )}
                                                <span className="text-indigo-500">{fmt(score)}</span>
                                            </div>
                                        </div>
                                        <div className="h-2 bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.max(pct, 2)}%` }}
                                                transition={{ duration: 0.8, delay: 0.2 + i * 0.08 }}
                                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Engagement Panel */}
                <div className="bg-white dark:bg-slate-900/50 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800/50 shadow-sm space-y-3">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Активность</h2>

                    {loadingEng ? (
                        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
                    ) : (
                        [
                            { label: 'Посещения', value: fmt(engagement?.total_visits), icon: Eye, color: 'bg-indigo-500/10 text-indigo-500' },
                            { label: 'Уникальных', value: fmt(engagement?.unique_visitors), icon: Users, color: 'bg-blue-500/10 text-blue-500' },
                            { label: 'Отзывы', value: fmt(engagement?.total_reviews), icon: MessageSquare, color: 'bg-amber-500/10 text-amber-500' },
                            { label: 'Ожидают модерации', value: fmt(engagement?.pending_reviews), icon: Activity, color: 'bg-orange-500/10 text-orange-500' },
                            { label: 'Одобрено', value: fmt(engagement?.approved_reviews), icon: Star, color: 'bg-emerald-500/10 text-emerald-500' },
                        ].map(({ label, value, icon: Icon, color }, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-[16px] bg-slate-50 dark:bg-slate-800/30">
                                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', color)}>
                                    <Icon size={15} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{label}</p>
                                    <p className="text-base font-bold text-slate-900 dark:text-white">{value}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Bottom: Categories + Cities + Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Categories */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-5">
                        <Utensils size={15} className="text-indigo-400" />
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">По категориям</h2>
                    </div>
                    {loadingCats ? (
                        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                    ) : (
                        <div className="space-y-3">
                            {(Array.isArray(categoryStats) ? categoryStats : []).slice(0, 8).map((cat, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                                        <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{cat.category}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {cat.avg_rating && (
                                            <span className="text-[10px] text-amber-500">★{cat.avg_rating}</span>
                                        )}
                                        <span className="text-xs font-bold text-slate-900 dark:text-white">{cat.total}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Cities */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-5">
                        <Globe size={15} className="text-emerald-400" />
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">По городам</h2>
                    </div>
                    {loadingCities ? (
                        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                    ) : (
                        <div className="space-y-3">
                            {(Array.isArray(cityStats) ? cityStats : []).map((city, i) => {
                                const maxCity = Math.max(...(Array.isArray(cityStats) ? cityStats : []).map(c => c.total), 1)
                                const pct = (city.total / maxCity) * 100
                                return (
                                    <div key={i}>
                                        <div className="flex justify-between items-center text-xs mb-1">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">{city.city}</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{city.total}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.6, delay: i * 0.1 }}
                                                className="h-full bg-emerald-400 rounded-full"
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Reviews Timeline */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 size={15} className="text-amber-400" />
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Отзывы за {period}д</h2>
                    </div>
                    <p className="text-[10px] text-slate-400 mb-5">Ежедневная динамика</p>
                    {loadingRev ? (
                        <Skeleton className="h-20" />
                    ) : reviewsTimeline.length === 0 ? (
                        <div className="h-16 flex items-center justify-center text-slate-300 text-xs">Нет отзывов за период</div>
                    ) : (
                        <MiniBarChart data={reviewsTimeline} valueKey="review_count" labelKey="day" colorClass="bg-amber-400" />
                    )}

                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] text-slate-400 mb-3">Новые пользователи</p>
                        {loadingGrowth ? (
                            <Skeleton className="h-16" />
                        ) : userGrowth.length === 0 ? (
                            <div className="h-10 flex items-center justify-center text-slate-300 text-xs">Нет данных</div>
                        ) : (
                            <MiniBarChart data={userGrowth} valueKey="new_users" labelKey="day" colorClass="bg-indigo-400" />
                        )}
                    </div>
                </div>
            </div>

            {/* Users breakdown */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                    <Users size={15} className="text-indigo-400" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Пользователи</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Всего', value: fmt(engagement?.total_users), color: 'text-indigo-500' },
                        { label: 'Обычных', value: fmt(engagement?.regular_users), color: 'text-slate-500' },
                        { label: 'Модераторы', value: fmt(engagement?.moderator_users), color: 'text-emerald-500' },
                        { label: 'Администраторы', value: fmt(engagement?.admin_users), color: 'text-orange-500' },
                    ].map(({ label, value, color }, i) => (
                        <div key={i} className="p-4 rounded-[18px] bg-slate-50 dark:bg-slate-800/30 text-center">
                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1">{label}</p>
                            <p className={cn('text-2xl font-bold', color)}>{value}</p>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    )
}

export default AdminStatsPage
