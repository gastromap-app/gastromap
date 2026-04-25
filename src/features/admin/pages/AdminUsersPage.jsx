import React, { useState, useMemo } from 'react'
import {
    Users, Search, Filter, MoreHorizontal,
    Mail, Shield, Calendar, ChevronRight, X,
    ArrowUpRight, Clock, Star, MapPin, Building2, Zap,
    CheckCircle2, Ban, KeyRound, ChevronDown, Heart,
    UtensilsCrossed, Wallet, Leaf, AlertCircle
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import AdminPageHeader from '../components/AdminPageHeader'
import {
    useProfiles,
    useUpdateProfileRoleMutation,
    useUpdateUserStatusMutation,
    useUserDetails
} from '@/shared/api/queries'
import { useAuthStore } from '@/shared/store/useAuthStore'

const relativeTime = (date) => {
    if (!date) return '—'
    const now = Date.now()
    const diff = now - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const formatDate = (date) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const AdminUsersPage = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState('All')
    const [statusFilter, setStatusFilter] = useState('All')
    const [showFilters, setShowFilters] = useState(false)
    const [selectedUser, setSelectedUser] = useState(null)
    const [isSlideOverOpen, setIsSlideOverOpen] = useState(false)
    const [editRole, setEditRole] = useState('')
    const [editStatus, setEditStatus] = useState('')
    const [saveToast, setSaveToast] = useState(null)

    const { data: profiles = [], isLoading: loadingProfiles } = useProfiles()
    const { data: userDetails, isLoading: loadingUserDetails } = useUserDetails(selectedUser?.id)
    const updateProfileRole = useUpdateProfileRoleMutation()
    const updateStatus = useUpdateUserStatusMutation()
    const { user: currentUser } = useAuthStore()

    const showToast = (msg) => {
        setSaveToast(msg)
        setTimeout(() => setSaveToast(null), 3000)
    }

    const [currentPage, setCurrentPage] = useState(1)
    const PAGE_SIZE = 20

    const filteredUsers = useMemo(() => {
        const q = searchQuery.toLowerCase()
        return profiles.filter(u => {
            const name = u.name || u.email || ''
            const matchesSearch = !q || name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
            const matchesRole = roleFilter === 'All' || u.role === roleFilter
            const matchesStatus = statusFilter === 'All' || u.status === statusFilter
            return matchesSearch && matchesRole && matchesStatus
        })
    }, [profiles, searchQuery, roleFilter, statusFilter])

    React.useEffect(() => { setCurrentPage(1) }, [searchQuery, roleFilter, statusFilter])
    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
    const pagedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

    const openUser = (user) => {
        setSelectedUser(user)
        setEditRole(user.role || 'user')
        setEditStatus(user.status || 'active')
        setIsSlideOverOpen(true)
    }

    const handleUpdate = async () => {
        const roleChanged = editRole !== selectedUser.role
        const statusChanged = editStatus !== selectedUser.status

        if (roleChanged && selectedUser.id === currentUser?.id) {
            showToast('Невозможно изменить собственную роль')
            return
        }

        try {
            if (roleChanged) {
                await updateProfileRole.mutateAsync({ userId: selectedUser.id, role: editRole })
            }
            if (statusChanged) {
                await updateStatus.mutateAsync({ userId: selectedUser.id, status: editStatus })
            }
            if (roleChanged || statusChanged) {
                showToast(`${selectedUser.name || selectedUser.email} updated successfully.`)
            }
            setIsSlideOverOpen(false)
        } catch (err) {
            showToast('Error: ' + err.message)
        }
    }

    const handleStatusChange = async (user, newStatus) => {
        if (user.role === 'admin') {
            showToast('Cannot change admin status.')
            return
        }
        try {
            await updateStatus.mutateAsync({ userId: user.id, status: newStatus })
            showToast(`${user.name || user.email} — status changed to ${newStatus}`)
        } catch (err) {
            showToast('Error: ' + err.message)
        }
    }

    const getQuickActionStatus = (status) => {
        if (status === 'active') return 'suspended'
        return 'active'
    }

    const stats = [
        { label: 'Total Users', val: loadingProfiles ? '...' : profiles.length.toString(), icon: Users, bg: 'bg-blue-50 dark:bg-blue-500/10', color: 'text-blue-600' },
        { label: 'Active', val: profiles.filter(u => u.status === 'active').length.toString(), icon: Zap, bg: 'bg-green-50 dark:bg-green-500/10', color: 'text-green-600' },
        { label: 'Suspended', val: profiles.filter(u => u.status === 'suspended').length.toString(), icon: AlertCircle, bg: 'bg-amber-50 dark:bg-amber-500/10', color: 'text-amber-600' },
        { label: 'Banned', val: profiles.filter(u => u.status === 'banned').length.toString(), icon: Ban, bg: 'bg-red-50 dark:bg-red-500/10', color: 'text-red-600' },
    ]

    const roleBadgeClass = (role) => {
        if (role === 'admin') return 'text-rose-600 dark:text-rose-400'
        if (role === 'moderator') return 'text-indigo-500 dark:text-indigo-400'
        return 'text-slate-500 dark:text-[hsl(220,10%,55%)]'
    }

    const statusBadgeClass = (status) => {
        if (status === 'active') return 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'
        if (status === 'suspended') return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
        return 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
    }

    const statusDotClass = (status) => {
        if (status === 'active') return 'bg-green-500'
        if (status === 'suspended') return 'bg-amber-500'
        return 'bg-red-500'
    }

    const selectClass = "w-full h-12 bg-slate-50 dark:bg-[hsl(220,20%,9%)]/50 border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-white appearance-none outline-none focus:border-indigo-500 transition-all cursor-pointer"

    const preferences = userDetails?.preferences || {}
    const submittedLocations = userDetails?.submittedLocations || []
    const favorites = userDetails?.favorites || []

    return (
        <div className="space-y-6 lg:space-y-10 pb-12 font-sans">
            {/* Toast */}
            <AnimatePresence>
                {saveToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-24 right-8 z-[9999] px-5 py-3 rounded-2xl bg-slate-900/95 text-white text-sm font-semibold shadow-xl border border-white/10 backdrop-blur-md"
                    >
                        <CheckCircle2 size={14} className="inline mr-2 text-emerald-400" />
                        {saveToast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <AdminPageHeader
                eyebrow="Admin"
                title="Users"
                subtitle="Member database and access management."
            />

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-8">
                {stats.map((s, i) => (
                    <div key={i} className="bg-white dark:bg-[hsl(220,20%,6%)]/50 p-3 lg:p-7 rounded-[28px] lg:rounded-[40px] border border-slate-100 dark:border-white/[0.03] shadow-sm flex flex-col sm:flex-row items-center gap-2 lg:gap-5 group hover:border-indigo-500/10 transition-all overflow-hidden relative">
                        <div className={cn("w-10 h-10 lg:w-16 lg:h-16 rounded-[18px] lg:rounded-[24px] flex items-center justify-center relative z-10 shrink-0 shadow-inner", s.bg, s.color)}>
                            <s.icon size={18} className="lg:w-7 lg:h-7" />
                        </div>
                        <div className="text-center sm:text-left relative z-10 min-w-0">
                            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest mb-0.5">{s.label}</p>
                            <p className="text-sm lg:text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tighter truncate">{s.val}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-6">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-[hsl(220,20%,9%)] disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-[hsl(220,20%,15%)] transition-colors"
                    >← Prev</button>
                    <span className="text-sm font-bold text-slate-500 dark:text-[hsl(220,10%,55%)]">
                        {currentPage} / {totalPages}
                    </span>
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-[hsl(220,20%,9%)] disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-[hsl(220,20%,15%)] transition-colors"
                    >Next →</button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[32px] lg:rounded-[48px] border border-slate-100 dark:border-white/[0.03] shadow-sm overflow-hidden flex flex-col flex-1">
                <div className="p-4 lg:p-10 border-b border-slate-50 dark:border-white/[0.03] flex flex-col gap-4">
                    <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
                        <div className="relative flex-1 lg:max-w-md group leading-none">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                aria-label="Search users"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[hsl(220,20%,3%)]/30 border-none rounded-2xl text-[13px] font-medium outline-none focus:ring-2 ring-indigo-500/10 transition-all shadow-inner"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={cn(
                                "flex items-center justify-center gap-2 px-6 py-2.5 border rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm",
                                showFilters
                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                    : "bg-white dark:bg-[hsl(220,20%,9%)] border-slate-100 dark:border-white/[0.06] text-slate-500 hover:text-indigo-600"
                            )}
                        >
                            <Filter size={16} />Filters
                            <ChevronDown size={14} className={cn("transition-transform", showFilters && "rotate-180")} />
                        </button>
                    </div>

                    {/* Filter panel */}
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="space-y-3 pt-2">
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest py-1.5">Role:</span>
                                        {['All', 'admin', 'moderator', 'user'].map(role => (
                                            <button
                                                key={role}
                                                onClick={() => setRoleFilter(role)}
                                                className={cn(
                                                    "px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all",
                                                    roleFilter === role
                                                        ? "bg-indigo-600 text-white shadow-md"
                                                        : "bg-slate-100 dark:bg-[hsl(220,20%,9%)] text-slate-500 hover:text-indigo-600"
                                                )}
                                            >
                                                {role === 'admin' ? 'Admin' : role === 'moderator' ? 'Moderator' : role === 'user' ? 'User' : role}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest py-1.5">Status:</span>
                                        {['All', 'active', 'suspended', 'banned'].map(status => (
                                            <button
                                                key={status}
                                                onClick={() => setStatusFilter(status)}
                                                className={cn(
                                                    "px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all",
                                                    statusFilter === status
                                                        ? "bg-indigo-600 text-white shadow-md"
                                                        : "bg-slate-100 dark:bg-[hsl(220,20%,9%)] text-slate-500 hover:text-indigo-600"
                                                )}
                                            >
                                                {status === 'active' ? 'Active' : status === 'suspended' ? 'Suspended' : status === 'banned' ? 'Banned' : status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden p-4 space-y-3">
                    {loadingProfiles ? (
                        <div className="py-8 text-center text-slate-400 text-sm font-semibold">Loading users...</div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-sm font-semibold">No users found.</div>
                    ) : (
                        pagedUsers.map(user => (
                            <div
                                key={`card-${user.id}`}
                                onClick={() => openUser(user)}
                                onKeyDown={(e) => e.key === 'Enter' && openUser(user)}
                                role="button"
                                tabIndex={0}
                                className="w-full text-left bg-slate-50 dark:bg-[hsl(220,20%,9%)]/40 rounded-2xl p-4 active:scale-[0.99] transition-transform border border-slate-100 dark:border-white/[0.06] cursor-pointer outline-none focus:ring-2 ring-indigo-500/20"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-900 dark:text-white font-bold text-sm shadow-inner shrink-0">
                                        {(user.name || user.email || 'U').charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.name || user.email}</p>
                                        <p className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] mt-0.5 truncate flex items-center gap-1">
                                            <Mail size={10} />{user.email}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            <Badge variant="outline" className={cn(
                                                "bg-transparent border border-slate-200 dark:border-white/[0.08] px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                                roleBadgeClass(user.role)
                                            )}>
                                                {user.role}
                                            </Badge>
                                            <div className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                                statusBadgeClass(user.status)
                                            )}>
                                                <div className={cn("w-1.5 h-1.5 rounded-full mr-1.5", statusDotClass(user.status))} />
                                                {user.status}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                                            <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(user.created_at)}</span>
                                            <span className="flex items-center gap-1"><Clock size={10} />{relativeTime(user.last_active_at)}</span>
                                            <span className="flex items-center gap-1"><MapPin size={10} />{(user.submittedLocations || 0)}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 shrink-0">
                                        <ChevronRight size={16} className="text-slate-400" />
                                        <button
                                            aria-label={`${user.status === 'active' ? 'Suspend' : 'Activate'} ${user.name || user.email}`}
                                            onClick={(e) => { e.stopPropagation(); handleStatusChange(user, getQuickActionStatus(user.status)) }}
                                            className={cn(
                                                "p-2 rounded-xl transition-all",
                                                user.status === 'active'
                                                    ? "text-slate-300 hover:text-red-500 hover:bg-red-50"
                                                    : "text-slate-300 hover:text-emerald-500 hover:bg-emerald-50"
                                            )}
                                        >
                                            {user.status === 'active' ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="hidden md:block overflow-x-auto custom-scrollbar font-black leading-none">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-[hsl(220,20%,6%)]/50">
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest pl-10 lg:pl-12">Member</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest">Role</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest">Registered</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest">Last Active</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-[hsl(220,10%,55%)] tracking-widest">Contributions</th>
                                <th className="px-6 py-4 text-right pr-10 lg:pr-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {loadingProfiles ? (
                                <tr><td colSpan={7} className="py-12 text-center text-slate-400 text-sm font-semibold">Loading users...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={7} className="py-12 text-center text-slate-400 text-sm font-semibold">No users found.</td></tr>
                            ) : (
                                pagedUsers.map((user) => (
                                    <tr
                                        key={user.id}
                                        onClick={() => openUser(user)}
                                        className="hover:bg-slate-50/80 dark:hover:bg-[hsl(220,20%,12%)]/40 transition-all group cursor-pointer border-none leading-none"
                                    >
                                        <td className="px-6 py-5 pl-10 lg:pl-12">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-900 dark:text-white font-bold text-xs shadow-inner group-hover:scale-110 transition-transform">
                                                    {(user.name || user.email || 'U').charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{user.name || user.email}</p>
                                                    <p className="text-[11px] text-slate-400 dark:text-[hsl(220,10%,55%)] mt-1 flex items-center gap-1 font-medium">
                                                        <Mail size={10} className="opacity-50" />{user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <Badge variant="outline" className={cn(
                                                "bg-transparent border border-slate-100 dark:border-white/[0.03] px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                                                roleBadgeClass(user.role)
                                            )}>
                                                {user.role}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className={cn(
                                                "inline-flex items-center p-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider",
                                                statusBadgeClass(user.status)
                                            )}>
                                                <div className={cn("w-1.5 h-1.5 rounded-full mr-2", statusDotClass(user.status))} />
                                                {user.status}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-[11px] font-bold text-slate-500">{formatDate(user.created_at)}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-[11px] font-bold text-slate-500">{relativeTime(user.last_active_at)}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                                                <MapPin size={12} className="text-slate-400" />
                                                {user.submittedLocations || 0}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right pr-10 lg:pr-12">
                                            <button
                                                aria-label={`${user.status === 'active' ? 'Suspend' : 'Activate'} ${user.name || user.email}`}
                                                onClick={(e) => { e.stopPropagation(); handleStatusChange(user, getQuickActionStatus(user.status)) }}
                                                className={cn(
                                                    "p-2 rounded-xl transition-all",
                                                    user.status === 'active'
                                                        ? "text-slate-300 hover:text-red-500 hover:bg-red-50"
                                                        : "text-slate-300 hover:text-emerald-500 hover:bg-emerald-50"
                                                )}
                                            >
                                                {user.status === 'active' ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Slide Over */}
            <AnimatePresence>
                {isSlideOverOpen && selectedUser && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSlideOverOpen(false)} className="fixed inset-0 z-[100] bg-slate-900/10 backdrop-blur-md" />
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 250 }} className="fixed top-0 right-0 w-full sm:w-[540px] bg-white dark:bg-[hsl(220,20%,6%)] h-full z-[110] flex flex-col shadow-2xl">

                            <div className="p-8 lg:p-10 border-b border-slate-100 dark:border-white/[0.03] flex justify-between items-center bg-white/50 dark:bg-[hsl(220,20%,6%)]/50 backdrop-blur-xl">
                                <div>
                                    <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white leading-none mb-1.5">User Profile</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">ID: #USER-{selectedUser.id}</p>
                                </div>
                                <button onClick={() => setIsSlideOverOpen(false)} aria-label="Close panel" className="p-3 bg-slate-50 dark:bg-[hsl(220,20%,9%)] text-slate-400 rounded-2xl hover:bg-slate-100 transition-all"><X size={20} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-10 custom-scrollbar">
                                {/* Profile Header */}
                                <div className="flex flex-col items-center py-8 bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/30 rounded-[36px] border border-slate-100 dark:border-white/[0.03] shadow-inner group">
                                    <div className="w-24 h-24 rounded-[32px] bg-indigo-600 text-white flex items-center justify-center text-3xl font-bold shadow-2xl shadow-indigo-500/20 mb-5 group-hover:scale-105 transition-transform">
                                        {(selectedUser.name || selectedUser.email || 'U').charAt(0)}
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-none">{selectedUser.name || selectedUser.email}</h3>
                                    <p className="text-[13px] font-medium text-slate-400 mt-2">{selectedUser.email}</p>
                                    <div className="flex items-center gap-3 mt-3">
                                        <div className={cn(
                                            "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                                            statusBadgeClass(editStatus)
                                        )}>
                                            <div className={cn("w-1.5 h-1.5 rounded-full mr-1.5", statusDotClass(editStatus))} />
                                            {editStatus}
                                        </div>
                                        <Badge variant="outline" className={cn(
                                            "bg-transparent border border-slate-200 dark:border-white/[0.08] px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                                            roleBadgeClass(editRole)
                                        )}>
                                            {editRole}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 mt-4 text-[11px] font-bold text-slate-400">
                                        <span className="flex items-center gap-1"><Calendar size={10} />Joined {formatDate(selectedUser.created_at)}</span>
                                        <span className="flex items-center gap-1"><Clock size={10} />{relativeTime(selectedUser.last_active_at)}</span>
                                    </div>
                                </div>

                                {/* Account Management */}
                                <div className="space-y-5">
                                    <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Account Management</h4>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-2">Access Level</label>
                                        <select
                                            value={editRole}
                                            onChange={(e) => setEditRole(e.target.value)}
                                            className={selectClass}
                                        >
                                            <option value="user">User</option>
                                            <option value="moderator">Moderator</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-2">Account Status</label>
                                        <select
                                            value={editStatus}
                                            onChange={(e) => setEditStatus(e.target.value)}
                                            className={selectClass}
                                        >
                                            <option value="active">Active</option>
                                            <option value="suspended">Suspended</option>
                                            <option value="banned">Banned</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleUpdate}
                                        disabled={updateProfileRole.isPending || updateStatus.isPending}
                                        className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[24px] font-bold text-[11px] uppercase tracking-widest shadow-2xl active:scale-[0.97] transition-all disabled:opacity-50"
                                    >
                                        {(updateProfileRole.isPending || updateStatus.isPending) ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>

                                {loadingUserDetails ? (
                                    <div className="py-6 text-center text-slate-400 text-sm font-semibold">Loading details...</div>
                                ) : (
                                    <>
                                        {/* DNA Preferences */}
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                                <UtensilsCrossed size={12} /> DNA Preferences
                                            </h4>
                                            {(!preferences.favorite_cuisines?.length && !preferences.vibe_preference?.length && !preferences.price_range?.length && !preferences.dietary_restrictions?.length) ? (
                                                <div className="text-[13px] font-medium text-slate-400 bg-slate-50 dark:bg-[hsl(220,20%,9%)]/30 rounded-2xl p-5 border border-slate-100 dark:border-white/[0.03]">
                                                    No preferences configured
                                                </div>
                                            ) : (
                                                <div className="space-y-4 bg-slate-50 dark:bg-[hsl(220,20%,9%)]/30 rounded-2xl p-5 border border-slate-100 dark:border-white/[0.03]">
                                                    {preferences.favorite_cuisines?.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2">Favorite Cuisines</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {preferences.favorite_cuisines.map((c, i) => (
                                                                    <span key={i} className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold">{c}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {preferences.vibe_preference?.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2">Vibe Preferences</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {preferences.vibe_preference.map((v, i) => (
                                                                    <span key={i} className="px-3 py-1 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-bold">{v}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {preferences.price_range?.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2">Price Range</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {preferences.price_range.map((p, i) => (
                                                                    <span key={i} className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">{p}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {preferences.dietary_restrictions?.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2">Dietary Restrictions</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {preferences.dietary_restrictions.map((d, i) => (
                                                                    <span key={i} className="px-3 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-bold">{d}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Contributions */}
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                                <MapPin size={12} /> Contributions
                                            </h4>
                                            <div className="bg-slate-50 dark:bg-[hsl(220,20%,9%)]/30 rounded-2xl p-5 border border-slate-100 dark:border-white/[0.03]">
                                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{submittedLocations.length}</p>
                                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mt-1">Submitted Locations</p>
                                                {submittedLocations.length === 0 ? (
                                                    <p className="text-[13px] font-medium text-slate-400 mt-3">No contributions yet</p>
                                                ) : (
                                                    <div className="mt-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                                        {submittedLocations.map((loc, i) => (
                                                            <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-[hsl(220,20%,9%)]/50 rounded-xl border border-slate-100 dark:border-white/[0.06]">
                                                                <div className="min-w-0">
                                                                    <p className="text-[12px] font-bold text-slate-900 dark:text-white truncate">{loc.title || 'Untitled'}</p>
                                                                    <p className="text-[11px] text-slate-400 mt-0.5">{loc.city || '—'}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className={cn(
                                                                        "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider",
                                                                        loc.status === 'approved' ? 'bg-green-50 dark:bg-green-500/10 text-green-600' :
                                                                        loc.status === 'pending' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600' :
                                                                        'bg-slate-100 dark:bg-[hsl(220,20%,12%)] text-slate-500'
                                                                    )}>
                                                                        {loc.status || 'unknown'}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400">{formatDate(loc.date)}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Favorites */}
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                                <Heart size={12} /> Favorites
                                            </h4>
                                            <div className="bg-slate-50 dark:bg-[hsl(220,20%,9%)]/30 rounded-2xl p-5 border border-slate-100 dark:border-white/[0.03]">
                                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{favorites.length}</p>
                                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mt-1">Saved Places</p>
                                                {favorites.length === 0 && (
                                                    <p className="text-[13px] font-medium text-slate-400 mt-3">No favorites yet</p>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}

export default AdminUsersPage
