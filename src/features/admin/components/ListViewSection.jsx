import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Star, MoreHorizontal, Edit, Trash2, Eye, EyeOff, CheckCircle, XCircle, Sparkles, Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * ListViewSection — DaisyUI-style table for admin locations list.
 * Supports bulk selection with action bar.
 */
const ListViewSection = ({ filteredLocations, viewMode, onEditLocation, onDelete, onApprove, onReject, onToggleVisibility, openActionMenuId, onToggleActionMenu, bulkReindexMutation, bulkEmbeddingMutation }) => {
    const { t } = useTranslation()
    const [selectedIds, setSelectedIds] = useState(new Set())

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const toggleAll = () => {
        if (selectedIds.size === filteredLocations.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredLocations.map(l => l.id)))
        }
    }

    const clearSelection = () => setSelectedIds(new Set())

    const handleBulkDelete = () => {
        if (!confirm(`Delete ${selectedIds.size} locations? This cannot be undone.`)) return
        selectedIds.forEach(id => onDelete(id))
        clearSelection()
    }

    const handleBulkHide = () => {
        selectedIds.forEach(id => onToggleVisibility(id, 'active'))
        clearSelection()
    }

    const handleBulkShow = () => {
        selectedIds.forEach(id => onToggleVisibility(id, 'hidden'))
        clearSelection()
    }

    const handleBulkReindex = () => {
        if (bulkReindexMutation) bulkReindexMutation.mutate({ limit: selectedIds.size })
        clearSelection()
    }

    const handleBulkEmbeddings = () => {
        if (bulkEmbeddingMutation) bulkEmbeddingMutation.mutate({ limit: selectedIds.size, onlyEmpty: true })
        clearSelection()
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return '—'
        const d = new Date(dateStr)
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    }

    const getStatusBadge = (status) => {
        const styles = {
            active: 'badge-success',
            approved: 'badge-success',
            pending: 'badge-warning',
            hidden: 'badge-ghost',
            rejected: 'badge-error',
        }
        return styles[status] || 'badge-ghost'
    }

    if (!filteredLocations || filteredLocations.length === 0) {
        return (
            <div className="text-center py-20 m-4 bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/20 rounded-[32px] border border-dashed border-slate-200 dark:border-white/[0.06]">
                <p className="text-micro font-black text-t-tertiary uppercase tracking-[0.2em]">{t('admin.table.no_objects')}</p>
            </div>
        )
    }

    return (
        <div className="relative">
            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="sticky top-0 z-20 flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 bg-primary/10 border-b border-primary/20 backdrop-blur-sm">
                    <span className="text-[11px] font-medium text-primary">{selectedIds.size} selected</span>
                    <div className="flex items-center gap-3 sm:gap-2 ml-0 sm:ml-auto flex-wrap">
                        <button onClick={handleBulkShow} className="btn btn-ghost btn-sm sm:btn-xs text-[11px] sm:text-[10px] gap-1.5"><Eye size={13} /> Show</button>
                        <button onClick={handleBulkHide} className="btn btn-ghost btn-sm sm:btn-xs text-[11px] sm:text-[10px] gap-1.5"><EyeOff size={13} /> Hide</button>
                        <button onClick={handleBulkReindex} className="btn btn-ghost btn-sm sm:btn-xs text-[11px] sm:text-[10px] gap-1.5"><Sparkles size={13} /> AI</button>
                        <button onClick={handleBulkEmbeddings} className="btn btn-ghost btn-sm sm:btn-xs text-[11px] sm:text-[10px] gap-1.5">⬡ Embed</button>
                        <button onClick={handleBulkDelete} className="btn btn-ghost btn-sm sm:btn-xs text-[11px] sm:text-[10px] gap-1.5 text-error"><Trash2 size={13} /> Delete</button>
                        <button onClick={clearSelection} className="btn btn-ghost btn-sm sm:btn-xs"><X size={14} /></button>
                    </div>
                </div>
            )}

            {/* ─── Mobile: Vertical card list ─── */}
            <div className="lg:hidden p-3 space-y-2">
                {filteredLocations.map((loc) => (
                    <div
                        key={loc.id}
                        className={cn(
                            "flex items-center gap-3 p-3 rounded-2xl border transition-colors cursor-pointer",
                            "bg-base-100 border-base-200 hover:bg-base-200/50",
                            selectedIds.has(loc.id) && "bg-primary/5 border-primary/20"
                        )}
                        onClick={() => onEditLocation(loc)}
                    >
                        {/* Checkbox */}
                        <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded-sm border border-slate-300 dark:border-slate-600 accent-primary cursor-pointer shrink-0"
                            checked={selectedIds.has(loc.id)}
                            onChange={(e) => { e.stopPropagation(); toggleSelect(loc.id) }}
                            onClick={(e) => e.stopPropagation()}
                        />
                        {/* Avatar */}
                        <div className="mask mask-squircle h-9 w-9 bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden">
                            {loc.image_url || loc.image ? (
                                <img src={loc.image_url || loc.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px] font-bold">
                                    {loc.title?.[0] || '?'}
                                </div>
                            )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs truncate">{loc.title}</div>
                            <div className="text-[10px] opacity-50 truncate">{loc.city}{loc.country ? `, ${loc.country}` : ''}</div>
                        </div>
                        {/* Right side */}
                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {(loc.google_rating || loc.rating) && (
                                <div className="flex items-center gap-0.5">
                                    <Star size={9} className="text-amber-400 fill-amber-400" />
                                    <span className="text-[10px] font-medium">{loc.google_rating || loc.rating}</span>
                                </div>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleVisibility(loc.id, loc.status) }}
                                className={cn("p-1 rounded-lg", loc.status === 'hidden' ? 'text-slate-400' : 'text-emerald-500')}
                            >
                                {loc.status === 'hidden' ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── Desktop: Table view ─── */}
            <div className="hidden lg:block overflow-x-auto">
            <table className="table table-xs">
                <thead>
                    <tr className="text-[10px] uppercase tracking-wider">
                        <th className="w-8 px-2">
                            <label>
                                <input
                                    type="checkbox"
                                    className="w-3.5 h-3.5 rounded-sm border border-slate-300 dark:border-slate-600 accent-primary cursor-pointer"
                                    checked={filteredLocations.length > 0 && selectedIds.size === filteredLocations.length}
                                    onChange={toggleAll}
                                />
                            </label>
                        </th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Rating</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th className="hidden md:table-cell">Created</th>
                        <th className="hidden md:table-cell">Updated</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {filteredLocations.map((loc) => (
                        <tr key={loc.id} className={cn("hover cursor-pointer", selectedIds.has(loc.id) && "bg-primary/5")} onClick={() => onEditLocation(loc)}>
                            <th className="w-8 px-2" onClick={(e) => e.stopPropagation()}>
                                <label>
                                    <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 rounded-sm border border-slate-300 dark:border-slate-600 accent-primary cursor-pointer"
                                        checked={selectedIds.has(loc.id)}
                                        onChange={() => toggleSelect(loc.id)}
                                    />
                                </label>
                            </th>
                            <td>
                                <div className="flex items-center gap-3">
                                    <div className="avatar">
                                        <div className="mask mask-squircle h-8 w-8 bg-slate-100 dark:bg-slate-800">
                                            {loc.image_url || loc.image ? (
                                                <img src={loc.image_url || loc.image} alt={loc.title} className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                                                    {loc.title?.[0] || '?'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-medium text-xs line-clamp-1">{loc.title}</div>
                                        <div className="text-[10px] opacity-50">{loc.city}{loc.country ? `, ${loc.country}` : ''}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span className="badge badge-ghost badge-xs text-[10px]">{loc.category || '—'}</span>
                            </td>
                            <td>
                                {(loc.google_rating || loc.rating) ? (
                                    <div className="flex items-center gap-1">
                                        <Star size={10} className="text-amber-400 fill-amber-400" />
                                        <span className="text-xs">{loc.google_rating || loc.rating}</span>
                                    </div>
                                ) : (
                                    <span className="text-[10px] opacity-40">—</span>
                                )}
                            </td>
                            <td>
                                <span className="text-xs">{loc.price_range || '—'}</span>
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => onToggleVisibility(loc.id, loc.status)}
                                    className={cn("btn btn-ghost btn-xs", loc.status === 'hidden' ? 'text-slate-400' : 'text-emerald-500')}
                                >
                                    {loc.status === 'hidden' ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </td>
                            <td className="hidden md:table-cell">
                                <span className="text-[10px] opacity-60">{formatDate(loc.createdAt || loc.created_at)}</span>
                            </td>
                            <td className="hidden md:table-cell">
                                <span className="text-[10px] opacity-60">{formatDate(loc.updatedAt || loc.updated_at)}</span>
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                                <div className="relative">
                                    <button
                                        onClick={() => onToggleActionMenu(loc.id)}
                                        className="btn btn-ghost btn-xs"
                                    >
                                        <MoreHorizontal size={14} />
                                    </button>
                                    {openActionMenuId === loc.id && (
                                        <div className="absolute right-0 top-8 z-50 bg-base-100 border border-base-300 rounded-xl shadow-xl p-2 min-w-[160px]">
                                            <button onClick={() => { onEditLocation(loc); onToggleActionMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-base-200 transition-colors">
                                                <Edit size={14} /> Edit
                                            </button>
                                            {loc.status === 'pending' && (
                                                <button onClick={() => { onApprove(loc.id); onToggleActionMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-base-200 text-success transition-colors">
                                                    <CheckCircle size={14} /> Approve
                                                </button>
                                            )}
                                            {loc.status === 'pending' && (
                                                <button onClick={() => { onReject(loc.id); onToggleActionMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-base-200 text-warning transition-colors">
                                                    <XCircle size={14} /> Reject
                                                </button>
                                            )}
                                            <button onClick={() => { onToggleVisibility(loc.id, loc.status); onToggleActionMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-base-200 transition-colors">
                                                {loc.status === 'hidden' ? <Eye size={14} /> : <EyeOff size={14} />}
                                                {loc.status === 'hidden' ? 'Show' : 'Hide'}
                                            </button>
                                            <div className="border-t border-base-300 my-1" />
                                            <button onClick={() => { onDelete(loc.id); onToggleActionMenu(null) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg hover:bg-base-200 text-error transition-colors">
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </div>
    )
}

export default ListViewSection
