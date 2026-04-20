// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from '../places/autocomplete.js'

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

const mockPredictions = [
  {
    place_id: 'ChIJ_hamsa',
    description: 'Hamsa, Szeroka, Kraków, Poland',
    structured_formatting: { main_text: 'Hamsa', secondary_text: 'Szeroka, Kraków, Poland' },
    types: ['restaurant', 'food', 'establishment'],
  },
  {
    place_id: 'ChIJ_cafe',
    description: 'Cafe Szal, Kraków, Poland',
    structured_formatting: { main_text: 'Cafe Szal', secondary_text: 'Kraków, Poland' },
    types: ['cafe', 'food', 'establishment'],
  },
]

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('api/places/autocomplete', () => {
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

  // ── Method guards ─────────────────────────────────────────────────────────

  it('handles OPTIONS preflight with 200', async () => {
    await handler({ method: 'OPTIONS', headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.end).toHaveBeenCalled()
  })

  it('rejects non-GET methods with 405', async () => {
    await handler({ method: 'POST', query: {}, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.json).toHaveBeenCalledWith({ error: 'GET only' })
  })

  it('returns 500 when GOOGLE_PLACES_API_KEY is missing', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '')
    await handler({ method: 'GET', query: { q: 'test' }, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'GOOGLE_PLACES_API_KEY not configured' })
  })

  // ── Valid autocomplete ────────────────────────────────────────────────────

  it('returns predictions array for valid input', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        predictions: mockPredictions,
      }),
    })

    await handler({
      method: 'GET',
      query: { q: 'Hamsa Kra' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.predictions).toBeDefined()
    expect(body.predictions.length).toBeGreaterThan(0)
    expect(body.predictions[0].place_id).toBe('ChIJ_hamsa')
    expect(body.predictions[0].main_text).toBe('Hamsa')
  })

  // ── Location bias ─────────────────────────────────────────────────────────

  it('passes sessiontoken to Google API for billing', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        predictions: [],
      }),
    })

    await handler({
      method: 'GET',
      query: { q: 'Hamsa', sessiontoken: 'session-123' },
      headers: {},
    }, res)

    const callUrl = global.fetch.mock.calls[0][0]
    expect(callUrl).toContain('sessiontoken=session-123')
  })

  // ── Empty results ─────────────────────────────────────────────────────────

  it('returns empty predictions for short query (< 2 chars)', async () => {
    await handler({
      method: 'GET',
      query: { q: 'H' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.predictions).toEqual([])
  })

  it('returns empty predictions when Google returns no results', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'ZERO_RESULTS',
        predictions: [],
      }),
    })

    await handler({
      method: 'GET',
      query: { q: 'xyznonexistent' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.predictions).toEqual([])
  })

  // ── Place details mode ────────────────────────────────────────────────────

  it('fetches full details when place_id is provided', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        result: {
          place_id: 'ChIJ_hamsa',
          name: 'Hamsa',
          formatted_address: 'Szeroka 2, Kraków',
          types: ['restaurant'],
          rating: 4.5,
          price_level: 2,
          geometry: { location: { lat: 50.04, lng: 19.94 } },
          address_components: [
            { long_name: 'Kraków', types: ['locality'] },
            { long_name: 'Poland', types: ['country'] },
          ],
        },
      }),
    })

    await handler({
      method: 'GET',
      query: { place_id: 'ChIJ_hamsa' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.result).toBeDefined()
    expect(body.result.title).toBe('Hamsa')
    expect(body.result.city).toBe('Kraków')
    expect(body.result.country).toBe('Poland')
  })

  // ── Error handling ────────────────────────────────────────────────────────

  it('returns 403 when Google API key is invalid', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'REQUEST_DENIED',
        error_message: 'API key is invalid',
      }),
    })

    await handler({
      method: 'GET',
      query: { q: 'test' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('returns 500 on fetch error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'))

    await handler({
      method: 'GET',
      query: { q: 'test' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  // ── CORS headers ──────────────────────────────────────────────────────────

  it('sets CORS headers', async () => {
    await handler({ method: 'OPTIONS', headers: {} }, res)
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
  })

  // ── Food type filtering ───────────────────────────────────────────────────

  it('filters predictions to food-related types', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        status: 'OK',
        predictions: [
          ...mockPredictions,
          {
            place_id: 'ChIJ_hardware',
            description: 'Hardware Store, Kraków',
            structured_formatting: { main_text: 'Hardware Store', secondary_text: 'Kraków' },
            types: ['hardware_store', 'store'],
          },
        ],
      }),
    })

    await handler({
      method: 'GET',
      query: { q: 'Kraków' },
      headers: {},
    }, res)

    const body = res.json.mock.calls[0][0]
    const placeIds = body.predictions.map(p => p.place_id)
    expect(placeIds).not.toContain('ChIJ_hardware')
  })
})
