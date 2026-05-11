import { supabase, ApiError } from './client'
import { config } from '@/shared/config/env'

const USE_SUPABASE = config.supabase.isConfigured

/**
 * Maximum dimensions and quality for uploaded images.
 * Optimized for free Supabase tier (1GB storage limit):
 * - WebP format: ~40% smaller than JPEG at same visual quality
 * - 1200px max width: sufficient for detail pages, saves ~30% vs 1400px
 * - Quality 0.75: visually indistinguishable from 0.82 but ~20% smaller
 * 
 * Typical result: 60-120KB per photo (vs 200-400KB with old JPEG settings)
 * At 100KB avg: ~10,000 photos fit in 1GB free tier
 */
const COMPRESS_DEFAULTS = {
    maxWidth: 1200,
    maxHeight: 900,
    quality: 0.75,
    format: 'webp', // WebP: ~40% smaller than JPEG, supported by all modern browsers
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

/**
 * Upload a file to Supabase Storage.
 * Automatically compresses images before upload to save storage space.
 * 
 * @param {File} file - File to upload
 * @param {string} bucket - Storage bucket name
 * @param {string} folder - Folder path within bucket
 * @param {object} options - Upload options
 * @param {boolean} options.skipCompression - Skip auto-compression (for already-compressed files)
 */
export async function uploadFile(file, bucket = 'locations', folder = 'general', options = {}) {
    if (!USE_SUPABASE) {
        console.warn('[Storage] Supabase not configured, using mock URL')
        return URL.createObjectURL(file)
    }

    // Auto-compress images unless explicitly skipped
    let fileToUpload = file
    if (!options.skipCompression && file.type.startsWith('image/')) {
        try {
            fileToUpload = await compressImage(file)
        } catch (err) {
            console.warn('[Storage] Compression failed, uploading original:', err.message)
            fileToUpload = file
        }
    }

    const timestamp = Date.now()
    const safeName = fileToUpload.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase()
    const path = `${folder}/${timestamp}-${safeName}`

    const { error } = await supabase.storage
        .from(bucket)
        .upload(path, fileToUpload, { 
            upsert: false,
            contentType: fileToUpload.type 
        })

    if (error) {
        console.error('[Storage] Upload error:', error)
        throw new ApiError(error.message, 400, 'UPLOAD_ERROR')
    }

    const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path)

    return publicUrlData.publicUrl
}
