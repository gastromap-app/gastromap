/**
 * Vercel Serverless Function — Admin Location Enrichment
 *
 * Single endpoint handling multiple enrichment actions:
 *   - "enrich": Fetch Google Places data and return diff
 *   - "upload-photos": Download, convert, and upload photos to R2
 *   - "freshness-check": Batch verify location data freshness
 *   - "quota-status": Return current API quota usage
 *
 * Uses in-memory quota tracking (best-effort for serverless).
 * Rate limited to 20 requests per 60 seconds per IP.
 */

import { setCorsHeaders } from '../_shared/cors.js'
import { applyRateLimit } from '../_shared/rate-limit.js'
import { normalizeCity, normalizeDiacritics } from '../_shared/normalize.js'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

// ── Environment variables ─────────────────────────────────────────────────────
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_ENDPOINT = process.env.R2_ENDPOINT
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL

// ── Clients ───────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '')

const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || '',
        secretAccessKey: R2_SECRET_ACCESS_KEY || '',
    },
})

// ── In-memory quota tracking ──────────────────────────────────────────────────
const quotaStore = new Map()
const DAILY_LIMIT = parseInt(process.env.GOOGLE_PLACES_DAILY_QUOTA || '1000', 10)

/**
 * Track a Google Places API call. Returns updated quota info.
 * @returns {{ callsToday: number, quotaRemaining: number }}
 */
export function trackApiCall() {
    const today = new Date().toISOString().slice(0, 10)
    const current = quotaStore.get(today) || 0
    quotaStore.set(today, current + 1)
    return { callsToday: current + 1, quotaRemaining: Math.max(0, DAILY_LIMIT - current - 1) }
}

/**
 * Get current quota status without incrementing.
 * @returns {{ callsToday: number, quotaRemaining: number, dailyLimit: number }}
 */
