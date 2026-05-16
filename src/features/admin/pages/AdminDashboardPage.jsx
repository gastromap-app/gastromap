import React, { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    Users, MapPin, Eye, MessageSquare,
    Clock, Bot, Plus, ShieldCheck, AlertCircle,
    Activity, Sparkles, Database, Cpu, HardDrive,
    ChevronDown, ChevronUp, BarChart3,
    ArrowRight, CheckCircle2, XCircle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from '@/lib/date'
import { useAdminStats, useRecentActivity, usePendingLocations, usePendingReviews } from '@/shared/api/queries'
import { supabase } from '@/shared/api/client'
import { getActiveAIConfig } from '@/shared/api/ai-config.api'
import AdminPageHeader from '../components/AdminPageHeader'

// ─── Stat card (no animation) ─────────────────────────────────────────────────

const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="relative bg-slate-50/70 dark:bg-white/[0.03] p-3 lg:p-5 rounded-[20px] border border-transparent hover:border-slate-100 dark:hover:border-white/5 transition-all duration-200">
        <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
                <h3 className="text-[10px] font-medium uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 leading-none">{title}</h3>
                <p className="text-lg lg:text-2xl font-light text-slate-900 dark:text-white leading-none tracking-tight truncate">{value}</p>
            </div>
            <div className={cn(
                'w-9 h-9 lg:w-11 lg:h-11 rounded-2xl flex items-center justify-center bg-white dark:bg-white/5 shadow-sm shrink-0',
                color.replace('bg-', 'text-')
            )}>
                <Icon size={18} className="lg:w-5 lg:h-5" strokeWidth={1.5} />
            </div>
        </div>
    </div>
)

// ─── Quick Action button ──────────────────────────────────────────────────────

const QuickAction = ({ icon: Icon, label, count, onClick, color = 'text-indigo-500', bg = 'bg-indigo-50 dark:bg-indigo-500/10' }) => (
    <button
        onClick={onClick}
        className="flex items-center gap-3 p-3 lg:p-4 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04] hover:border-indigo-200 dark:hover:border-indigo-500/20 transition-all group active:scale-[0.98] w-full text-left"
    >
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", bg)}>
            <Icon size={18} className={color} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white leading-none">{label}</p>
            {count !== undefined && (
                <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wider">{count} pending</p>
            )}
        </div>
        <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
    </button>
)

// ─── Health Check indicator ───────────────────────────────────────────────────

const HealthItem = ({ label, status, detail }) => (
    <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
            {status === 'ok' && <CheckCircle2 size={14} className="text-emerald-500" />}
            {status === 'warning' && <AlertCircle size={14} className="text-amber-500" />}
            {status === 'error' && <XCircle size={14} className="text-red-500" />}
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
        </div>
        <span className={cn("text-xs font-medium", 
            status === 'ok' ? 'text-emerald-500' : status === 'warning' ? 'text-amber-500' : 'text-red-500'
        )}>{detail}</span>
    </div>
)

// ─── Activity row ─────────────────────────────────────────────────────────────

