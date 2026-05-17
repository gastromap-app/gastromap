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

    // Check photos: location has NO photos at all (neither image_url nor google_photos)
    const hasImageUrl = location.image_url && location.image_url.trim() !== ''
    const hasGooglePhotos = Array.isArray(location.google_photos) && location.google_photos.filter(Boolean).length > 0
    const hasAnyPhoto = hasImageUrl || hasGooglePhotos

    if (!hasAnyPhoto) {
        indicators.push('no photos')
    } else if (!hasImageUrl || !location.image_url.includes('r2.dev')) {
        // Has photos but cover is not on Cloudflare R2 — needs migration
        indicators.push('not on R2')
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
    'not on R2': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
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
