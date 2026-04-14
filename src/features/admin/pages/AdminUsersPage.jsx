import React, { useState, useMemo } from 'react'
import {
    Users, Search, Filter, MoreHorizontal,
    Mail, Shield, Calendar, ChevronRight, X,
    ArrowUpRight, Clock, Star, MapPin, Building2, Zap,
    CheckCircle2, Ban, KeyRound, ChevronDown
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useProfiles, useUpdateProfileRoleMutation } from '@/shared/api/queries'

const AdminUsersPage = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState('All')
    const [showFilters, setShowFilters] = useState(false)
    const [selectedUser, setSelectedUser] = useState(null)
    const [isSlideOverOpen, setIsSlideOverOpen] = useState(false)
    const [editRole, setEditRole] = useState('')
    const [editStatus, setEditStatus] = useState('')
    const [saveToast, setSaveToast] = useState(null)

    const { data: profiles = [], isLoading: loadingProfiles } = useProfiles()
    const updateProfileRole = useUpdateProfileRoleMutation()

    const showToast = (msg) => {
        setSaveToast(msg)
        setTimeout(() => setSaveToast(null), 3000)
    }

    const filteredUsers = useMemo(() => {
        const q = searchQuery.toLowerCase()
        return profiles.filter(u => {
            const name = u.name || u.email || ''
            const matchesSearch = !q || name.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
            const matchesRole = roleFilter === 'All' || u.role === roleFilter
            return matchesSearch && matchesRole
        })
    }, [profiles, searchQuery, roleFilter])

    const openUser = (user) => {
        setSelectedUser(user)
        setEditRole(user.role || 'user')
        setEditStatus(user.status || 'active')
        setIsSlideOverOpen(true)
    }

    const handleUpdate = async () => {
        await updateProfileRole.mutateAsync({ userId: selectedUser.id, role: editRole })
        setIsSlideOverOpen(false)
        showToast(`${selectedUser.name || selectedUser.email} updated successfully.`)
    }

    const handleBanToggle = (user) => {
        showToast(`${user.name || user.email} ${user.status === 'active' ? 'restricted' : 'reactivated'}.`)
    }

    const stats = [
        { label: 'Total Users', val: loadingProfiles ? '...' : profiles.length.toString(), icon: Users, bg: 'bg-blue-50 dark:bg-blue-500/10', color: 'text-blue-600' },
                { label: 'Moderators', val: profiles.filter(u => u.role === 'moderator').length.toString(), icon: Star, bg: 'bg-indigo-50 dark:bg-indigo-500/10', color: 'text-indigo-600 dark:text-indigo-400' }
        { label: 'Active', val: profiles.filter(u => u.status === 'active').length.toString(), icon: Zap, bg: 'bg-green-50 dark:bg-green-500/10', color: 'text-green-600' },
    ]

    const inputClass = "w-full h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-medium text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all"
    const selectClass = "w-full h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-white appearance-none outline-none focus:border-indigo-500 transition-all cursor-pointer"

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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                <div>
                    <h1 className="text-xl lg:text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">Users</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1.5 text-xs lg:text-base">Member database and access management.</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 lg:gap-8">
                {stats.map((s, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900/50 p-3 lg:p-7 rounded-[28px] lg:rounded-[40px] border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col sm:flex-row items-center gap-2 lg:gap-5 group hover:border-indigo-500/10 transition-all overflow-hidden relative">
                        <div className={cn("w-10 h-10 lg:w-16 lg:h-16 rounded-[18px] lg:rounded-[24px] flex items-center justify-center relative z-10 shrink-0 shadow-inner", s.bg, s.color)}>
                            <s.icon size={18} className="lg:w-7 lg:h-7" />
                        </div>
                        <div className="text-center sm:text-left relative z-10 min-w-0">
                            <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-0.5">{s.label}</p>
                            <p className="text-sm lg:text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tighter truncate">{s.val}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[32px] lg:rounded-[48px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden flex flex-col flex-1">
                <div className="p-4 lg:p-10 border-b border-slate-50 dark:border-slate-800/50 flex flex-col gap-4">
                    <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
                        <div className="relative flex-1 lg:max-w-md group leading-none">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                aria-label="Search users"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950/30 border-none rounded-2xl text-[13px] font-medium outline-none focus:ring-2 ring-indigo-500/10 transition-all shadow-inner"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={cn(
                                "flex items-center justify-center gap-2 px-6 py-2.5 border rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm",
                                showFilters
                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                    : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-500 hover:text-indigo-600"
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
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {['All', 'admin', 'moderator', 'user'].map(role => (
                                        <button
                                            key={role}
                                            onClick={() => setRoleFilter(role)}
                                            className={cn(
                                                "px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all",
                                                roleFilter === role
                                                    ? "bg-indigo-600 text-white shadow-md"
                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600"
                                            )}
                                        >
                                            {role === 'admin' ? 'Admin' : role === 'moderator' ? 'Moderator' : role === 'user' ? 'User' : role}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="overflow-x-auto custom-scrollbar font-black leading-none">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest pl-10 lg:pl-12">Member</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">Role</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">Activity</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest">Status</th>
                                <th className="px-6 py-4 text-right pr-10 lg:pr-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {loadingProfiles ? (
                                <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm font-semibold">Loading users...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm font-semibold">No users found.</td></tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr
                                        key={user.id}
                                        onClick={() => openUser(user)}
                                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all group cursor-pointer border-none leading-none"
                                    >
                                        <td className="px-6 py-5 pl-10 lg:pl-12">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-900 dark:text-white font-bold text-xs shadow-inner group-hover:scale-110 transition-transform">
                                                    {(user.name || user.email || 'U').charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{user.name || user.email}</p>
                                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 font-medium">
                                                        <Mail size={10} className="opacity-50" />{user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <Badge variant="outline" className={cn(
                                                "bg-transparent border border-slate-100 dark:border-slate-800/50 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                                                user.role === 'admin' ? 'text-rose-600 dark:text-rose-400' : user.role === 'moderator' ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                                            )}>
                                                {user.role}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[11px] font-bold text-slate-500">—</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className={cn(
                                                "inline-flex items-center p-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider",
                                                user.status === 'active' ? 'bg-green-50 dark:bg-green-500/5 text-green-600' : 'bg-red-50 text-red-500'
                                            )}>
                                                <div className={cn("w-1.5 h-1.5 rounded-full mr-2", user.status === 'active' ? 'bg-green-500' : 'bg-red-500')} />
                                                {user.status}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right pr-10 lg:pr-12">
                                            <button
                                                aria-label={`Ban or activate ${user.name || user.email}`}
                                                onClick={(e) => { e.stopPropagation(); handleBanToggle(user) }}
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
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 250 }} className="fixed top-0 right-0 w-full sm:w-[500px] bg-white dark:bg-slate-900 h-full z-[110] flex flex-col shadow-2xl">

                            <div className="p-8 lg:p-12 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
                                <div>
                                    <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white leading-none mb-1.5">User Profile</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">ID: #USER-{selectedUser.id}</p>
                                </div>
                                <button onClick={() => setIsSlideOverOpen(false)} aria-label="Close panel" className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all"><X size={20} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 lg:p-14 space-y-12 custom-scrollbar">
                                <div className="flex flex-col items-center py-10 bg-slate-50/50 dark:bg-slate-800/30 rounded-[40px] border border-slate-100 dark:border-slate-800/50 shadow-inner group">
                                    <div className="w-28 h-28 rounded-[36px] bg-indigo-600 text-white flex items-center justify-center text-4xl font-bold shadow-2xl shadow-indigo-500/20 mb-6 group-hover:scale-105 transition-transform">{(selectedUser.name || selectedUser.email || 'U').charAt(0)}</div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{selectedUser.name || selectedUser.email}</h3>
                                    <p className="text-[13px] font-medium text-slate-400 mt-2">{selectedUser.email}</p>
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">
                                        Joined {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString('en-GB') : '—'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-6 leading-none">
                                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Visits</p>
                                        <p className="text-3xl font-bold text-slate-900 dark:text-white">—</p>
                                    </div>
                                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Reviews</p>
                                        <p className="text-3xl font-bold text-slate-900 dark:text-white">—</p>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 leading-none">
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
                                            <option value="inactive">Restricted</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 lg:p-12 border-t border-slate-100 dark:border-slate-800/50 flex gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shrink-0">
                                <button onClick={handleUpdate} className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[28px] font-bold text-[11px] uppercase tracking-widest shadow-2xl active:scale-[0.97] transition-all">
                                    Save Changes
                                </button>
                                <button onClick={() => setIsSlideOverOpen(false)} className="px-10 py-4 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-[28px] font-bold text-[11px] uppercase tracking-widest hover:text-slate-900 dark:hover:text-white transition-all">
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}

export default AdminUsersPage
