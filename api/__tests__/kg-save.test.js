// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from '../kg/save.js'

// ─── Helpers ────────────────────────────────────────────────────────────────
function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    end: vi.fn(),
  }
}

const VALID_JWT = 'valid.jwt.token'
const SERVICE_KEY = 'test-service-role-key'

function defaultReq(overrides = {}) {
  return {
    method: 'POST',
    headers: {
      authorization: `Bearer ${VALID_JWT}`,
      origin: 'http://localhost:5173',
    },
    body: {
      type: 'cuisine',
      data: { name: 'Georgian' },
    },
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('api/kg/save', () => {
  let res

  beforeEach(() => {
    res = mockRes()
    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY)
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // ── JWT Auth ───────────────────────────────────────────────────────────────

  it('returns 401 when Authorization header is missing', async () => {
    await handler({
      method: 'POST',
      headers: {},
      body: { type: 'cuisine', data: { name: 'Test' } },
    }, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Missing Authorization') })
    )
  })

  it('returns 401 when JWT is invalid', async () => {
    // Mock Supabase Auth user check → not ok
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer invalid.jwt' },
      body: { type: 'cuisine', data: { name: 'Test' } },
    }, res)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('passes JWT verification for valid token', async () => {
    // Auth check → ok
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'user-1', email: 'test@test.com' }),
    })
    // Dedup check → no existing
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    // INSERT → success
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify([{ id: 1, name: 'Georgian' }]),
    })

    await handler(defaultReq(), res)

    // Verify auth check was called with JWT
    const authCall = global.fetch.mock.calls[0]
    expect(authCall[0]).toContain('/auth/v1/user')
  })

  // ── Method guards ─────────────────────────────────────────────────────────

  it('handles OPTIONS preflight with 200', async () => {
    await handler({ method: 'OPTIONS', headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.end).toHaveBeenCalled()
  })

  it('rejects non-POST methods with 405', async () => {
    await handler({ method: 'GET', headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  // ── Body validation ───────────────────────────────────────────────────────

  it('returns 400 when type is missing', async () => {
    // Need to pass auth first
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'u1', email: 'a@b.c' }),
    })

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${VALID_JWT}` },
      body: { data: { name: 'Test' } },
    }, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('type and data') })
    )
  })

  it('returns 400 for invalid type', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'u1', email: 'a@b.c' }),
    })

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${VALID_JWT}` },
      body: { type: 'invalid_type', data: { name: 'Test' } },
    }, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Unknown type') })
    )
  })

  it('returns 400 when name is empty', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'u1', email: 'a@b.c' }),
    })

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${VALID_JWT}` },
      body: { type: 'cuisine', data: { name: '' } },
    }, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  // ── Dedup detection ───────────────────────────────────────────────────────

  it('returns existing entity when duplicate found (name match)', async () => {
    const existingCuisine = { id: 42, name: 'Georgian', slug: 'georgian' }

    // Auth check
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'u1', email: 'a@b.c' }),
    })
    // Dedup check → existing found
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [existingCuisine],
    })

    await handler(defaultReq(), res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.duplicate).toBe(true)
    expect(body.data.name).toBe('Georgian')
  })

  // ── Entity creation per type ──────────────────────────────────────────────

  it('creates a cuisine entity with type-specific validation', async () => {
    // Auth
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'u1', email: 'a@b.c' }),
    })
    // Dedup → empty
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    // Alias dedup → empty (for cuisine type, will check aliases field)
    // Actually the code does alias check as part of step 1.1
    // No separate fetch needed since existing.length === 0 triggers alias check
    // But alias check is also via fetch - need to mock it
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    // INSERT → success
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify([{ id: 1, name: 'Georgian', spice_level: 'medium' }]),
    })

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${VALID_JWT}` },
      body: {
        type: 'cuisine',
        data: {
          name: 'Georgian',
          description: 'Georgian cuisine',
          spice_level: 'medium',
          flavor_profile: 'herbaceous',
        },
      },
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.duplicate).toBe(false)
  })

  it('creates a dish entity with type-specific validation', async () => {
    // Auth
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'u1', email: 'a@b.c' }),
    })
    // Dedup → empty
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    // Alias dedup for dish type
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    // INSERT → success
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify([{ id: 2, name: 'Khinkali', course: 'main' }]),
    })

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${VALID_JWT}` },
      body: {
        type: 'dish',
        data: {
          name: 'Khinkali',
          serving_temp: 'hot',
          course: 'main',
          spicy_level: 2,
        },
      },
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.duplicate).toBe(false)
  })

  it('creates an ingredient entity with category mapping', async () => {
    // Auth
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'u1', email: 'a@b.c' }),
    })
    // Dedup → empty
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    // Alias dedup for ingredient type
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    // INSERT → success
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify([{ id: 3, name: 'Walnut', category: 'nut' }]),
    })

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${VALID_JWT}` },
      body: {
        type: 'ingredient',
        data: {
          name: 'Walnut',
          category: 'nut',
          is_allergen: true,
        },
      },
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.duplicate).toBe(false)
  })

  // ── CORS headers ──────────────────────────────────────────────────────────

  it('sets CORS headers for allowed origin (Vercel preview)', async () => {
    await handler({
      method: 'OPTIONS',
      headers: { origin: 'https://gastromap-git-abc.vercel.app' },
    }, res)

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://gastromap-git-abc.vercel.app')
  })

  it('sets CORS headers for localhost', async () => {
    await handler({
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173' },
    }, res)

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:5173')
  })

  it('sets CORS headers for production origin', async () => {
    await handler({
      method: 'OPTIONS',
      headers: { origin: 'https://gastromap.app' },
    }, res)

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://gastromap.app')
  })

  it('defaults CORS to gastromap.app for disallowed origin', async () => {
    await handler({
      method: 'OPTIONS',
      headers: { origin: 'https://evil.com' },
    }, res)

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://gastromap.app')
  })

  // ── Missing service key ───────────────────────────────────────────────────

  it('returns 500 when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

    await handler(defaultReq(), res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('SUPABASE_SERVICE_ROLE_KEY') })
    )
  })

  // ── INSERT failure ────────────────────────────────────────────────────────

  it('handles Supabase INSERT failure gracefully', async () => {
    // Auth
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'u1', email: 'a@b.c' }),
    })
    // Dedup → empty
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    // Alias dedup
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    // INSERT → failure
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: async () => JSON.stringify({ message: 'duplicate key' }),
    })

    await handler(defaultReq(), res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  // ── String body parsing ───────────────────────────────────────────────────

  it('parses string body as JSON', async () => {
    // Auth
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'u1', email: 'a@b.c' }),
    })
    // Dedup
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    // Alias dedup
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    // INSERT
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify([{ id: 1, name: 'Georgian' }]),
    })

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${VALID_JWT}` },
      body: JSON.stringify({ type: 'cuisine', data: { name: 'Georgian' } }),
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('returns 400 for invalid JSON string body', async () => {
    // Auth
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'u1', email: 'a@b.c' }),
    })

    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${VALID_JWT}` },
      body: 'not-valid-json{',
    }, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })
})
