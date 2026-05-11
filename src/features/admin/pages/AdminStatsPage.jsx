import React from 'react'
import { motion } from 'framer-motion'
import {
    Users, MapPin, Star, Eye, TrendingUp,
    Activity, Globe, Calendar, BarChart3,
    ArrowUpRight, ArrowDownRight, Layers, MousePointerClick
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import AdminPageHeader from '../components/AdminPageHeader'
import {
    useAdminStats, useCategoryStats, useCityStats,
    useReviewsTimeline, useUserGrowth, useEngagementStats, useTopLocations
} from '@/shared/api/queries'
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend
} from 'recharts'

/* ─── Theme tokens ─────────────────────────────────────────────────────── */

const CHART_COLORS = {
    primary: '#6366f1',    // indigo-500
    secondary: '#8b5cf6',  // violet-500
    accent: '#10b981',     // emerald-500
    rose: '#f43f5e',       // rose-500
    amber: '#f59e0b',      // amber-500
    slate: '#94a3b8',      // slate-400
    grid: '#e2e8f0',       // slate-200
}

const PIE_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f59e0b', '#10b981', '#06b6d4', '#64748b'
]

/* ─── Helpers ──────────────────────────────────────────────────────────── */

const formatDate = (iso) => {
    const d = new Date(iso)
    return `${d.getDate()}.${d.getMonth() + 1}`
}

const formatNumber = (n) => {
    if (n === null || n === undefined || n === '...' || n === '—') return n
    return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

/* ─── KPI Card ─────────────────────────────────────────────────────────── */

const KpiCard = ({ title, value, icon: Icon, trend, accent = 'primary' }) => {
    const colorMap = {
        primary: 'text-indigo-500 bg-indigo-50 border-indigo-100',
        emerald: 'text-emerald-500 bg-emerald-50 border-emerald-100',
        rose: 'text-rose-500 bg-rose-50 border-rose-100',
        amber: 'text-amber-500 bg-amber-50 border-amber-100',
        slate: 'text-slate-500 bg-slate-50 border-slate-100',
    }
    const c = colorMap[accent] || colorMap.primary

    return (
        <div className="bg-white dark:bg-[hsl(220,20%,6%)] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-5 lg:p-6">
            <div className="flex items-start justify-between mb-4">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border', c)}>
                    <Icon size={20} />
                </div>
                {trend !== undefined && trend !== null && (
                    <div className={cn(
                        'flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-bold uppercase tracking-wider',
                        trend > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                    )}>
                        {trend > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <p className="text-micro font-bold text-t-tertiary uppercase tracking-widest mb-1.5">{title}</p>
            <p className="text-2xl lg:text-3xl font-bold text-t-primary tracking-tight">{formatNumber(value)}</p>
        </div>
    )
}

/* ─── Custom Tooltip ───────────────────────────────────────────────────── */

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-white dark:bg-[hsl(220,20%,8%)] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 shadow-lg">
            <p className="text-micro font-bold text-t-tertiary uppercase tracking-wider mb-1">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-t-secondary">{p.name}:</span>
                    <span className="text-t-primary">{p.value}</span>
                </div>
            ))}
        </div>
    )
}

/* ─── Chart Card Wrapper ───────────────────────────────────────────────── */

const ChartCard = ({ title, icon: Icon, children, className }) => (
    <div className={cn('bg-white dark:bg-[hsl(220,20%,6%)] border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden', className)}>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.04] flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-white/[0.03] flex items-center justify-center text-slate-400">
                <Icon size={14} />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>
        </div>
        <div className="p-4 lg:p-5">
            {children}
        </div>
    </div>
)

/* ─── Loading Skeleton ─────────────────────────────────────────────────── */

const SkeletonPulse = ({ className }) => (
    <div className={cn('bg-slate-100 dark:bg-white/[0.04] rounded-xl animate-pulse', className)} />
)

/* ─── Main Page ────────────────────────────────────────────────────────── */

