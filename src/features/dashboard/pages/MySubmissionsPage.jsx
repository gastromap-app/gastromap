import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, Clock, CheckCircle2, XCircle, AlertCircle, Plus } from 'lucide-react'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'
import { getMySubmissions } from '@/shared/api/submissions.api'

// ─── Config ────────────────────────────────────────────────────────────────

const STATUS = {
    pending:  {
        label: 'Under Review',
        Icon:  Clock,
        color: 'text-amber-700 dark:text-amber-400',
        bg:    'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
    },
    approved: {
        label: 'Approved',
        Icon:  CheckCircle2,
        color: 'text-emerald-700 dark:text-emerald-400',
        bg:    'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
    },
    rejected: {
        label: 'Rejected',
        Icon:  XCircle,
        color: 'text-red-600 dark:text-red-400',
        bg:    'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
    },
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const cfg = STATUS[status] || STATUS.pending
    const { Icon } = cfg
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl border ${cfg.bg} ${cfg.color}`}>
            <Icon size={12} strokeWidth={2.5} /> {cfg.label}
        </span>
    )
}

function SubmissionCard({ item, index }) {
    const date = new Date(item.created_at).toLocaleDateString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric',
    })

    return (
        <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: index * 0.06 }}
            className="bg-white dark:bg-[hsl(220,20%,6%)] border border-slate-100 dark:border-white/[0.06] rounded-3xl p-5 space-y-3 shadow-sm"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 dark:text-white truncate">{item.name}</p>
                    <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-0.5">
                        <MapPin size={13} strokeWidth={2} />
                        <span className="truncate">{[item.address, item.city].filter(Boolean).join(', ')}</span>
                    </div>
                </div>
                <StatusBadge status={item.status} />
            </div>

            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 capitalize bg-slate-100 dark:bg-[hsl(220,20%,9%)] px-2.5 py-1 rounded-lg">
                    {item.category}
                </span>
                <span className="text-xs text-slate-400">{date}</span>
            </div>

            {item.status === 'pending' && (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400/80 text-xs bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl px-3 py-2">
                    <AlertCircle size={12} /> Usually reviewed within 48 hours
                </div>
            )}
            {item.status === 'approved' && (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400/80 text-xs bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-3 py-2">
                    <CheckCircle2 size={12} /> +100 points credited to your account
                </div>
            )}
            {item.status === 'rejected' && item.rejection_reason && (
                <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl px-3 py-2 space-y-0.5">
                    <p className="text-xs font-bold text-red-600 dark:text-red-400">Rejection reason</p>
                    <p className="text-xs text-red-500 dark:text-red-400/70">{item.rejection_reason}</p>
                </div>
            )}
        </motion.div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function MySubmissionsPage() {
    const { user }  = useAuthStore()
    const navigate  = useNavigate()
    const [submissions, setSubmissions] = useState([])
    const [loading, setLoading]         = useState(true)
    const [error, setError]             = useState('')

    useEffect(() => {
        if (!user?.id) return
        getMySubmissions(user.id)
            .then(setSubmissions)
            .catch((err) => setError(err.message || 'Failed to load your submissions.'))
            .finally(() => setLoading(false))
    }, [user?.id])

    const counts = {
        pending:  submissions.filter((s) => s.status === 'pending').length,
        approved: submissions.filter((s) => s.status === 'approved').length,
        rejected: submissions.filter((s) => s.status === 'rejected').length,
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 mt-14 md:mt-20 pb-16">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">My Submissions</h1>
                    <p className="text-slate-500 dark:text-[hsl(220,10%,55%)] mt-1">Places you have suggested to GastroMap</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/add-place')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                    <Plus size={16} /> Add
                </button>
            </div>

            {/* Stats row */}
            {!loading && submissions.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                        { label: 'Pending',  count: counts.pending,  color: 'text-amber-600 dark:text-amber-400'   },
                        { label: 'Approved', count: counts.approved, color: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Rejected', count: counts.rejected, color: 'text-red-500 dark:text-red-400'      },
                    ].map((s) => (
                        <div key={s.label} className="bg-white dark:bg-[hsl(220,20%,6%)] border border-slate-100 dark:border-white/[0.06] rounded-2xl p-4 text-center shadow-sm">
                            <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
                            <p className="text-slate-400 text-xs mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4">
                    <AlertCircle size={20} className="text-red-500 shrink-0" />
                    <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Empty */}
            {!loading && !error && submissions.length === 0 && (
                <div className="text-center py-20 space-y-5">
                    <div className="text-6xl">📍</div>
                    <div>
                        <p className="text-xl font-black text-slate-900 dark:text-white">No submissions yet</p>
                        <p className="text-slate-500 dark:text-[hsl(220,10%,55%)] mt-2">
                            Know a great place that is not on GastroMap? Add it!
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/dashboard/add-place')}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-lg active:scale-95"
                    >
                        <Plus size={18} /> Add First Place
                    </button>
                </div>
            )}

            {/* List */}
            {!loading && !error && (
                <div className="space-y-3">
                    {submissions.map((item, i) => (
                        <SubmissionCard key={item.id} item={item} index={i} />
                    ))}
                </div>
            )}
        </div>
    )
}
