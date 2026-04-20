// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from '../places/search.js'

// ─── Helpers ────────────────────────────────────────────────────────────────
function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    end: vi.fn(),
  }
}

const GOOGLE_API_KEY = 'test-google-places-key'

const mockSearchResult = {
  place_id: 'ChIJ_test',
  name: 'Hamsa',
  formatted_address: 'Szeroka 2, Krakow, Poland',
  geometry: { location: { lat: 50.0497, lng: 19.9421 } },
  types: ['restaurant', 'food', 'establishment'],
  rating: 4.5,
  user_ratings_total: 320,
  price_level: 2,
}

const mockDetailsResult = {
  place_id: 'ChIJ_test',
  name: 'Hamsa',
  formatted_address: 'Szeroka 2, Krakow, Poland',
  vicinity: 'Szeroka 2',
  geometry: { location: { lat: 50.0497, lng: 19.9421 } },
  types: ['restaurant', 'food', 'establishment'],
  rating: 4.5,
  user_ratings_total: 320,
  price_level: 2,
  opening_hours: { weekday_text: ['Mon: 12-22', 'Tue: 12-22'] },
  website: 'https://hamsa.pl',
  formatted_phone_number: '+48 123 456',
  photos: [{ photo_reference: 'photo_ref_123' }],
  url: 'https://maps.google.com/?cid=test',
  editorial_summary: { overview: 'Georgian restaurant in Kazimierz' },
  serves_beer: true,
  serves_wine: true,
  serves_dinner: true,
  serves_lunch: false,
  serves_breakfast: false,
  takeout: true,
  delivery: false,
  dine_in: true,
  wheelchair_accessible_entrance: true,
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('api/places/search', () => {
  let res

  beforeEach(() => {
    res = mockRes()
    vi.stubEnv('GOOGLE_PLACES_API_KEY', GOOGLE_API_KEY)
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // ── Method & input guards ─────────────────────────────────────────────────

  it('handles OPTIONS preflight with 200', async () => {
    await handler({ method: 'OPTIONS', headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.end).toHaveBeenCalled()
  })

  it('rejects non-POST methods with 405', async () => {
    await handler({ method: 'GET', body: {}, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 500 when GOOGLE_PLACES_API_KEY is missing', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '')
    await handler({ method: 'POST', body: { query: 'test' }, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'GOOGLE_PLACES_API_KEY not configured' })
  })

  it('returns 400 when neither query nor place_id provided', async () => {
    await handler({ method: 'POST', body: {}, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'query or place_id is required' })
  })

  // ── Text search mode ──────────────────────────────────────────────────────

  it('performs text search and returns normalized result', async () => {
    // Text search → results
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        results: [mockSearchResult],
      }),
    })
    // Details for top result
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        result: mockDetailsResult,
      }),
    })

    await handler({
      method: 'POST',
      body: { query: 'Hamsa Krakow' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.result.title).toBe('Hamsa')
    expect(body.result.category).toBe('Restaurant')
    expect(body.result.lat).toBe(50.0497)
    expect(body.source).toBe('google_places')
    expect(body.candidates).toBeDefined()
  })

  // ── Direct lookup mode ────────────────────────────────────────────────────

  it('fetches place details directly when place_id is provided', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        result: mockDetailsResult,
      }),
    })

    await handler({
      method: 'POST',
      body: { place_id: 'ChIJ_test' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.result.title).toBe('Hamsa')
    expect(body.source).toBe('google_places')
    // Only one fetch call for details, no text search
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  // ── Field mapping ─────────────────────────────────────────────────────────

  it('maps Google types to GastroMap categories correctly', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        result: { ...mockDetailsResult, types: ['cafe', 'food'] },
      }),
    })

    await handler({
      method: 'POST',
      body: { place_id: 'test' },
      headers: {},
    }, res)

    const body = res.json.mock.calls[0][0]
    expect(body.result.category).toBe('Cafe')
  })

  it('maps bar type to Bar category', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        result: { ...mockDetailsResult, types: ['bar', 'establishment'] },
      }),
    })

    await handler({
      method: 'POST',
      body: { place_id: 'test' },
      headers: {},
    }, res)

    const body = res.json.mock.calls[0][0]
    expect(body.result.category).toBe('Bar')
  })

  it('maps price_level to $ format', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        result: { ...mockDetailsResult, price_level: 3 },
      }),
    })

    await handler({
      method: 'POST',
      body: { place_id: 'test' },
      headers: {},
    }, res)

    const body = res.json.mock.calls[0][0]
    expect(body.result.price_level).toBe('$$$')
  })

  it('maps price_level 0 to $', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        result: { ...mockDetailsResult, price_level: 0 },
      }),
    })

    await handler({
      method: 'POST',
      body: { place_id: 'test' },
      headers: {},
    }, res)

    const body = res.json.mock.calls[0][0]
    expect(body.result.price_level).toBe('$')
  })

  it('maps bakery type to Bakery category', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        result: { ...mockDetailsResult, types: ['bakery', 'food'] },
      }),
    })

    await handler({
      method: 'POST',
      body: { place_id: 'test' },
      headers: {},
    }, res)

    const body = res.json.mock.calls[0][0]
    expect(body.result.category).toBe('Bakery')
  })

  it('extracts amenities from boolean fields', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        result: mockDetailsResult,
      }),
    })

    await handler({
      method: 'POST',
      body: { place_id: 'test' },
      headers: {},
    }, res)

    const body = res.json.mock.calls[0][0]
    expect(body.result.amenities).toContain('wheelchair accessible')
    expect(body.result.amenities).toContain('takeout')
    expect(body.result.amenities).toContain('dine-in')
    expect(body.result.amenities).toContain('alcohol')
  })

  // ── Error handling ────────────────────────────────────────────────────────

  it('returns 403 when Google API key is invalid (REQUEST_DENIED)', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'REQUEST_DENIED',
        error_message: 'API key is invalid',
      }),
    })

    await handler({
      method: 'POST',
      body: { query: 'test' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('API key invalid') })
    )
  })

  it('returns 404 when no places found', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'ZERO_RESULTS',
        results: [],
      }),
    })

    await handler({
      method: 'POST',
      body: { query: 'nonexistent place xyz' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 500 when Google API throws an error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network timeout'))

    await handler({
      method: 'POST',
      body: { query: 'test' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  // ── CORS headers ──────────────────────────────────────────────────────────

  it('sets CORS headers', async () => {
    await handler({ method: 'OPTIONS', headers: {} }, res)
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'POST, OPTIONS')
  })
})
