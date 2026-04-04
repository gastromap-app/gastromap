import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    CheckCircle2, XCircle, Search, Filter,
    MoreVertical, MapPin, User, Calendar, MessageSquare, AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
            name: r.location_name || 'Unknown Location',
            type: 'Review',
            city: r.location_city || '\u2014',
            author: r.user_name || r.user_email || 'Anonymous',
            date: r.created_at,
            insiderTip: r.review_text?.substring(0, 100) || '\u2014',
            mustTry: `Rating: ${r.rating}/5`,
            tags: r.rating >= 4 ? ['High Rating'] : ['Needs Attention'],
            status: 'PENDING_MODERATION'
        })),
        ...pendingLocations.map(l => ({
            ...l,
            queueType: 'location',
            name: l.name,
            type: l.category || 'Location',
            city: l.city || '\u2014',
            author: l.created_by || 'System',
            date: l.created_at,
            insiderTip: l.insider_tip || '\u2014',
            mustTry: l.must_try || '\u2014',
            tags: l.tags || [],
            status: 'PENDING_MODERATION'
        }))
    ]

    const [searchTerm, setSearchTerm] = useState('')
    const [selectedItem, setSelectedItem] = useState(null)
    const [revisionNote, setRevisionNote] = useState('')
    const [toast, setToast] = useState(null)

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    const filteredQueue = queue.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.author.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleApprove = async (item) => {
        try {
            if (item.queueType === 'review') {
                await updateReviewStatus.mutateAsync({
                    reviewId: item.id,
                    status: 'approved'
                })
            } else {
                await updateLocationStatus.mutateAsync({
                    id: item.id,
                    status: 'active'
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
                    status: 'revision_requested',
                    comment: revisionNote
                })
            } else {
                await updateLocationStatus.mutateAsync({
                    id: item.id,
                    status: 'revision_requested'
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
        <div className="space-y-8 pb-12 animate-in fade-in duration-500">
            {/* Toast notification */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={cn(
                            "fixed top-4 right-4 z-[100] px-6 py-3 rounded-xl shadow-2xl font-semibold text-sm",
                            toast.type === 'success'
                                ? "bg-emerald-500 text-white"
                                : "bg-rose-500 text-white"
                        )}
                    >
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Модерация</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Одобряйте новые заведения и управляйте контентом сообщества.</p>
                </div>
            </header>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Поиск по названию, городу или автору..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium shrink-0">
                    <Filter size={18} />
                    Фильтры
                </button>
            </div>

            {/* Queue List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
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
                                    filteredQueue.map(item => (
                                        <motion.tr
                                            key={item.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
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
                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                    <User size={14} className="text-slate-400" />
                                                    {item.author}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
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
                                                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
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
                                className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl border border-slate-200/50 dark:border-slate-800 flex flex-col max-h-[90vh]"
                            >
                                {/* Modal Header */}
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/20">
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
                                    <button onClick={() => setSelectedItem(null)} className="p-2 bg-white dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shadow-sm">
                                        <XCircle size={20} />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="p-6 overflow-y-auto space-y-6 flex-1">

                                    {/* Content Group */}
                                    <div className="space-y-4 bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <div>
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Insider Tip (От автора)</h4>
                                            <p className="text-slate-800 dark:text-slate-300 flex items-start gap-2">
                                                <MessageSquare size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                                                <span className="italic">"{selectedItem.insiderTip}"</span>
                                            </p>
                                        </div>
                                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Must Try</h4>
                                            <p className="text-slate-800 dark:text-slate-300 font-medium">{selectedItem.mustTry}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Тэги & Атмосфера</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedItem.tags.map(tag => (
                                                <span key={tag} className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 shadow-sm">
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
                                        <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Запросить правку у автора</label>
                                            <textarea
                                                value={revisionNote}
                                                onChange={(e) => setRevisionNote(e.target.value)}
                                                className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl resize-none h-24 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
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
                                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex justify-end gap-3">
                                    <button
                                        onClick={() => setSelectedItem(null)}
                                        className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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
