import React from 'react'
import { motion } from 'framer-motion'
import { 
    Users, MapPin, Star, Eye, TrendingUp, 
    Calendar, Globe, Activity, CheckCircle2, AlertCircle,
    ArrowUpRight, ArrowDownRight, MoreHorizontal
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import AdminPageHeader from '../components/AdminPageHeader'
import { useAdminStats } from '@/shared/api/queries'

const StatCard = ({ title, value, icon: Icon, trend, color, subtitle }) => (
    <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] p-6 lg:p-8 shadow-sm group">
        <div className="flex items-start justify-between mb-6">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-opacity-10", color)}>
                <Icon size={22} className={color.replace('bg-', 'text-')} />
            </div>
            {trend && (
                <div className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                    trend > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                )}>
                    {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{value}</h3>
            {subtitle && <p className="text-[10px] font-bold text-slate-400 mt-2">{subtitle}</p>}
        </div>
    </div>
)

const ChartPlaceholder = ({ title, icon: Icon }) => {
    const { t } = useTranslation()
    return (
        <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] p-6 lg:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/[0.02] flex items-center justify-center text-slate-400">
                        <Icon size={16} />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>
                </div>
                <button className="p-2 hover:bg-slate-50 dark:hover:bg-white/[0.02] rounded-xl transition-all text-slate-400">
                    <MoreHorizontal size={16} />
                </button>
            </div>
            <div className="h-48 flex items-center justify-center bg-slate-50/50 dark:bg-white/[0.01] rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.05]">
                <div className="flex flex-col items-center gap-2 opacity-30">
                    <TrendingUp size={24} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dynamic chart coming soon</span>
                </div>
            </div>
        </div>
    )
}

const AdminStatsPage = () => {
    const { t } = useTranslation()
    const { data: stats, isLoading } = useAdminStats()

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-8 lg:space-y-12 pb-12 font-sans">
            <AdminPageHeader 
                eyebrow="Admin"
                title={t('admin.stats.title')}
                subtitle={t('admin.stats.subtitle')}
            />

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
                <StatCard 
                    title={t('admin.stats.total_objects')}
                    value={stats?.locations?.total || 0}
                    icon={MapPin}
                    color="bg-indigo-500 text-indigo-500"
                    subtitle={t('admin.stats.this_month', { count: 24 })}
                    trend={12.5}
                />
                <StatCard 
                    title={t('admin.stats.pending_moderation')}
                    value={stats?.locations?.pending || 0}
                    icon={Activity}
                    color="bg-amber-500 text-amber-500"
                    subtitle={stats?.locations?.pending > 0 ? t('admin.stats.pending') : t('admin.stats.all_checked')}
                />
                <StatCard 
                    title={t('admin.stats.average_rating')}
                    value={stats?.engagement?.avg_rating?.toFixed(1) || '0.0'}
                    icon={Star}
                    color="bg-emerald-500 text-emerald-500"
                    subtitle={t('admin.stats.approved_reviews', { count: stats?.engagement?.total_reviews || 0 })}
                />
                <StatCard 
                    title={t('admin.stats.visits')}
                    value={stats?.engagement?.total_visits || 0}
                    icon={Eye}
                    color="bg-rose-500 text-rose-500"
                    trend={-2.4}
                />
            </div>

            {/* Charts & Breakdown */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <ChartPlaceholder title={t('admin.stats.activity')} icon={Activity} />
                <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] p-6 lg:p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/[0.02] flex items-center justify-center text-slate-400">
                            <TrendingUp size={16} />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{t('admin.stats.top_locations')}</h3>
                    </div>
                    
                    <div className="space-y-4">
                        {stats?.engagement?.top_locations?.length > 0 ? (
                            stats.engagement.top_locations.slice(0, 5).map((loc, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-white/[0.02] rounded-2xl group cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center font-black text-indigo-500 shadow-sm">
                                            {i + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900 dark:text-white leading-none mb-1">{loc.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{loc.city}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-slate-900 dark:text-white leading-none mb-1">{loc.visits}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('admin.stats.visits_label')}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-400 italic py-12 text-center">{t('admin.stats.no_active_locations')}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Demographics */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                <ChartPlaceholder title={t('admin.stats.by_category')} icon={Globe} />
                <ChartPlaceholder title={t('admin.stats.by_city')} icon={MapPin} />
                <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-white/[0.03] p-6 lg:p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/[0.02] flex items-center justify-center text-slate-400">
                            <Users size={16} />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{t('admin.stats.user_breakdown')}</h3>
                    </div>
                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('admin.stats.total')}</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{stats?.users?.total || 0}</p>
                            </div>
                            <TrendingUp className="text-emerald-500 mb-1" size={20} />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-slate-400 uppercase tracking-widest">{t('admin.stats.regular')}</span>
                                <span className="text-slate-900 dark:text-white">{stats?.users?.regular || 0}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-white/[0.02] rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500" style={{ width: '85%' }} />
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-slate-400 uppercase tracking-widest">{t('admin.stats.moderators')}</span>
                                <span className="text-slate-900 dark:text-white">{stats?.users?.moderators || 0}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-white/[0.02] rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500" style={{ width: '10%' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AdminStatsPage
