/**
 * migrate-photos-to-r2.js
 * 
 * One-time migration script: downloads all location photos from Google CDN
 * and uploads them to Cloudflare R2, then updates Supabase with permanent URLs.
 * 
 * Usage:
 *   node scripts/migrate-photos-to-r2.js
 *   node scripts/migrate-photos-to-r2.js --dry-run    # preview without changes
 *   node scripts/migrate-photos-to-r2.js --limit=10   # process only 10 locations
 * 
 * Requirements:
 *   - .env with R2_*, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL
 *   - npm packages: @aws-sdk/client-s3, sharp, dotenv, @supabase/supabase-js
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
} = process.env

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}
if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    console.error('❌ Missing R2 env vars (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_URL)')
    process.exit(1)
}

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
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
const GOOGLE_CDN_RE = /lh3\.googleusercontent\.com/
const GOOGLE_MAPS_RE = /maps\.googleapis\.com/

function isGoogleUrl(url) {
    if (!url || typeof url !== 'string') return false
    return GOOGLE_CDN_RE.test(url) || GOOGLE_MAPS_RE.test(url)
}

function isAlreadyMigrated(url) {
    if (!url || typeof url !== 'string') return false
    return url.includes('r2.dev') || url.includes('r2.cloudflarestorage.com')
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
                if (res.status === 404 || res.status === 403) return null // permanently gone
                throw new Error(`HTTP ${res.status}`)
            }
            
            const buffer = Buffer.from(await res.arrayBuffer())
            if (buffer.length < 1000) return null // too small, likely error page
            return buffer
        } catch (err) {
            if (attempt === retries) {
                console.warn(`    ⚠️  Failed to download after ${retries} attempts: ${err.message}`)
                return null
            }
            await new Promise(r => setTimeout(r, 1000 * attempt))
        }
    }
    return null
}

async function convertToWebP(buffer) {
    try {
        return await sharp(buffer)
            .resize(1200, null, { withoutEnlargement: true }) // max 1200px wide
            .webp({ quality: 80 })
            .toBuffer()
    } catch (err) {
        console.warn(`    ⚠️  Sharp conversion failed: ${err.message}, using original`)
        return buffer
    }
}

async function objectExists(key) {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
        return true
    } catch {
        return false
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

async function migratePhoto(url, locationId, photoIndex) {
    const key = `locations/${locationId}/${photoIndex === 'main' ? 'main' : photoIndex}.webp`
    
    // Skip if already uploaded
    if (await objectExists(key)) {
        return `${R2_PUBLIC_URL}/${key}`
    }
    
    const buffer = await downloadImage(url)
    if (!buffer) return null
    
    const webpBuffer = await convertToWebP(buffer)
    const r2Url = await uploadToR2(webpBuffer, key)
    return r2Url
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
    console.log('🚀 GastroMap Photo Migration → Cloudflare R2')
    console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ LIVE'}`)
    if (LIMIT) console.log(`   Limit: ${LIMIT} locations`)
    console.log('')

    // Fetch all locations with photos
    let query = supabase
        .from('locations')
        .select('id, title, image_url, photos, google_place_id')
        .in('status', ['active', 'approved'])
        .order('created_at', { ascending: true })

    if (LIMIT) query = query.limit(LIMIT)

    const { data: locations, error } = await query
    if (error) {
        console.error('❌ Failed to fetch locations:', error.message)
        process.exit(1)
    }

    console.log(`📦 Found ${locations.length} locations to process`)
    console.log('')

    let stats = { total: 0, migrated: 0, skipped: 0, failed: 0, alreadyDone: 0 }

    for (let i = 0; i < locations.length; i++) {
        const loc = locations[i]
        const urls = []
        
        // Collect all photo URLs for this location
        if (loc.image_url && isGoogleUrl(loc.image_url)) {
            urls.push({ url: loc.image_url, field: 'image_url', index: 'main' })
        } else if (loc.image_url && isAlreadyMigrated(loc.image_url)) {
            stats.alreadyDone++
        }
        
        if (Array.isArray(loc.photos)) {
            loc.photos.forEach((url, idx) => {
                if (isGoogleUrl(url)) {
                    urls.push({ url, field: 'photos', index: idx })
                } else if (isAlreadyMigrated(url)) {
                    stats.alreadyDone++
                }
            })
        }

        if (urls.length === 0) {
            stats.skipped++
            continue
        }

        console.log(`[${i + 1}/${locations.length}] ${loc.title} (${loc.id}) — ${urls.length} photo(s)`)
        stats.total += urls.length

        if (DRY_RUN) {
            urls.forEach(u => console.log(`    📷 Would migrate: ${u.url.substring(0, 60)}...`))
            stats.migrated += urls.length
            continue
        }

        // Migrate each photo
        const updatePayload = {}
        let newPhotos = loc.photos ? [...loc.photos] : []
        let hasChanges = false

        for (const item of urls) {
            const r2Url = await migratePhoto(item.url, loc.id, item.index)
            
            if (r2Url) {
                if (item.field === 'image_url') {
                    updatePayload.image_url = r2Url
                } else {
                    newPhotos[item.index] = r2Url
                }
                hasChanges = true
                stats.migrated++
                console.log(`    ✅ ${item.index === 'main' ? 'main' : `photo[${item.index}]`} → R2`)
            } else {
                stats.failed++
                console.log(`    ❌ ${item.index === 'main' ? 'main' : `photo[${item.index}]`} — download failed`)
            }
        }

        // Update Supabase
        if (hasChanges) {
            if (newPhotos.some((_, idx) => urls.find(u => u.field === 'photos' && u.index === idx))) {
                updatePayload.photos = newPhotos
            }
            
            const { error: updateErr } = await supabase
                .from('locations')
                .update(updatePayload)
                .eq('id', loc.id)

            if (updateErr) {
                console.error(`    ❌ DB update failed: ${updateErr.message}`)
            }
        }

        // Rate limit: small delay between locations
        await new Promise(r => setTimeout(r, 200))
    }

    // ─── Summary ───────────────────────────────────────────────────────────
    console.log('')
    console.log('═══════════════════════════════════════════')
    console.log('📊 Migration Summary')
    console.log('═══════════════════════════════════════════')
    console.log(`   Total photos processed: ${stats.total}`)
    console.log(`   ✅ Migrated to R2:      ${stats.migrated}`)
    console.log(`   ⏭️  Skipped (no Google): ${stats.skipped}`)
    console.log(`   ✓  Already on R2:       ${stats.alreadyDone}`)
    console.log(`   ❌ Failed:              ${stats.failed}`)
    console.log('═══════════════════════════════════════════')
}

main().catch(err => {
    console.error('💥 Unhandled error:', err)
    process.exit(1)
})
