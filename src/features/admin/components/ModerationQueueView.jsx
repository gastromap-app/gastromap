import React from 'react'
import { AlertCircle, Building2, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
    const { t } = useTranslation()

    if (pendingLocations.length === 0) {
        return (
            <div className="text-center py-20">
                <AlertCircle size={48} className="mx-auto text-t-quaternary mb-4" />
                <p className="text-lg font-bold text-t-tertiary">{t('admin.moderation.queue_empty')}</p>
                <p className="text-sm text-t-quaternary mt-1">{t('admin.moderation.no_pending')}</p>
            </div>
        )
    }

    return (
        <div className="p-8 lg:p-14 space-y-6">
            {pendingLocations.map(loc => (
                <div
                    key={loc.id}
                    className="bg-card rounded-sheet border border-border p-6 flex flex-col sm:flex-row items-center justify-between gap-6 group hover:border-primary/10 transition-all"
                >
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-card bg-secondary flex items-center justify-center text-t-quaternary shadow-sm group-hover:scale-105 transition-transform">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-h3 text-t-primary leading-none mb-2">
                                {loc.title}
                            </h3>
                            <p className="text-micro font-medium text-t-tertiary flex items-center gap-1.5">
                                <MapPin size={12} /> {loc.city}, {loc.country}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => onEdit(loc)}
                            className="flex-1 sm:px-6 py-3.5 bg-secondary text-t-primary rounded-image font-bold text-micro uppercase tracking-widest border border-border active:scale-95 transition-all"
                        >
                            {t('admin.actions.check')}
                        </button>
                        <button
                            onClick={() => onApprove(loc.id)}
                            className="flex-1 sm:px-6 py-3.5 bg-primary text-white rounded-image font-bold text-micro uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-primary/20"
                        >
                            {t('admin.actions.approve')}
                        </button>
                        <button
                            onClick={() => onReject(loc.id)}
                            className="flex-1 sm:px-6 py-3.5 bg-secondary text-amber-600 rounded-image font-bold text-micro uppercase tracking-widest border border-border active:scale-95 transition-all"
                        >
                            {t('admin.actions.reject')}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default ModerationQueueView
