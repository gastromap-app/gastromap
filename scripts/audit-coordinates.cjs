#!/usr/bin/env node
/**
 * Coordinate Audit Script
 *
 * Compares stored location coordinates against Google Places data.
 * Reports discrepancies and optionally updates the database.
 *
 * Usage:
 *   node scripts/audit-coordinates.cjs           # Audit only, generate report
 *   node scripts/audit-coordinates.cjs --fix     # Audit + update database
 *   node scripts/audit-coordinates.cjs --limit 50 # Process first 50 locations
 *   node scripts/audit-coordinates.cjs --threshold 200 # Flag if >200m apart
 */
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// ─── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EDGE_BASE = `${SUPABASE_URL}/functions/v1`

const THRESHOLD_METERS = parseInt(process.argv.find(a => a.startsWith('--threshold='))?.split('=')[1] || '100', 10)
const SHOULD_FIX = process.argv.includes('--fix')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10)
const DELAY_MS = 200 // Rate limit between Google API calls

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Sign in as admin to get an authenticated session for bypassing RLS.
 * Credentials can be set via env vars or will be prompted.
 */
async function adminSignIn() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.argv.find(a => a.startsWith('--email='))?.split('=')[1] || 'alik2191@gmail.com'
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.argv.find(a => a.startsWith('--password='))?.split('=')[1]

  if (!ADMIN_PASSWORD) {
    console.log('⚠️  No admin password provided. Set ADMIN_PASSWORD env var or use --password=')
    console.log('   Will attempt service role key instead...')
    return null
  }

  console.log('🔐 Signing in as admin...')
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })

  if (error || !data.session) {
    console.error('❌ Admin sign-in failed:', error?.message || 'No session')
    console.log('   Will use anon key (read-only, active/approved locations only)')
    return null
  }

  console.log('   ✅ Signed in as', data.user.email)
  return data.session.access_token
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function toRad(deg) {
  return deg * (Math.PI / 180)
}

/**
 * Haversine distance in meters
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000 // Earth radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Fetch place details from Google Places via Supabase Edge Function
 */
