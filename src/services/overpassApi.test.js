import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchPlacesByBoundingBox } from './overpassApi'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeResponse(body, ok = true, status = 200) {
    return {
        ok,
        status,
        json: vi.fn().mockResolvedValue(body),
    }
}

/** Minimal valid OSM element for a node */
function makeNode(overrides = {}) {
    return {
        type: 'node',
        id: 12345,
        lat: 50.06,
        lon: 19.94,
        tags: {
            name: 'Test Restaurant',
            amenity: 'restaurant',
            ...overrides.tags,
        },
        ...overrides,
    }
}

const BBOX = [49.9, 50.2, 19.7, 20.2] // [south, north, west, east]

describe('overpassApi', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('fetchPlacesByBoundingBox – happy path', () => {
        it('returns an array of transformed locations', async () => {
            const elements = [makeNode(), makeNode({ id: 99999, tags: { name: 'Cool Cafe', amenity: 'cafe' } })]
            mockFetch.mockResolvedValue(makeResponse({ elements }))

            const result = await fetchPlacesByBoundingBox(BBOX)

            expect(Array.isArray(result)).toBe(true)
            expect(result).toHaveLength(2)
        })

        it('each location has required fields', async () => {
            mockFetch.mockResolvedValue(makeResponse({ elements: [makeNode()] }))
            const result = await fetchPlacesByBoundingBox(BBOX)
            const loc = result[0]

            expect(loc).toHaveProperty('id', 'osm_12345')
            expect(loc).toHaveProperty('title', 'Test Restaurant')
            expect(loc).toHaveProperty('category', 'Restaurant')
            expect(loc).toHaveProperty('coordinates')
            expect(loc.coordinates).toHaveProperty('lat', 50.06)
            expect(loc.coordinates).toHaveProperty('lng', 19.94)
            expect(loc).toHaveProperty('rating')
            expect(loc).toHaveProperty('image')
            expect(loc).toHaveProperty('priceLevel')
            expect(loc).toHaveProperty('vibe')
        })

        it('maps amenity types to correct categories', async () => {
            const nodes = [
                makeNode({ id: 1, lat: 1, lon: 1, tags: { name: 'R', amenity: 'restaurant' } }),
                makeNode({ id: 2, lat: 1, lon: 1, tags: { name: 'C', amenity: 'cafe' } }),
                makeNode({ id: 3, lat: 1, lon: 1, tags: { name: 'B', amenity: 'bar' } }),
                makeNode({ id: 4, lat: 1, lon: 1, tags: { name: 'P', amenity: 'pub' } }),
                makeNode({ id: 5, lat: 1, lon: 1, tags: { name: 'F', amenity: 'fast_food' } }),
            ]
            mockFetch.mockResolvedValue(makeResponse({ elements: nodes }))
            const result = await fetchPlacesByBoundingBox(BBOX, 10)

            expect(result.find(l => l.title === 'R').category).toBe('Restaurant')
            expect(result.find(l => l.title === 'C').category).toBe('Cafe')
            expect(result.find(l => l.title === 'B').category).toBe('Bar')
            expect(result.find(l => l.title === 'P').category).toBe('Bar')
            expect(result.find(l => l.title === 'F').category).toBe('Street Food')
        })

        it('uses center coords for way elements (no direct lat/lon)', async () => {
            const way = {
                type: 'way',
                id: 88888,
                center: { lat: 52.23, lon: 21.01 },
                tags: { name: 'Way Restaurant', amenity: 'restaurant' },
            }
            mockFetch.mockResolvedValue(makeResponse({ elements: [way] }))
            const result = await fetchPlacesByBoundingBox(BBOX)

            expect(result[0].coordinates).toEqual({ lat: 52.23, lng: 21.01 })
        })

        it('respects the limit parameter', async () => {
            const elements = Array.from({ length: 20 }, (_, i) =>
                makeNode({ id: i + 1, lat: 50 + i * 0.001, lon: 19 + i * 0.001 })
            )
            mockFetch.mockResolvedValue(makeResponse({ elements }))
            const result = await fetchPlacesByBoundingBox(BBOX, 5)

            expect(result.length).toBeLessThanOrEqual(5)
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('fetchPlacesByBoundingBox – query building', () => {
        it('sends POST to overpass-api.de/api/interpreter', async () => {
            mockFetch.mockResolvedValue(makeResponse({ elements: [] }))
            await fetchPlacesByBoundingBox(BBOX)

            const [url, options] = mockFetch.mock.calls[0]
            expect(url).toBe('https://overpass-api.de/api/interpreter')
            expect(options.method).toBe('POST')
        })

        it('includes correct Content-Type header', async () => {
            mockFetch.mockResolvedValue(makeResponse({ elements: [] }))
            await fetchPlacesByBoundingBox(BBOX)

            const [, options] = mockFetch.mock.calls[0]
            expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
        })

        it('includes bounding box coordinates in query body', async () => {
            mockFetch.mockResolvedValue(makeResponse({ elements: [] }))
            await fetchPlacesByBoundingBox([49.9, 50.2, 19.7, 20.2])

            const [, options] = mockFetch.mock.calls[0]
            const body = decodeURIComponent(options.body)
            expect(body).toContain('49.9')
            expect(body).toContain('50.2')
            expect(body).toContain('19.7')
            expect(body).toContain('20.2')
        })

        it('includes timeout directive in Overpass query', async () => {
            mockFetch.mockResolvedValue(makeResponse({ elements: [] }))
            await fetchPlacesByBoundingBox(BBOX)

            const [, options] = mockFetch.mock.calls[0]
            const body = decodeURIComponent(options.body)
            expect(body).toContain('timeout:25')
        })

        it('queries restaurant, cafe, bar, pub, fast_food amenity types', async () => {
            mockFetch.mockResolvedValue(makeResponse({ elements: [] }))
            await fetchPlacesByBoundingBox(BBOX)

            const [, options] = mockFetch.mock.calls[0]
            const body = decodeURIComponent(options.body)
            expect(body).toContain('restaurant')
            expect(body).toContain('cafe')
            expect(body).toContain('bar')
            expect(body).toContain('pub')
            expect(body).toContain('fast_food')
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('fetchPlacesByBoundingBox – filtering and transformation', () => {
        it('filters out elements with no name tag', async () => {
            const elements = [
                makeNode({ id: 1, tags: { amenity: 'restaurant' } }), // no name
                makeNode({ id: 2, tags: { name: 'Named Place', amenity: 'cafe' } }),
            ]
            mockFetch.mockResolvedValue(makeResponse({ elements }))
            const result = await fetchPlacesByBoundingBox(BBOX)

            expect(result).toHaveLength(1)
            expect(result[0].title).toBe('Named Place')
        })

        it('filters out elements with no coordinates', async () => {
            const noCoord = { type: 'node', id: 777, tags: { name: 'Ghost', amenity: 'restaurant' } }
            mockFetch.mockResolvedValue(makeResponse({ elements: [noCoord] }))
            const result = await fetchPlacesByBoundingBox(BBOX)

            expect(result).toHaveLength(0)
        })

        it('uses stars tag as rating when present', async () => {
            const node = makeNode({ tags: { name: 'Star Hotel', amenity: 'restaurant', stars: '4' } })
            mockFetch.mockResolvedValue(makeResponse({ elements: [node] }))
            const result = await fetchPlacesByBoundingBox(BBOX)

            expect(result[0].rating).toBe(4)
        })

        it('generates hash-based pseudo-rating (3.5–4.9) when no stars tag', async () => {
            mockFetch.mockResolvedValue(makeResponse({ elements: [makeNode()] }))
            const result = await fetchPlacesByBoundingBox(BBOX)

            expect(result[0].rating).toBeGreaterThanOrEqual(3.5)
            expect(result[0].rating).toBeLessThanOrEqual(4.9)
        })

        it('builds address from addr:street + addr:housenumber', async () => {
            const node = makeNode({ tags: {
                name: 'Addressed Place', amenity: 'restaurant',
                'addr:street': 'Main St', 'addr:housenumber': '42',
            }})
            mockFetch.mockResolvedValue(makeResponse({ elements: [node] }))
            const result = await fetchPlacesByBoundingBox(BBOX)

            expect(result[0].address).toContain('Main St')
            expect(result[0].address).toContain('42')
        })

        it('extracts features from OSM tags', async () => {
            const node = makeNode({ tags: {
                name: 'Accessible Place', amenity: 'restaurant',
                outdoor_seating: 'yes', wheelchair: 'yes',
                takeaway: 'yes', delivery: 'yes',
                internet_access: 'wlan',
                'diet:vegan': 'yes',
                'diet:vegetarian': 'yes',
            }})
            mockFetch.mockResolvedValue(makeResponse({ elements: [node] }))
            const result = await fetchPlacesByBoundingBox(BBOX)
            const features = result[0].features

            expect(features).toContain('Outdoor Seating')
            expect(features).toContain('Wheelchair Access')
            expect(features).toContain('Takeaway')
            expect(features).toContain('Delivery')
            expect(features).toContain('WiFi')
            expect(features).toContain('Vegan Menu')
            expect(features).toContain('Vegetarian Options')
        })

        it('capitalizes cuisine name', async () => {
            const node = makeNode({ tags: { name: 'Pasta Place', amenity: 'restaurant', cuisine: 'italian' } })
            mockFetch.mockResolvedValue(makeResponse({ elements: [node] }))
            const result = await fetchPlacesByBoundingBox(BBOX)

            expect(result[0].cuisine).toBe('Italian')
        })

        it('handles semicolon-separated cuisine — uses only first', async () => {
            const node = makeNode({ tags: { name: 'Multi', amenity: 'restaurant', cuisine: 'italian;french' } })
            mockFetch.mockResolvedValue(makeResponse({ elements: [node] }))
            const result = await fetchPlacesByBoundingBox(BBOX)

            expect(result[0].cuisine).toBe('Italian')
        })

        it('uses description tag when present', async () => {
            const node = makeNode({ tags: { name: 'Desc Place', amenity: 'restaurant', description: 'Custom description' } })
            mockFetch.mockResolvedValue(makeResponse({ elements: [node] }))
            const result = await fetchPlacesByBoundingBox(BBOX)

            expect(result[0].description).toBe('Custom description')
        })

        it('parses opening_hours: 24/7 as "24/7"', async () => {
            const node = makeNode({ tags: { name: 'Always Open', amenity: 'restaurant', opening_hours: 'Mo-Su 00:00-24:00 "24/7"' } })
            mockFetch.mockResolvedValue(makeResponse({ elements: [node] }))
            const result = await fetchPlacesByBoundingBox(BBOX)

            // The raw oh string contains '24/7' so parseOpeningHours returns '24/7'
            expect(result[0].openingHours).toBe('24/7')
        })

        it('includes phone and website when tags present', async () => {
            const node = makeNode({ tags: {
                name: 'Contactable', amenity: 'restaurant',
                phone: '+48 123 456 789', website: 'https://example.com'
            }})
            mockFetch.mockResolvedValue(makeResponse({ elements: [node] }))
            const result = await fetchPlacesByBoundingBox(BBOX)

            expect(result[0].phone).toBe('+48 123 456 789')
            expect(result[0].website).toBe('https://example.com')
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('fetchPlacesByBoundingBox – error handling', () => {
        it('throws on HTTP error response', async () => {
            mockFetch.mockResolvedValue(makeResponse(null, false, 504))
            await expect(fetchPlacesByBoundingBox(BBOX)).rejects.toThrow('Overpass API error: 504')
        })

        it('throws on network failure', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'))
            await expect(fetchPlacesByBoundingBox(BBOX)).rejects.toThrow('Network error')
        })

        it('returns empty array when elements array is empty', async () => {
            mockFetch.mockResolvedValue(makeResponse({ elements: [] }))
            const result = await fetchPlacesByBoundingBox(BBOX)
            expect(result).toEqual([])
        })
    })
})
