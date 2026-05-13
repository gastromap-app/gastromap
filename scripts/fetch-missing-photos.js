/**
 * fetch-missing-photos.js
 * 
 * Fetches photos from Google Places API for locations that have no image_url,
 * converts to WebP, uploads to Cloudflare R2, and updates Supabase.
 * 
 * Usage:
 *   node scripts/fetch-missing-photos.js
 *   node scripts/fetch-missing-photos.js --dry-run
 *   node scripts/fetch-missing-photos.js --limit=5
 *   node scripts/fetch-missing-photos.js --retry-google   # also retry remaining Google CDN URLs
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

// ─── Config ────────────────────────────────────────────────────────────────
const {
    VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_ENDPOINT,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL,
    GOOGLE_PLACES_API_KEY,
} = process.env

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}
if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    console.error('❌ Missing R2 env vars')
    process.exit(1)
}
if (!GOOGLE_PLACES_API_KEY) {
    console.error('❌ Missing GOOGLE_PLACES_API_KEY')
    process.exit(1)
}

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const RETRY_GOOGLE = args.includes('--retry-google')
const limitArg = args.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null

// ─── Clients ───────────────────────────────────────────────────────────────
const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
})

// ─── Helpers ───────────────────────────────────────────────────────────────
async function getGooglePhotos(placeId, maxPhotos = 10) {
    // Step 1: Get photo references from Place Details
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`
    const detailsRes = await fetch(detailsUrl)
    const details = await detailsRes.json()

    if (details.status !== 'OK' || !details.result?.photos?.length) {
        return []
    }

    const photoRefs = details.result.photos.slice(0, maxPhotos)

    // Step 2: Resolve each photo reference to actual image
    const photos = []
    for (const ref of photoRefs) {
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${ref.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`
        try {
            const res = await fetch(photoUrl, { redirect: 'follow' })
            if (res.ok) {
                const buffer = Buffer.from(await res.arrayBuffer())
                if (buffer.length > 1000) {
                    photos.push(buffer)
                }
            }
        } catch (err) {
            console.warn(`    ⚠️  Failed to fetch photo: ${err.message}`)
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100))
    }

    return photos
}

async function convertToWebP(buffer) {
    try {
        return await sharp(buffer)
            .resize(1200, null, { withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer()
    } catch {
        return buffer
    }
}

async function uploadToR2(buffer, key) {
    await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
    }))
    return `${R2_PUBLIC_URL}/${key}`
}

async function downloadImage(url, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 15000)
            const res = await fetch(url, {
                signal: controller.signal,
                headers: { 'User-Agent': 'GastroMap-Migration/1.0' },
                redirect: 'follow',
            })
            clearTimeout(timeout)
            if (!res.ok) {
                if (res.status === 404 || res.status === 403) return null
                throw new Error(`HTTP ${res.status}`)
            }
            const buffer = Buffer.from(await res.arrayBuffer())
            if (buffer.length < 1000) return null
            return buffer
        } catch (err) {
            if (attempt === retries) return null
            await new Promise(r => setTimeout(r, 1000 * attempt))
        }
    }
    return null
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
    console.log('🚀 Fetch Missing Photos → Google Places API → R2')
    console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE'}`)
    console.log(`   Retry Google CDN: ${RETRY_GOOGLE ? 'YES' : 'NO'}`)
    if (LIMIT) console.log(`   Limit: ${LIMIT}`)
    console.log('')

    // Fetch locations without photos (or with remaining Google URLs)
    const { data: allLocations, error } = await supabase
        .from('locations')
        .select('id, title, image_url, photos, google_place_id')
        .in('status', ['active', 'approved'])
        .order('created_at', { ascending: true })

    if (error) {
        console.error('❌ Failed to fetch locations:', error.message)
        process.exit(1)
    }

    // Filter: locations without image_url OR with remaining Google CDN URLs
    let targets = allLocations.filter(loc => {
        const hasNoPhoto = !loc.image_url || loc.image_url.trim() === ''
        const hasGooglePhoto = RETRY_GOOGLE && loc.image_url && 
            (loc.image_url.includes('googleusercontent.com') || loc.image_url.includes('googleapis.com'))
        return (hasNoPhoto || hasGooglePhoto) && loc.google_place_id
    })

    if (LIMIT) targets = targets.slice(0, LIMIT)

    console.log(`📦 Found ${targets.length} locations to process`)
    console.log('')

    let stats = { fetched: 0, uploaded: 0, noPhotos: 0, noPlaceId: 0, failed: 0 }

    for (let i = 0; i < targets.length; i++) {
        const loc = targets[i]
        console.log(`[${i + 1}/${targets.length}] ${loc.title} (${loc.google_place_id})`)

        if (!loc.google_place_id) {
            console.log('    ⏭️  No google_place_id — skipping')
            stats.noPlaceId++
            continue
        }

        if (DRY_RUN) {
            console.log('    📷 Would fetch photos from Google Places API')
            stats.fetched++
            continue
        }

        // Fetch photos from Google
        const photoBuffers = await getGooglePhotos(loc.google_place_id, 10)

        if (photoBuffers.length === 0) {
            console.log('    ⚠️  No photos available from Google')
            stats.noPhotos++
            continue
        }

        console.log(`    📸 Got ${photoBuffers.length} photos from Google`)
        stats.fetched++

        // Convert and upload each photo
        const r2Urls = []
        for (let j = 0; j < photoBuffers.length; j++) {
            const key = `locations/${loc.id}/${j === 0 ? 'main' : j - 1}.webp`
            const webp = await convertToWebP(photoBuffers[j])
            const url = await uploadToR2(webp, key)
            r2Urls.push(url)
        }

        // Update Supabase
        const updatePayload = {
            image_url: r2Urls[0],
        }
        if (r2Urls.length > 1) {
            updatePayload.photos = r2Urls.slice(1)
        }

        const { error: updateErr } = await supabase
            .from('locations')
            .update(updatePayload)
            .eq('id', loc.id)

        if (updateErr) {
            console.error(`    ❌ DB update failed: ${updateErr.message}`)
            stats.failed++
        } else {
            console.log(`    ✅ Uploaded ${r2Urls.length} photos to R2`)
            stats.uploaded++
        }

        // Rate limit: 500ms between locations (Google API quota)
        await new Promise(r => setTimeout(r, 500))
    }

    console.log('')
    console.log('═══════════════════════════════════════════')
    console.log('📊 Summary')
    console.log('═══════════════════════════════════════════')
    console.log(`   Locations processed:  ${targets.length}`)
    console.log(`   ✅ Photos uploaded:   ${stats.uploaded}`)
    console.log(`   📸 Fetched from API:  ${stats.fetched}`)
    console.log(`   ⚠️  No photos found:  ${stats.noPhotos}`)
    console.log(`   ⏭️  No place_id:      ${stats.noPlaceId}`)
    console.log(`   ❌ Failed:            ${stats.failed}`)
    console.log('═══════════════════════════════════════════')
}

main().catch(err => {
    console.error('💥 Unhandled error:', err)
    process.exit(1)
})