async function fetchPlaceFromGoogle(placeId) {
  try {
    const url = new URL(`${EDGE_BASE}/places-autocomplete`)
    url.searchParams.set('place_id', placeId)

    const res = await fetch(url.toString(), {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text}`)
    }

    const data = await res.json()
    const result = data.result

    if (!result?.geometry?.location) {
      return null
    }

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      name: result.name,
      address: result.formatted_address,
      place_id: result.place_id,
    }
  } catch (err) {
    console.warn(`  ⚠️ Google Places error for ${placeId}: ${err.message}`)
    return null
  }
}

/**
 * Search Google Places by name + address
 */
async function searchPlaceByName(name, address, city) {
  try {
    const query = address ? `${name}, ${address}` : name
    const url = new URL(`${EDGE_BASE}/places-autocomplete`)
    url.searchParams.set('q', query)
    if (city) {
      url.searchParams.set('lat', '50.0619')  // Krakow default bias
      url.searchParams.set('lng', '19.9368')
    }

    const res = await fetch(url.toString(), {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    })

    if (!res.ok) return null

    const data = await res.json()
    const prediction = data.predictions?.[0]
    if (!prediction?.place_id) return null

    // Fetch full details for the first match
    return fetchPlaceFromGoogle(prediction.place_id)
  } catch (err) {
    console.warn(`  ⚠️ Search error for "${name}": ${err.message}`)
    return null
  }
}

/**
 * Update location coordinates in Supabase
 */
async function fixCoordinates(locationId, lat, lng, client) {
  const { error } = await client
    .from('locations')
    .update({ lat, lng, updated_at: new Date().toISOString() })
    .eq('id', locationId)

  if (error) {
    console.error(`  ❌ Failed to update ${locationId}: ${error.message}`)
    return false
  }
  return true
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Coordinate Audit Started')
  console.log(`   Threshold: ${THRESHOLD_METERS}m`)
  console.log(`   Fix mode:  ${SHOULD_FIX ? 'YES ⚠️' : 'NO (report only)'}`)
  if (LIMIT) console.log(`   Limit:     ${LIMIT} locations`)
  console.log('')

  // 1. Determine client: service_role > admin auth > anon
  let client = supabase
  let adminToken = null

  if (SUPABASE_SERVICE_KEY) {
    console.log('🔐 Using SUPABASE_SERVICE_ROLE_KEY')
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  } else {
    adminToken = await adminSignIn()
    if (adminToken) {
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${adminToken}` } },
      })
    }
  }

  // 2. Fetch locations
  console.log('📥 Fetching locations from database...')
  let query = client
    .from('locations')
    .select('id, title, address, city, country, lat, lng, google_place_id, status')
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (LIMIT) query = query.limit(LIMIT)

  const { data: locations, error } = await query

  if (error) {
    console.error('❌ Failed to fetch locations:', error.message)
    process.exit(1)
  }

  console.log(`   Found ${locations.length} locations with coordinates\n`)

  const results = []
  let fixed = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i]
    const progress = `[${i + 1}/${locations.length}]`

    process.stdout.write(`${progress} "${loc.title}" `)

    let googleData = null

    // Strategy 1: Use stored google_place_id
    if (loc.google_place_id) {
      googleData = await fetchPlaceFromGoogle(loc.google_place_id)
      if (googleData) {
        process.stdout.write(`→ matched by Place ID `)
      }
    }

    // Strategy 2: Search by name + address
    if (!googleData) {
      await sleep(DELAY_MS)
      googleData = await searchPlaceByName(loc.title, loc.address, loc.city)
      if (googleData) {
        process.stdout.write(`→ matched by search `)
      }
    }

    if (!googleData) {
      skipped++
      console.log(`⚠️ not found on Google`)
      results.push({
        id: loc.id,
        title: loc.title,
        status: 'NOT_FOUND',
        storedLat: loc.lat,
        storedLng: loc.lng,
        googleLat: null,
        googleLng: null,
        distanceMeters: null,
      })
      continue
    }

    // Compare coordinates
    const distance = haversine(loc.lat, loc.lng, googleData.lat, googleData.lng)
    const isOff = distance > THRESHOLD_METERS

    if (isOff) {
      process.stdout.write(`⚠️ OFF by ${Math.round(distance)}m`)
      if (SHOULD_FIX) {
        if (!adminToken) {
          process.stdout.write(` ❌ SKIP (no admin token)`)
        } else {
          const ok = await fixCoordinates(loc.id, googleData.lat, googleData.lng, client)
          if (ok) {
            fixed++
            process.stdout.write(` ✅ FIXED`)
          } else {
            failed++
            process.stdout.write(` ❌ FAILED`)
          }
        }
      }
      console.log('')
    } else {
      console.log(`✅ OK (${Math.round(distance)}m)`)
    }

    results.push({
      id: loc.id,
      title: loc.title,
      status: isOff ? 'MISMATCH' : 'OK',
      storedLat: loc.lat,
      storedLng: loc.lng,
      googleLat: googleData.lat,
      googleLng: googleData.lng,
      distanceMeters: Math.round(distance),
      googleName: googleData.name,
      googleAddress: googleData.address,
    })

    // Rate limiting
    await sleep(DELAY_MS)
  }

  // ─── Report ────────────────────────────────────────────────────────────

  const mismatches = results.filter(r => r.status === 'MISMATCH')
  const notFound = results.filter(r => r.status === 'NOT_FOUND')
  const ok = results.filter(r => r.status === 'OK')

  console.log('\n📊 Results:')
  console.log(`   ✅ Correct:      ${ok.length}`)
  console.log(`   ⚠️  Mismatched:   ${mismatches.length}`)
  console.log(`   ❓ Not found:     ${notFound.length}`)
  if (SHOULD_FIX) {
    console.log(`   🔧 Fixed:        ${fixed}`)
    console.log(`   💥 Fix failed:   ${failed}`)
  }

  // Write JSON report
  const reportPath = path.join(__dirname, `coordinate-audit-${Date.now()}.json`)
  fs.writeFileSync(reportPath, JSON.stringify({
    meta: {
      timestamp: new Date().toISOString(),
      thresholdMeters: THRESHOLD_METERS,
      totalProcessed: locations.length,
      fixed,
      failed,
    },
    summary: {
      correct: ok.length,
      mismatched: mismatches.length,
      notFound: notFound.length,
    },
    mismatches,
    notFound: notFound.map(r => ({ id: r.id, title: r.title, storedLat: r.storedLat, storedLng: r.storedLng })),
  }, null, 2))

  console.log(`\n📝 Report saved: ${reportPath}`)

  // Write CSV report for easy import
  const csvPath = path.join(__dirname, `coordinate-audit-${Date.now()}.csv`)
  const csvLines = [
    'ID,Title,Status,StoredLat,StoredLng,GoogleLat,GoogleLng,DistanceMeters',
    ...results.map(r =>
      `"${r.id}","${(r.title || '').replace(/"/g, '""')}",${r.status},${r.storedLat},${r.storedLng},${r.googleLat ?? ''},${r.googleLng ?? ''},${r.distanceMeters ?? ''}`
    ),
  ]
  fs.writeFileSync(csvPath, csvLines.join('\n'))
  console.log(`📝 CSV saved:    ${csvPath}`)

  if (mismatches.length > 0 && !SHOULD_FIX) {
    console.log(`\n💡 Run with --fix to update ${mismatches.length} locations with corrected coordinates`)
  }

  // Sign out
  if (adminToken) {
    await supabase.auth.signOut()
    console.log('\n🔒 Signed out')
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
