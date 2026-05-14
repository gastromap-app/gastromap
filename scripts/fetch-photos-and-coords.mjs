/**
 * fetch-photos-and-coords.mjs
 * 
 * Combined script:
 * 1. Fetches up to 10 photos from Google Places API
 * 2. Converts to WebP and uploads to Cloudflare R2
 * 3. Verifies/updates coordinates from Google Places
 * 4. Checks if location still exists (not permanently closed)
 * 
 * Skips locations that already have R2 photos.
 * 
 * Usage:
 *   node scripts/fetch-photos-and-coords.mjs
 *   node scripts/fetch-photos-and-coords.mjs --limit=20
 *   node scripts/fetch-photos-and-coords.mjs --dry-run
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const {
    VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
    R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_URL,
    GOOGLE_PLACES_API_KEY,
} = process.env

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('❌ Missing Supabase env'); process.exit(1) }
if (!R2_ACCESS_KEY_ID || !R2_ENDPOINT || !R2_BUCKET_NAME || !R2_PUBLIC_URL) { console.error('❌ Missing R2 env'); process.exit(1) }
if (!GOOGLE_PLACES_API_KEY) { console.error('❌ Missing GOOGLE_PLACES_API_KEY'); process.exit(1) }

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const limitArg = args.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

// ─── Google Places: get details (photos + geometry + status) ────────────────
async function getPlaceDetails(placeId) {
    const fields = 'photos,geometry,business_status,name'
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_PLACES_API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status !== 'OK') return null
    return data.result
}

// ─── Download a single photo by reference ──────────────────────────────────
async function downloadPhoto(photoRef) {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`
    try {
        const res = await fetch(url, { redirect: 'follow' })
        if (!res.ok) return null
        const buffer = Buffer.from(await res.arrayBuffer())
        return buffer.length > 1000 ? buffer : null
    } catch { return null }
}

// ─── Convert to WebP ───────────────────────────────────────────────────────
async function toWebP(buffer) {
    try {
        return await sharp(buffer).resize(1200, null, { withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
    } catch { return buffer }
}

// ─── Upload to R2 ──────────────────────────────────────────────────────────
async function uploadToR2(buffer, key) {
    await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME, Key: key, Body: buffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
    }))
    return `${R2_PUBLIC_URL}/${key}`
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
    console.log('🚀 Fetch Photos + Verify Coordinates')
    console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE'}`)
    if (LIMIT) console.log(`   Limit: ${LIMIT}`)
    console.log('')

    // Get all active locations
    const { data: all, error } = await supabase
        .from('locations')
        .select('id, title, image_url, google_place_id, lat, lng, status')
        .in('status', ['active', 'approved', 'draft'])
        .order('created_at', { ascending: true })

    if (error) { console.error('❌', error.message); process.exit(1) }

    // Filter: needs photo (no R2 URL) AND has google_place_id
    let targets = all.filter(loc => {
        const hasR2 = loc.image_url?.includes('r2.dev')
        const hasPlaceId = !!loc.google_place_id
        return !hasR2 && hasPlaceId
    })

    if (LIMIT) targets = targets.slice(0, LIMIT)

    console.log(`📦 Total locations: ${all.length}`)
    console.log(`📦 Already on R2: ${all.filter(l => l.image_url?.includes('r2.dev')).length}`)
    console.log(`📦 To process: ${targets.length}`)
    console.log('')

    const stats = { photos: 0, coords: 0, closed: 0, noPhotos: 0, failed: 0 }

    for (let i = 0; i < targets.length; i++) {
        const loc = targets[i]
        console.log(`[${i + 1}/${targets.length}] ${loc.title}`)

        if (DRY_RUN) { console.log('    📷 Would process'); continue }

        // Single API call — gets photos + coordinates + business status
        const details = await getPlaceDetails(loc.google_place_id)

        if (!details) {
            console.log('    ⚠️  Place not found in Google')
            stats.failed++
            await delay(300)
            continue
        }

        // Check if permanently closed
        if (details.business_status === 'CLOSED_PERMANENTLY') {
            console.log('    🚫 PERMANENTLY CLOSED — marking as hidden')
            await supabase.from('locations').update({ status: 'hidden' }).eq('id', loc.id)
            stats.closed++
            await delay(300)
            continue
        }

        const updates = {}

        // ── Coordinates check ──
        if (details.geometry?.location) {
            const gLat = details.geometry.location.lat
            const gLng = details.geometry.location.lng
            const latDiff = Math.abs((loc.lat || 0) - gLat)
            const lngDiff = Math.abs((loc.lng || 0) - gLng)

            if (latDiff > 0.001 || lngDiff > 0.001 || !loc.lat || !loc.lng) {
                updates.lat = gLat
                updates.lng = gLng
                console.log(`    📍 Coords updated: ${loc.lat},${loc.lng} → ${gLat},${gLng}`)
                stats.coords++
            }
        }

        // ── Photos ──
        const photoRefs = (details.photos || []).slice(0, 10)

        if (photoRefs.length > 0) {
            const r2Urls = []
            for (let j = 0; j < photoRefs.length; j++) {
                const buffer = await downloadPhoto(photoRefs[j].photo_reference)
                if (!buffer) continue
                const webp = await toWebP(buffer)
                const key = `locations/${loc.id}/${j === 0 ? 'main' : j - 1}.webp`
                const url = await uploadToR2(webp, key)
                r2Urls.push(url)
                await delay(100) // rate limit between photo downloads
            }

            if (r2Urls.length > 0) {
                updates.image_url = r2Urls[0]
                if (r2Urls.length > 1) updates.google_photos = r2Urls.slice(1)
                console.log(`    📸 ${r2Urls.length} photos → R2`)
                stats.photos++
            } else {
                console.log('    ⚠️  Photos exist but download failed')
                stats.noPhotos++
            }
        } else {
            console.log('    ⚠️  No photos in Google')
            stats.noPhotos++
        }

        // ── Save to DB ──
        if (Object.keys(updates).length > 0) {
            const { error: upErr } = await supabase.from('locations').update(updates).eq('id', loc.id)
            if (upErr) {
                console.error(`    ❌ DB error: ${upErr.message}`)
                stats.failed++
            }
        }

        await delay(500) // rate limit between locations
    }

    console.log('')
    console.log('═══════════════════════════════════════════')
    console.log('📊 Summary')
    console.log(`   Processed:        ${targets.length}`)
    console.log(`   ✅ Photos saved:  ${stats.photos}`)
    console.log(`   📍 Coords fixed:  ${stats.coords}`)
    console.log(`   🚫 Closed:        ${stats.closed}`)
    console.log(`   ⚠️  No photos:    ${stats.noPhotos}`)
    console.log(`   ❌ Failed:        ${stats.failed}`)
    console.log('═══════════════════════════════════════════')
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

main().catch(err => { console.error('💥', err); process.exit(1) })
