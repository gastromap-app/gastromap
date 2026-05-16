import { useState, useEffect, useCallback } from 'react'
import { queryClient } from '@/shared/config/queryClient'

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
            // 1. Clear all Service Worker / Workbox caches
            if ('caches' in window) {
                const keys = await caches.keys()
                await Promise.all(keys.map(k => caches.delete(k)))
            }
            // 2. Clear React Query cache
            queryClient.clear()
            // 3. Clear localStorage (except auth data)
            const authKeys = ['sb-auth-token', 'supabase.auth.token', 'auth-storage']
            const keysToKeep = []
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (authKeys.some(ak => key?.includes(ak))) {
                    keysToKeep.push({ key, value: localStorage.getItem(key) })
                }
            }
            localStorage.clear()
            keysToKeep.forEach(({ key, value }) => localStorage.setItem(key, value))
            // 4. Unregister Service Worker so it re-registers fresh
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations()
                await Promise.all(regs.map(r => r.unregister()))
            }
            // 5. Brief delay so caller can show success toast before reload
            await new Promise(resolve => setTimeout(resolve, 800))
            // 6. Reload to pick up fresh state
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
