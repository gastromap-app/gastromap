import React from 'react'
import { motion } from 'framer-motion'
import {
    Users, MapPin, CreditCard, TrendingUp,
    ArrowUpRight, Calendar, Filter, Download,
    MousePointer2, Clock, Star, Activity, Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    useCategoryStats, useTopLocations,
    useEngagementStats, usePaymentStats, useAdminStats,
} from '@/shared/api/queries'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n, fallback = '—') => (n == null ? fallback : Number(n).toLocaleString())
const fmtMoney = (n, fallback = '—') =>
    n == null ? fallback : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, change, isPositive, icon: Icon, color, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay * 0.1 }}
        className="bg-white dark:bg-slate-900 p-4 lg:p-6 rounded-[20px] lg:rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/10 transition-colors"
    >
        <div className={cn(
            'absolute -top-4 -right-4 w-20 lg:w-32 h-20 lg:h-32 rounded-full blur-[40px] lg:blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity',
            color === 'indigo' ? 'bg-indigo-500' : color === 'emerald' ? 'bg-emerald-500' : 'bg-orange-500'
        )} />

        <div className="flex justify-between items-start mb-4 lg:mb-6 relative z-10">
            <div className={cn(
                'p-2.5 lg:p-3 rounded-xl lg:rounded-[18px] shadow-inner',
                color === 'indigo' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    : color === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
            )}>
                <Icon size={20} className="lg:w-6 lg:h-6" />
            </div>
            {change != null && (
                <div className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider',
                    isPositive ? 'bg-green-50 dark:bg-green-500/10 text-green-600' : 'bg-red-50 dark:bg-red-500/10 text-red-600'
                )}>
                    <ArrowUpRight size={12} className={isPositive ? '' : 'rotate-180'} />
                    {change}
                </div>
            )}
        </div>

        <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-0.5 lg:mb-1">{label}</p>
            <h3 className="text-lg lg:text-2xl font-bold text-slate-900 dark:text-white leading-tight truncate">{value}</h3>
        </div>
    </motion.div>
)

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = ({ className }) => (
    <div className={cn('animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl', className)} />
)

// ─── AdminStatsPage ───────────────────────────────────────────────────────────

