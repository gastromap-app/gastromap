// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from '../ai/semantic-search.js'

// ─── Helpers ────────────────────────────────────────────────────────────────
function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    end: vi.fn(),
  }
}

// Create a fake 768-dim embedding vector
function fakeEmbedding(dim = 768, val = 0.01) {
  return Array.from({ length: dim }, (_, i) => val + (i % 10) * 0.001)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('api/ai/semantic-search', () => {
  let res

  beforeEach(() => {
    res = mockRes()
    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_KEY', 'test-service-key')
    vi.stubEnv('OPENROUTER_API_KEY', 'test-or-key')
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // ── Method & input validation ─────────────────────────────────────────────

  it('handles OPTIONS preflight with 200', async () => {
    await handler({ method: 'OPTIONS', headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.end).toHaveBeenCalled()
  })

  it('rejects non-POST methods with 405', async () => {
    await handler({ method: 'GET', body: {}, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 400 when query is missing', async () => {
    await handler({ method: 'POST', body: {}, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'query is required' })
  })

  it('returns 400 when query is only whitespace', async () => {
    await handler({ method: 'POST', body: { query: '   ' }, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 500 when env vars are missing', async () => {
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_KEY', '')
    vi.stubEnv('SUPABASE_ANON_KEY', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    vi.stubEnv('VITE_OPENROUTER_API_KEY', '')

    await handler({ method: 'POST', body: { query: 'test' }, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Server configuration error: missing env vars' })
  })

  // ── Valid query with results ──────────────────────────────────────────────

  it('returns matching results for a valid query', async () => {
    const embVec = fakeEmbedding()

    // Call 1: OpenRouter embeddings
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ embedding: embVec }],
      }),
    })

    // Call 2: Supabase locations
    const locEmbVec = fakeEmbedding(768, 0.01)
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 1, title: 'Hamsa', description: 'Georgian food', city: 'Krakow',
          country: 'Poland', category: 'Restaurant', cuisine: 'Georgian',
          rating: 4.5, image: null, price_level: '$$',
          tags: ['Georgian'], special_labels: null, vibe: ['Cozy'],
          embedding_vec: locEmbVec,
        },
      ],
    })

    await handler({ method: 'POST', body: { query: 'Georgian restaurant' }, headers: {} }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.results.length).toBeGreaterThan(0)
    expect(body.results[0].title).toBe('Hamsa')
    expect(body.count).toBe(body.results.length)
  })

  // ── Empty results ─────────────────────────────────────────────────────────

  it('returns empty results when no locations match', async () => {
    const embVec = fakeEmbedding()

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: embVec }] }),
    })

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    await handler({ method: 'POST', body: { query: 'obscure non-matching query' }, headers: {} }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.results).toEqual([])
    expect(body.count).toBe(0)
  })

  // ── Threshold filtering ───────────────────────────────────────────────────

  it('filters results below threshold', async () => {
    const embVec = fakeEmbedding(768, 0.01)

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: embVec }] }),
    })

    // Location with an orthogonal embedding → low similarity
    const orthogonalVec = fakeEmbedding(768, -0.99)
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 99, title: 'Bad Match', description: 'No match', city: 'Nowhere',
          country: 'X', category: 'Cafe', cuisine: 'Other',
          rating: 1, image: null, price_level: '$',
          tags: [], special_labels: null, vibe: [],
          embedding_vec: orthogonalVec,
        },
      ],
    })

    await handler({
      method: 'POST',
      body: { query: 'best restaurant', threshold: 0.5 },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.results).toEqual([])
  })

  // ── Limit enforcement ─────────────────────────────────────────────────────

  it('respects the limit parameter', async () => {
    const embVec = fakeEmbedding()

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: embVec }] }),
    })

    // 5 matching locations
    const locations = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1, title: `Place ${i}`, description: 'Desc', city: 'City',
      country: 'X', category: 'Restaurant', cuisine: 'Italian',
      rating: 4, image: null, price_level: '$$',
      tags: [], special_labels: null, vibe: [],
      embedding_vec: embVec,
    }))

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => locations,
    })

    await handler({
      method: 'POST',
      body: { query: 'Italian food', limit: 2 },
      headers: {},
    }, res)

    const body = res.json.mock.calls[0][0]
    expect(body.results.length).toBeLessThanOrEqual(2)
  })

  // ── Error handling ────────────────────────────────────────────────────────

  it('returns 500 when embedding API fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })

    await handler({ method: 'POST', body: { query: 'test' }, headers: {} }, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('returns 500 when Supabase fetch fails', async () => {
    const embVec = fakeEmbedding()

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: embVec }] }),
    })

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal error',
    })

    await handler({ method: 'POST', body: { query: 'test' }, headers: {} }, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  // ── CORS headers ──────────────────────────────────────────────────────────

  it('sets CORS headers', async () => {
    await handler({ method: 'OPTIONS', headers: {} }, res)
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'POST, OPTIONS')
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type')
  })

  // ── City and category filtering ───────────────────────────────────────────

  it('passes city filter to Supabase URL', async () => {
    const embVec = fakeEmbedding()

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: embVec }] }),
    })

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    await handler({
      method: 'POST',
      body: { query: 'food', city: 'Krakow' },
      headers: {},
    }, res)

    const sbUrl = global.fetch.mock.calls[1][0]
    expect(sbUrl).toContain('city=ilike.Krakow')
  })

  it('passes category filter to Supabase URL', async () => {
    const embVec = fakeEmbedding()

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: embVec }] }),
    })

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    await handler({
      method: 'POST',
      body: { query: 'food', category: 'Restaurant' },
      headers: {},
    }, res)

    const sbUrl = global.fetch.mock.calls[1][0]
    expect(sbUrl).toContain('category=ilike.Restaurant')
  })
})
