import { useEffect, useRef } from 'react'
import { useFavoritesStore } from '@/features/dashboard/hooks/useFavoritesStore'

const SYNC_TAG = 'gastromap-favorites-sync'
const PENDING_KEY = 'gastromap-offline-favorites'

/**
 * useOfflineSync — Background Sync for favorites.
 *
 * When the user toggles a favorite while offline:
 *   1. The change is applied immediately to the local Zustand store (optimistic UI)
 *   2. The pending operation is queued in localStorage
 *   3. A Background Sync tag is registered with the Service Worker
 *   4. When connectivity returns, the SW fires the sync event and we flush the queue
 *
 * The SW calls `syncFavorites()` via a BroadcastChannel message.
 * Without a real backend, the flush just clears the queue (no-op persistence).
 *
 * @returns {{ hasPending: boolean }}
 */
export function useOfflineSync() {
    const { favoriteIds } = useFavoritesStore()
    const isOnlineRef = useRef(navigator.onLine)

    // ── Register Background Sync when coming back online ─────────────────
    useEffect(() => {
        const handleOnline = async () => {
            isOnlineRef.current = true
            await flushPendingSync()
        }
        const handleOffline = () => {
            isOnlineRef.current = false
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        // Try to flush any pending ops on mount (e.g. app reopened after offline)
        if (navigator.onLine) {
            flushPendingSync()
        }

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    return {
        hasPending: getPendingOps().length > 0,
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Read pending sync queue from localStorage */
function getPendingOps() {
    try {
        return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
    } catch {
        return []
    }
}

/** Queue a favorite toggle operation for background sync */
export function queueFavoriteSync(locationId, action /* 'add' | 'remove' */) {
    const ops = getPendingOps()
    // Deduplicate: if the same location is toggled twice, cancel both out
    const existing = ops.findIndex((op) => op.locationId === locationId)
    if (existing >= 0) {
        ops.splice(existing, 1)
    } else {
        ops.push({ locationId, action, timestamp: Date.now() })
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify(ops))

    // Register Background Sync with the Service Worker
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready
            .then((reg) => reg.sync.register(SYNC_TAG))
            .catch(() => {
                // SyncManager unavailable — will flush on next online event
            })
    }
}

/** Flush the pending queue to the backend (no-op until backend exists) */
async function flushPendingSync() {
    const ops = getPendingOps()
    if (ops.length === 0) return

    // TODO: replace with real API calls once backend is available
    // await Promise.all(ops.map(op => api.toggleFavorite(op.locationId, op.action)))

    console.info('[OfflineSync] Flushing', ops.length, 'pending favorite ops')

    // Clear the queue after "syncing"
    localStorage.removeItem(PENDING_KEY)
}
