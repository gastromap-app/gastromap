import { useState, useCallback } from 'react'

/**
 * useSemanticSearch — хук для AI-powered семантического поиска локаций.
 *
 * Использует /api/ai/semantic-search который:
 *   1. Генерирует embedding запроса через OpenRouter
 *   2. Загружает локации с float8[] embeddings из Supabase
 *   3. Вычисляет cosine similarity на стороне сервера
 *
 * @param {object} options
 * @param {number} options.threshold - порог схожести (default: 0.3)
 * @param {number} options.limit - макс кол-во результатов (default: 10)
 */
export function useSemanticSearch({ threshold = 0.3, limit = 10 } = {}) {
    const [results, setResults] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [lastQuery, setLastQuery] = useState('')

    const search = useCallback(async (query, { city, category } = {}) => {
        if (!query?.trim()) return

        setIsLoading(true)
        setError(null)
        setLastQuery(query)

        try {
            const response = await fetch('/api/ai/semantic-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, city, category, limit, threshold }),
            })

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`)
            }

            const data = await response.json()
            setResults(data.results ?? [])
            return data.results ?? []
        } catch (err) {
            console.error('[useSemanticSearch] error:', err)
            setError(err.message)
            return []
        } finally {
            setIsLoading(false)
        }
    }, [threshold, limit])

    const clear = useCallback(() => {
        setResults([])
        setError(null)
        setLastQuery('')
    }, [])

    return { results, isLoading, error, lastQuery, search, clear }
}
