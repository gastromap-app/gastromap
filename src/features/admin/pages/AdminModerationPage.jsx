import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    CheckCircle2, XCircle, Search, Filter,
    MapPin, User, Calendar, MessageSquare, AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import AdminPageHeader from '../components/AdminPageHeader'
import { usePendingReviews, usePendingLocations, useUpdateReviewStatusMutation, useUpdateLocationStatusMutation } from '@/shared/api/queries'

export default function AdminModerationPage() {
    const { data: pendingReviews = [], isLoading: _loadingReviews } = usePendingReviews()
    const { data: pendingLocations = [], isLoading: _loadingLocs } = usePendingLocations()
    const updateReviewStatus = useUpdateReviewStatusMutation()
    const updateLocationStatus = useUpdateLocationStatusMutation()

    // Combine both into a unified queue
    const queue = [
        ...pendingReviews.map(r => ({
            ...r,
            queueType: 'review',
            name: r.locations?.title || r.location_name || 'Unknown Location',
            type: 'Review',
            city: r.locations?.city || r.location_city || '\u2014',
            author: r.profiles?.name || r.profiles?.full_name || r.user_name || r.user_email || 'Anonymous',
            date: r.created_at,
            insiderTip: r.review_text?.substring(0, 100) || '\u2014',
            mustTry: `Rating: ${r.rating}/5`,
            tags: r.rating >= 4 ? ['High Rating'] : ['Needs Attention'],
            status: 'PENDING_MODERATION'
        })),
        ...pendingLocations.map(l => ({
            ...l,
            queueType: 'location',
            name: l.title || l.name || 'Unknown',
            type: l.category || 'Location',
            city: l.city || '—',
            author: l.created_by || 'System',
            date: l.created_at,
            insiderTip: l.insider_tip || '—',
            mustTry: l.what_to_try ? (Array.isArray(l.what_to_try) ? l.what_to_try.join(', ') : l.what_to_try) : '—',
            tags: l.tags || [],
            adminComment: l.moderation_note || null,
            status: 'PENDING_MODERATION'
        }))
    ]

    const [searchTerm, setSearchTerm] = useState('')
    const [selectedItem, setSelectedItem] = useState(null)
    const [revisionNote, setRevisionNote] = useState('')
    const [toast, setToast] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const PAGE_SIZE = 20

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    const filteredQueue = queue.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.author.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalPages = Math.ceil(filteredQueue.length / PAGE_SIZE)
    const paginatedQueue = filteredQueue.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

    useEffect(() => { setCurrentPage(1) }, [searchTerm])

    const handleApprove = async (item) => {
        try {
            if (item.queueType === 'review') {
                await updateReviewStatus.mutateAsync({
                    reviewId: item.id,
                    status: 'published'
                })
            } else {
                await updateLocationStatus.mutateAsync({
                    id: item.id,
                    status: 'approved',
                    source: item.source,
                    itemData: item
                })
            }
            setSelectedItem(null)
            showToast(`${item.queueType === 'review' ? 'Отзыв' : 'Заведение'} успешно одобрено!`, 'success')
        } catch (error) {
            console.error('Approval error:', error)
            showToast('Ошибка при одобрении. Попробуйте снова.', 'error')
        }
    }

    const handleRequestRevision = async (item) => {
        if (!revisionNote.trim()) return;
        try {
            if (item.queueType === 'review') {
                await updateReviewStatus.mutateAsync({
                    reviewId: item.id,
                    status: 'rejected',
                    comment: revisionNote
                })
            } else {
                await updateLocationStatus.mutateAsync({
                    id: item.id,
                    status: 'revision_requested',
                    moderationNote: revisionNote,
                    source: item.source,
                    itemData: item
                })
            }
            setSelectedItem(null)
            setRevisionNote('')
            showToast('Запрос на правку отправлен автору', 'success')
        } catch (error) {
            console.error('Revision request error:', error)
            showToast('Ошибка при отправке запроса. Попробуйте снова.', 'error')
        }
    }

    return (
        <div className="space-y-6 lg:space-y-8 pb-12 font-sans">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        className={cn(
                            "fixed top-24 right-8 z-[9999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-xl border backdrop-blur-md flex items-center gap-2",
                            toast.type === 'success'
                                ? "bg-slate-900/95 border-white/10"
                                : "bg-rose-600/95 border-rose-400/20"
                        )}
                    >
                        {toast.type === 'success'
                            ? <CheckCircle2 size={15} className="text-emerald-400" />
                            : <AlertCircle size={15} className="text-rose-200" />
                        }
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <AdminPageHeader
                eyebrow="Admin"
                title="Модерация"
                subtitle="Одобряйте новые заведения и управляйте контентом."
                badge={queue.length > 0 ? { label: `${queue.length} в очереди`, color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20' } : undefined}
            />

            {/* Search */}
            <div className="flex gap-3">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={15} />
                    <input
                        type="text"
                        placeholder="Поиск по названию, городу или автору..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[hsl(220,20%,3%)]/30 border-none rounded-2xl text-[13px] font-medium outline-none focus:ring-2 ring-indigo-500/10 transition-all shadow-inner"
                    />
                </div>
                <button className="h-10 px-3 flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-white/[0.08] text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-all">
                    <Filter size={14} />
                    <span className="text-xs font-medium hidden sm:inline">Фильтры</span>
                </button>
            </div>

            {/* Queue List — mobile cards */}
            <div className="md:hidden space-y-3">
                <AnimatePresence>
                    {filteredQueue.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[24px] border border-slate-100 dark:border-white/[0.03]">
                            Очередь модерации пуста.
                        </div>
                    ) : (
                        paginatedQueue.map(item => (
                            <motion.button
                                key={`card-${item.id}`}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onClick={() => setSelectedItem(item)}
                                className="w-full text-left bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[20px] border border-slate-100 dark:border-white/[0.03] p-4 active:scale-[0.99] transition-transform"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                        <MapPin size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                            {item.name}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-[hsl(220,10%,55%)] mt-0.5 truncate">
                                            {item.type} • {item.city}
                                        </div>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-[hsl(220,10%,55%)]">
                                            <span className="flex items-center gap-1 truncate"><User size={12} /> {item.author}</span>
                                            <span className="flex items-center gap-1 shrink-0"><Calendar size={12} /> {new Date(item.date).toLocaleDateString('ru-RU')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                                    <div className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold",
                                        item.status === 'PENDING_MODERATION'
                                            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                            : "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                                    )}>
                                        <AlertCircle size={12} />
                                        {item.status === 'PENDING_MODERATION' ? 'На проверке' : 'Запрошена правка'}
                                    </div>
                                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Проверить →</span>
                                </div>
                            </motion.button>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Queue List — desktop table */}
            <div className="hidden md:block bg-white dark:bg-[hsl(220,20%,6%)]/50 rounded-[32px] lg:rounded-[40px] border border-slate-100 dark:border-white/[0.03] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/20 text-xs uppercase tracking-wider text-slate-500 dark:text-[hsl(220,10%,55%)] font-semibold">
                                <th className="p-4 pl-6">Заведение</th>
                                <th className="p-4">Автор</th>
                                <th className="p-4">Дата</th>
                                <th className="p-4">Статус</th>
                                <th className="p-4 pr-6 text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            <AnimatePresence>
                                {filteredQueue.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-slate-500">
                                            Очередь модерации пуста.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedQueue.map(item => (
                                        <motion.tr
                                            key={item.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="hover:bg-slate-50/50 dark:hover:bg-[hsl(220,20%,12%)]/30 transition-colors"
                                        >
                                            <td className="p-4 pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                                        <MapPin size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-sm text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => setSelectedItem(item)}>
                                                            {item.name}
                                                        </div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                            <span>{item.type}</span> • <span>{item.city}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-[hsl(220,10%,55%)]">
                                                    <User size={14} className="text-slate-400" />
                                                    {item.author}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-[hsl(220,10%,55%)]">
                                                    <Calendar size={14} className="text-slate-400" />
                                                    {new Date(item.date).toLocaleDateString('ru-RU')}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                                                    item.status === 'PENDING_MODERATION'
                                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                                        : "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                                                )}>
                                                    <AlertCircle size={12} />
                                                    {item.status === 'PENDING_MODERATION' ? 'На проверке' : 'Запрошена правка'}
                                                </div>
                                            </td>
                                            <td className="p-4 pr-6 text-right">
                                                <button
                                                    onClick={() => setSelectedItem(item)}
                                                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-[hsl(220,20%,9%)] hover:bg-slate-200 dark:hover:bg-[hsl(220,20%,15%)] text-slate-700 dark:text-[hsl(220,10%,55%)] rounded-lg transition-colors"
                                                >
                                                    Проверить
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 disabled:opacity-30"
                    >
                        ← Назад
                    </button>
                    <span className="text-xs text-slate-400">
                        {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 disabled:opacity-30"
                    >
                        Далее →
                    </button>
                </div>
            )}

            {/* Review Modal */}
            <AnimatePresence>
                {selectedItem && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedItem(null)}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        >
                            {/* Modal Content */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white dark:bg-[hsl(220,20%,6%)] w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl border border-slate-200/50 dark:border-white/[0.06] flex flex-col max-h-[90vh]"
                            >
                                {/* Modal Header */}
                                <div className="p-6 border-b border-slate-100 dark:border-white/[0.06] flex justify-between items-start bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/20">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={cn(
                                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                selectedItem.status === 'PENDING_MODERATION'
                                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                                                    : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                                            )}>
                                                {selectedItem.status === 'PENDING_MODERATION' ? 'Новое заведение' : 'Ожидает правок пользователя'}
                                            </div>
                                        </div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedItem.name}</h2>
                                        <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
                                            <span className="flex items-center gap-1"><MapPin size={14} /> {selectedItem.city} ({selectedItem.type})</span>
                                            <span className="flex items-center gap-1"><User size={14} /> {selectedItem.author}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedItem(null)} className="p-2 bg-white dark:bg-[hsl(220,20%,9%)] rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-[hsl(220,20%,90%)] transition-colors shadow-sm">
                                        <XCircle size={20} />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="p-6 overflow-y-auto space-y-6 flex-1">

                                    {/* Content Group */}
                                    <div className="space-y-4 bg-slate-50 dark:bg-[hsl(220,20%,9%)]/30 p-5 rounded-2xl border border-slate-100 dark:border-white/[0.06]">
                                        <div>
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Insider Tip (От автора)</h4>
                                            <p className="text-slate-800 dark:text-[hsl(220,10%,55%)] flex items-start gap-2">
                                                <MessageSquare size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                                                <span className="italic">"{selectedItem.insiderTip}"</span>
                                            </p>
                                        </div>
                                        <div className="pt-4 border-t border-slate-200 dark:border-white/[0.04]">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Must Try</h4>
                                            <p className="text-slate-800 dark:text-[hsl(220,10%,55%)] font-medium">{selectedItem.mustTry}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Тэги & Атмосфера</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedItem.tags.map(tag => (
                                                <span key={tag} className="px-3 py-1 bg-white dark:bg-[hsl(220,20%,9%)] border border-slate-200 dark:border-white/[0.08] rounded-lg text-sm font-medium text-slate-600 dark:text-[hsl(220,10%,55%)] shadow-sm">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Admin Comment (if any) */}
                                    {selectedItem.adminComment && (
                                        <div className="bg-rose-50 dark:bg-rose-500/10 p-4 rounded-xl border border-rose-100 dark:border-rose-500/20">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 mb-1">Ваш предыдущий запрос на правку:</h4>
                                            <p className="text-sm text-rose-700 dark:text-rose-400">{selectedItem.adminComment}</p>
                                        </div>
                                    )}

                                    {/* Action Area: Request Revision */}
                                    {selectedItem.status === 'PENDING_MODERATION' && (
                                        <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                                            <label className="text-sm font-bold text-slate-700 dark:text-[hsl(220,10%,55%)]">Запросить правку у автора</label>
                                            <textarea
                                                value={revisionNote}
                                                onChange={(e) => setRevisionNote(e.target.value)}
                                                className="w-full p-3 bg-white dark:bg-[hsl(220,20%,6%)] border border-slate-200 dark:border-white/[0.08] rounded-xl resize-none h-24 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                                placeholder="Укажите, что нужно исправить (например: 'Пожалуйста, добавьте более точный адрес')..."
                                            />
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={() => handleRequestRevision(selectedItem)}
                                                    disabled={!revisionNote.trim()}
                                                    className="px-4 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Отправить на доработку
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div className="p-6 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/20 flex justify-end gap-3">
                                    <button
                                        onClick={() => setSelectedItem(null)}
                                        className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-[hsl(220,10%,55%)] hover:bg-slate-200 dark:hover:bg-[hsl(220,20%,15%)] transition-colors"
                                    >
                                        Закрыть
                                    </button>
                                    <button
                                        onClick={() => handleApprove(selectedItem)}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
                                    >
                                        <CheckCircle2 size={18} />
                                        Одобрить (+1 балл автору)
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
