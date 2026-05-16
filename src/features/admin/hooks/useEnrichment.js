import { useState, useCallback } from 'react'
import { supabase } from '@/shared/api/client'

/**
 * Custom hook for location enrichment workflow.
 * Manages state machine: idle → loading → reviewing → uploading → error
 * Communicates with /api/locations/enrich endpoint.
 */
export function useEnrichment() {
    const [state, setState] = useState('idle') // idle | loading | reviewing | uploading | error
    const [diff, setDiff] = useState(null)
    const [photos, setPhotos] = useState([])
    const [error, setError] = useState(null)
    const [quotaRemaining, setQuotaRemaining] = useState(null)
    const [freshnessResults, setFreshnessResults] = useState(null)
    const [progress, setProgress] = useState(null) // { current, total } for batch operations

    const callApi = useCallback(async (body) => {
        // Get current session token for admin auth
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        const response = await fetch('/api/locations/enrich', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
        })
        const data = await response.json()
        if (data.quotaRemaining !== undefined) {
            setQuotaRemaining(data.quotaRemaining)
        }
        if (!response.ok || data.success === false) {
            throw new Error(data.error || `Request failed with status ${response.status}`)
        }
        return data
    }, [])

    const fetchEnrichment = useCallback(async (locationId, fields) => {
        setState('loading')
        setError(null)
        setDiff(null)
        setPhotos([])
        try {
            const data = await callApi({ action: 'enrich', locationId, fields })
            setDiff(data.diff)
            setPhotos(data.photos || [])
            setState('reviewing')
            return data
        } catch (err) {
            setError(err.message)
            setState('error')
            return null
        }
    }, [callApi])

    const uploadPhotos = useCallback(async (locationId, photoRefs) => {
        setState('uploading')
        setError(null)
        try {
            const data = await callApi({ action: 'upload-photos', locationId, photoRefs })
            setState('reviewing')
            return data.urls || []
        } catch (err) {
            setError(err.message)
            setState('error')
            return []
        }
    }, [callApi])

    const runFreshnessCheck = useCallback(async (locationIds) => {
        setState('loading')
        setError(null)
        setFreshnessResults(null)
        setProgress({ current: 0, total: locationIds.length })
        try {
            const data = await callApi({ action: 'freshness-check', locationIds })
            setFreshnessResults(data.results)
            setProgress({ current: locationIds.length, total: locationIds.length })
            setState('reviewing')
            return data.results
        } catch (err) {
            setError(err.message)
            setState('error')
            return []
        }
    }, [callApi])

    const fetchQuotaStatus = useCallback(async () => {
        try {
            const data = await callApi({ action: 'quota-status' })
            setQuotaRemaining(data.quotaRemaining)
            return data
        } catch (err) {
            console.warn('[useEnrichment] Quota status fetch failed:', err.message)
            return null
        }
    }, [callApi])

    const reset = useCallback(() => {
        setState('idle')
        setDiff(null)
        setPhotos([])
        setError(null)
        setFreshnessResults(null)
        setProgress(null)
    }, [])

    return {
        // State
        enrichmentState: state,
        diff,
        photos,
        error,
        quotaRemaining,
        freshnessResults,
        progress,
        // Actions
        fetchEnrichment,
        uploadPhotos,
        runFreshnessCheck,
        fetchQuotaStatus,
        reset,
    }
}
