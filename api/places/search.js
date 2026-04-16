/**
 * Vercel Serverless — Google Places API Proxy
 * 
 * Keeps API key server-side (never exposed to browser).
 * 
 * POST /api/places/search
 *   { query: "Hamsa Krakow" }
 *   → Google Places Text Search → найти place_id
 *   → Google Places Details → полные данные
 *   → нормализованный объект для формы локации
 */

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place'

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY not configured' })

    const { query, place_id } = req.body || {}

    try {
        // ── Mode 1: fetch by place_id directly ──────────────────────────────
        if (place_id) {
            const details = await fetchDetails(place_id, apiKey)
            return res.status(200).json({ result: normalizePlace(details), source: 'google_places' })
        }

        // ── Mode 2: text search → top result → details ──────────────────────
        if (!query?.trim()) {
            return res.status(400).json({ error: 'query or place_id is required' })
        }

        // Step 1: Text Search
        const searchUrl = new URL(`${PLACES_BASE}/textsearch/json`)
        searchUrl.searchParams.set('query', query.trim())
        searchUrl.searchParams.set('type', 'restaurant|cafe|bar|food')
        searchUrl.searchParams.set('language', 'en')
        searchUrl.searchParams.set('key', apiKey)

        const searchRes = await fetch(searchUrl.toString())
        const searchData = await searchRes.json()

        if (searchData.status === 'REQUEST_DENIED') {
            return res.status(403).json({ error: 'Google API key invalid or missing Places API permission', details: searchData.error_message })
        }
        if (!searchData.results?.length) {
            return res.status(404).json({ error: 'No places found', query })
        }

        // Step 2: Get full details for top result
        const topResult = searchData.results[0]
        const details = await fetchDetails(topResult.place_id, apiKey)

        return res.status(200).json({
            result: normalizePlace(details),
            candidates: searchData.results.slice(0, 3).map(r => ({
                place_id: r.place_id,
                name: r.name,
                address: r.formatted_address,
                rating: r.rating,
            })),
            source: 'google_places'
        })

    } catch (err) {
        console.error('[places/search] Error:', err.message)
        return res.status(500).json({ error: 'Places API error', message: err.message })
    }
}

async function fetchDetails(placeId, apiKey) {
    const fields = [
        'place_id', 'name', 'formatted_address', 'vicinity',
        'geometry', 'types', 'rating', 'user_ratings_total',
        'price_level', 'opening_hours', 'website', 'formatted_phone_number',
        'photos', 'url', 'editorial_summary', 'serves_beer',
        'serves_breakfast', 'serves_dinner', 'serves_lunch', 'serves_wine',
        'takeout', 'delivery', 'dine_in', 'wheelchair_accessible_entrance',
    ].join(',')

    const detailUrl = new URL(`${PLACES_BASE}/details/json`)
    detailUrl.searchParams.set('place_id', placeId)
    detailUrl.searchParams.set('fields', fields)
    detailUrl.searchParams.set('language', 'en')
    detailUrl.searchParams.set('key', apiKey)

    const r = await fetch(detailUrl.toString())
    const d = await r.json()
    return d.result || {}
}

function normalizePlace(p) {
    // Map Google types → GastroMap category
    const CATEGORY_MAP = {
        restaurant: 'Restaurant', cafe: 'Cafe', bar: 'Bar',
        bakery: 'Bakery', night_club: 'Bar', food: 'Restaurant',
        meal_takeaway: 'Fast Food', meal_delivery: 'Fast Food',
        fine_dining_restaurant: 'Fine Dining',
    }
    const googleTypes = p.types || []
    const category = googleTypes.reduce((found, t) => found || CATEGORY_MAP[t], null) || 'Restaurant'

    // Map Google price_level (0-4) → GastroMap ($-$$$$)
    const PRICE_MAP = { 0: '$', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }
    const priceLevel = PRICE_MAP[p.price_level] || '$$'

    // Opening hours as a string
    const openingHours = p.opening_hours?.weekday_text?.join(' | ') || null

    // Photos — Google Photos references (used to fetch actual URLs client-side)
    const photoRef = p.photos?.[0]?.photo_reference || null
    const photoUrl = photoRef
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=PLACEHOLDER`
        : null

    // Amenities from boolean fields
    const amenities = []
    if (p.wheelchair_accessible_entrance) amenities.push('wheelchair accessible')
    if (p.delivery) amenities.push('delivery')
    if (p.takeout) amenities.push('takeout')
    if (p.dine_in) amenities.push('dine-in')
    if (p.serves_beer || p.serves_wine) amenities.push('alcohol')

    // Tags from Google types
    const typeTagMap = {
        cafe: 'Coffee', bar: 'Bar', bakery: 'Bakery',
        night_club: 'Nightlife', vegetarian_restaurant: 'Vegetarian',
        pizza_restaurant: 'Pizza', sushi_restaurant: 'Sushi',
    }
    const tags = googleTypes.reduce((acc, t) => {
        if (typeTagMap[t]) acc.push(typeTagMap[t])
        return acc
    }, [])

    return {
        // Core identity
        title:         p.name || null,
        category,
        // Address & geo
        address:       p.formatted_address || p.vicinity || null,
        lat:           p.geometry?.location?.lat || null,
        lng:           p.geometry?.location?.lng || null,
        // Contact
        phone:         p.formatted_phone_number || null,
        website:       p.website || null,
        // Data
        rating:        p.rating || null,
        price_level:   priceLevel,
        opening_hours: openingHours,
        // Content
        description:   p.editorial_summary?.overview || null,  // LLM will translate/expand
        tags,
        amenities,
        // Photo
        photo_reference: photoRef,
        photo_url_hint:  photoUrl,
        // Google IDs for re-fetch
        google_place_id: p.place_id || null,
        google_maps_url: p.url || null,
        // Metadata
        _source: 'google_places',
        _raw_types: googleTypes,
    }
}
