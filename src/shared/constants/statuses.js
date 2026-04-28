/**
 * Centralized status constants for locations and reviews.
 * All status checks across the app should reference these constants
 * instead of hardcoded strings.
 */

export const LOCATION_STATUSES = {
    ACTIVE: 'active',
    APPROVED: 'approved',
    PENDING: 'pending',
    REJECTED: 'rejected',
    REVISION_REQUESTED: 'revision_requested',
    HIDDEN: 'hidden',
    COMING_SOON: 'coming_soon',
}

/** Statuses considered "visible" to public users */
export const VISIBLE_STATUSES = [LOCATION_STATUSES.APPROVED, LOCATION_STATUSES.ACTIVE]

/** Statuses that appear in the moderation queue */
export const MODERATION_STATUSES = [LOCATION_STATUSES.PENDING, LOCATION_STATUSES.REVISION_REQUESTED]

export const REVIEW_STATUSES = {
    PENDING: 'pending',
    PUBLISHED: 'published',
    REJECTED: 'rejected',
}

/** Status display configuration: label, badge color classes, dot color */
export const STATUS_DISPLAY = {
    [LOCATION_STATUSES.ACTIVE]: { label: 'Активен', badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600', dot: 'bg-emerald-500' },
    [LOCATION_STATUSES.APPROVED]: { label: 'Активен', badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600', dot: 'bg-emerald-500' },
    [LOCATION_STATUSES.PENDING]: { label: 'Ожидает', badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600', dot: 'bg-amber-500' },
    [LOCATION_STATUSES.REJECTED]: { label: 'Отклонён', badge: 'bg-rose-50 dark:bg-rose-500/10 text-rose-500', dot: 'bg-rose-500' },
    [LOCATION_STATUSES.REVISION_REQUESTED]: { label: 'На доработку', badge: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700', dot: 'bg-orange-500' },
    [LOCATION_STATUSES.HIDDEN]: { label: 'Скрыт', badge: 'bg-slate-100 dark:bg-[hsl(220,20%,9%)] text-slate-500', dot: 'bg-slate-400' },
    [LOCATION_STATUSES.COMING_SOON]: { label: 'Скоро', badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
}

export const getStatusDisplay = (status) => STATUS_DISPLAY[status] || STATUS_DISPLAY[LOCATION_STATUSES.PENDING]
