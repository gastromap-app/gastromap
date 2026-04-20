// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from '../db/migrate.js'

// ─── Helpers ────────────────────────────────────────────────────────────────
function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    end: vi.fn(),
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('api/db/migrate', () => {
  let res

  beforeEach(() => {
    res = mockRes()
    vi.stubEnv('SUPABASE_URL', 'https://myyzguendoruefiiufop.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
    vi.stubEnv('MIGRATE_SECRET', 'test-secret-123')
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // ── Method guard ──────────────────────────────────────────────────────────

  it('handles OPTIONS preflight with 200', async () => {
    await handler({ method: 'OPTIONS', headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.end).toHaveBeenCalled()
  })

  it('rejects non-POST methods with 405', async () => {
    await handler({ method: 'GET', body: {}, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.json).toHaveBeenCalledWith({ error: 'POST only' })
  })

  // ── Auth/authorization ────────────────────────────────────────────────────

  it('returns 403 when secret is wrong', async () => {
    await handler({
      method: 'POST',
      body: { secret: 'wrong-secret' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid secret' })
  })

  it('returns 403 when secret is missing', async () => {
    await handler({
      method: 'POST',
      body: {},
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('accepts request with correct secret', async () => {
    // Management API succeeds
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'migration applied' }),
    })

    await handler({
      method: 'POST',
      body: { secret: 'test-secret-123' },
      headers: {},
    }, res)

    // Should not return 403
    expect(res.status).not.toHaveBeenCalledWith(403)
  })

  it('uses default secret when MIGRATE_SECRET env is not set', async () => {
    vi.stubEnv('MIGRATE_SECRET', '')
    // The default is 'gastromap-migrate-2026'
    await handler({
      method: 'POST',
      body: { secret: 'gastromap-migrate-2026' },
      headers: {},
    }, res)

    // Should not return 403 — the default secret matches
    expect(res.status).not.toHaveBeenCalledWith(403)
  })

  // ── Missing env vars ──────────────────────────────────────────────────────

  it('returns 500 when SUPABASE_URL is missing', async () => {
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_URL', '')

    await handler({
      method: 'POST',
      body: { secret: 'test-secret-123' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('SUPABASE_URL') })
    )
  })

  it('returns 500 when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

    await handler({
      method: 'POST',
      body: { secret: 'test-secret-123' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })

  // ── Migration execution via Management API ────────────────────────────────

  it('runs migration via Supabase Management API when available', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'columns added' }),
    })

    await handler({
      method: 'POST',
      body: { secret: 'test-secret-123' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.success).toBe(true)
    expect(body.method).toBe('management_api')

    // Verify it called the Management API
    const callUrl = global.fetch.mock.calls[0][0]
    expect(callUrl).toContain('api.supabase.com/v1/projects/')
    expect(callUrl).toContain('/database/query')
  })

  it('extracts project ref from SUPABASE_URL for Management API', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'ok' }),
    })

    await handler({
      method: 'POST',
      body: { secret: 'test-secret-123' },
      headers: {},
    }, res)

    const callUrl = global.fetch.mock.calls[0][0]
    expect(callUrl).toContain('myyzguendoruefiiufop')
  })

  // ── Fallback when Management API fails ────────────────────────────────────

  it('returns SQL for manual execution when Management API fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    })

    await handler({
      method: 'POST',
      body: { secret: 'test-secret-123' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.success).toBe(false)
    expect(body.sql).toBeDefined()
    expect(body.sql).toContain('kg_cuisines')
    expect(body.sql).toContain('kg_dishes')
    expect(body.sql).toContain('kg_ingredients')
    expect(body.sql).toContain('kg_allergens')
  })

  it('returns SQL for manual execution when Management API throws', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Connection refused'))

    await handler({
      method: 'POST',
      body: { secret: 'test-secret-123' },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.success).toBe(false)
    expect(body.sql).toBeDefined()
  })

  // ── CORS headers ──────────────────────────────────────────────────────────

  it('sets CORS headers', async () => {
    await handler({ method: 'OPTIONS', headers: {} }, res)
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
  })
})
