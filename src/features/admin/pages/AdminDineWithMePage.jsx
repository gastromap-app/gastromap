import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users, MapPin, HandMetal, AlertTriangle, Clock,
    CheckCircle2, XCircle, Trash2,
    UtensilsCrossed, RefreshCw, UserCheck, UserX
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from '@/lib/date'
import AdminPageHeader from '../components/AdminPageHeader'
import {
    useDineAdminStats,
    useDineAdminPresences,
    useDineAdminWaves,
    useDineAdminReports,
    useDineAdminWaitlist,
    useDeleteDinePresenceMutation,
    useDeleteDineWaveMutation,
    useUpdateReportStatusMutation,
    useUpdateWaitlistStatusMutation,
    useDeleteWaitlistEntryMutation,
} from '@/shared/api/queries'

// ─── Tab definitions ────────────────────────────────────────────────────────

const TABS = [
    { id: 'activity', label: 'Activity', icon: Clock },
    { id: 'waitlist', label: 'Waitlist', icon: Users },
    { id: 'reports', label: 'Reports', icon: AlertTriangle },
]

// ─── Stat card ──────────────────────────────────────────────────────────────

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: delay * 0.05 }}
        className="relative bg-slate-50/70 dark:bg-white/[0.03] p-3 lg:p-5 rounded-[20px] border border-transparent hover:border-slate-100 dark:hover:border-white/5 transition-all duration-300"
    >
        <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
                <h3 className="text-[9px] lg:text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest mb-1.5 leading-none">{title}</h3>
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

// ─── Tab selector ───────────────────────────────────────────────────────────

function TabSelector({ activeTab, setActiveTab }) {
    const { t } = useTranslation()
    return (
        <div className="flex gap-1 p-1 bg-slate-100/80 dark:bg-white/[0.03] rounded-2xl">
            {TABS.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
                        activeTab === tab.id
                            ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-white/60'
                    )}
                >
                    <tab.icon size={14} />
                    {t(`admin.dine.tabs.${tab.id}`, tab.label)}
                </button>
            ))}
        </div>
    )
}

// ─── Activity Tab ───────────────────────────────────────────────────────────