export function getQuotaStatus() {
    const today = new Date().toISOString().slice(0, 10)
    const callsToday = quotaStore.get(today) || 0
    return { callsToday, quotaRemaining: Math.max(0, DAILY_LIMIT - callsToday), dailyLimit: DAILY_LIMIT }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map user-facing field names to Google Places API field names */
const FIELD_MAP = {
    title: 'name',
    opening_hours: 'opening_hours',
    address: 'formatted_address',
    coordinates: 'geometry',
    photos: 'photos',
}

/**
 * Fetch with a timeout (AbortController-based).
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, timeoutMs = 10000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const resp = await fetch(url, { signal: controller.signal })
        return resp
    } finally {
        clearTimeout(timer)
    }
}

/**
 * Compute diff between current DB values and Google Places values for selected fields.
 */
function computeDiff(location, placeDetails, selectedFields) {
    const diff = {}

    if (selectedFields.title) {
        const current = location.title || ''
        const google = placeDetails.name || ''
        diff.title = { current, google, match: current === google }
    }

    if (selectedFields.opening_hours) {
        const current = location.opening_hours || ''
        const google = placeDetails.opening_hours
            ? placeDetails.opening_hours.weekday_text?.join(', ') || ''
            : ''
        diff.opening_hours = { current, google, match: current === google }
    }

    if (selectedFields.address) {
        const currentRaw = location.address || location.google_formatted_address || ''
        const googleRaw = placeDetails.formatted_address || ''
        // Normalize diacritics for comparison
        const currentNorm = normalizeDiacritics(currentRaw) || ''
        const googleNorm = normalizeDiacritics(googleRaw) || ''
        diff.address = {
            current: currentRaw,
            google: googleRaw,
            match: currentNorm.toLowerCase() === googleNorm.toLowerCase(),
        }
    }

    if (selectedFields.coordinates) {
        const currentLat = location.lat || null
        const currentLng = location.lng || null
        const googleLat = placeDetails.geometry?.location?.lat || null
        const googleLng = placeDetails.geometry?.location?.lng || null
        diff.coordinates = {
            current: { lat: currentLat, lng: currentLng },
            google: { lat: googleLat, lng: googleLng },
            match: currentLat === googleLat && currentLng === googleLng,
        }
    }

    if (selectedFields.photos) {
        const currentPhotos = location.image_url || ''
        const googlePhotos = placeDetails.photos?.length || 0
        diff.photos = {
            current: currentPhotos,
            google: `${googlePhotos} photos available`,
            match: false, // Photos always show as available for review
        }
    }

    return diff
}

/**
 * Sleep helper for delays between API calls.
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Action handlers ───────────────────────────────────────────────────────────

async function handleEnrich(body) {
    // 1. Validate inputs
    const { locationId, fields } = body
    if (!locationId || typeof locationId !== 'string') {
        return { success: false, error: 'Invalid request: missing required field "locationId"', code: 'INVALID_REQUEST', _status: 400 }
    }
    if (!fields || typeof fields !== 'object') {
        return { success: false, error: 'Invalid request: missing required field "fields"', code: 'INVALID_REQUEST', _status: 400 }
    }

    // 2. Fetch current location from Supabase
    const { data: location, error: dbError } = await supabase
        .from('locations')
        .select('*')
        .eq('id', locationId)
        .single()

    if (dbError || !location) {
        return { success: false, error: 'Location not found', code: 'LOCATION_NOT_FOUND', _status: 404 }
    }

    // 3. Build search query
    const primaryQuery = `${location.title} ${location.address || ''}`.trim()
    const fallbackQuery = `${location.title} ${normalizeCity(location.city) || location.city || ''} ${location.country || ''}`.trim()

    // 4. Call Google Places Text Search
    let placeId = null
    let businessStatus = null

    try {
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(primaryQuery)}&language=en&key=${GOOGLE_API_KEY}`
        const searchResp = await fetchWithTimeout(searchUrl, 10000)
        const searchData = await searchResp.json()

        if (searchData.status === 'REQUEST_DENIED') {
            return { success: false, error: 'Google Places API access denied. Check API key configuration.', code: 'GOOGLE_API_DENIED', _status: 502 }
        }

        if (searchData.results && searchData.results.length > 0) {
            placeId = searchData.results[0].place_id
            businessStatus = searchData.results[0].business_status || null
        } else {
            // 5. Retry with fallback query
            trackApiCall()
            const fallbackUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(fallbackQuery)}&language=en&key=${GOOGLE_API_KEY}`
            const fallbackResp = await fetchWithTimeout(fallbackUrl, 10000)
            const fallbackData = await fallbackResp.json()

            if (fallbackData.status === 'REQUEST_DENIED') {
                return { success: false, error: 'Google Places API access denied. Check API key configuration.', code: 'GOOGLE_API_DENIED', _status: 502 }
            }

            if (fallbackData.results && fallbackData.results.length > 0) {
                placeId = fallbackData.results[0].place_id
                businessStatus = fallbackData.results[0].business_status || null
            }
        }

        trackApiCall() // Track the text search call
    } catch (err) {
        if (err.name === 'AbortError') {
            return { success: false, error: 'Enrichment request timed out. Try again.', code: 'TIMEOUT', _status: 504 }
        }
        throw err
    }

    // No results found
    if (!placeId) {
        // Update last_enriched_at even on no results
        await supabase.from('locations').update({ last_enriched_at: new Date().toISOString() }).eq('id', locationId)
        const quota = getQuotaStatus()
        return { success: true, placeId: null, businessStatus: null, diff: {}, photos: [], apiCallsUsed: quota.callsToday, quotaRemaining: quota.quotaRemaining }
    }

    // 6. Call Google Places Details for selected fields
    const googleFields = Object.entries(fields)
        .filter(([, selected]) => selected)
        .map(([field]) => FIELD_MAP[field])
        .filter(Boolean)

    // Always include business_status and name for identification
    const detailFields = [...new Set([...googleFields, 'business_status', 'place_id'])].join(',')

    let placeDetails = {}
    try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${detailFields}&language=en&key=${GOOGLE_API_KEY}`
        const detailsResp = await fetchWithTimeout(detailsUrl, 10000)
        const detailsData = await detailsResp.json()

        if (detailsData.status === 'REQUEST_DENIED') {
            return { success: false, error: 'Google Places API access denied. Check API key configuration.', code: 'GOOGLE_API_DENIED', _status: 502 }
        }

        placeDetails = detailsData.result || {}
        businessStatus = placeDetails.business_status || businessStatus
        trackApiCall()
    } catch (err) {
        if (err.name === 'AbortError') {
            return { success: false, error: 'Enrichment request timed out. Try again.', code: 'TIMEOUT', _status: 504 }
        }
        throw err
    }

    // 7-8. Compute diff (normalization happens inside computeDiff)
    const diff = computeDiff(location, placeDetails, fields)

    // Extract photos array
    const photos = (placeDetails.photos || []).slice(0, 10).map(p => ({
        reference: p.photo_reference,
        width: p.width,
        height: p.height,
    }))

    // 10-11. Update last_enriched_at
    await supabase.from('locations').update({
        last_enriched_at: new Date().toISOString(),
        google_place_id: placeId,
    }).eq('id', locationId)

    // 12. Return response
    const quota = getQuotaStatus()
    return {
        success: true,
        placeId,
        businessStatus,
        diff,
        photos,
        apiCallsUsed: quota.callsToday,
        quotaRemaining: quota.quotaRemaining,
    }
}

async function handleUploadPhotos(body) {
    // 1. Validate inputs
    const { locationId, photoRefs } = body
    if (!locationId || typeof locationId !== 'string') {
        return { success: false, error: 'Invalid request: missing required field "locationId"', code: 'INVALID_REQUEST', _status: 400 }
    }
    if (!Array.isArray(photoRefs) || photoRefs.length === 0) {
        return { success: false, error: 'Invalid request: missing required field "photoRefs"', code: 'INVALID_REQUEST', _status: 400 }
    }

    const urls = []
    const failed = []

    // 2. Process each photo reference
    for (let i = 0; i < photoRefs.length; i++) {
        const ref = photoRefs[i]
        try {
            // Download from Google Places Photo API
            const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(ref)}&key=${GOOGLE_API_KEY}`
            const photoResp = await fetchWithTimeout(photoUrl, 10000)

            if (!photoResp.ok) {
                failed.push({ reference: ref, error: `Download failed with status ${photoResp.status}` })
                continue
            }

            const imageBuffer = Buffer.from(await photoResp.arrayBuffer())
            trackApiCall()

            // Convert to WebP using sharp
            let webpBuffer
            try {
                webpBuffer = await sharp(imageBuffer)
                    .resize(1200, null, { withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toBuffer()
            } catch (compressErr) {
                failed.push({ reference: ref, error: 'Image compression failed' })
                continue
            }

            // Upload to R2
            const key = `locations/${locationId}/${i === 0 ? 'main' : i - 1}.webp`
            try {
                await s3.send(new PutObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: key,
                    Body: webpBuffer,
                    ContentType: 'image/webp',
                    CacheControl: 'public, max-age=31536000, immutable',
                }))
            } catch (r2Err) {
                failed.push({ reference: ref, error: 'R2 upload failed' })
                continue
            }

            const url = `${R2_PUBLIC_URL}/${key}`
            urls.push(url)
        } catch (err) {
            // 3. Continue on individual failures
            failed.push({ reference: ref, error: err.message || 'Unknown error' })
        }
    }

    // 4. Return results
    return { success: true, urls, failed }
}

async function handleFreshnessCheck(body) {
    // 1. Validate inputs
    const { locationIds } = body
    if (!Array.isArray(locationIds) || locationIds.length === 0) {
        return { success: false, error: 'Invalid request: missing required field "locationIds"', code: 'INVALID_REQUEST', _status: 400 }
    }

    const results = []
    const freshnessFields = 'business_status,formatted_address,opening_hours,geometry,photos'

    // 2. Process each location sequentially with 500ms delay
    for (let i = 0; i < locationIds.length; i++) {
        const locationId = locationIds[i]

        // Add 500ms delay between API calls (skip first)
        if (i > 0) {
            await sleep(500)
        }

        try {
            // Fetch location from Supabase
            const { data: location, error: dbError } = await supabase
                .from('locations')
                .select('*')
                .eq('id', locationId)
                .single()

            if (dbError || !location) {
                results.push({ locationId, diff: {}, warnings: ['Location not found in database'] })
                continue
            }

            let placeId = location.google_place_id
            let placeDetails = {}

            // If location has google_place_id, use Place Details directly
            if (placeId) {
                try {
                    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${freshnessFields}&language=en&key=${GOOGLE_API_KEY}`
                    const detailsResp = await fetchWithTimeout(detailsUrl, 10000)
                    const detailsData = await detailsResp.json()

                    if (detailsData.status === 'REQUEST_DENIED') {
                        results.push({ locationId, diff: {}, warnings: ['Google API access denied'] })
                        continue
                    }

                    placeDetails = detailsData.result || {}
                    trackApiCall()
                } catch (err) {
                    if (err.name === 'AbortError') {
                        results.push({ locationId, diff: {}, warnings: ['Request timed out'] })
                        continue
                    }
                    throw err
                }
            } else {
                // No google_place_id — try Text Search first
                const searchQuery = `${location.title} ${normalizeCity(location.city) || location.city || ''} ${location.country || ''}`.trim()
                try {
                    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&language=en&key=${GOOGLE_API_KEY}`
                    const searchResp = await fetchWithTimeout(searchUrl, 10000)
                    const searchData = await searchResp.json()

                    if (searchData.status === 'REQUEST_DENIED') {
                        results.push({ locationId, diff: {}, warnings: ['Google API access denied'] })
                        continue
                    }

                    trackApiCall()

                    if (searchData.results && searchData.results.length > 0) {
                        placeId = searchData.results[0].place_id

                        // Now fetch details
                        await sleep(500)
                        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${freshnessFields}&language=en&key=${GOOGLE_API_KEY}`
                        const detailsResp = await fetchWithTimeout(detailsUrl, 10000)
                        const detailsData = await detailsResp.json()

                        placeDetails = detailsData.result || {}
                        trackApiCall()
                    } else {
                        results.push({ locationId, diff: {}, warnings: ['No Google Places match found'] })
                        // Update last_enriched_at even on no results
                        await supabase.from('locations').update({ last_enriched_at: new Date().toISOString() }).eq('id', locationId)
                        continue
                    }
                } catch (err) {
                    if (err.name === 'AbortError') {
                        results.push({ locationId, diff: {}, warnings: ['Request timed out'] })
                        continue
                    }
                    throw err
                }
            }

            // Compute diff for all fields
            const allFields = { title: true, opening_hours: true, address: true, coordinates: true, photos: true }
            const diff = computeDiff(location, placeDetails, allFields)

            // Flag CLOSED_PERMANENTLY as warning
            const warnings = []
            if (placeDetails.business_status === 'CLOSED_PERMANENTLY') {
                warnings.push('CLOSED_PERMANENTLY')
            }

            results.push({ locationId, diff, warnings })

            // Update last_enriched_at and google_place_id
            const updateData = { last_enriched_at: new Date().toISOString() }
            if (placeId && !location.google_place_id) {
                updateData.google_place_id = placeId
            }
            await supabase.from('locations').update(updateData).eq('id', locationId)

        } catch (err) {
            results.push({ locationId, diff: {}, warnings: [`Error: ${err.message}`] })
        }
    }

    const quota = getQuotaStatus()
    return {
        success: true,
        results,
        apiCallsUsed: quota.callsToday,
        quotaRemaining: quota.quotaRemaining,
    }
}

function handleQuotaStatus() {
    const status = getQuotaStatus()
    return { success: true, ...status }
}

// ── Supported actions ─────────────────────────────────────────────────────────
const ACTION_HANDLERS = {
    'enrich': handleEnrich,
    'upload-photos': handleUploadPhotos,
    'freshness-check': handleFreshnessCheck,
    'quota-status': handleQuotaStatus,
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
    // CORS
    setCorsHeaders(req, res)

    // Preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    // Method check
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // Rate limit: 20 req / 60s per IP
    if (applyRateLimit(req, res, 'locations-enrich', { maxRequests: 20, windowMs: 60000 })) {
        return // applyRateLimit already sent 429 response
    }

    try {
        const body = req.body

        // Validate request body
        if (!body || typeof body !== 'object') {
            return res.status(400).json({ error: 'Invalid request: missing request body', code: 'INVALID_REQUEST' })
        }

        const { action } = body

        if (!action || typeof action !== 'string') {
            return res.status(400).json({ error: 'Invalid request: missing required field "action"', code: 'INVALID_REQUEST' })
        }

        // Route to action handler
        const actionHandler = ACTION_HANDLERS[action]

        if (!actionHandler) {
            return res.status(400).json({
                error: `Invalid action: "${action}". Supported actions: ${Object.keys(ACTION_HANDLERS).join(', ')}`,
                code: 'INVALID_ACTION',
            })
        }

        // Execute action
        const result = await actionHandler(body)

        // Handle custom status codes from action handlers
        const status = result._status || 200
        if (result._status) {
            const { _status, ...responseBody } = result
            return res.status(status).json(responseBody)
        }
        return res.status(200).json(result)

    } catch (err) {
        console.error('[locations/enrich] Unexpected error:', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
}
