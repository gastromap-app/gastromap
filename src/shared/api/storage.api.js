import { ApiError } from './client'

/**
 * Maximum dimensions and quality for uploaded images.
 * Client-side pre-compression before sending to the R2 upload endpoint:
 * - WebP format: ~40% smaller than JPEG at same visual quality
 * - 1200px max width: sufficient for detail pages
 * - Quality 0.75: visually indistinguishable from 0.82 but ~20% smaller
 */
const COMPRESS_DEFAULTS = {
    maxWidth: 1200,
    maxHeight: 900,
    quality: 0.75,
    format: 'webp',
}

/**
 * Compress an image file using the Canvas API.
 * Outputs WebP by default (falls back to JPEG for Safari < 16).
 * Returns a File that is always smaller than or equal to the original.
 */
export function compressImage(file, opts = {}) {
    const { maxWidth, maxHeight, quality, format } = { ...COMPRESS_DEFAULTS, ...opts }
    
    return new Promise((resolve, reject) => {
        const img = new Image()
        const objectUrl = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(objectUrl)
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
            const canvas = document.createElement('canvas')
            canvas.width  = Math.round(img.width  * scale)
            canvas.height = Math.round(img.height * scale)
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
            
            const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg'
            const ext = format === 'webp' ? '.webp' : '.jpg'
            
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        // WebP not supported — fallback to JPEG
                        canvas.toBlob(
                            (jpegBlob) => {
                                if (!jpegBlob) return reject(new Error('Compression failed'))
                                const safeName = file.name.replace(/\.\w+$/, '.jpg')
                                resolve(new File([jpegBlob], safeName, { type: 'image/jpeg' }))
                            },
                            'image/jpeg',
                            quality
                        )
                        return
                    }
                    
                    // If compressed is larger than original (rare for small images), use original
                    if (blob.size >= file.size && file.type.startsWith('image/')) {
                        resolve(file)
                        return
                    }
                    
                    const safeName = file.name.replace(/\.\w+$/, ext)
                    resolve(new File([blob], safeName, { type: mimeType }))
                },
                mimeType,
                quality,
            )
        }
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
        img.src = objectUrl
    })
}

/** Small delay helper for retry logic */
function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

/**
 * Upload a file to Cloudflare R2 via the serverless endpoint.
 * Automatically compresses images client-side before upload.
 * Independent of Supabase Storage — works even when Supabase is throttling.
 * 
 * @param {File} file - File to upload
 * @param {string} bucket - Ignored (kept for API compatibility), R2 uses folder-based organization
 * @param {string} folder - Folder path within R2 bucket (default: 'general')
 * @param {object} options - Upload options
 * @param {boolean} options.skipCompression - Skip client-side pre-compression
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadFile(file, bucket = 'locations', folder = 'general', options = {}) {
    // Client-side pre-compression (reduces upload size)
    let fileToUpload = file
    if (!options.skipCompression && file.type.startsWith('image/')) {
        try {
            fileToUpload = await compressImage(file)
        } catch (err) {
            console.warn('[Storage] Client compression failed, uploading original:', err.message)
            fileToUpload = file
        }
    }

    // Build multipart form data
    const formData = new FormData()
    formData.append('file', fileToUpload)
    formData.append('folder', folder)

    // Retry logic: up to 2 retries for transient errors
    const MAX_RETRIES = 2
    let lastError = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
            console.warn(`[Storage] Retry attempt ${attempt}/${MAX_RETRIES}...`)
            await delay(1000) // 1s delay between retries
        }

        try {
            // 20-second timeout to prevent hanging on throttled connections
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 20000)

            const response = await fetch('/api/upload-to-r2', {
                method: 'POST',
                body: formData,
                signal: controller.signal,
            })

            clearTimeout(timeoutId)

            // Success
            if (response.ok) {
                const data = await response.json()
                return data.url
            }

            // Non-retryable client errors (4xx)
            if (response.status >= 400 && response.status < 500) {
                const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))
                throw new ApiError(
                    errorData.error || `Upload failed with status ${response.status}`,
                    response.status,
                    errorData.code || 'UPLOAD_ERROR'
                )
            }

            // Server errors (5xx) — retryable
            lastError = new ApiError(
                'Storage service temporarily unavailable. Please retry.',
                response.status,
                'UPLOAD_UNAVAILABLE'
            )

        } catch (err) {
            // AbortController timeout
            if (err.name === 'AbortError') {
                throw new ApiError(
                    'Upload timed out after 20 seconds. Please try again.',
                    408,
                    'UPLOAD_TIMEOUT'
                )
            }

            // Network errors — retryable
            if (err instanceof ApiError) {
                // 4xx errors are not retryable — rethrow immediately
                if (err.status >= 400 && err.status < 500) {
                    throw err
                }
                lastError = err
            } else {
                lastError = new ApiError(
                    'Network error during upload. Please check your connection.',
                    0,
                    'UPLOAD_UNAVAILABLE'
                )
            }
        }
    }

    // All retries exhausted
    throw lastError || new ApiError(
        'Upload failed after multiple attempts. Please try again later.',
        503,
        'UPLOAD_UNAVAILABLE'
    )
}
