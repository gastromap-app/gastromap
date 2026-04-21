import { supabase, ApiError } from './client'
import { config } from '@/shared/config/env'

const USE_SUPABASE = config.supabase.isConfigured

/**
 * Compress an image file using the Canvas API.
 * Returns a new JPEG File, never larger than the original.
 */
export function compressImage(file, { maxWidth = 1400, maxHeight = 1050, quality = 0.82 } = {}) {
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
            canvas.toBlob(
                (blob) => {
                    if (!blob) return reject(new Error('Compression failed'))
                    const safeName = file.name.replace(/\.\w+$/, '.jpg')
                    resolve(new File([blob], safeName, { type: 'image/jpeg' }))
                },
                'image/jpeg',
                quality,
            )
        }
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
        img.src = objectUrl
    })
}

/**
 * Upload a file to Supabase Storage.
 * @param {File} file 
 * @param {string} bucket 
 * @param {string} folder 
 */
export async function uploadFile(file, bucket = 'locations', folder = 'general') {
    if (!USE_SUPABASE) {
        console.warn('[Storage] Supabase not configured, using mock URL')
        return URL.createObjectURL(file)
    }

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase()
    const path = `${folder}/${timestamp}-${safeName}`

    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { 
            upsert: false,
            contentType: file.type 
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
