import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users, MapPin, Eye, MessageSquare,
    Clock, Bot, Plus, Download,
    Activity, Sparkles,
    ChevronDown, ChevronUp, BarChart3,
    ArrowRight, Upload
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from '@/lib/date'
import LocationHierarchyExplorer from '../components/LocationHierarchyExplorer'
import { useAdminStats, useRecentActivity } from '@/shared/api/queries'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: delay * 0.05 }}
        className="relative bg-slate-50/70 dark:bg-white/[0.03] p-3 lg:p-5 rounded-[20px] border border-transparent hover:border-slate-100 dark:hover:border-white/5 transition-all duration-300"
    >
        <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
                <h3 className="text-[9px] lg:text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1.5 leading-none">{title}</h3>
                <p className="text-lg lg:text-2xl font-bold text-slate-900 dark:text-white leading-none tracking-tight truncate">{value}</p>
            </div>
            <div className={cn(
                'w-9 h-9 lg:w-11 lg:h-11 rounded-2xl flex items-center justify-center bg-white dark:bg-white/5 shadow-sm shrink-0',
                color.replace('bg-', 'text-')
            )}>
                <Icon size={18} className="lg:w-5 lg:h-5" />
            </div>
        </div>
    </motion.div>
)

// ─── Activity row ─────────────────────────────────────────────────────────────

const ActivityRow = ({ item }) => (
    <div className="flex items-center justify-between p-3 lg:p-4 bg-slate-50/60 dark:bg-slate-800/30 rounded-[18px] hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition-all">
        <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 flex items-center justify-center font-bold text-sm text-slate-500 shrink-0">
                {item.user_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none mb-1 truncate">{item.user_name || 'User'}</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide truncate leading-none">{item.action_text || item.activity_type}</p>
            </div>
        </div>
        <span className="text-[10px] font-medium text-slate-300 dark:text-slate-500 whitespace-nowrap ml-3 shrink-0">
            {formatDistanceToNow(item.created_at)}
        </span>
    </div>
)

// ─── Empty activity row ───────────────────────────────────────────────────────

const EmptyRow = () => (
    <div className="flex items-center gap-4 p-3 lg:p-4 bg-slate-50/60 dark:bg-slate-800/30 rounded-[18px]">
        <div className="w-10 h-10 rounded-[14px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 flex items-center justify-center text-slate-300 shrink-0">
            <Activity size={16} />
        </div>
        <div>
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 leading-none mb-1">No activity yet</p>
            <p className="text-[10px] text-slate-300 dark:text-slate-600 font-medium uppercase tracking-wide leading-none">Activity will appear here</p>
        </div>
    </div>
)

// ─── Main page ────────────────────────────────────────────────────────────────

const AdminDashboardPage = () => {
    const navigate = useNavigate()
    const [isStatsCollapsed, setIsStatsCollapsed] = useState(false)
    const { user } = useAuthStore()

    const { data: adminStats, isLoading: loadingStats } = useAdminStats()
    const { data: recentActivities = [] } = useRecentActivity(10)

    const totalLocations = adminStats?.locations?.total ?? (loadingStats ? '...' : '—')
    const totalUsers = adminStats?.users?.total ?? (loadingStats ? '...' : '—')
    const totalReviews = adminStats?.engagement?.total_reviews ?? (loadingStats ? '...' : '—')
    const pageViews = adminStats?.engagement?.total_visits ?? (loadingStats ? '...' : '—')

    const stats = [
        { title: 'Locations', value: totalLocations, icon: MapPin, color: 'bg-orange-500' },
        { title: 'Users', value: totalUsers, icon: Users, color: 'bg-blue-500' },
        { title: 'Reviews', value: totalReviews, icon: MessageSquare, color: 'bg-emerald-500' },
        { title: 'Visits', value: pageViews, icon: Eye, color: 'bg-indigo-500' },
    ]

    return (
        <div className="space-y-6 lg:space-y-8 pb-12 font-sans">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-xl lg:text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">Панель управления</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-xs lg:text-sm">Все системы работают в штатном режиме.</p>
                    </div>
                </div>

                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={() => navigate('/admin/locations?import=true')}
                        className="h-10 px-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-semibold text-sm shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Upload size={15} /> Импорт
                    </button>
                    <button
                        onClick={() => navigate('/admin/locations?export=true')}
                        className="h-10 px-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-semibold text-sm shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Download size={15} /> Экспорт
                    </button>
                    <button
                        onClick={() => navigate('/admin/locations?create=true')}
                        className="h-10 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold text-sm shadow-sm shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Plus size={15} /> Создать
                    </button>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

                {/* Left column: Stats + AI Insight */}
                <div className="lg:col-span-1 space-y-5">

                    {/* Analytics Card */}
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50 rounded-[28px] lg:rounded-[32px] overflow-hidden shadow-sm">
                        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50">
                            <div className="flex items-center gap-2">
                                <BarChart3 size={16} className="text-indigo-500" />
                                <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Аналитика</h2>
                            </div>
                            <button
                                onClick={() => setIsStatsCollapsed(!isStatsCollapsed)}
                                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400"
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
                                    transition={{ duration: 0.25 }}
                                >
                                    <div className="p-4 grid grid-cols-2 gap-3">
                                        {stats.map((stat, i) => (
                                            <StatCard key={i} {...stat} delay={i} />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* AI Insight Card */}
                    <div className="bg-white dark:bg-slate-900/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-slate-800/50 p-5 shadow-sm relative overflow-hidden">
                        <div className="absolute -right-3 -bottom-3 opacity-[0.04] dark:opacity-[0.06] pointer-events-none">
                            <Bot size={88} />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                                    <Sparkles size={13} className="text-indigo-500" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">GastroAI Insight</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug mb-4">
                                Weekend brunch venues up 24% in popularity this week.
                            </p>
                            <button
                                onClick={() => navigate('/admin/stats')}
                                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors group"
                            >
                                View report
                                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right column: Explorer + Activity */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Location Hierarchy Explorer */}
                    <LocationHierarchyExplorer />

                    {/* Recent Activity Card */}
                    <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50 rounded-[28px] lg:rounded-[32px] overflow-hidden shadow-sm">
                        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50">
                            <div className="flex items-center gap-2">
                                <Clock size={16} className="text-slate-400" />
                                <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Последние действия</h2>
                            </div>
                            <button
                                onClick={() => navigate('/admin/users')}
                                className="text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors"
                            >
                                Все →
                            </button>
                        </div>

                        <div className="p-4 space-y-2">
                            {recentActivities.length > 0
                                ? recentActivities.slice(0, 5).map((item, i) => (
                                    <ActivityRow key={i} item={item} />
                                ))
                                : Array.from({ length: 3 }).map((_, i) => (
                                    <EmptyRow key={i} />
                                ))
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AdminDashboardPage
