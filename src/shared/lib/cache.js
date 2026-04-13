/**
 * Simple localStorage cache with TTL.
 *
 * Architecture:
 *   L1 — React Query in-memory cache (staleTime: Infinity → never background-fetches)
 *   L2 — This localStorage cache (TTL per key type)
 *   L3 — Supabase live fetch
 *   L4 — Mock data (final fallback)
 *
 * Flow on read:
 *   React Query miss → getCachedData(key) → if HIT: return instantly
 *                                          → if MISS: fetch Supabase → setCachedData → return
 *
 * Flow on write (mutation):
 *   mutation succeeds → invalidateCacheKey(key) + qc.invalidateQueries(key)
 *   → next read fetches fresh from Supabase → populates L2 again
 */

const PREFIX = 'gm_cache_'

/**
 * Cache TTLs per data type (milliseconds).
 * KG data changes rarely — 24h is fine.
 * Locations change more often — 10 min.
 */
export const TTL = {
    cuisines:       24 * 60 * 60 * 1000,  // 24 hours
    dishes:         24 * 60 * 60 * 1000,  // 24 hours
    ingredients:    24 * 60 * 60 * 1000,  // 24 hours
    locations:      10 * 60 * 1000,        // 10 minutes
    categories:     60 * 60 * 1000,        // 1 hour
    semanticSearch: 10 * 60 * 1000,        // 10 minutes — same query shouldn't hit API again
    braveSearch:    30 * 60 * 1000,        // 30 minutes — news/search results
}

/**
 * Read a value from the cache.
 * Returns null if missing or expired.
 *
 * @param {string} key - Cache key (e.g. 'cuisines', 'dishes_null')
 * @returns {any|null}
 */
export function getCachedData(key) {
    try {
        const raw = localStorage.getItem(PREFIX + key)
        if (!raw) return null

        const entry = JSON.parse(raw)

        // Expire check
        if (Date.now() > entry.expiresAt) {
            localStorage.removeItem(PREFIX + key)
            return null
        }

        return entry.data
    } catch {
        return null
    }
}

/**
 * Write a value to the cache.
 *
 * @param {string} key
 * @param {any} data
 * @param {number} ttl - Milliseconds until expiry (default 24h)
 */
export function setCachedData(key, data, ttl = TTL.cuisines) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify({
            data,
            cachedAt:  Date.now(),
            expiresAt: Date.now() + ttl,
        }))
    } catch {
        // localStorage full or blocked (e.g. private mode) — silently ignore
    }
}

/**
 * Remove a specific cache entry.
 * Call this after successful mutations so the next read fetches fresh data.
 *
 * @param {string} key
 */
export function invalidateCacheKey(key) {
    try {
        localStorage.removeItem(PREFIX + key)
    } catch {
        // ignore
    }
}

/**
 * Remove all cache entries whose key starts with the given prefix.
 * Useful to purge an entire entity group (e.g. all 'dishes_*' entries).
 *
 * @param {string} keyPrefix - e.g. 'dishes'
 */
export function invalidateCacheGroup(keyPrefix) {
    try {
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
            const storageKey = localStorage.key(i)
            if (storageKey?.startsWith(PREFIX + keyPrefix)) {
                keysToRemove.push(storageKey)
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k))
    } catch {
        // ignore
    }
}

/**
 * Wipe the entire GastroMap cache (e.g. on logout or data reset).
 */
export function clearAllCache() {
    try {
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
            const storageKey = localStorage.key(i)
            if (storageKey?.startsWith(PREFIX)) {
                keysToRemove.push(storageKey)
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k))
    } catch {
        // ignore
    }
}

/**
 * Debug helper — returns a summary of all cached entries.
 * Usage: import { getCacheStats } from '@/shared/lib/cache'; getCacheStats()
 */
export function getCacheStats() {
    const stats = []
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const storageKey = localStorage.key(i)
            if (!storageKey?.startsWith(PREFIX)) continue
            const raw = localStorage.getItem(storageKey)
            if (!raw) continue
            const entry = JSON.parse(raw)
            const age = Math.round((Date.now() - entry.cachedAt) / 1000)
            const ttlLeft = Math.round((entry.expiresAt - Date.now()) / 1000)
            const size = new Blob([raw]).size
            stats.push({
                key: storageKey.replace(PREFIX, ''),
                records: Array.isArray(entry.data) ? entry.data.length : '?',
                age: `${age}s ago`,
                ttlLeft: ttlLeft > 0 ? `${ttlLeft}s` : 'EXPIRED',
                size: `${(size / 1024).toFixed(1)} KB`,
            })
        }
    } catch {
        // ignore
    }
    return stats
}
