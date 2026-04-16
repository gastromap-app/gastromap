import { useState, useCallback } from 'react'
import { config } from '@/shared/config/env'
import { getCachedData, setCachedData, TTL } from '@/shared/lib/cache'

/**
 * useSemanticSearch — AI-powered semantic location search with caching.
 *
 * Cache strategy:
 *   L1 — in-memory (React state, component lifetime)
 *   L2 — localStorage (10 min TTL, dedupe identical queries)
 *   L3 — Edge Function: supabase.co/functions/v1/semantic-search
 *   L4 — Vercel fallback: /api/ai/semantic-search
 *
 * @param {object} options
 * @param {number} options.threshold - similarity threshold (default: 0.3)
 * @param {number} options.limit - max results (default: 10)
 */
export function useSemanticSearch({ threshold = 0.3, limit = 10 } = {}) {
    const [results, setResults] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [lastQuery, setLastQuery] = useState('')
    const [fromCache, setFromCache] = useState(false)

    const search = useCallback(async (query, { city, category } = {}) => {
        if (!query?.trim()) return []

        // L2 cache key: normalize query + filters
        const cacheKey = `semanticSearch_${query.trim().toLowerCase()}_${city || ''}_${category || ''}_${limit}`
        const cached = getCachedData(cacheKey)
        if (cached) {
            setResults(cached)
            setLastQuery(query)
            setFromCache(true)
            setIsLoading(false)
            return cached
        }

        setIsLoading(true)
        setFromCache(false)
        setError(null)
        setLastQuery(query)

        const anonKey = config.supabase.anonKey
        const headers = { 'Content-Type': 'application/json' }
        if (anonKey) headers['Authorization'] = `Bearer ${anonKey}`

        const body = JSON.stringify({ query, city, category, limit, threshold })

        // Try Edge Function first, then Vercel fallback
        const urls = [
            config.ai?.semanticSearchUrl,
            config.ai?.semanticSearchFallback,
            '/api/ai/semantic-search',
        ].filter(Boolean)

        let lastErr = null
        for (const url of urls) {
            try {
                const response = await fetch(url, { method: 'POST', headers, body })
                if (!response.ok) {
                    lastErr = `${url}: HTTP ${response.status}`
                    continue
                }
                const data = await response.json()
                const res = data.results ?? []

                // Populate L2 cache
                setCachedData(cacheKey, res, TTL.semanticSearch)

                setResults(res)
                setIsLoading(false)
                return res
            } catch (err) {
                lastErr = err.message
            }
        }

        console.error('[useSemanticSearch] all endpoints failed:', lastErr)
        setError(lastErr)
        setIsLoading(false)
        return []
    }, [threshold, limit])

    const clear = useCallback(() => {
        setResults([])
        setError(null)
        setLastQuery('')
        setFromCache(false)
    }, [])

    return { results, isLoading, error, lastQuery, fromCache, search, clear }
}
