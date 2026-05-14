/**
 * 1. Find new place_id for 5 locations via Google Text Search
 * 2. Fetch photos + coords for them
 * 3. Delete the other 19 locations from DB
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_URL, GOOGLE_PLACES_API_KEY } = process.env
const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const s3 = new S3Client({ region: 'auto', endpoint: R2_ENDPOINT, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } })

const delay = ms => new Promise(r => setTimeout(r, ms))

// 5 locations to fix
const TO_FIX = [
    'Megiddo Cafe & Bakery',
    'Boby Specialty Coffee & Matcha',
    'Karma Coffee Roastery',
    'Bun Bakery',
    'Café Bunker',
]

// 19 locations to delete
const TO_DELETE = [
    'Gospoda Karczmarzewska',
    'Botanica',
    'Krakow Street Food',
    'Bistro Locus',
    'Gospoda Krakowska',
    'Hawełka Restaurant',
    'Vega Restaurant',
    'Café Młynek',
    'Rubinstein Restaurant',
    'Pizzeria Italiana',
    'HANA',
    'Kieliszki na Próżnej',
    'Polakowski',
    'Kawiarnia Vis a Vis',
    'Pierogarnia Mnicha',
    'Restauracja Ancora',
    'Awiw',
    'Dwie Trzecie',
    'Mañana',
]

async function searchPlace(query) {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' Krakow')}&key=${GOOGLE_PLACES_API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.length) return null
    return data.results[0].place_id
}

async function getDetails(placeId) {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos,geometry,business_status&key=${GOOGLE_PLACES_API_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    return data.status === 'OK' ? data.result : null
}

async function downloadPhoto(ref) {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${ref}&key=${GOOGLE_PLACES_API_KEY}`
    try {
        const res = await fetch(url, { redirect: 'follow' })
        if (!res.ok) return null
        const buf = Buffer.from(await res.arrayBuffer())
        return buf.length > 1000 ? buf : null
    } catch { return null }
}

async function uploadToR2(buffer, key) {
    const webp = await sharp(buffer).resize(1200, null, { withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
    await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: webp, ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable' }))
    return `${R2_PUBLIC_URL}/${key}`
}

async function main() {
    console.log('═══ STEP 1: Fix 5 locations ═══\n')

    for (const name of TO_FIX) {
        console.log(`🔍 ${name}`)

        // Find in DB
        const { data: [loc] } = await supabase.from('locations').select('id, title, lat, lng').ilike('title', `%${name.replace('é', '%').replace('&', '%')}%`).limit(1)
        if (!loc) { console.log('   ❌ Not found in DB'); continue }

        // Search Google for new place_id
        const placeId = await searchPlace(name)
        if (!placeId) { console.log('   ❌ Not found in Google'); continue }
        console.log(`   📍 New place_id: ${placeId}`)

        // Get details
        const details = await getDetails(placeId)
        if (!details) { console.log('   ❌ Details failed'); continue }

        const updates = { google_place_id: placeId }

        // Coords
        if (details.geometry?.location) {
            updates.lat = details.geometry.location.lat
            updates.lng = details.geometry.location.lng
            console.log(`   📍 Coords: ${updates.lat}, ${updates.lng}`)
        }

        // Photos
        const refs = (details.photos || []).slice(0, 10)
        if (refs.length > 0) {
            const urls = []
            for (let j = 0; j < refs.length; j++) {
                const buf = await downloadPhoto(refs[j].photo_reference)
                if (!buf) continue
                const url = await uploadToR2(buf, `locations/${loc.id}/${j === 0 ? 'main' : j - 1}.webp`)
                urls.push(url)
                await delay(100)
            }
            if (urls.length > 0) {
                updates.image_url = urls[0]
                if (urls.length > 1) updates.google_photos = urls.slice(1)
                console.log(`   📸 ${urls.length} photos → R2`)
            }
        }

        // Save
        const { error } = await supabase.from('locations').update(updates).eq('id', loc.id)
        if (error) console.error(`   ❌ DB error: ${error.message}`)
        else console.log(`   ✅ Updated`)

        await delay(500)
    }

    console.log('\n═══ STEP 2: Delete 19 locations ═══\n')

    for (const name of TO_DELETE) {
        const { data } = await supabase.from('locations').select('id, title').ilike('title', `%${name}%`).limit(1)
        if (!data?.length) { console.log(`   ⏭️  ${name} — not found`); continue }
        const { error } = await supabase.from('locations').delete().eq('id', data[0].id)
        if (error) console.log(`   ❌ ${name}: ${error.message}`)
        else console.log(`   🗑️  ${name} — deleted`)
    }

    console.log('\n✅ Done!')
}

main().catch(err => { console.error('💥', err); process.exit(1) })
