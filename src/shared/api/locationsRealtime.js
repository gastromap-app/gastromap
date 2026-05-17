/**
 * locationsRealtime.js — Singleton Supabase Realtime → React Query bridge.
 *
 * Maintains exactly one Realtime channel for the `locations` table and routes
 * INSERT/UPDATE/DELETE events into the React Query cache via setQueryData and
 * invalidateQueries. Replaces the legacy useLocationsStore.subscribeToRealtime.
 *
 * Design: .kiro/specs/data-loading-architecture/design.md Section "Realtime Service"
 * Requirements: R4.1–R4.6, R17.6
 */

import { supabase } from './client'
import { queryKeys } from './queries/queryKeys'

// ─── Module-level singleton state ────────────────────────────────────────
let channel = null
let queryClientRef = null
let attempts = 0
let backoffTimer = null

const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30000

// ─── Normalise helper (lightweight — just ensures the row has an id) ─────
function normalisePayload(row) {
  if (!row || !row.id) return null
  return row
}

// ─── Handlers ────────────────────────────────────────────────────────────

function handleInsert(payload) {
  if (!queryClientRef) return
  const loc = normalisePayload(payload.new)
  if (!loc) return

  // Optimistically prepend to list caches so UI updates instantly.
  queryClientRef.setQueriesData({ queryKey: ['locations'] }, (old) => {
    if (!old) return old
    if (Array.isArray(old)) return [loc, ...old]
    if (old.data && Array.isArray(old.data)) {
      return { ...old, data: [loc, ...old.data] }
    }
    return old
  })

  // Invalidate all list/bounds queries so they refetch with the new row.
  queryClientRef.invalidateQueries({ queryKey: ['locations'] })
  queryClientRef.invalidateQueries({ queryKey: ['admin', 'locations'] })
}

function handleUpdate(payload) {
  if (!queryClientRef) return
  const targetId = payload.new?.id || payload.old?.id
  if (!targetId) return

  const loc = normalisePayload(payload.new)

  // Update the detail cache entry immediately (instant UI update).
  if (loc) {
    queryClientRef.setQueryData(queryKeys.locations.detail(targetId), (prev) => {
      if (!prev) return prev
      return { ...prev, ...loc }
    })
  }

  // Update list caches optimistically.
  queryClientRef.setQueriesData({ queryKey: ['locations'] }, (old) => {
    if (!old) return old
    if (Array.isArray(old)) {
      return old.map((item) => (item?.id === targetId ? { ...item, ...loc } : item))
    }
    if (old.data && Array.isArray(old.data)) {
      return {
        ...old,
        data: old.data.map((item) => (item?.id === targetId ? { ...item, ...loc } : item)),
      }
    }
    return old
  })

  // Invalidate list queries so they refetch with the updated row.
  queryClientRef.invalidateQueries({ queryKey: ['locations'] })
  queryClientRef.invalidateQueries({ queryKey: ['admin', 'locations'] })
}

function handleDelete(payload) {
  if (!queryClientRef) return
  const targetId = payload.old?.id
  if (!targetId) return

  // Remove the detail cache entry.
  queryClientRef.removeQueries({ queryKey: queryKeys.locations.detail(targetId) })

  // Remove from list caches optimistically.
  queryClientRef.setQueriesData({ queryKey: ['locations'] }, (old) => {
    if (!old) return old
    if (Array.isArray(old)) {
      return old.filter((item) => item?.id !== targetId)
    }
    if (old.data && Array.isArray(old.data)) {
      return { ...old, data: old.data.filter((item) => item?.id !== targetId) }
    }
    return old
  })

  // Also remove from admin list caches
  queryClientRef.setQueriesData({ queryKey: ['admin', 'locations'] }, (old) => {
    if (!old) return old
    if (Array.isArray(old)) {
      return old.filter((item) => item?.id !== targetId)
    }
    if (old.data && Array.isArray(old.data)) {
      return { ...old, data: old.data.filter((item) => item?.id !== targetId) }
    }
    return old
  })

  // Invalidate list queries so they refetch without the deleted row.
  queryClientRef.invalidateQueries({ queryKey: ['locations'] })
  queryClientRef.invalidateQueries({ queryKey: ['admin', 'locations'] })
}

// ─── Subscription lifecycle ──────────────────────────────────────────────

function subscribe() {
  if (!supabase || !queryClientRef) return

  // Guard: exactly one channel (R4.1) — remove any existing before creating new.
  if (channel) {
    try {
      supabase.removeChannel(channel)
    } catch {
      /* already removed */
    }
    channel = null
  }

  channel = supabase
    .channel('locations-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'locations' },
      (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            handleInsert(payload)
            break
          case 'UPDATE':
            handleUpdate(payload)
            break
          case 'DELETE':
            handleDelete(payload)
            break
          default:
            break
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        attempts = 0 // Reset backoff on successful subscription
        console.info('[locationsRealtime] ✅ Subscribed to locations table')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[locationsRealtime] ⚠️ ${status} — scheduling reconnect`)
        scheduleReconnect()
      }
    })
}

function scheduleReconnect() {
  if (backoffTimer) return // Already scheduled
  attempts += 1
  const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempts - 1), BACKOFF_MAX_MS)
  console.info(`[locationsRealtime] Reconnecting in ${delay}ms (attempt ${attempts})`)
  backoffTimer = setTimeout(() => {
    backoffTimer = null
    subscribe()
  }, delay)
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Start the singleton Realtime subscription. Call once at the
 * QueryClientProvider level (AppProviders.jsx).
 *
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @returns {() => void} Cleanup function (for useEffect return)
 */
export function startLocationsRealtime(queryClient) {
  queryClientRef = queryClient
  attempts = 0
  subscribe()

  return () => {
    stopLocationsRealtime()
  }
}

/**
 * Stop the singleton Realtime subscription and clean up.
 */
export function stopLocationsRealtime() {
  if (backoffTimer) {
    clearTimeout(backoffTimer)
    backoffTimer = null
  }
  if (channel && supabase) {
    try {
      supabase.removeChannel(channel)
    } catch {
      /* already removed */
    }
  }
  channel = null
  queryClientRef = null
  attempts = 0
}