const AdminStatsPage = () => {
    const { data: stats = {}, isLoading: loadingStats } = useAdminStats()
    const { data: topLocations = [], isLoading: loadingTop } = useTopLocations(5)
    const { data: engagement = {}, isLoading: loadingEngagement } = useEngagementStats()
    const { data: payments = {}, isLoading: loadingPayments } = usePaymentStats()
    const { data: categoryStats = {} } = useCategoryStats()

    const isLoading = loadingStats || loadingTop || loadingEngagement || loadingPayments

    // Real stats from DB
    const mainStats = [
        {
            label: 'Пользователи',
            value: fmt(stats?.users?.total),
            change: stats?.users?.this_month ? `+${fmt(stats.users.this_month)} за месяц` : null,
            isPositive: true,
            icon: Users,
            color: 'indigo',
        },
        {
            label: 'Локации',
            value: fmt(stats?.locations?.published),
            change: stats?.locations?.pending ? `${fmt(stats.locations.pending)} на модерации` : null,
            isPositive: true,
            icon: MapPin,
            color: 'indigo',
        },
        {
            label: 'Выручка',
            value: fmtMoney(payments?.total_revenue),
            change: payments?.this_month_revenue != null ? `${fmtMoney(payments.this_month_revenue)} за месяц` : null,
            isPositive: true,
            icon: CreditCard,
            color: 'emerald',
        },
        {
            label: 'Активных подписок',
            value: fmt(payments?.active_subscriptions),
            change: null,
            isPositive: true,
            icon: TrendingUp,
            color: 'orange',
        },
    ]

    // Build city bars from locations categories or engagement if available
    const maxVisits = topLocations.length > 0
        ? Math.max(...topLocations.map(l => l.review_count || l.visit_count || 1))
        : 1

    return (
        <div className="space-y-6 lg:space-y-8 pb-10 font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-5">
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white leading-tight">Аналитика</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-0.5 text-xs lg:text-sm">
                        Данные из базы данных в реальном времени.
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm grow sm:grow-0">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest leading-none">Всё время</span>
                    </div>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
                {isLoading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-32 lg:h-40 rounded-[20px] lg:rounded-[32px]" />
                    ))
                    : mainStats.map((stat, i) => (
                        <StatCard key={i} {...stat} delay={i} />
                    ))
                }
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">

                {/* Top Locations */}
                <div className="xl:col-span-2 bg-white dark:bg-slate-900 p-5 lg:p-10 rounded-[32px] lg:rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-8 lg:mb-10 pl-1">
                        <h2 className="text-lg lg:text-xl font-bold text-slate-900 dark:text-white">Топ локаций</h2>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">по активности</span>
                    </div>

                    {loadingTop ? (
                        <div className="space-y-5">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-10" />
                            ))}
                        </div>
                    ) : topLocations.length > 0 ? (
                        <div className="space-y-6">
                            {topLocations.map((loc, i) => {
                                const score = loc.review_count || loc.visit_count || loc.rating || 0
                                const pct = maxVisits > 0 ? (score / maxVisits) * 100 : 0
                                return (
                                    <div key={loc.id || i} className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] lg:text-xs font-bold uppercase tracking-wider">
                                            <span className="text-slate-500 dark:text-slate-400 truncate max-w-[60%]">{loc.title || loc.name || `Локация ${i+1}`}</span>
                                            <span className="text-slate-900 dark:text-white">{fmt(score)}</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-full overflow-hidden shadow-inner border border-slate-200/5 dark:border-slate-700/50">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                                                className="h-full rounded-full bg-indigo-500 shadow-lg"
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <MapPin size={32} className="text-slate-200 dark:text-slate-700 mb-3" />
                            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">Нет данных по активности</p>
                            <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Данные появятся по мере роста аудитории</p>
                        </div>
                    )}
                </div>

                {/* Engagement & Summary */}
                <div className="bg-white dark:bg-slate-900/50 p-6 lg:p-8 rounded-[32px] lg:rounded-[48px] border border-slate-100 dark:border-slate-800/50 shadow-sm space-y-4">
                    <h2 className="text-base lg:text-lg font-bold text-slate-900 dark:text-white mb-2 pl-1">Активность</h2>

                    {loadingEngagement ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
                        </div>
                    ) : (
                        <>
                            {[
                                { label: 'Визиты', value: fmt(engagement?.total_visits), icon: Eye, color: 'bg-indigo-500/10 text-indigo-500' },
                                { label: 'Отзывы', value: fmt(engagement?.total_reviews), icon: Star, color: 'bg-amber-500/10 text-amber-500' },
                                { label: 'Избранное', value: fmt(engagement?.total_favorites), icon: Activity, color: 'bg-emerald-500/10 text-emerald-500' },
                                { label: 'Ожидают модерации', value: fmt(engagement?.pending_reviews), icon: Clock, color: 'bg-orange-500/10 text-orange-500' },
                            ].map(({ label, value, icon: Icon, color }, i) => (
                                <div key={i} className="flex items-center gap-3 p-4 rounded-[20px] bg-slate-50 dark:bg-slate-800/30 border border-slate-100/60 dark:border-slate-700/30">
                                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', color)}>
                                        <Icon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">{label}</p>
                                        <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {/* Category breakdown */}
                    {categoryStats && Object.keys(categoryStats).length > 0 && (
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-3 pl-1">По категориям</p>
                            <div className="space-y-2">
                                {Object.entries(categoryStats).slice(0, 4).map(([key, val], i) => (
                                    <div key={i} className="flex justify-between items-center text-xs px-1">
                                        <span className="text-slate-500 dark:text-slate-400 capitalize">{key}</span>
                                        <span className="font-bold text-slate-900 dark:text-white">{fmt(val)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Locations stats breakdown */}
            <div className="bg-white dark:bg-slate-900 p-5 lg:p-8 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
                <h2 className="text-base lg:text-lg font-bold text-slate-900 dark:text-white mb-6 pl-1">Статус локаций</h2>
                {isLoading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Всего', value: fmt(stats?.locations?.total), dot: 'bg-slate-400' },
                            { label: 'Опубликовано', value: fmt(stats?.locations?.published), dot: 'bg-emerald-500' },
                            { label: 'На проверке', value: fmt(stats?.locations?.pending), dot: 'bg-amber-500' },
                            { label: 'Отклонено', value: fmt(stats?.locations?.rejected), dot: 'bg-red-500' },
                        ].map(({ label, value, dot }, i) => (
                            <div key={i} className="p-4 rounded-[18px] bg-slate-50 dark:bg-slate-800/30 border border-slate-100/60 dark:border-slate-700/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={cn('w-2 h-2 rounded-full', dot)} />
                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{label}</p>
                                </div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default AdminStatsPage
