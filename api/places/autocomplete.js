/**
 * Vercel Serverless — Google Places Autocomplete Proxy
 *
 * GET /api/places/autocomplete?q=Ham&sessiontoken=xxx
 *   → Google Places Autocomplete API
 *   → [{ place_id, description, structured_formatting }]
 *
 * GET /api/places/autocomplete?place_id=ChIJ...&sessiontoken=xxx
 *   → Google Places Details (full data for selected suggestion)
 */

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place'

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY not configured' })

    const { q, place_id, sessiontoken } = req.query

    try {
        // ── Mode 1: Fetch full details for selected place ────────────────────
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
            detailUrl.searchParams.set('key', apiKey)

            const r = await fetch(detailUrl.toString())
            const d = await r.json()

            if (d.status !== 'OK') {
                return res.status(404).json({ error: `Places API: ${d.status}`, details: d.error_message })
            }

            return res.status(200).json({ result: normalizePlace(d.result) })
        }

        // ── Mode 2: Autocomplete suggestions ────────────────────────────────
        if (!q || q.length < 2) {
            return res.status(200).json({ predictions: [] })
        }

        const autoUrl = new URL(`${PLACES_BASE}/autocomplete/json`)
        autoUrl.searchParams.set('input', q)
        autoUrl.searchParams.set('types', 'establishment')
        // Bias towards food/restaurant places
        autoUrl.searchParams.set('keyword', 'restaurant cafe bar food')
        autoUrl.searchParams.set('language', 'en')
        if (sessiontoken) autoUrl.searchParams.set('sessiontoken', sessiontoken)
        autoUrl.searchParams.set('key', apiKey)

        const r = await fetch(autoUrl.toString())
        const d = await r.json()

        if (d.status === 'REQUEST_DENIED') {
            return res.status(403).json({ error: 'Invalid API key or Places API not enabled', details: d.error_message })
        }

        // Filter to food-related places only
        const foodTypes = new Set([
            'restaurant', 'cafe', 'bar', 'food', 'bakery', 'night_club',
            'meal_takeaway', 'meal_delivery', 'supermarket', 'grocery_or_supermarket'
        ])

        const predictions = (d.predictions || [])
            .filter(p => {
                const types = p.types || []
                return types.some(t => foodTypes.has(t)) || types.includes('establishment')
            })
            .slice(0, 6)
            .map(p => ({
                place_id:    p.place_id,
                description: p.description,
                main_text:   p.structured_formatting?.main_text || p.description,
                secondary_text: p.structured_formatting?.secondary_text || '',
                types:       p.types || [],
            }))

        // Cache for 5 minutes
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
        return res.status(200).json({ predictions, status: d.status })

    } catch (err) {
        console.error('[places/autocomplete] Error:', err.message)
        return res.status(500).json({ error: 'Autocomplete error', message: err.message })
    }
}

// ─── Normalise Google Place → GastroMap schema ─────────────────────────────

function normalizePlace(p) {
    if (!p) return null

    const CATEGORY_MAP = {
        restaurant: 'Restaurant', cafe: 'Cafe', bar: 'Bar',
        bakery: 'Bakery', night_club: 'Bar', food: 'Restaurant',
        meal_takeaway: 'Street Food', meal_delivery: 'Street Food',
        fine_dining_restaurant: 'Fine Dining', coffee_shop: 'Coffee Shop',
        supermarket: 'Market', grocery_or_supermarket: 'Market',
    }
    const googleTypes = p.types || []
    const category = googleTypes.reduce((found, t) => found || CATEGORY_MAP[t], null) || 'Restaurant'

    const PRICE_MAP = { 0: '$', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }

    const openingHours = p.opening_hours?.weekday_text?.join(' | ') || ''

    // Extract city & country from address_components
    let city = '', country = ''
    for (const comp of (p.address_components || [])) {
        if (comp.types.includes('locality'))             city    = comp.long_name
        if (comp.types.includes('country'))              country = comp.long_name
        if (!city && comp.types.includes('postal_town')) city    = comp.long_name
    }

    // Photo reference → URL hint
    const photoRef = p.photos?.[0]?.photo_reference || null

    const amenities = []
    if (p.wheelchair_accessible_entrance) amenities.push('wheelchair accessible')
    if (p.delivery)   amenities.push('delivery')
    if (p.takeout)    amenities.push('takeout')
    if (p.dine_in)    amenities.push('dine-in')
    if (p.serves_beer || p.serves_wine) amenities.push('alcohol')
    if (p.serves_breakfast) amenities.push('breakfast')
    if (p.serves_lunch)     amenities.push('lunch')
    if (p.serves_dinner)    amenities.push('dinner')

    const typeTagMap = {
        cafe: 'Coffee', bar: 'Bar', bakery: 'Bakery',
        night_club: 'Nightlife', vegetarian_restaurant: 'Vegetarian',
    }
    const tags = googleTypes.reduce((acc, t) => {
        if (typeTagMap[t]) acc.push(typeTagMap[t])
        return acc
    }, [])

    return {
        title:          p.name             || '',
        category,
        address:        p.formatted_address || p.vicinity || '',
        city,
        country,
        lat:            p.geometry?.location?.lat ?? null,
        lng:            p.geometry?.location?.lng ?? null,
        phone:          p.formatted_phone_number   || '',
        website:        p.website                  || '',
        rating:         p.rating                   ?? null,
        price_level:    PRICE_MAP[p.price_level]   || '$$',
        opening_hours:  openingHours,
        description:    p.editorial_summary?.overview || '',
        tags,
        amenities,
        photo_reference:  photoRef,
        google_place_id:  p.place_id || null,
        google_maps_url:  p.url      || null,
        _source:          'google_places',
        _raw_types:       googleTypes,
    }
}
