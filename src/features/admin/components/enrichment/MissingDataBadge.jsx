import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Determines which data indicators are missing for a location.
 * Returns an array of indicator strings.
 */
export function getMissingDataIndicators(location) {
    if (!location) return []

    const indicators = []

    // No place_id
    if (!location.google_place_id) {
        indicators.push('no place_id')
    }

    // No photos — image_url must contain "r2.dev" to count as having photos
    if (!location.image_url || !location.image_url.includes('r2.dev')) {
        indicators.push('no photos')
    }

    // No hours
    if (!location.opening_hours || location.opening_hours.trim() === '') {
        indicators.push('no hours')
    }

    // No coords — null, undefined, or 0
    if (
        location.lat === null || location.lat === undefined || location.lat === 0 ||
        location.lng === null || location.lng === undefined || location.lng === 0
    ) {
        indicators.push('no coords')
    }

    return indicators
}

const BADGE_STYLES = {
    'no place_id': 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    'no photos': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    'no hours': 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
    'no coords': 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
}

/**
 * MissingDataBadge — Renders colored pill badges for each missing data indicator.
 */
export default function MissingDataBadge({ location }) {
    const indicators = getMissingDataIndicators(location)

    if (indicators.length === 0) return null

    return (
        <div className="flex flex-wrap gap-1">
            {indicators.map(indicator => (
                <span
                    key={indicator}
                    className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide",
                        BADGE_STYLES[indicator] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    )}
                >
                    {indicator}
                </span>
            ))}
        </div>
    )
}
