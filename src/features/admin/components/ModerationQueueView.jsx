import React from 'react'
import { AlertCircle, Building2, MapPin } from 'lucide-react'

/**
 * ModerationQueueView
 *
 * Displays the queue of pending locations awaiting moderation approval.
 * Allows admin to review, approve, or reject submitted locations.
 */
const ModerationQueueView = ({
    pendingLocations,
    onEdit,
    onApprove,
    onReject,
}) => {
    if (pendingLocations.length === 0) {
        return (
            <div className="text-center py-20">
                <AlertCircle size={48} className="mx-auto text-slate-300 dark:text-[hsl(220,10%,35%)] mb-4" />
                <p className="text-lg font-bold text-slate-400">Очередь пуста</p>
                <p className="text-sm text-slate-400 mt-1">Нет объектов на модерации</p>
            </div>
        )
    }

    return (
        <div className="p-8 lg:p-14 space-y-6">
            {pendingLocations.map(loc => (
                <div
                    key={loc.id}
                    className="bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/30 rounded-[32px] border border-slate-100 dark:border-white/[0.03] p-6 flex flex-col sm:flex-row items-center justify-between gap-6 group hover:border-indigo-500/10 transition-all"
                >
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[24px] bg-white dark:bg-[hsl(220,20%,9%)] flex items-center justify-center text-slate-300 shadow-sm group-hover:scale-105 transition-transform">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg lg:text-xl font-bold text-slate-900 dark:text-white leading-none mb-2">
                                {loc.title}
                            </h3>
                            <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                                <MapPin size={12} /> {loc.city}, {loc.country}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => onEdit(loc)}
                            className="flex-1 sm:px-6 py-3.5 bg-white dark:bg-[hsl(220,20%,9%)] text-slate-900 dark:text-white rounded-[20px] font-bold text-[10px] uppercase tracking-widest border border-slate-100 dark:border-white/[0.08] active:scale-95 transition-all"
                        >
                            Проверить
                        </button>
                        <button
                            onClick={() => onApprove(loc.id)}
                            className="flex-1 sm:px-6 py-3.5 bg-indigo-600 text-white rounded-[20px] font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                        >
                            Одобрить
                        </button>
                        <button
                            onClick={() => onReject(loc.id)}
                            className="flex-1 sm:px-6 py-3.5 bg-white dark:bg-[hsl(220,20%,9%)] text-orange-500 rounded-[20px] font-bold text-[10px] uppercase tracking-widest border border-slate-100 dark:border-white/[0.08] active:scale-95 transition-all"
                        >
                            Отклонить
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default ModerationQueueView
