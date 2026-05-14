/**
 * enrich-all-locations.mjs
 * 
 * Comprehensive location enrichment script:
 * 1. Find google_place_id for locations that don't have one (via Text Search)
 * 2. Verify/update coordinates, address, city name (English format)
 * 3. Download up to 10 photos → WebP → R2 for locations without photos
 * 4. Mark permanently closed locations as hidden
 * 
 * Usage:
 *   node scripts/enrich-all-locations.mjs --dry-run          # preview only
 *   node scripts/enrich-all-locations.mjs --limit=10         # process max 10
 *   node scripts/enrich-all-locations.mjs --skip-photos      # only data, no photos
 *   node scripts/enrich-all-locations.mjs --only-missing-id  # only find place_ids
 *   node scripts/enrich-all-locations.mjs                    # full run
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

// ─── Env ───────────────────────────────────────────────────────────────────
const {
    VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
    R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_URL,
    GOOGLE_PLACES_API_KEY,
} = process.env

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('❌ Missing Supabase env'); process.exit(1) }
if (!R2_ACCESS_KEY_ID || !R2_ENDPOINT || !R2_BUCKET_NAME || !R2_PUBLIC_URL) { console.error('❌ Missing R2 env'); process.exit(1) }
if (!GOOGLE_PLACES_API_KEY) { console.error('❌ Missing GOOGLE_PLACES_API_KEY'); process.exit(1) }

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SKIP_PHOTOS = args.includes('--skip-photos')
const ONLY_MISSING_ID = args.includes('--only-missing-id')
const limitArg = args.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null

// ─── Clients ───────────────────────────────────────────────────────────────
const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

const delay = ms => new Promise(r => setTimeout(r, ms))

// ─── City name normalization (Polish → English) ────────────────────────────
const CITY_MAP = {
    'kraków': 'Krakow', 'krakow': 'Krakow', 'cracow': 'Krakow',
    'warszawa': 'Warsaw', 'warsaw': 'Warsaw',
    'gdańsk': 'Gdansk', 'gdansk': 'Gdansk',
    'wrocław': 'Wroclaw', 'wroclaw': 'Wroclaw',
    'łódź': 'Lodz', 'lodz': 'Lodz',
    'poznań': 'Poznan', 'poznan': 'Poznan',
    'katowice': 'Katowice',
    'szczecin': 'Szczecin',
    'lublin': 'Lublin',
    'białystok': 'Bialystok', 'bialystok': 'Bialystok',
    'toruń': 'Torun', 'torun': 'Torun',
    'rzeszów': 'Rzeszow', 'rzeszow': 'Rzeszow',
    'kielce': 'Kielce',
    'olsztyn': 'Olsztyn',
    'opole': 'Opole',
    'zakopane': 'Zakopane',
    'sopot': 'Sopot',
    'gdynia': 'Gdynia',
}

function normalizeCity(city) {
    if (!city) return city
    const lower = city.trim().toLowerCase()
    return CITY_MAP[lower] || city.trim()
}

// ─── Google Places API helpers ─────────────────────────────────────────────

async function textSearch(query) {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=en&key=${GOOGLE_PLACES_API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status === 'REQUEST_DENIED') {
        console.error('   ❌ API REQUEST_DENIED:', data.error_message)
        return null
    }
    if (data.status !== 'OK' || !data.results?.length) return null
    return data.results[0]
}

async function getPlaceDetails(placeId) {
    const fields = 'name,formatted_address,geometry,business_status,photos'
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=en&key=${GOOGLE_PLACES_API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status !== 'OK') return null
    return data.result
}

async function downloadPhoto(photoRef) {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`
    try {
        const res = await fetch(url, { redirect: 'follow' })
        if (!res.ok) return null
        const buffer = Buffer.from(await res.arrayBuffer())
        return buffer.length > 1000 ? buffer : null
    } catch { return null }
}

async function uploadToR2(buffer, key) {
    const webp = await sharp(buffer).resize(1200, null, { withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
    await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME, Key: key, Body: webp,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
    }))
    return `${R2_PUBLIC_URL}/${key}`
}

// ─── Extract city from Google formatted_address ────────────────────────────
function extractCity(formattedAddress) {
    if (!formattedAddress) return null
    // Google format: "Street 12, 30-001 Kraków, Poland" or "Street 12, Kraków, Poland"
    const parts = formattedAddress.split(',').map(p => p.trim())
    // City is usually the second-to-last part (before country), possibly with postal code
    if (parts.length >= 3) {
        const cityPart = parts[parts.length - 2]
        // Remove postal code if present (e.g. "30-001 Kraków" → "Kraków")
        const cleaned = cityPart.replace(/^\d{2}-\d{3}\s*/, '').trim()
        return normalizeCity(cleaned)
    }
    return null
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
    console.log('🚀 Enrich All Locations')
    console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE'}`)
    if (SKIP_PHOTOS) console.log('   📷 Photos: SKIPPED')
    if (ONLY_MISSING_ID) console.log('   🎯 Only: missing place_id')
    if (LIMIT) console.log(`   Limit: ${LIMIT}`)
    console.log('')

    // Load all active locations
    const { data: all, error } = await supabase
        .from('locations')
        .select('id, title, city, country, address, lat, lng, image_url, google_place_id, google_formatted_address, status')
        .in('status', ['active', 'approved', 'draft'])
        .order('created_at', { ascending: true })

    if (error) { console.error('❌', error.message); process.exit(1) }

    console.log(`📦 Total active locations: ${all.length}`)
    const withPlaceId = all.filter(l => !!l.google_place_id)
    const withoutPlaceId = all.filter(l => !l.google_place_id)
    const withR2 = all.filter(l => l.image_url?.includes('r2.dev'))
    const withoutR2 = all.filter(l => !l.image_url?.includes('r2.dev'))

    console.log(`   ✅ With place_id: ${withPlaceId.length}`)
    console.log(`   ❌ Without place_id: ${withoutPlaceId.length}`)
    console.log(`   📸 With R2 photos: ${withR2.length}`)
    console.log(`   📷 Without R2 photos: ${withoutR2.length}`)
    console.log('')

    // Determine what to process
    let targets
    if (ONLY_MISSING_ID) {
        targets = withoutPlaceId
    } else {
        // Process all: first those without place_id, then those without photos
        targets = [
            ...withoutPlaceId,
            ...withPlaceId.filter(l => !l.image_url?.includes('r2.dev')),
        ]
        // Remove duplicates
        const seen = new Set()
        targets = targets.filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true })
    }

    if (LIMIT) targets = targets.slice(0, LIMIT)
    console.log(`🎯 To process: ${targets.length}`)
    console.log('')

    const stats = { placeIdFound: 0, coordsFixed: 0, cityFixed: 0, addressFixed: 0, photos: 0, closed: 0, failed: 0, apiDenied: 0 }

    for (let i = 0; i < targets.length; i++) {
        const loc = targets[i]
        console.log(`[${i + 1}/${targets.length}] ${loc.title} (${loc.city || '?'})`)

        if (DRY_RUN) {
            console.log(`    ${loc.google_place_id ? '✓ has place_id' : '⚠️  needs place_id'}`)
            console.log(`    ${loc.image_url?.includes('r2.dev') ? '✓ has R2 photo' : '⚠️  needs photos'}`)
            continue
        }

        const updates = {}
        let placeId = loc.google_place_id

        // ── Step 1: Find place_id if missing ──
        if (!placeId) {
            // Search by "title + address" for better accuracy (avoids finding wrong branch)
            const searchQuery = loc.address 
                ? `${loc.title} ${loc.address}`
                : `${loc.title} ${loc.city || 'Krakow'} ${loc.country || 'Poland'}`
            const result = await textSearch(searchQuery)
            if (!result) {
                if (stats.apiDenied === 0) {
                    // First denial — might be API not ready yet
                    console.log('    ⚠️  Text Search not available (API key may need more time)')
                }
                stats.failed++
                await delay(300)
                continue
            }
            placeId = result.place_id
            updates.google_place_id = placeId
            console.log(`    🔍 Found place_id: ${placeId}`)
            stats.placeIdFound++
            await delay(300)
        }

        // ── Step 2: Get Place Details ──
        const details = await getPlaceDetails(placeId)
        if (!details) {
            console.log('    ⚠️  Place Details failed')
            stats.failed++
            await delay(300)
            continue
        }

        // Check if permanently closed
        if (details.business_status === 'CLOSED_PERMANENTLY') {
            console.log('    🚫 PERMANENTLY CLOSED → hidden')
            updates.status = 'hidden'
            stats.closed++
            if (Object.keys(updates).length > 0) {
                await supabase.from('locations').update(updates).eq('id', loc.id)
            }
            await delay(300)
            continue
        }

        // ── Step 3: Verify address match before updating coordinates ──
        // Safety: if DB has an address and Google returns a very different one,
        // it means Text Search found the WRONG place (e.g. different branch).
        // In that case, skip coordinate update to avoid moving the pin to wrong location.
        let addressMismatch = false
        if (details.formatted_address && loc.address && loc.address.length > 5) {
            // Normalize: remove diacritics (ó→o, ą→a, ś→s), lowercase, keep only alphanumeric
            const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
            
            const dbFull = norm(loc.address)
            const googleFull = norm(details.formatted_address)
            const dbStreet = norm(loc.address.split(',')[0])
            const googleStreet = norm(details.formatted_address.split(',')[0])

            // Extract house number
            const dbNum = loc.address.match(/\d+/)?.[0] || ''
            const googleNum = details.formatted_address.match(/\d+/)?.[0] || ''

            // Match criteria (any one is enough):
            // 1. Street names share 5+ char common substring
            // 2. Same house number AND partial street overlap (4+ chars)
            // 3. Postal codes match (strong signal)
            // 4. Full address contains the other's street
            const streetOverlap = 
                dbStreet.includes(googleStreet.slice(0, Math.min(5, googleStreet.length))) ||
                googleStreet.includes(dbStreet.slice(0, Math.min(5, dbStreet.length)))
            
            const numAndPartial = dbNum && dbNum === googleNum && (
                dbStreet.includes(googleStreet.slice(0, 4)) ||
                googleStreet.includes(dbStreet.slice(0, 4))
            )

            const dbPostal = loc.address.match(/\d{2}-\d{3}/)?.[0] || ''
            const googlePostal = details.formatted_address.match(/\d{2}-\d{3}/)?.[0] || ''
            const postalMatch = dbPostal && googlePostal && dbPostal === googlePostal

            const crossContains = googleFull.includes(dbStreet.slice(0, 6)) || dbFull.includes(googleStreet.slice(0, 6))

            if (!streetOverlap && !numAndPartial && !postalMatch && !crossContains && dbStreet.length > 4 && googleStreet.length > 4) {
                addressMismatch = true
                console.log(`    ⚠️  ADDRESS MISMATCH — skipping coords update`)
                console.log(`       DB: ${loc.address}`)
                console.log(`       Google: ${details.formatted_address}`)
                // Don't save this wrong place_id if we just found it
                if (updates.google_place_id) {
                    delete updates.google_place_id
                    stats.placeIdFound--
                }
            }
        }

        // ── Step 4: Verify/update coordinates (only if address matches) ──
        if (!addressMismatch && details.geometry?.location) {
            const gLat = details.geometry.location.lat
            const gLng = details.geometry.location.lng
            const latDiff = Math.abs((loc.lat || 0) - gLat)
            const lngDiff = Math.abs((loc.lng || 0) - gLng)

            if (latDiff > 0.001 || lngDiff > 0.001 || !loc.lat || !loc.lng) {
                updates.lat = gLat
                updates.lng = gLng
                console.log(`    📍 Coords: ${loc.lat?.toFixed(4)},${loc.lng?.toFixed(4)} → ${gLat.toFixed(4)},${gLng.toFixed(4)}`)
                stats.coordsFixed++
            }
        }

        // ── Step 5: Verify/update address ──
        if (!addressMismatch && details.formatted_address) {
            updates.google_formatted_address = details.formatted_address
            if (!loc.address || loc.address.length < 5) {
                updates.address = details.formatted_address
                console.log(`    🏠 Address: ${details.formatted_address}`)
                stats.addressFixed++
            }
        }

        // ── Step 6: Normalize city to English ──
        const googleCity = extractCity(details.formatted_address)
        const currentCity = normalizeCity(loc.city)
        if (googleCity && googleCity !== loc.city) {
            updates.city = googleCity
            console.log(`    🌍 City: "${loc.city}" → "${googleCity}"`)
            stats.cityFixed++
        } else if (currentCity !== loc.city) {
            updates.city = currentCity
            console.log(`    🌍 City normalized: "${loc.city}" → "${currentCity}"`)
            stats.cityFixed++
        }

        // ── Step 7: Download photos if needed ──
        if (!addressMismatch && !SKIP_PHOTOS && !loc.image_url?.includes('r2.dev')) {
            const photoRefs = (details.photos || []).slice(0, 10)
            if (photoRefs.length > 0) {
                const r2Urls = []
                for (let j = 0; j < photoRefs.length; j++) {
                    const buffer = await downloadPhoto(photoRefs[j].photo_reference)
                    if (!buffer) continue
                    const key = `locations/${loc.id}/${j === 0 ? 'main' : j - 1}.webp`
                    const url = await uploadToR2(buffer, key)
                    r2Urls.push(url)
                    await delay(100)
                }
                if (r2Urls.length > 0) {
                    updates.image_url = r2Urls[0]
                    if (r2Urls.length > 1) updates.google_photos = r2Urls.slice(1)
                    console.log(`    📸 ${r2Urls.length} photos → R2`)
                    stats.photos++
                }
            } else {
                console.log('    ⚠️  No photos in Google')
            }
        }

        // ── Save updates ──
        if (Object.keys(updates).length > 0) {
            const { error: upErr } = await supabase.from('locations').update(updates).eq('id', loc.id)
            if (upErr) {
                console.error(`    ❌ DB error: ${upErr.message}`)
                stats.failed++
            }
        } else {
            console.log('    ✓ Already up to date')
        }

        await delay(500)
    }

    console.log('')
    console.log('═══════════════════════════════════════════')
    console.log('📊 Summary')
    console.log(`   Processed:         ${targets.length}`)
    console.log(`   🔍 Place IDs found: ${stats.placeIdFound}`)
    console.log(`   📍 Coords fixed:    ${stats.coordsFixed}`)
    console.log(`   🌍 Cities fixed:    ${stats.cityFixed}`)
    console.log(`   🏠 Addresses fixed: ${stats.addressFixed}`)
    console.log(`   📸 Photos saved:    ${stats.photos}`)
    console.log(`   🚫 Closed:          ${stats.closed}`)
    console.log(`   ❌ Failed:          ${stats.failed}`)
    console.log('═══════════════════════════════════════════')
}

main().catch(err => { console.error('💥', err); process.exit(1) })
