import { useState, useEffect, useCallback } from 'react'

/**
 * useStorageQuota — monitor browser storage usage (Cache + IndexedDB).
 *
 * Returns:
 *   usage      – bytes used
 *   quota      – total bytes available
 *   percent    – usage as 0-100 number
 *   isWarning  – true when > 75% of quota (iOS Safari ~50MB hard limit)
 *   clearCache – async function to wipe all caches and reload
 */
export function useStorageQuota() {
    const [usage, setUsage] = useState(0)
    const [quota, setQuota] = useState(0)
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(async () => {
        if (!navigator.storage?.estimate) {
            setLoading(false)
            return
        }
        try {
            const est = await navigator.storage.estimate()
            setUsage(est.usage || 0)
            setQuota(est.quota || 0)
        } catch {
            // Silent fail — storage API may be restricted
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const percent = quota > 0 ? Math.round((usage / quota) * 100) : 0
    const isWarning = percent > 75

    const clearCache = useCallback(async () => {
        try {
            // 1. Clear all Workbox caches
            if ('caches' in window) {
                const keys = await caches.keys()
                await Promise.all(keys.map(k => caches.delete(k)))
            }
            // 2. Clear IndexedDB (Zustand persist stores)
            // We keep auth-storage so user stays logged in
            const storesToClear = [
                'ai-chat-storage',
                'favorites-storage',
                'user-prefs-storage',
                'app-config-storage',
                'gastromap-notifications-storage',
            ]
            storesToClear.forEach(name => {
                try { localStorage.removeItem(name) } catch { /* ignore */ }
            })
            // 3. Unregister Service Worker so it re-registers fresh
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations()
                await Promise.all(regs.map(r => r.unregister()))
            }
            // 4. Reload to pick up fresh state
            window.location.reload()
        } catch (err) {
            console.error('[StorageQuota] Clear cache failed:', err)
            throw err
        }
    }, [])

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }

    return { usage, quota, percent, isWarning, loading, clearCache, formatBytes, refresh }
}

export default useStorageQuota