const AdminStatsPage = () => {
    const { t } = useTranslation()
    const { data: stats, isLoading: loadingStats } = useAdminStats()
    const { data: categoryStats, isLoading: loadingCategories } = useCategoryStats()
    const { data: cityStats, isLoading: loadingCities } = useCityStats()
    const { data: reviewsTimeline, isLoading: loadingReviews } = useReviewsTimeline(30)
    const { data: userGrowth, isLoading: loadingGrowth } = useUserGrowth(30)
    const { data: engagement, isLoading: loadingEngagement } = useEngagementStats()
    const { data: topLocs, isLoading: loadingTop } = useTopLocations(10)

    const isLoading = loadingStats || loadingCategories || loadingCities || loadingReviews || loadingGrowth || loadingEngagement || loadingTop

    /* ── Derived chart data ───────────────────────────────────────────── */

    const userGrowthData = (userGrowth || []).map(d => ({
        label: formatDate(d.day),
        newUsers: d.new_users,
        cumulative: d.total_cumulative,
    }))

    const reviewsData = (reviewsTimeline || []).map(d => ({
        label: formatDate(d.day),
        reviews: d.review_count,
        rating: d.avg_rating,
    }))

    const categoryData = (categoryStats || []).slice(0, 8).map(c => ({
        name: c.category,
        value: c.total,
        active: c.active,
    }))

    const cityData = (cityStats || []).slice(0, 8).map(c => ({
        name: c.city,
        value: c.total,
    }))

    const topLocationsData = (topLocs || []).slice(0, 8).map((l, _i) => ({
        name: l.title.length > 18 ? l.title.slice(0, 18) + '…' : l.title,
        score: l.score || l.review_count + l.visit_count || 0,
        visits: l.visit_count || 0,
        reviews: l.review_count || 0,
    })).sort((a, b) => b.score - a.score)

    /* ── Engagement breakdown for mini bars ───────────────────────────── */

    const engagementBars = engagement ? [
        { label: t('admin.stats.regular') || 'Regular', value: engagement.regular_users || 0, color: CHART_COLORS.primary },
        { label: t('admin.stats.moderators') || 'Moderators', value: engagement.moderator_users || 0, color: CHART_COLORS.amber },
        { label: t('admin.stats.admins') || 'Admins', value: engagement.admin_users || 0, color: CHART_COLORS.rose },
    ] : []
    const maxUsers = Math.max(...engagementBars.map(e => e.value), 1)

    return (
        <div className="space-y-6 lg:space-y-8 pb-12 font-sans">
            <AdminPageHeader
                eyebrow="Admin"
                title={t('admin.stats.title')}
                subtitle={t('admin.stats.subtitle')}
            />

            {/* ── KPI Row ───────────────────────────────────────────────── */}
            {isLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonPulse key={i} className="h-32" />
                    ))}
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6"
                >
                    <KpiCard
                        title={t('admin.stats.total_objects')}
                        value={stats?.locations?.total ?? 0}
                        icon={MapPin}
                        accent="primary"
                        trend={12.5}
                    />
                    <KpiCard
                        title={t('admin.stats.visits')}
                        value={stats?.engagement?.total_visits ?? 0}
                        icon={Eye}
                        accent="emerald"
                        trend={-2.4}
                    />
                    <KpiCard
                        title={t('admin.stats.average_rating')}
                        value={stats?.engagement?.avg_rating?.toFixed(1) ?? '0.0'}
                        icon={Star}
                        accent="amber"
                    />
                    <KpiCard
                        title={t('admin.stats.pending_moderation')}
                        value={stats?.locations?.pending ?? 0}
                        icon={Activity}
                        accent="rose"
                    />
                </motion.div>
            )}

            {/* ── Charts Row 1: Growth + Reviews ──────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
                {/* User Growth */}
                <ChartCard title={t('admin.stats.user_growth') || 'User Growth'} icon={Users}>
                    {loadingGrowth ? (
                        <SkeletonPulse className="h-52 lg:h-64" />
                    ) : userGrowthData.length === 0 ? (
                        <div className="h-52 lg:h-64 flex items-center justify-center text-xs text-slate-400 font-medium uppercase tracking-wider">
                            No growth data yet
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220} className="lg:!h-64">
                            <AreaChart data={userGrowthData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
                                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--text-tertiary))' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--text-tertiary))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="cumulative" name="Total Users" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#cumulativeGrad)" dot={false} />
                                <Bar dataKey="newUsers" name="New Users" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} opacity={0.25} barSize={8} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                {/* Reviews Timeline */}
                <ChartCard title={t('admin.stats.reviews_timeline') || 'Reviews Timeline'} icon={Calendar}>
                    {loadingReviews ? (
                        <SkeletonPulse className="h-52 lg:h-64" />
                    ) : reviewsData.length === 0 ? (
                        <div className="h-52 lg:h-64 flex items-center justify-center text-xs text-slate-400 font-medium uppercase tracking-wider">
                            No reviews yet
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220} className="lg:!h-64">
                            <BarChart data={reviewsData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--text-tertiary))' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--text-tertiary))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="reviews" name="Reviews" fill={CHART_COLORS.emerald} radius={[3, 3, 0, 0]} barSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* ── Charts Row 2: Categories + Cities ───────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
                {/* Categories */}
                <ChartCard title={t('admin.stats.by_category') || 'By Category'} icon={Layers}>
                    {loadingCategories ? (
                        <SkeletonPulse className="h-52 lg:h-64" />
                    ) : categoryData.length === 0 ? (
                        <div className="h-52 lg:h-64 flex items-center justify-center text-xs text-slate-400 font-medium uppercase tracking-wider">
                            No categories yet
                        </div>
                    ) : (
                        <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-8">
                            <ResponsiveContainer width="100%" height={200} className="lg:!w-1/2 lg:!h-56">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={80}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {categoryData.map((_, i) => (
                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="w-full lg:w-1/2 space-y-2">
                                {categoryData.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                            <span className="font-medium text-t-secondary truncate">{c.name}</span>
                                        </div>
                                        <span className="font-bold text-t-primary ml-2 shrink-0">{c.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </ChartCard>

                {/* Cities */}
                <ChartCard title={t('admin.stats.by_city') || 'By City'} icon={Globe}>
                    {loadingCities ? (
                        <SkeletonPulse className="h-52 lg:h-64" />
                    ) : cityData.length === 0 ? (
                        <div className="h-52 lg:h-64 flex items-center justify-center text-xs text-slate-400 font-medium uppercase tracking-wider">
                            No city data yet
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220} className="lg:!h-64">
                            <BarChart data={cityData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--text-tertiary))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--text-secondary))' }} axisLine={false} tickLine={false} width={90} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="value" name="Locations" fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>
            </div>

            {/* ── Charts Row 3: Top Locations + Engagement ────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
                {/* Top Locations — takes 2 cols */}
                <div className="lg:col-span-2">
                    <ChartCard title={t('admin.stats.top_locations') || 'Top Locations'} icon={TrendingUp}>
                        {loadingTop ? (
                            <SkeletonPulse className="h-52 lg:h-64" />
                        ) : topLocationsData.length === 0 ? (
                            <div className="h-52 lg:h-64 flex items-center justify-center text-xs text-slate-400 font-medium uppercase tracking-wider">
                                No location activity yet
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={220} className="lg:!h-64">
                                <BarChart data={topLocationsData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--text-tertiary))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--text-secondary))' }} axisLine={false} tickLine={false} width={110} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 11 }} />
                                    <Bar dataKey="visits" name="Visits" stackId="a" fill={CHART_COLORS.primary} radius={[0, 2, 2, 0]} barSize={14} />
                                    <Bar dataKey="reviews" name="Reviews" stackId="a" fill={CHART_COLORS.emerald} radius={[0, 2, 2, 0]} barSize={14} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                </div>

                {/* Engagement Breakdown */}
                <div className="lg:col-span-1">
                    <ChartCard title={t('admin.stats.engagement') || 'Engagement'} icon={MousePointerClick}>
                        {loadingEngagement ? (
                            <SkeletonPulse className="h-52 lg:h-64" />
                        ) : !engagement ? (
                            <div className="h-52 lg:h-64 flex items-center justify-center text-xs text-slate-400 font-medium uppercase tracking-wider">
                                No data
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Mini stats */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3">
                                        <p className="text-micro font-bold text-t-tertiary uppercase tracking-wider mb-1">Locations</p>
                                        <p className="text-lg font-bold text-t-primary">{engagement.active_locations}</p>
                                        <p className="text-micro text-t-quaternary mt-0.5">/ {engagement.total_locations} total</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3">
                                        <p className="text-micro font-bold text-t-tertiary uppercase tracking-wider mb-1">Reviews</p>
                                        <p className="text-lg font-bold text-t-primary">{engagement.approved_reviews}</p>
                                        <p className="text-micro text-t-quaternary mt-0.5">/ {engagement.total_reviews} total</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3">
                                        <p className="text-micro font-bold text-t-tertiary uppercase tracking-wider mb-1">Visitors</p>
                                        <p className="text-lg font-bold text-t-primary">{engagement.unique_visitors}</p>
                                        <p className="text-micro text-t-quaternary mt-0.5">{engagement.total_visits} visits</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3">
                                        <p className="text-micro font-bold text-t-tertiary uppercase tracking-wider mb-1">Avg Rating</p>
                                        <p className="text-lg font-bold text-t-primary">{engagement.avg_rating?.toFixed(1) ?? '—'}</p>
                                        <p className="text-micro text-t-quaternary mt-0.5">out of 5</p>
                                    </div>
                                </div>

                                {/* User role bars */}
                                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/[0.04]">
                                    <p className="text-micro font-bold text-t-tertiary uppercase tracking-wider">User Roles</p>
                                    {engagementBars.map((bar, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between text-xs font-medium mb-1">
                                                <span className="text-t-secondary">{bar.label}</span>
                                                <span className="text-t-primary font-bold">{bar.value}</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 dark:bg-white/[0.04] rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(bar.value / maxUsers) * 100}%` }}
                                                    transition={{ duration: 0.8, delay: i * 0.1 }}
                                                    className="h-full rounded-full"
                                                    style={{ background: bar.color }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </ChartCard>
                </div>
            </div>
        </div>
    )
}

export default AdminStatsPage
