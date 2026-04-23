import { describe, it, expect, vi, beforeEach } from 'vitest'
import { geocodeCity, getCitiesForCountry, getCityImage } from './nominatimApi'

// localStorage is mocked globally by src/test/setup.js
// We mock global.fetch here
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeResponse(body, ok = true, status = 200) {
    return {
        ok,
        status,
        json: vi.fn().mockResolvedValue(body),
    }
}

describe('nominatimApi', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Clear localStorage cache between tests
        window.localStorage.clear()
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('getCityImage', () => {
        it('returns a valid Unsplash URL', () => {
            const url = getCityImage('Krakow')
            expect(url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/)
            expect(url).toContain('?q=80&w=1200')
        })

        it('is deterministic — same city name always returns same URL', () => {
            expect(getCityImage('Warsaw')).toBe(getCityImage('Warsaw'))
        })

        it('returns a URL for empty string input', () => {
            const url = getCityImage('')
            expect(url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/)
        })

        it('different city names can produce different URLs (hash-based)', () => {
            // Not guaranteed to differ, but should work without throwing
            const a = getCityImage('Paris')
            const b = getCityImage('Tokyo')
            expect(typeof a).toBe('string')
            expect(typeof b).toBe('string')
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('geocodeCity', () => {
        it('returns parsed lat/lon/boundingbox/display_name on success', async () => {
            const apiResponse = [{
                lat: '50.0647',
                lon: '19.9450',
                boundingbox: ['49.9', '50.2', '19.7', '20.2'],
                display_name: 'Kraków, Lesser Poland, Poland',
            }]
            mockFetch.mockResolvedValue(makeResponse(apiResponse))

            const result = await geocodeCity('Krakow', 'Poland')

            expect(result.lat).toBe(50.0647)
            expect(result.lon).toBe(19.9450)
            expect(result.boundingbox).toEqual([49.9, 50.2, 19.7, 20.2])
            expect(result.display_name).toBe('Kraków, Lesser Poland, Poland')
        })

        it('sends correct query parameters', async () => {
            mockFetch.mockResolvedValue(makeResponse([{
                lat: '1', lon: '2', boundingbox: ['0','0','0','0'], display_name: 'Test'
            }]))

            await geocodeCity('Berlin', 'Germany')

            const [url] = mockFetch.mock.calls[0]
            expect(url).toContain('city=Berlin')
            expect(url).toContain('country=Germany')
            expect(url).toContain('format=json')
            expect(url).toContain('limit=1')
        })

        it('sends correct User-Agent and Accept-Language headers', async () => {
            mockFetch.mockResolvedValue(makeResponse([{
                lat: '1', lon: '2', boundingbox: ['0','0','0','0'], display_name: 'X'
            }]))

            await geocodeCity('Paris', 'France')

            const [, options] = mockFetch.mock.calls[0]
            expect(options.headers['User-Agent']).toContain('GastroMap')
            expect(options.headers['Accept-Language']).toBe('en')
        })

        it('throws when city is not found (empty results)', async () => {
            mockFetch.mockResolvedValue(makeResponse([]))
            await expect(geocodeCity('Atlantis', 'Ocean')).rejects.toThrow('City not found')
        })

        it('throws on HTTP error response', async () => {
            mockFetch.mockResolvedValue(makeResponse(null, false, 429))
            await expect(geocodeCity('Madrid', 'Spain')).rejects.toThrow('Nominatim error: 429')
        })

        it('caches result in localStorage', async () => {
            const apiResponse = [{
                lat: '52.2', lon: '21.0', boundingbox: ['51.9','52.5','20.7','21.3'], display_name: 'Warsaw, Poland'
            }]
            mockFetch.mockResolvedValue(makeResponse(apiResponse))

            await geocodeCity('Warsaw', 'Poland')

            expect(window.localStorage.setItem).toHaveBeenCalledWith(
                'nominatim:warsaw:poland',
                expect.stringContaining('"lat":52.2')
            )
        })

        it('returns cached result without calling fetch again', async () => {
            const cached = { lat: 50.06, lon: 19.94, boundingbox: [1,2,3,4], display_name: 'Cached City' }
            const cacheEntry = JSON.stringify({ data: cached, timestamp: Date.now() })
            window.localStorage.getItem.mockReturnValueOnce(cacheEntry)

            const result = await geocodeCity('Krakow', 'Poland')
            expect(mockFetch).not.toHaveBeenCalled()
            expect(result).toEqual(cached)
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('getCitiesForCountry', () => {
        it('returns an array of cities with name/lat/lon/image', async () => {
            const apiResponse = [
                { name: 'Krakow', lat: '50.06', lon: '19.94', display_name: 'Krakow, Poland' },
                { name: 'Warsaw', lat: '52.23', lon: '21.01', display_name: 'Warsaw, Poland' },
            ]
            mockFetch.mockResolvedValue(makeResponse(apiResponse))

            const result = await getCitiesForCountry('poland')

            expect(result).toHaveLength(2)
            expect(result[0]).toMatchObject({ name: 'Krakow', lat: 50.06, lon: 19.94 })
            expect(result[0].image).toMatch(/^https:\/\/images\.unsplash\.com/)
        })

        it('deduplicates cities with the same name', async () => {
            const apiResponse = [
                { name: 'Gdansk', lat: '54.35', lon: '18.64', display_name: 'Gdansk' },
                { name: 'Gdansk', lat: '54.36', lon: '18.65', display_name: 'Gdansk duplicate' },
            ]
            mockFetch.mockResolvedValue(makeResponse(apiResponse))

            const result = await getCitiesForCountry('poland')
            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('Gdansk')
        })

        it('filters out results missing name, lat, or lon', async () => {
            const apiResponse = [
                { name: 'Wroclaw', lat: '51.10', lon: '17.03', display_name: 'Wroclaw' },
                { name: '',        lat: '50.00', lon: '20.00', display_name: 'no name' },
                { name: 'NoCoord', lat: null,    lon: null,    display_name: 'no coords' },
            ]
            mockFetch.mockResolvedValue(makeResponse(apiResponse))

            const result = await getCitiesForCountry('poland')
            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('Wroclaw')
        })

        it('throws on HTTP error', async () => {
            mockFetch.mockResolvedValue(makeResponse(null, false, 503))
            await expect(getCitiesForCountry('xyz')).rejects.toThrow('Nominatim cities error: 503')
        })

        it('caches result in localStorage', async () => {
            mockFetch.mockResolvedValue(makeResponse([
                { name: 'Lodz', lat: '51.75', lon: '19.45', display_name: 'Lodz' }
            ]))

            await getCitiesForCountry('poland')

            expect(window.localStorage.setItem).toHaveBeenCalledWith(
                'nominatim:cities:poland',
                expect.any(String)
            )
        })

        it('returns cached cities without fetching', async () => {
            const cached = [{ name: 'CachedCity', lat: 50, lon: 20, image: 'img' }]
            const cacheEntry = JSON.stringify({ data: cached, timestamp: Date.now() })
            window.localStorage.getItem.mockReturnValueOnce(cacheEntry)

            const result = await getCitiesForCountry('poland')
            expect(mockFetch).not.toHaveBeenCalled()
            expect(result).toEqual(cached)
        })

        it('sends country as query parameter', async () => {
            mockFetch.mockResolvedValue(makeResponse([]))

            await getCitiesForCountry('germany').catch(() => {})

            const [url] = mockFetch.mock.calls[0]
            expect(url).toContain('country=germany')
        })
    })
})
