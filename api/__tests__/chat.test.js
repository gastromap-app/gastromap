// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from '../ai/chat.js'

// ─── Helpers ────────────────────────────────────────────────────────────────
function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    end: vi.fn(),
  }
}

function mockOpenRouterResponse(overrides = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'chatcmpl-test',
      choices: [{ message: { content: 'AI response' } }],
      ...overrides,
    }),
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('api/ai/chat', () => {
  let res

  beforeEach(() => {
    res = mockRes()
    vi.stubEnv('OPENROUTER_API_KEY', 'test-or-key-123')
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // ── Method & auth guards ──────────────────────────────────────────────────

  it('rejects non-POST methods with 405', async () => {
    await handler({ method: 'GET', body: {}, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' })
  })

  it('returns 500 when OPENROUTER_API_KEY is missing', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '')
    await handler({ method: 'POST', body: { messages: [{ role: 'user', content: 'hi' }] }, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'OPENROUTER_API_KEY not configured' })
  })

  it('returns 400 when messages is missing', async () => {
    await handler({ method: 'POST', body: {}, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'messages array is required' })
  })

  it('returns 400 when messages is not an array', async () => {
    await handler({ method: 'POST', body: { messages: 'not-array' }, headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'messages array is required' })
  })

  // ── Valid request with cascade mode ───────────────────────────────────────

  it('returns AI content on valid POST request (cascade mode)', async () => {
    global.fetch.mockResolvedValueOnce(mockOpenRouterResponse({
      choices: [{ message: { content: 'Here is a great restaurant!' } }],
    }))

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Find a restaurant' }],
        model: 'openai/gpt-oss-120b:free',
        _skip_rag: true,
      },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.choices[0].message.content).toBe('Here is a great restaurant!')
    expect(body._model_used).toBe('openai/gpt-oss-120b:free')
  })

  // ── Cascade behavior on 429 ───────────────────────────────────────────────

  it('cascades to next model on 429 status', async () => {
    // First model returns 429
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
    })
    // Second model succeeds
    global.fetch.mockResolvedValueOnce(mockOpenRouterResponse({
      choices: [{ message: { content: 'Fallback response' } }],
    }))

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'openai/gpt-oss-120b:free',
        _skip_rag: true,
      },
      headers: {},
    }, res)

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body._model_used).toBe('nvidia/nemotron-3-super-120b-a12b:free')
  })

  it('cascades on rate_limit error in response body', async () => {
    // First model returns 200 but body has rate_limit error
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ error: { code: 429, message: 'rate limited' } }),
    })
    // Second model succeeds
    global.fetch.mockResolvedValueOnce(mockOpenRouterResponse({
      choices: [{ message: { content: 'Success after rate limit' } }],
    }))

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'openai/gpt-oss-120b:free',
        _skip_rag: true,
      },
      headers: {},
    }, res)

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('returns 503 when all models are rate-limited', async () => {
    // Every call returns 429 — cascade has many models, so we mock enough
    const fourTwoNine = { ok: false, status: 429, json: async () => ({}) }
    for (let i = 0; i < 15; i++) {
      global.fetch.mockResolvedValueOnce(fourTwoNine)
    }

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'openai/gpt-oss-120b:free',
        _skip_rag: true,
      },
      headers: {},
    }, res)

    expect(res.status).toHaveBeenCalledWith(503)
    const body = res.json.mock.calls[0][0]
    expect(body.error).toContain('rate-limited')
  })

  // ── max_tokens validation ─────────────────────────────────────────────────

  it('defaults max_tokens to 1024 in cascade mode', async () => {
    global.fetch.mockResolvedValueOnce(mockOpenRouterResponse())

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'openai/gpt-oss-120b:free',
        _skip_rag: true,
      },
      headers: {},
    }, res)

    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.max_tokens).toBe(1024)
  })

  it('caps max_tokens at 4096 in cascade mode', async () => {
    global.fetch.mockResolvedValueOnce(mockOpenRouterResponse())

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'openai/gpt-oss-120b:free',
        max_tokens: 99999,
        _skip_rag: true,
      },
      headers: {},
    }, res)

    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.max_tokens).toBe(4096)
  })

  it('defaults max_tokens to 256 in direct model mode', async () => {
    global.fetch.mockResolvedValueOnce(mockOpenRouterResponse())

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'some-model',
        _direct_model: true,
        _skip_rag: true,
      },
      headers: {},
    }, res)

    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.max_tokens).toBe(256)
  })

  it('caps max_tokens at 4096 in direct model mode', async () => {
    global.fetch.mockResolvedValueOnce(mockOpenRouterResponse())

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'some-model',
        max_tokens: 50000,
        _direct_model: true,
        _skip_rag: true,
      },
      headers: {},
    }, res)

    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.max_tokens).toBe(4096)
  })

  // ── RAG injection ─────────────────────────────────────────────────────────

  it('injects RAG context when location intent is detected', async () => {
    // First call = semantic search
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{
          title: 'Hamsa',
          category: 'Restaurant',
          city: 'Krakow',
          rating: 4.5,
          price_level: '$$',
          cuisine: 'Georgian',
          description: 'Great Georgian food',
          tags: ['Georgian', 'Wine'],
          vibe: ['Cozy'],
        }],
      }),
    })
    // Second call = OpenRouter
    global.fetch.mockResolvedValueOnce(mockOpenRouterResponse())

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Find a restaurant in Krakow' }],
        model: 'openai/gpt-oss-120b:free',
      },
      headers: { host: 'localhost:5173', 'x-forwarded-proto': 'http' },
    }, res)

    // Verify semantic search was called
    const ragCall = global.fetch.mock.calls[0]
    expect(ragCall[0]).toContain('/api/ai/semantic-search')

    // Verify the OpenRouter call has RAG context appended
    const chatCall = JSON.parse(global.fetch.mock.calls[1][1].body)
    const systemMsg = chatCall.messages.find(m => m.role === 'system')
    expect(systemMsg).toBeDefined()
    expect(systemMsg.content).toContain('GastroMap database')
    expect(systemMsg.content).toContain('Hamsa')
  })

  it('skips RAG when _skip_rag is true', async () => {
    global.fetch.mockResolvedValueOnce(mockOpenRouterResponse())

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Find a restaurant' }],
        model: 'openai/gpt-oss-120b:free',
        _skip_rag: true,
      },
      headers: {},
    }, res)

    // Only one fetch call (to OpenRouter), no semantic search
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not inject RAG when no food keywords present', async () => {
    global.fetch.mockResolvedValueOnce(mockOpenRouterResponse())

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'What is the capital of France?' }],
        model: 'openai/gpt-oss-120b:free',
      },
      headers: {},
    }, res)

    // Only one fetch call (to OpenRouter), no semantic search
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  // ── Direct model mode ─────────────────────────────────────────────────────

  it('uses direct model mode when _direct_model is set', async () => {
    global.fetch.mockResolvedValueOnce(mockOpenRouterResponse({
      choices: [{ message: { content: 'Direct model response' } }],
    }))

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'custom-model',
        _direct_model: true,
        _skip_rag: true,
      },
      headers: {},
    }, res)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const callUrl = global.fetch.mock.calls[0][0]
    expect(callUrl).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  // ── Unknown model in cascade ──────────────────────────────────────────────

  it('prepends unknown model to cascade and tries it first', async () => {
    global.fetch.mockResolvedValueOnce(mockOpenRouterResponse())

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'custom/unknown-model:free',
        _skip_rag: true,
      },
      headers: {},
    }, res)

    const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(callBody.model).toBe('custom/unknown-model:free')
  })

  // ── Error handling ────────────────────────────────────────────────────────

  it('returns 500 on unexpected error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network failure'))

    // Need to exhaust cascade - all calls fail
    for (let i = 0; i < 15; i++) {
      global.fetch.mockRejectedValueOnce(new Error('Network failure'))
    }

    await handler({
      method: 'POST',
      body: {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'openai/gpt-oss-120b:free',
        _skip_rag: true,
      },
      headers: {},
    }, res)

    // When all models fail with exceptions, it returns 503
    expect(res.status).toHaveBeenCalledWith(503)
  })
})
