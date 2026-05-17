import React from 'react'
import { Check, X, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const FIELD_LABELS = {
    title: 'Title',
    opening_hours: 'Opening Hours',
    address: 'Address',
    coordinates: 'Coordinates',
    photos: 'Photos',
    google_formatted_address: 'Formatted Address',
    city: 'City',
    country: 'Country',
}

function formatValue(value) {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'object') {
        if (value.lat !== undefined && value.lng !== undefined) {
            return `${value.lat}, ${value.lng}`
        }
        return JSON.stringify(value, null, 2)
    }
    return String(value)
}

/**
 * DiffView — Side-by-side comparison of current vs Google Places data.
 * Color-codes differences and provides per-field Apply/Cancel buttons.
 */
export default function DiffView({ diff, acceptedFields = {}, skippedFields = {}, onApplyField, onCancelField, onApplyAll }) {
    if (!diff || Object.keys(diff).length === 0) {
        return (
            <div className="text-center py-8 text-t-quaternary text-sm">
                No differences found. All fields are up to date.
            </div>
        )
    }

    const fields = Object.entries(diff)
    const hasChanges = fields.some(([, data]) => !data.match)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium uppercase tracking-wider text-t-tertiary">
                    Field Comparison
                </label>
                {hasChanges && (
                    <button
                        onClick={onApplyAll}
                        className="px-3 py-1.5 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        Accept All
                    </button>
                )}
            </div>

            <div className="space-y-2">
                {fields.map(([fieldName, data]) => {
                    const isAccepted = acceptedFields[fieldName]
                    const isSkipped = skippedFields[fieldName]

                    return (
                        <div
                            key={fieldName}
                            className={cn(
                                "rounded-xl border p-4 transition-all",
                                data.match
                                    ? "bg-card border-border opacity-70"
                                    : isAccepted
                                        ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-300 dark:border-emerald-700/50"
                                        : isSkipped
                                            ? "bg-card border-border opacity-50"
                                            : "bg-card border-emerald-200 dark:border-emerald-800/40"
                            )}
                        >
                            {/* Field header */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-t-primary">
                                    {FIELD_LABELS[fieldName] || fieldName}
                                </span>
                                {data.match && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase rounded-full">
                                        <CheckCircle2 size={10} />
                                        Up to date
                                    </span>
                                )}
                                {isAccepted && !data.match && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold uppercase rounded-full">
                                        <Check size={10} strokeWidth={3} />
                                        Accepted
                                    </span>
                                )}
                                {isSkipped && !data.match && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase rounded-full">
                                        <X size={10} strokeWidth={3} />
                                        Skipped
                                    </span>
                                )}
                            </div>

                            {/* Side-by-side values */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase tracking-wider text-t-quaternary font-medium">
                                        Current
                                    </span>
                                    <div className="px-3 py-2 bg-secondary rounded-lg text-xs text-t-secondary font-mono break-all">
                                        {formatValue(data.current)}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase tracking-wider text-t-quaternary font-medium">
                                        Google
                                    </span>
                                    <div className={cn(
                                        "px-3 py-2 rounded-lg text-xs font-mono break-all",
                                        data.match
                                            ? "bg-secondary text-t-secondary"
                                            : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800/40"
                                    )}>
                                        {formatValue(data.google)}
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons for non-matching fields (only if not yet decided) */}
                            {!data.match && !isAccepted && !isSkipped && (
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                                    <button
                                        onClick={() => onApplyField(fieldName)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors"
                                    >
                                        <Check size={12} strokeWidth={3} />
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => onCancelField(fieldName)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-t-tertiary text-[10px] font-bold uppercase tracking-wider rounded-lg border border-border transition-colors"
                                    >
                                        <X size={12} strokeWidth={3} />
                                        Skip
                                    </button>
                                </div>
                            )}

                            {/* Undo button for decided fields */}
                            {!data.match && (isAccepted || isSkipped) && (
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                                    <button
                                        onClick={() => {
                                            if (isAccepted) onCancelField(fieldName)
                                            else onApplyField(fieldName)
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-t-tertiary text-[10px] font-bold uppercase tracking-wider rounded-lg border border-border transition-colors"
                                    >
                                        <ArrowRight size={12} />
                                        {isAccepted ? 'Undo Accept' : 'Undo Skip'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
