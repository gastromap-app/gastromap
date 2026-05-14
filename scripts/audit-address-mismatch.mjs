/**
 * audit-address-mismatch.mjs
 * 
 * Finds locations where the DB address and Google formatted_address don't match.
 * These are likely cases where Text Search found the WRONG place.
 * 
 * For mismatches: geocodes the DB address to get correct coordinates and fixes them.
 * 
 * Usage:
 *   node scripts/audit-address-mismatch.mjs              # report only
 *   node scripts/audit-address-mismatch.mjs --fix        # fix coordinates via geocoding
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY
const FIX_MODE = process.argv.includes('--fix')

const delay = ms => new Promise(r => setTimeout(r, ms))

async function geocodeAddress(address) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status === 'OK' && data.results[0]) {
        return data.results[0].geometry.location
    }
    return null
}

async function main() {
    console.log(`🔍 Audit: Address Mismatch Detection`)
    console.log(`   Mode: ${FIX_MODE ? '🔧 FIX' : '📋 REPORT ONLY'}`)
    console.log('')

    const { data, error } = await supabase
        .from('locations')
        .select('id, title, address, google_formatted_address, lat, lng, google_place_id, city')
        .not('google_formatted_address', 'is', null)
        .not('address', 'is', null)
        .in('status', ['active', 'approved', 'draft'])

    if (error) { console.error('DB error:', error.message); process.exit(1) }

    const mismatches = []

    for (const loc of data) {
        if (!loc.address || loc.address.length < 5 || !loc.google_formatted_address) continue

        // Extract street part (before first comma)
        const dbStreet = loc.address.split(',')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
        const googleStreet = loc.google_formatted_address.split(',')[0].toLowerCase().replace(/[^a-z0-9]/g, '')

        if (dbStreet.length < 4 || googleStreet.length < 4) continue

        // Check if streets share common substring
        const match = dbStreet.includes(googleStreet.slice(0, Math.min(6, googleStreet.length))) ||
                      googleStreet.includes(dbStreet.slice(0, Math.min(6, dbStreet.length)))

        if (!match) {
            mismatches.push(loc)
        }
    }

    console.log(`📦 Total locations with google_formatted_address: ${data.length}`)
    console.log(`⚠️  Address mismatches found: ${mismatches.length}`)
    console.log('')

    if (mismatches.length === 0) {
        console.log('✅ No mismatches found!')
        return
    }

    let fixed = 0

    for (const loc of mismatches) {
        console.log(`${loc.title} (${loc.city})`)
        console.log(`  DB addr:     ${loc.address}`)
        console.log(`  Google addr: ${loc.google_formatted_address}`)
        console.log(`  Current:     ${loc.lat}, ${loc.lng}`)

        if (FIX_MODE) {
            // Geocode the DB address to get correct coordinates
            const coords = await geocodeAddress(loc.address)
            if (coords) {
                console.log(`  Fixed to:    ${coords.lat}, ${coords.lng}`)
                const { error: upErr } = await supabase.from('locations').update({
                    lat: coords.lat,
                    lng: coords.lng,
                    google_place_id: null,  // Remove wrong place_id
                    google_formatted_address: null,
                }).eq('id', loc.id)
                if (upErr) console.log(`  ❌ DB error: ${upErr.message}`)
                else { console.log(`  ✅ Fixed`); fixed++ }
                await delay(200)
            } else {
                console.log(`  ❌ Geocoding failed`)
            }
        }
        console.log('')
    }

    if (FIX_MODE) {
        console.log(`\n✅ Fixed ${fixed} / ${mismatches.length} locations`)
    } else {
        console.log(`\nRun with --fix to correct coordinates via geocoding`)
    }
}

main().catch(err => { console.error(err); process.exit(1) })
