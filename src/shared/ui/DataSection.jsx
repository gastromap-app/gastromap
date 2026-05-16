/**
 * DataSection — Reusable wrapper that enforces the 8-second skeleton ceiling
 * and provides consistent error/empty/offline states for any React Query
 * consumer section.
 *
 * Design: .kiro/specs/data-loading-architecture/design.md Section "Error Handling"
 * Requirements: R12.1, R12.2, R12.3, R12.4, R12.5, R12.6
 *
 * Props:
 *   query    — A React Query result object ({ status, data, error, refetch })
 *   children — The success-state content (rendered when data is available and non-empty)
 *   fallback — The loading skeleton (rendered while pending, max 8 seconds)
 *   error    — A render function `(refetch) => ReactNode` for the error state
 *   empty    — The empty-results UI (rendered when data is available but empty)
 *   isEmpty  — Optional custom emptiness check `(data) => boolean`. Defaults to
 *              checking array length === 0 or data === null/undefined.
 *
 * Behaviour:
 *   - While `query.status === 'pending'` AND no cached data exists AND the
 *     8-second ceiling has not been hit → renders `fallback` (skeleton).
 *   - If 8 seconds pass without data arriving → transitions to error state
 *     (same as if `query.status === 'error'`). This prevents infinite skeletons.
 *   - When `query.status === 'error'` OR ceiling hit → renders `error(query.refetch)`.
 *     If `query.refetch` is undefined, logs a one-time console.warn (R12.3).
 *   - When data arrives and passes the emptiness check → renders `children`.
 *   - When data arrives but is empty → renders `empty`.
 *   - Stale-while-revalidate: if `query.data` exists (cached from a prior fetch
 *     within staleTime), `children` renders immediately — no skeleton flash (R14.1).
 */

import { useState, useEffect, useRef } from 'react'

/**
 * Default emptiness check for query data.
 * @param {unknown} data
 * @returns {boolean}
 */
function defaultIsEmpty(data) {
  if (data == null) return true
  if (Array.isArray(data) && data.length === 0) return true
  // Support paginated shapes like { data: [], total: 0 }
  if (data && typeof data === 'object' && 'data' in data) {
    const inner = data.data
    if (Array.isArray(inner) && inner.length === 0) return true
  }
  return false
}

/**
 * @param {{
 *   query: { status: string, data: unknown, error: unknown, refetch?: () => void },
 *   children: import('react').ReactNode,
 *   fallback?: import('react').ReactNode,
 *   error?: (refetch?: () => void) => import('react').ReactNode,
 *   empty?: import('react').ReactNode,
 *   isEmpty?: (data: unknown) => boolean,
 * }} props
 */
export function DataSection({ query, children, fallback, error, empty, isEmpty: isEmptyFn }) {
  const [ceilingHit, setCeilingHit] = useState(false)
  const warnedRef = useRef(false)

  // 8-second skeleton ceiling timer (R12.1, R12.5).
  // Starts when the query enters `pending` state with no cached data.
  // Clears/resets when data arrives or the query leaves `pending`.
  useEffect(() => {
    if (query.status !== 'pending' || query.data != null) {
      setCeilingHit(false)
      return
    }
    const timer = setTimeout(() => setCeilingHit(true), 8000)
    return () => clearTimeout(timer)
  }, [query.status, query.data])

  // Determine emptiness using custom or default check.
  const checkEmpty = typeof isEmptyFn === 'function' ? isEmptyFn : defaultIsEmpty

  // ─── State machine transitions ────────────────────────────────────────

  // 1. Pending with no cached data and ceiling not hit → skeleton (R12.1)
  if (query.status === 'pending' && query.data == null && !ceilingHit) {
    return fallback ?? null
  }

  // 2. Error state OR ceiling hit → error UI with retry (R12.2, R12.5)
  if (query.status === 'error' || ceilingHit) {
    // Log once if refetch is missing (R12.3)
    if (!query.refetch && !warnedRef.current) {
      warnedRef.current = true
      console.warn('[DataSection] missing refetch')
    }
    return typeof error === 'function' ? error(query.refetch) : null
  }

  // 3. Data available but empty → empty state (R7.5, R12.4)
  if (query.data != null && checkEmpty(query.data)) {
    return empty ?? null
  }

  // 4. Data available → success (R12.4, R14.1)
  // This includes the SWR case: query.data exists from cache, background
  // refetch may be in flight (query.isFetching === true), but we show
  // cached data immediately — no skeleton flash.
  return children ?? null
}

export default DataSection
