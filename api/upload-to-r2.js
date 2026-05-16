/**
 * Vercel Serverless — Upload image to Cloudflare R2
 * 
 * Accepts multipart/form-data with:
 *   - file: image (JPEG, PNG, GIF, WebP), max 10MB
 *   - folder: string (subfolder in R2, e.g. "general" or location UUID)
 * 
 * Pipeline:
 *   1. Validate CORS, rate limit, method
 *   2. Parse multipart form data
 *   3. Validate MIME type and file size
 *   4. Compress to WebP via sharp (1200px, quality 80)
 *   5. Upload to R2 via S3-compatible API
 *   6. Return public URL
 */

import { setCorsHeaders } from './_shared/cors.js'
import { applyRateLimit } from './_shared/rate-limit.js'
import { verifyAdmin } from './_shared/auth.js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import Busboy from 'busboy'

// Vercel: disable built-in body parsing so we can handle multipart ourselves
export const config = {
    api: { bodyParser: false },
}

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const {
    R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_URL,
} = process.env

const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || '',
        secretAccessKey: R2_SECRET_ACCESS_KEY || '',
    },
})

/**
 * Parse multipart form data from the request.
 * Returns { file: Buffer, filename: string, mimeType: string, folder: string }
 */
function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        let file = null
        let filename = ''
        let mimeType = ''
        let folder = ''
        let fileSize = 0
        const chunks = []

        const busboy = Busboy({
            headers: req.headers,
            limits: { fileSize: MAX_FILE_SIZE + 1024 }, // slightly over to detect overflow
        })

        busboy.on('file', (fieldname, stream, info) => {
            if (fieldname !== 'file') {
                stream.resume()
                return
            }
            filename = info.filename || 'upload'
            mimeType = info.mimeType || ''

            stream.on('data', (chunk) => {
                fileSize += chunk.length
                if (fileSize <= MAX_FILE_SIZE) {
                    chunks.push(chunk)
                }
            })

            stream.on('end', () => {
                if (fileSize > 0) {
                    file = Buffer.concat(chunks)
                }
            })
        })

        busboy.on('field', (fieldname, value) => {
            if (fieldname === 'folder') {
                folder = value.trim()
            }
        })

        busboy.on('finish', () => {
            resolve({ file, filename, mimeType, folder, fileSize })
        })

        busboy.on('error', (err) => {
            reject(err)
        })

        req.pipe(busboy)
    })
}

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

    // Rate limit: 30 req / 60s per IP
    if (applyRateLimit(req, res, 'upload-to-r2', { maxRequests: 30, windowMs: 60000 })) {
        return // applyRateLimit already sent 429 response
    }

    // Admin authentication — verify JWT and admin role
    const { error: authError, status: authStatus } = await verifyAdmin(req)
    if (authError) {
        return res.status(authStatus).json({ error: authError })
    }

    try {
        // Parse multipart
        const { file, filename, mimeType, folder, fileSize } = await parseMultipart(req)

        // Validate folder
        if (!folder) {
            return res.status(400).json({ error: 'Missing required field: folder', code: 'MISSING_FOLDER' })
        }

        // Validate file presence
        if (!file || file.length === 0) {
            return res.status(400).json({ error: 'No image file provided', code: 'MISSING_FILE' })
        }

        // Validate file size
        if (fileSize > MAX_FILE_SIZE) {
            return res.status(413).json({ error: 'File exceeds 10MB size limit', code: 'FILE_TOO_LARGE' })
        }

        // Validate MIME type
        if (!ALLOWED_MIMES.has(mimeType)) {
            return res.status(400).json({
                error: `Invalid file type: ${mimeType}. Allowed: JPEG, PNG, GIF, WebP`,
                code: 'INVALID_MIME',
            })
        }

        // Compress to WebP
        let webpBuffer
        try {
            webpBuffer = await sharp(file)
                .resize(1200, null, { withoutEnlargement: true })
                .webp({ quality: 80 })
                .toBuffer()
        } catch (compressErr) {
            console.error('[upload-to-r2] Compression failed:', compressErr.message)
            return res.status(422).json({
                error: 'Image could not be processed. File may be corrupt or unreadable.',
                code: 'COMPRESSION_FAILED',
            })
        }

        // Generate unique key
        const timestamp = Date.now()
        const sanitizedName = filename
            .replace(/\.\w+$/, '') // remove extension
            .replace(/[^a-z0-9\-_]/gi, '_')
            .toLowerCase()
            .slice(0, 60) // cap length
        const key = `locations/${folder}/${timestamp}-${sanitizedName}.webp`

        // Upload to R2
        try {
            await s3.send(new PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: key,
                Body: webpBuffer,
                ContentType: 'image/webp',
                CacheControl: 'public, max-age=31536000, immutable',
            }))
        } catch (r2Err) {
            console.error('[upload-to-r2] R2 upload failed:', r2Err.message)
            return res.status(502).json({
                error: 'Storage upload failed. Please try again.',
                code: 'R2_UPLOAD_FAILED',
            })
        }

        // Return public URL
        const url = `${R2_PUBLIC_URL}/${key}`
        return res.status(200).json({ url })

    } catch (err) {
        console.error('[upload-to-r2] Unexpected error:', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
}