function ActivityTab() {
    const { t } = useTranslation()
    const { data: presences = [], isLoading: loadingPresences } = useDineAdminPresences()
    const { data: waves = [], isLoading: loadingWaves } = useDineAdminWaves()
    const deletePresence = useDeleteDinePresenceMutation()
    const deleteWave = useDeleteDineWaveMutation()

    return (
        <div className="space-y-6">
            {/* Active Presences */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 border border-slate-100 dark:border-white/[0.03] rounded-[24px] overflow-hidden shadow-sm">
                <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50 dark:border-white/[0.03]">
                    <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-emerald-500" />
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                            {t('admin.dine.active_presences', 'Active Presences')}
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                            {presences.length}
                        </span>
                    </div>
                </div>

                {loadingPresences ? (
                    <div className="p-6 flex items-center justify-center">
                        <RefreshCw size={16} className="animate-spin text-slate-300" />
                    </div>
                ) : presences.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">
                        {t('admin.dine.no_presences', 'No active presences right now')}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                        {presences.map(p => (
                            <div key={p.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                                        {(p.profile?.full_name || p.profile?.name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                            {p.profile?.full_name || p.profile?.name || 'Unknown'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium truncate">
                                            {p.location?.title || p.location?.name || 'Unknown venue'} · {p.status} · {p.visibility}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] text-slate-300 whitespace-nowrap">
                                        {formatDistanceToNow(p.created_at)}
                                    </span>
                                    <button
                                        onClick={() => deletePresence.mutate(p.id)}
                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors text-slate-300 hover:text-red-500"
                                        title="Remove presence"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Recent Waves */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 border border-slate-100 dark:border-white/[0.03] rounded-[24px] overflow-hidden shadow-sm">
                <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50 dark:border-white/[0.03]">
                    <div className="flex items-center gap-2">
                        <HandMetal size={16} className="text-blue-500" />
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                            {t('admin.dine.recent_waves', 'Recent Waves')}
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                            {waves.length}
                        </span>
                    </div>
                </div>

                {loadingWaves ? (
                    <div className="p-6 flex items-center justify-center">
                        <RefreshCw size={16} className="animate-spin text-slate-300" />
                    </div>
                ) : waves.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">
                        {t('admin.dine.no_waves', 'No waves sent yet')}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                        {waves.slice(0, 20).map(w => (
                            <div key={w.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex items-center -space-x-2">
                                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center text-[10px] font-bold text-blue-600 ring-2 ring-white dark:ring-[hsl(220,20%,6%)] z-10">
                                            {(w.from_profile?.full_name || w.from_profile?.name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center text-[10px] font-bold text-purple-600 ring-2 ring-white dark:ring-[hsl(220,20%,6%)]">
                                            {(w.to_profile?.full_name || w.to_profile?.name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                            {w.from_profile?.full_name || w.from_profile?.name || 'User'} → {w.to_profile?.full_name || w.to_profile?.name || 'User'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium truncate">
                                            {w.venue_name}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] text-slate-300 whitespace-nowrap">
                                        {formatDistanceToNow(w.created_at)}
                                    </span>
                                    <button
                                        onClick={() => deleteWave.mutate(w.id)}
                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors text-slate-300 hover:text-red-500"
                                        title="Delete wave"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Waitlist Tab ───────────────────────────────────────────────────────────

function WaitlistTab() {
    const { t } = useTranslation()
    const [statusFilter, setStatusFilter] = useState('pending')
    const { data: waitlist = [], isLoading } = useDineAdminWaitlist({ status: statusFilter })
    const updateStatus = useUpdateWaitlistStatusMutation()
    const deleteEntry = useDeleteWaitlistEntryMutation()

    // eslint-disable-next-line no-unused-vars
    const statusCounts = {
        pending: waitlist.filter(w => w.status === 'pending').length,
        approved: waitlist.filter(w => w.status === 'approved').length,
        rejected: waitlist.filter(w => w.status === 'rejected').length,
    }

    const statusBadge = (status) => {
        const styles = {
            pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
            approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
            rejected: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
        }
        return (
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider', styles[status] || styles.pending)}>
                {status}
            </span>
        )
    }

    return (
        <div className="space-y-4">
            {/* Filter tabs */}
            <div className="flex gap-2">
                {['pending', 'approved', 'rejected'].map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                            statusFilter === s
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'
                        )}
                    >
                        {s === 'pending' && <Clock size={12} />}
                        {s === 'approved' && <CheckCircle2 size={12} />}
                        {s === 'rejected' && <XCircle size={12} />}
                        {t(`admin.dine.waitlist_${s}`, s.charAt(0).toUpperCase() + s.slice(1))}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 border border-slate-100 dark:border-white/[0.03] rounded-[24px] overflow-hidden shadow-sm">
                {isLoading ? (
                    <div className="p-6 flex items-center justify-center">
                        <RefreshCw size={16} className="animate-spin text-slate-300" />
                    </div>
                ) : waitlist.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">
                        {t('admin.dine.no_waitlist', 'No {{status}} waitlist entries', { status: statusFilter })}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                        {waitlist.map(entry => (
                            <div key={entry.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">
                                        {(entry.profile?.full_name || entry.profile?.name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                {entry.profile?.full_name || entry.profile?.name || 'Unknown'}
                                            </p>
                                            {statusBadge(entry.status)}
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium truncate">
                                            {entry.profile?.email || ''} · {formatDistanceToNow(entry.created_at)}
                                        </p>
                                        {entry.message && (
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-1">"{entry.message}"</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                    {entry.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => updateStatus.mutate({ entryId: entry.id, status: 'approved' })}
                                                className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-colors text-emerald-600"
                                                title={t('admin.dine.approve', 'Approve')}
                                            >
                                                <UserCheck size={14} />
                                            </button>
                                            <button
                                                onClick={() => updateStatus.mutate({ entryId: entry.id, status: 'rejected' })}
                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors text-red-500"
                                                title={t('admin.dine.reject', 'Reject')}
                                            >
                                                <UserX size={14} />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => deleteEntry.mutate(entry.id)}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors text-slate-300 hover:text-red-500"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Reports Tab ────────────────────────────────────────────────────────────

function ReportsTab() {
    const { t } = useTranslation()
    const [statusFilter, setStatusFilter] = useState('open')
    const { data: reports = [], isLoading } = useDineAdminReports({ status: statusFilter })
    const updateReport = useUpdateReportStatusMutation()

    const reasonLabel = (reason) => {
        const labels = {
            harassment: 'Harassment',
            spam: 'Spam',
            inappropriate: 'Inappropriate',
            other: 'Other',
        }
        return labels[reason] || reason
    }

    const statusBadge = (status) => {
        const styles = {
            open: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
            resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
            dismissed: 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400',
        }
        return (
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider', styles[status] || styles.open)}>
                {status}
            </span>
        )
    }

    return (
        <div className="space-y-4">
            {/* Filter tabs */}
            <div className="flex gap-2">
                {['open', 'resolved', 'dismissed'].map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                            statusFilter === s
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'
                        )}
                    >
                        {s === 'open' && <AlertTriangle size={12} />}
                        {s === 'resolved' && <CheckCircle2 size={12} />}
                        {s === 'dismissed' && <XCircle size={12} />}
                        {t(`admin.dine.report_${s}`, s.charAt(0).toUpperCase() + s.slice(1))}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 border border-slate-100 dark:border-white/[0.03] rounded-[24px] overflow-hidden shadow-sm">
                {isLoading ? (
                    <div className="p-6 flex items-center justify-center">
                        <RefreshCw size={16} className="animate-spin text-slate-300" />
                    </div>
                ) : reports.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">
                        {t('admin.dine.no_reports', 'No {{status}} reports', { status: statusFilter })}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                        {reports.map(report => (
                            <div key={report.id} className="px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex items-center -space-x-2">
                                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center text-[10px] font-bold text-red-600 ring-2 ring-white dark:ring-[hsl(220,20%,6%)] z-10">
                                                {(report.reporter?.full_name || report.reporter?.name || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[10px] font-bold text-slate-600 ring-2 ring-white dark:ring-[hsl(220,20%,6%)]">
                                                {(report.reported?.full_name || report.reported?.name || 'U').charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                <span className="text-red-500">{report.reporter?.full_name || report.reporter?.name || 'User'}</span>
                                                {' → '}
                                                <span>{report.reported?.full_name || report.reported?.name || 'User'}</span>
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-400">{formatDistanceToNow(report.created_at)}</span>
                                                {statusBadge(report.status)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                        {report.status === 'open' && (
                                            <>
                                                <button
                                                    onClick={() => updateReport.mutate({ reportId: report.id, status: 'resolved' })}
                                                    className="px-3 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-colors text-emerald-600 text-xs font-bold"
                                                >
                                                    {t('admin.dine.resolve', 'Resolve')}
                                                </button>
                                                <button
                                                    onClick={() => updateReport.mutate({ reportId: report.id, status: 'dismissed' })}
                                                    className="px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-400 text-xs font-bold"
                                                >
                                                    {t('admin.dine.dismiss', 'Dismiss')}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="ml-11 flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                                        {reasonLabel(report.reason)}
                                    </span>
                                    {report.details && (
                                        <p className="text-xs text-slate-500 truncate">"{report.details}"</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

const AdminDineWithMePage = () => {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState('activity')

    const { data: stats, isLoading: loadingStats } = useDineAdminStats()

    const statCards = [
        {
            title: t('admin.dine.stat_active', 'Active Diners'),
            value: loadingStats ? '...' : (stats?.activePresences ?? '—'),
            icon: MapPin,
            color: 'bg-emerald-500',
        },
        {
            title: t('admin.dine.stat_waves', 'Total Waves'),
            value: loadingStats ? '...' : (stats?.totalWaves ?? '—'),
            icon: HandMetal,
            color: 'bg-blue-500',
        },
        {
            title: t('admin.dine.stat_reports', 'Open Reports'),
            value: loadingStats ? '...' : (stats?.openReports ?? '—'),
            icon: AlertTriangle,
            color: 'bg-red-500',
        },
        {
            title: t('admin.dine.stat_waitlist', 'Waitlist Pending'),
            value: loadingStats ? '...' : (stats?.waitlistPending ?? '—'),
            icon: Users,
            color: 'bg-amber-500',
        },
    ]

    return (
        <div className="space-y-4 lg:space-y-6 pb-12 font-sans">
            {/* Header */}
            <AdminPageHeader
                eyebrow="Admin"
                title={t('admin.dine.title', 'Dine With Me')}
                subtitle={t('admin.dine.subtitle', 'Monitor activity, manage waitlist, and handle reports')}
                icon={UtensilsCrossed}
            />

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {statCards.map((stat, i) => (
                    <StatCard key={i} {...stat} delay={i} />
                ))}
            </div>

            {/* Tab Selector */}
            <TabSelector activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'activity' && <ActivityTab />}
                    {activeTab === 'waitlist' && <WaitlistTab />}
                    {activeTab === 'reports' && <ReportsTab />}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}

export default AdminDineWithMePage
