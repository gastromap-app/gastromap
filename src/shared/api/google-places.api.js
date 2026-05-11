import { supabase } from './client'
import { config } from '@/shared/config/env'

/**
 * Fetches photo data from Google Places for a given Place ID.
 * Returns an array of objects: { url, photo_reference }.
 */
export async function fetchGooglePhotos(googlePlaceId) {
    if (!googlePlaceId) return []
    
    if (!supabase) {
        console.warn('[GooglePlaces] ⚠️ Supabase not initialized')
        return []
    }

    try {
        console.log('[GooglePlaces] 🛰️ Fetching photos metadata for:', googlePlaceId)
        const { data, error } = await supabase.functions.invoke('get-google-photo', {
            method: 'GET',
            queryParams: { 
                place_id: googlePlaceId,
                mode: 'json',
                width: '1200'
            }
        })

        if (error) {
            console.error('[GooglePlaces] ❌ Function invocation failed:', error.message)
            return []
        }

        return data?.photos || []
    } catch (err) {
        console.error('[GooglePlaces] ⚠️ Global request error:', err.message)
        return []
    }
}

/**
 * Downloads a photo from Google Places via proxy and uploads it to Supabase Storage.
 * @param {string} googlePlaceId 
 * @param {string} photoReference 
 * @returns {Promise<string>} Public URL of the uploaded photo.
 */
export async function ingestGooglePhoto(googlePlaceId, photoReference) {
    try {
        console.log('[GooglePlaces] 📥 Ingesting photo:', photoReference?.substring(0, 10))
        
        // 1. Fetch binary data from our proxy function using native fetch
        // supabase.functions.invoke doesn't handle image/jpeg blobs well (parses them as text)
        const { data: { session } } = await supabase.auth.getSession()
        const functionUrl = new URL(`${config.supabase.url}/functions/v1/get-google-photo`)
        functionUrl.searchParams.set('place_id', googlePlaceId)
        functionUrl.searchParams.set('photo_reference', photoReference)
        functionUrl.searchParams.set('width', '1600')

        const response = await fetch(functionUrl.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${session?.access_token || config.supabase.anonKey}`
            }
        })

        if (!response.ok) {
            const errText = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, message: ${errText}`)
        }
        
        const blob = await response.blob()
        if (!blob || blob.size === 0) throw new Error('No blob returned or empty blob')

        // 2. Prepare file object, including a safe version of the photoReference for duplication checks
        const safeRef = (photoReference || '').substring(0, 20).replace(/[^a-zA-Z0-9]/g, '')
        const fileName = `google_${googlePlaceId}_${safeRef}_${Date.now()}.jpg`
        const file = new File([blob], fileName, { type: 'image/jpeg' })

        // 3. Upload to our storage
        const { uploadFile } = await import('./storage.api')
        const publicUrl = await uploadFile(file, 'locations', 'google-ingested')
        
        return publicUrl
    } catch (err) {
        console.error('[GooglePlaces] ❌ Ingestion failed:', err.message)
        return null
    }
}
