import React from 'react'
import { Activity, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * QuotaIndicator — Displays remaining API calls and daily limit.
 * Shows warning styling when quota is running low (< 50).
 */
export default function QuotaIndicator({ quotaRemaining, dailyLimit }) {
    if (quotaRemaining === null || quotaRemaining === undefined) return null

    const isLow = quotaRemaining < 50
    const percentage = dailyLimit > 0 ? Math.round((quotaRemaining / dailyLimit) * 100) : 0

    return (
        <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            isLow
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400"
                : "bg-secondary border-border text-t-tertiary"
        )}>
            {isLow ? (
                <AlertTriangle size={12} strokeWidth={2.5} />
            ) : (
                <Activity size={12} strokeWidth={2.5} />
            )}
            <span>
                <span className="font-bold">{quotaRemaining}</span>
                <span className="text-t-quaternary"> / {dailyLimit}</span>
            </span>
            {isLow && (
                <span className="text-[9px] uppercase font-bold tracking-wider">
                    Low
                </span>
            )}
        </div>
    )
}
