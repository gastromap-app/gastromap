import { useState, useCallback } from 'react'
import { config } from '@/shared/config/env'
import { supabase } from '@/shared/api/client'

/**
 * useSemanticSearch — AI-powered semantic location search.
 *
 * Uses Supabase Edge Function (primary) with Vercel fallback:
 *   1. Generates query embedding via OpenRouter
 *   2. Fetches locations with float8[] embeddings from Supabase
 *   3. Returns cosine-similarity ranked results
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

    const search = useCallback(async (query, { city, category } = {}) => {
        if (!query?.trim()) return []

        setIsLoading(true)
        setError(null)
        setLastQuery(query)

        // Build headers — include Supabase anon key for Edge Function auth
        const headers = { 'Content-Type': 'application/json' }
        const anonKey = config.supabase.anonKey
        if (anonKey) headers['Authorization'] = `Bearer ${anonKey}`

        const body = JSON.stringify({ query, city, category, limit, threshold })

        // Try Edge Function first, then Vercel fallback
        const urls = [
            config.ai.semanticSearchUrl,
            config.ai.semanticSearchFallback,
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
                setResults(res)
                return res
            } catch (err) {
                lastErr = err.message
            }
        }

        console.error('[useSemanticSearch] all endpoints failed:', lastErr)
        setError(lastErr)
        return []
    }, [threshold, limit])

    const clear = useCallback(() => {
        setResults([])
        setError(null)
        setLastQuery('')
    }, [])

    return { results, isLoading, error, lastQuery, search, clear }
}
