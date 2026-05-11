import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')
const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const FOOD_TYPES = new Set([
  'restaurant', 'cafe', 'bar', 'food', 'bakery', 'night_club',
  'meal_takeaway', 'meal_delivery', 'coffee_shop', 'fine_dining_restaurant',
])

const CATEGORY_MAP: Record<string, string> = {
  restaurant: 'restaurant', cafe: 'cafe', bar: 'bar',
  bakery: 'bakery', night_club: 'bar', food: 'restaurant',
  meal_takeaway: 'restaurant', meal_delivery: 'restaurant',
  fine_dining_restaurant: 'restaurant', coffee_shop: 'cafe',
}

const PRICE_MAP: Record<number, string> = { 0: '$', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }

function normalizePlace(p: any) {
  if (!p) return null

  const googleTypes: string[] = p.types || []
  const category = googleTypes.reduce((found: string | null, t: string) =>
    found || CATEGORY_MAP[t] || null, null) || 'restaurant'

  const openingHours = p.opening_hours?.weekday_text?.join(' | ') || ''

  let city = '', country = '', country_code = ''
  for (const comp of (p.address_components || [])) {
    if (comp.types.includes('locality'))  city = comp.long_name
    if (comp.types.includes('country')) {
      country = comp.long_name
      country_code = comp.short_name
    }
    if (!city && comp.types.includes('postal_town')) city = comp.long_name
  }

  const amenities: string[] = []
  if (p.wheelchair_accessible_entrance) amenities.push('wheelchair accessible')
  if (p.delivery)   amenities.push('delivery')
  if (p.takeout)    amenities.push('takeout')
  if (p.dine_in)    amenities.push('dine-in')
  if (p.serves_beer || p.serves_wine) amenities.push('alcohol')
  if (p.serves_breakfast) amenities.push('breakfast')
  if (p.serves_lunch)     amenities.push('lunch')
  if (p.serves_dinner)    amenities.push('dinner')

  return {
    title:           p.name             || '',
    category,
    address:         p.formatted_address || p.vicinity || '',
    city,
    country,
    country_code,
    lat:             p.geometry?.location?.lat ?? null,
    lng:             p.geometry?.location?.lng ?? null,
    phone:           p.formatted_phone_number   || '',
    website:         p.website                  || '',
    rating:          p.rating                   ?? null,
    price_level:     PRICE_MAP[p.price_level]   || '$$',
    opening_hours:   openingHours,
    description:     p.editorial_summary?.overview || '',
    amenities,
    photo_reference: p.photos?.[0]?.photo_reference || null,
    google_place_id: p.place_id || null,
    google_maps_url: p.url      || null,
    _source:         'google_places',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (!GOOGLE_API_KEY) {
    console.error('[places-autocomplete] ❌ Missing GOOGLE_PLACES_API_KEY')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const url = new URL(req.url)
    const q          = url.searchParams.get('q')
    const place_id   = url.searchParams.get('place_id')
    const sessiontoken = url.searchParams.get('sessiontoken') || undefined

    // ── Mode 1: Place Details ──────────────────────────────────────────────
    if (place_id) {
      const fields = [
        'place_id', 'name', 'formatted_address', 'vicinity',
        'geometry', 'types', 'rating', 'user_ratings_total',
        'price_level', 'opening_hours', 'website', 'formatted_phone_number',
        'photos', 'url', 'editorial_summary',
        'serves_beer', 'serves_breakfast', 'serves_dinner',
        'serves_lunch', 'serves_wine', 'takeout', 'delivery',
        'dine_in', 'wheelchair_accessible_entrance',
        'address_components',
      ].join(',')

      const detailUrl = new URL(`${PLACES_BASE}/details/json`)
      detailUrl.searchParams.set('place_id', place_id)
      detailUrl.searchParams.set('fields', fields)
      detailUrl.searchParams.set('language', 'en')
      if (sessiontoken) detailUrl.searchParams.set('sessiontoken', sessiontoken)
      detailUrl.searchParams.set('key', GOOGLE_API_KEY)

      const r = await fetch(detailUrl.toString())
      const d = await r.json()

      if (d.status !== 'OK') {
        console.warn(`[places-autocomplete] Details status: ${d.status}`)
        return new Response(
          JSON.stringify({ error: `Places API: ${d.status}` }),
          { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ result: normalizePlace(d.result) }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // ── Mode 2: Autocomplete ───────────────────────────────────────────────
    if (!q || q.length < 2) {
      return new Response(
        JSON.stringify({ predictions: [] }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const autoUrl = new URL(`${PLACES_BASE}/autocomplete/json`)
    autoUrl.searchParams.set('input', q)
    autoUrl.searchParams.set('types', 'establishment')
    autoUrl.searchParams.set('language', 'en')
    if (sessiontoken) autoUrl.searchParams.set('sessiontoken', sessiontoken)
    autoUrl.searchParams.set('key', GOOGLE_API_KEY)

    const r = await fetch(autoUrl.toString())
    const d = await r.json()

    if (d.status === 'REQUEST_DENIED') {
      console.error('[places-autocomplete] REQUEST_DENIED:', d.error_message)
      return new Response(
        JSON.stringify({ error: 'Invalid API key', details: d.error_message }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const predictions = (d.predictions || [])
      .filter((p: any) => {
        const types: string[] = p.types || []
        return types.some(t => FOOD_TYPES.has(t)) || types.includes('establishment')
      })
      .slice(0, 6)
      .map((p: any) => ({
        place_id:       p.place_id,
        description:    p.description,
        main_text:      p.structured_formatting?.main_text || p.description,
        secondary_text: p.structured_formatting?.secondary_text || '',
        types:          p.types || [],
      }))

    return new Response(
      JSON.stringify({ predictions, status: d.status }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
        },
      }
    )

  } catch (err: any) {
    console.error('[places-autocomplete] ❌ Error:', err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