const ActivityRow = ({ item }) => (
    <div className="flex items-center justify-between p-3 lg:p-4 bg-slate-50/60 dark:bg-[hsl(220,20%,9%)]/30 rounded-[18px] hover:bg-slate-100/60 dark:hover:bg-[hsl(220,20%,12%)]/50 transition-all">
        <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-[hsl(220,20%,6%)] border border-slate-100 dark:border-white/[0.03] flex items-center justify-center font-medium text-sm text-slate-500 shrink-0">
                {item.user_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white leading-none mb-1 truncate">{item.user_name || 'User'}</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider truncate leading-none">{item.action_text || item.activity_type}</p>
            </div>
        </div>
        <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-3 shrink-0">
            {formatDistanceToNow(item.created_at)}
        </span>
    </div>
)

const EmptyRow = () => {
    const { t } = useTranslation()
    return (
        <div className="flex items-center gap-4 p-3 lg:p-4 bg-slate-50/60 dark:bg-[hsl(220,20%,9%)]/30 rounded-[18px]">
            <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-[hsl(220,20%,6%)] border border-slate-100 dark:border-white/[0.03] flex items-center justify-center text-slate-300 shrink-0">
                <Activity size={16} />
            </div>
            <div>
                <p className="text-sm font-medium text-slate-400 leading-none mb-1">{t('admin.dashboard.no_activity')}</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider leading-none">{t('admin.dashboard.activity_will_appear')}</p>
            </div>
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const AdminDashboardPage = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [isStatsCollapsed, setIsStatsCollapsed] = useState(false)
    const { data: adminStats, isLoading: loadingStats } = useAdminStats()
    const { data: recentActivities = [] } = useRecentActivity(10)
    const { data: pendingLocations = [] } = usePendingLocations()
    const { data: pendingReviews = [] } = usePendingReviews()

    // Health check state
    const [health, setHealth] = useState({ supabase: 'ok', ai: 'ok', r2: 'ok', r2Detail: '—' })
    const [r2Stats, setR2Stats] = useState(null)

    useEffect(() => {
        const checkHealth = async () => {
            const newHealth = { supabase: 'ok', ai: 'ok', r2: 'ok', r2Detail: '—' }

            // Supabase DB
            try {
                if (!supabase) { newHealth.supabase = 'error'; }
                else {
                    const { error } = await supabase.from('locations').select('id', { count: 'exact', head: true })
                    newHealth.supabase = error ? 'warning' : 'ok'
                }
            } catch { newHealth.supabase = 'error' }

            // AI
            const aiConfig = getActiveAIConfig()
            newHealth.ai = aiConfig.isConfigured ? 'ok' : aiConfig.useProxy ? 'warning' : 'error'

            // R2 Storage — try real API, fallback to estimate.
            //
            // The `/api/locations/enrich` endpoint is a Vercel serverless function
            // that exists ONLY in production. `vite dev` does not boot the
            // serverless runtime, so the call deterministically 404s locally and
            // floods the console. Skip the attempt entirely on `import.meta.env.DEV`
            // and use the local-count estimate fallback. On production the call
            // proceeds as before.
            const useR2EstimateFallback = () => {
                const locCount = adminStats?.locations?.total || 0
                const estimatedMB = Math.round(locCount * 0.8) // ~800KB avg per location (main + gallery)
                setR2Stats({
                    usedMB: estimatedMB,
                    usedGB: Math.round(estimatedMB / 1024 * 100) / 100,
                    objectCount: locCount * 5,
                    limitGB: 10,
                    percentUsed: Math.round(estimatedMB / 10240 * 100 * 10) / 10,
                    isEstimate: true,
                })
                newHealth.r2Detail = `~${estimatedMB} MB / 10 GB (est.)`
                newHealth.r2 = 'ok'
            }

            if (import.meta.env.DEV) {
                useR2EstimateFallback()
            } else {
                try {
                    const storageRes = await fetch('/api/locations/enrich', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'storage-stats' }),
                    })
                    if (storageRes.ok) {
                        const stats = await storageRes.json()
                        setR2Stats(stats)
                        newHealth.r2Detail = `${stats.usedMB < 1024 ? stats.usedMB + ' MB' : stats.usedGB + ' GB'} / ${stats.limitGB} GB`
                        newHealth.r2 = stats.percentUsed > 80 ? 'warning' : 'ok'
                    } else {
                        useR2EstimateFallback()
                    }
                } catch {
                    useR2EstimateFallback()
                }
            }

            setHealth(newHealth)
        }
        checkHealth()
    }, [adminStats])

    const totalLocations = adminStats?.locations?.total ?? (loadingStats ? '...' : '—')
    const totalUsers = adminStats?.users?.total ?? (loadingStats ? '...' : '—')
    const totalReviews = adminStats?.engagement?.total_reviews ?? (loadingStats ? '...' : '—')
    const pageViews = adminStats?.engagement?.total_visits ?? (loadingStats ? '...' : '—')

    const stats = [
        { title: t('admin.stats.locations'), value: totalLocations, icon: MapPin, color: 'bg-orange-500' },
        { title: t('admin.stats.users'), value: totalUsers, icon: Users, color: 'bg-blue-500' },
        { title: t('admin.stats.reviews'), value: totalReviews, icon: MessageSquare, color: 'bg-emerald-500' },
        { title: t('admin.stats.visits'), value: pageViews, icon: Eye, color: 'bg-indigo-500' },
    ]

    return (
        <div className="space-y-4 lg:space-y-6 pb-12 font-sans">

            {/* Header */}
            <AdminPageHeader
                eyebrow="Admin"
                title={t('admin.dashboard.title')}
                subtitle={<span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />{t('admin.dashboard.all_systems_ok')}</span>}
                className="pb-4 lg:pb-6"
            />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">

                {/* Left column: Stats + Quick Actions */}
                <div className="lg:col-span-1 space-y-5">

                    {/* Analytics Card */}
                    <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 border border-slate-100 dark:border-white/[0.03] rounded-[24px] overflow-hidden shadow-sm">
                        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50 dark:border-white/[0.03]">
                            <div className="flex items-center gap-2">
                                <BarChart3 size={16} className="text-indigo-500" strokeWidth={1.5} />
                                <h2 className="font-medium text-sm text-slate-900 dark:text-white">{t('admin.dashboard.analytics')}</h2>
                            </div>
                            <button
                                onClick={() => setIsStatsCollapsed(!isStatsCollapsed)}
                                className="p-1.5 hover:bg-slate-50 dark:hover:bg-[hsl(220,20%,12%)] rounded-xl transition-all text-slate-400"
                            >
                                {isStatsCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                            </button>
                        </div>

                        <AnimatePresence initial={false}>
                            {!isStatsCollapsed && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <div className="p-4 grid grid-cols-2 gap-3">
                                        {stats.map((stat, i) => (
                                            <StatCard key={i} {...stat} />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400 px-1">Quick Actions</h3>
                        <QuickAction
                            icon={Plus}
                            label="Add Location"
                            onClick={() => navigate('/admin/locations?create=true')}
                            color="text-emerald-500"
                            bg="bg-emerald-50 dark:bg-emerald-500/10"
                        />
                        <QuickAction
                            icon={ShieldCheck}
                            label="Review Queue"
                            count={pendingLocations.length + pendingReviews.length}
                            onClick={() => navigate('/admin/moderation')}
                            color="text-amber-500"
                            bg="bg-amber-50 dark:bg-amber-500/10"
                        />
                        <QuickAction
                            icon={Users}
                            label="Manage Users"
                            onClick={() => navigate('/admin/users')}
                        />
                    </div>

                    {/* AI Insight Card */}
                    <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[24px] border border-slate-100 dark:border-white/[0.03] p-5 shadow-sm relative overflow-hidden">
                        <div className="absolute -right-3 -bottom-3 opacity-[0.04] dark:opacity-[0.06] pointer-events-none">
                            <Bot size={88} />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                                    <Sparkles size={13} className="text-indigo-500" />
                                </div>
                                <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-500">GastroAI Insight</span>
                            </div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                                {t('admin.dashboard.ai_insight')}
                            </p>
                            <button
                                onClick={() => navigate('/admin/stats')}
                                className="flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors group"
                            >
                                {t('admin.dashboard.view_report')}
                                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right column: Activity + Health + Storage */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Recent Activity Card */}
                    <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 border border-slate-100 dark:border-white/[0.03] rounded-[24px] overflow-hidden shadow-sm">
                        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50 dark:border-white/[0.03]">
                            <div className="flex items-center gap-2">
                                <Clock size={16} className="text-slate-400" strokeWidth={1.5} />
                                <h2 className="font-medium text-sm text-slate-900 dark:text-white">{t('admin.dashboard.recent_activity')}</h2>
                            </div>
                            <button
                                onClick={() => navigate('/admin/users')}
                                className="text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors"
                            >
                                {t('admin.dashboard.view_all')}
                            </button>
                        </div>

                        <div className="p-4 space-y-2">
                            {recentActivities.length > 0
                                ? recentActivities.slice(0, 8).map((item, i) => (
                                    <ActivityRow key={i} item={item} />
                                ))
                                : Array.from({ length: 3 }).map((_, i) => (
                                    <EmptyRow key={i} />
                                ))
                            }
                        </div>
                    </div>

                    {/* Health + R2 Storage — side by side on desktop */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                        {/* Health Check */}
                        <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[24px] border border-slate-100 dark:border-white/[0.03] p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <Cpu size={14} className="text-slate-400" strokeWidth={1.5} />
                                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">System Health</h3>
                            </div>
                            <div className="space-y-1 divide-y divide-slate-50 dark:divide-white/[0.03]">
                                <HealthItem label="Supabase DB" status={health.supabase} detail={health.supabase === 'ok' ? 'Connected' : 'Issue'} />
                                <HealthItem label="AI API" status={health.ai} detail={health.ai === 'ok' ? 'Key active' : health.ai === 'warning' ? 'Proxy mode' : 'No key'} />
                                <HealthItem label="R2 Photos" status={health.r2} detail={health.r2Detail} />
                            </div>
                        </div>

                        {/* R2 Storage Card */}
                        <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[24px] border border-slate-100 dark:border-white/[0.03] p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <HardDrive size={14} className="text-slate-400" strokeWidth={1.5} />
                                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">
                                    Cloudflare R2{r2Stats?.isEstimate ? ' (est.)' : ''}
                                </h3>
                            </div>

                            {r2Stats ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-light text-slate-900 dark:text-white">
                                            {r2Stats.isEstimate ? '~' : ''}{r2Stats.usedMB < 1024 ? `${r2Stats.usedMB} MB` : `${r2Stats.usedGB} GB`}
                                        </span>
                                        <span className="text-xs font-medium text-slate-400">
                                            / {r2Stats.limitGB} GB
                                        </span>
                                    </div>
                                    <div className="w-full h-2.5 bg-slate-100 dark:bg-white/[0.05] rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-500",
                                                r2Stats.percentUsed > 80 ? 'bg-amber-500' : r2Stats.percentUsed > 50 ? 'bg-blue-500' : 'bg-emerald-500'
                                            )}
                                            style={{ width: `${Math.min(r2Stats.percentUsed, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-medium text-slate-400">
                                            {r2Stats.percentUsed}% used
                                        </span>
                                        <span className="text-[10px] font-medium text-slate-500">
                                            {r2Stats.isEstimate ? '~' : ''}{r2Stats.objectCount.toLocaleString()} files
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
                                    Loading...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AdminDashboardPage
