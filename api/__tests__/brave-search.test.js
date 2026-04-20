// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from '../brave-search.js'

// ─── Helpers ────────────────────────────────────────────────────────────────
function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    end: vi.fn(),
  }
}

const BRAVE_KEY = 'test-brave-api-key'

const mockBraveResults = [
  {
    title: 'Georgian cuisine - Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Georgian_cuisine',
    description: 'Georgian cuisine is unique',
  },
  {
    title: 'Best Khachapuri - Serious Eats',
    url: 'https://www.seriouseats.com/best-khachapuri',
    description: 'The ultimate cheese bread',
  },
  {
    title: 'Georgian Food Blog',
    url: 'https://www.someblog.com/georgian-food',
    description: 'A personal blog about Georgian food',
  },
  {
    title: 'Рецепты с food.ru',
    url: 'https://food.ru/recipes/georgian',
    description: 'Рецепты грузинской кухни',
  },
  {
    title: 'Eda ru recipes',
    url: 'https://eda.ru/georgian',
    description: 'Грузинская кухня рецепты',
  },
]

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('api/brave-search', () => {
  let res

  beforeEach(() => {
    res = mockRes()
    vi.stubEnv('BRAVE_SEARCH_API_KEY', BRAVE_KEY)
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

  it('returns 400 when API key is missing', async () => {
    vi.stubEnv('BRAVE_SEARCH_API_KEY', '')
    await handler({ method: 'POST', body: { query: 'test' }, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Brave Search API key not configured' })
  })

  it('returns 400 when query is missing', async () => {
    await handler({ method: 'POST', body: {}, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'query is required' })
  })

  // ── Domain trust sorting ──────────────────────────────────────────────────

  it('sorts trusted domains (Wikipedia, Serious Eats) to the top', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: { results: [...mockBraveResults] },
      }),
    })

    await handler({
      method: 'POST',
      body: { query: 'Georgian cuisine', count: 5 },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    // Wikipedia should be first (trusted)
    expect(body.results[0].url).toContain('wikipedia.org')
    // Serious Eats should be second (trusted)
    expect(body.results[1].url).toContain('seriouseats.com')
  })

  // ── Blocked domain filtering ──────────────────────────────────────────────

  it('filters out blocked domains (food.ru, eda.ru)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: { results: [...mockBraveResults] },
      }),
    })

    await handler({
      method: 'POST',
      body: { query: 'Georgian cuisine', count: 10 },
      headers: {},
    }, res)

    const body = res.json.mock.calls[0][0]
    const urls = body.results.map(r => r.url)
    expect(urls.some(u => u.includes('food.ru'))).toBe(false)
    expect(urls.some(u => u.includes('eda.ru'))).toBe(false)
  })

  it('filters out yandex.ru and vk.com', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: 'Yandex', url: 'https://yandex.ru/food', description: 'test' },
            { title: 'VK', url: 'https://vk.com/food', description: 'test' },
            { title: 'Wiki', url: 'https://en.wikipedia.org/wiki/Food', description: 'test' },
          ],
        },
      }),
    })

    await handler({
      method: 'POST',
      body: { query: 'food', count: 10 },
      headers: {},
    }, res)

    const body = res.json.mock.calls[0][0]
    const urls = body.results.map(r => r.url)
    expect(urls.some(u => u.includes('yandex.ru'))).toBe(false)
    expect(urls.some(u => u.includes('vk.com'))).toBe(false)
  })

  // ── Non-Latin query handling ──────────────────────────────────────────────

  it('adds EN context for non-Latin (Cyrillic) queries', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: { results: [] },
      }),
    })

    await handler({
      method: 'POST',
      body: { query: 'грузинская кухня', count: 5 },
      headers: {},
    }, res)

    const callUrl = global.fetch.mock.calls[0][0]
    const searchParam = new URL(callUrl).searchParams.get('q')
    expect(searchParam).toContain('cuisine traditional dishes food')
  })

  it('does not add EN context for Latin queries', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: { results: [] },
      }),
    })

    await handler({
      method: 'POST',
      body: { query: 'Georgian cuisine', count: 5 },
      headers: {},
    }, res)

    const callUrl = global.fetch.mock.calls[0][0]
    const searchParam = new URL(callUrl).searchParams.get('q')
    expect(searchParam).toBe('Georgian cuisine')
  })

  // ── Count / limit ─────────────────────────────────────────────────────────

  it('respects the count parameter', async () => {
    const manyResults = Array.from({ length: 10 }, (_, i) => ({
      title: `Result ${i}`,
      url: `https://example.com/${i}`,
      description: `Description ${i}`,
    }))

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: { results: manyResults },
      }),
    })

    await handler({
      method: 'POST',
      body: { query: 'food', count: 3 },
      headers: {},
    }, res)

    const body = res.json.mock.calls[0][0]
    expect(body.results.length).toBeLessThanOrEqual(3)
  })

  // ── Rate limit handling ───────────────────────────────────────────────────

  it('returns error when Brave API returns non-200 status', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    })

    await handler({
      method: 'POST',
      body: { query: 'test' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(429)
    const body = res.json.mock.calls[0][0]
    expect(body.error).toContain('429')
  })

  // ── General error handling ────────────────────────────────────────────────

  it('returns 500 on fetch error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network failure'))

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
  })

  // ── API key from body fallback ────────────────────────────────────────────

  it('uses API key from request body as fallback', async () => {
    vi.stubEnv('BRAVE_SEARCH_API_KEY', '')

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        web: { results: [] },
      }),
    })

    await handler({
      method: 'POST',
      body: { query: 'test', apiKey: 'body-api-key' },
      headers: {},
    }, res)

    // Should not return 400 — the body apiKey should be used
    const authHeader = global.fetch.mock.calls[0][1].headers['X-Subscription-Token']
    expect(authHeader).toBe('body-api-key')
  })
})
