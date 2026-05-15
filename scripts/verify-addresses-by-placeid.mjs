/**
 * Verify & fix addresses/coordinates for locations that have google_place_id.
 * 
 * Uses Google Place Details API to get the authoritative address and coordinates,
 * then updates the DB if they differ.
 * 
 * - Always trusts Google as source of truth
 * - Normalizes city names to English (Kraków → Krakow)
 * - Skips locations without google_place_id
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY

if (!GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY not found in .env')
    process.exit(1)
}

// City normalization map
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

function extractCity(formattedAddress) {
    if (!formattedAddress) return null
    const parts = formattedAddress.split(',').map(p => p.trim())
    if (parts.length >= 3) {
        const cityPart = parts[parts.length - 2]
        const cleaned = cityPart.replace(/^\d{2}-\d{3}\s*/, '').trim()
        return normalizeCity(cleaned)
    }
    return null
}

const delay = ms => new Promise(r => setTimeout(r, ms))

async function getPlaceDetails(placeId) {
    const fields = 'formatted_address,geometry,business_status'
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`
    
    const resp = await fetch(url)
    const json = await resp.json()
    
    if (json.status === 'OK' && json.result) {
        return json.result
    }
    if (json.status === 'REQUEST_DENIED') {
        console.error('❌ Google API denied:', json.error_message)
        process.exit(1)
    }
    return null
}

async function run() {
    console.log('🔍 Verify Addresses by Place ID')
    console.log('================================\n')

    // Get all locations with place_id
    const { data: locations, error } = await supabase.from('locations')
        .select('id, title, address, city, country, lat, lng, google_place_id, google_formatted_address')
        .not('google_place_id', 'is', null)
        .in('status', ['approved', 'active'])
        .order('created_at', { ascending: true })

    if (error) {
        console.error('DB error:', error.message)
        process.exit(1)
    }

    console.log(`📦 Total locations with place_id: ${locations.length}\n`)

    const stats = { checked: 0, addressFixed: 0, coordsFixed: 0, cityFixed: 0, closed: 0, failed: 0 }

    for (let i = 0; i < locations.length; i++) {
        const loc = locations[i]
        stats.checked++

        // Rate limit: 10 requests per second max
        if (i > 0 && i % 10 === 0) await delay(1100)

        const details = await getPlaceDetails(loc.google_place_id)
        
        if (!details) {
            console.log(`[${i + 1}/${locations.length}] ${loc.title} — ❌ No details`)
            stats.failed++
            continue
        }

        // Check if permanently closed
        if (details.business_status === 'CLOSED_PERMANENTLY') {
            console.log(`[${i + 1}/${locations.length}] ${loc.title} — 🚫 PERMANENTLY CLOSED`)
            await supabase.from('locations').update({ status: 'hidden' }).eq('id', loc.id)
            stats.closed++
            continue
        }

        const updates = {}
        let changed = false

        // ── Check address ──
        if (details.formatted_address) {
            updates.google_formatted_address = details.formatted_address

            const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
            const dbNorm = norm(loc.address || '')
            const googleNorm = norm(details.formatted_address)

            if (dbNorm !== googleNorm) {
                updates.address = details.formatted_address
                changed = true
                stats.addressFixed++
            }
        }

        // ── Check coordinates ──
        if (details.geometry?.location) {
            const gLat = details.geometry.location.lat
            const gLng = details.geometry.location.lng
            const latDiff = Math.abs((loc.lat || 0) - gLat)
            const lngDiff = Math.abs((loc.lng || 0) - gLng)

            if (latDiff > 0.0005 || lngDiff > 0.0005) {
                updates.lat = gLat
                updates.lng = gLng
                changed = true
                stats.coordsFixed++
            }
        }

        // ── Check city normalization ──
        const googleCity = extractCity(details.formatted_address)
        const currentCity = normalizeCity(loc.city)
        if (googleCity && googleCity !== loc.city) {
            updates.city = googleCity
            changed = true
            stats.cityFixed++
        } else if (currentCity !== loc.city) {
            updates.city = currentCity
            changed = true
            stats.cityFixed++
        }

        // ── Apply updates ──
        if (Object.keys(updates).length > 0) {
            const { error: updateErr } = await supabase.from('locations')
                .update(updates)
                .eq('id', loc.id)

            if (updateErr) {
                console.log(`[${i + 1}/${locations.length}] ${loc.title} — ❌ Update failed: ${updateErr.message}`)
                stats.failed++
            } else if (changed) {
                console.log(`[${i + 1}/${locations.length}] ${loc.title}`)
                if (updates.address) console.log(`    🏠 ${loc.address} → ${updates.address}`)
                if (updates.lat) console.log(`    📍 ${loc.lat?.toFixed(5)},${loc.lng?.toFixed(5)} → ${updates.lat.toFixed(5)},${updates.lng.toFixed(5)}`)
                if (updates.city) console.log(`    🌍 ${loc.city} → ${updates.city}`)
            }
        }
    }

    console.log('\n═══════════════════════════════════════════')
    console.log('📊 Summary')
    console.log(`   Checked:          ${stats.checked}`)
    console.log(`   🏠 Addresses fixed: ${stats.addressFixed}`)
    console.log(`   📍 Coords fixed:    ${stats.coordsFixed}`)
    console.log(`   🌍 Cities fixed:    ${stats.cityFixed}`)
    console.log(`   🚫 Closed:          ${stats.closed}`)
    console.log(`   ❌ Failed:          ${stats.failed}`)
    console.log('═══════════════════════════════════════════')
}

run()
