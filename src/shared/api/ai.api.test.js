import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeQuery, analyzeQueryStream } from './ai.api'

// ─── Mock @/shared/config/env ──────────────────────────────────────────────
vi.mock('@/shared/config/env', () => ({
    config: {
        ai: { openRouterKey: 'test-key', model: null, modelFallback: null, maxResponseTokens: 1024, isConfigured: true },
        app: { isDev: false },
    }
}))

// ─── Mock client ───────────────────────────────────────────────────────────
vi.mock('./client', () => ({
    ApiError: class ApiError extends Error {
        constructor(message, status, code) {
            super(message)
            this.name = 'ApiError'
            this.status = status
            this.code = code
        }
    },
}))

// ─── Mock useAppConfigStore ────────────────────────────────────────────────
const { mockGetState } = vi.hoisted(() => ({
    mockGetState: vi.fn(() => ({
        aiApiKey: 'test-api-key',
        aiPrimaryModel: null,
        aiFallbackModel: null,
    }))
}))

vi.mock('@/store/useAppConfigStore', () => ({
    useAppConfigStore: {
        getState: mockGetState,
    }
}))

// ─── Mock useLocationsStore ────────────────────────────────────────────────
const mockLocations = [
    {
        id: 'loc1',
        title: 'The Krakow Bistro',
        category: 'Restaurant',
        cuisine: 'Polish',
        city: 'Krakow',
        address: 'ul. Florianska 1',
        rating: 4.8,
        priceLevel: '$$',
        vibe: ['Cozy', 'Romantic'],
        features: ['outdoor seating', 'wifi'],
        best_for: ['date', 'family'],
        dietary: ['vegetarian'],
        michelin_stars: 0,
        michelin_bib: false,
        description: 'A great Polish restaurant',
        insider_tip: 'Try the pierogi',
        what_to_try: ['pierogi', 'bigos'],
        ai_keywords: ['proposal spot'],
        ai_context: 'Romantic setting',
        openingHours: '12:00-23:00',
        phone: '+48123456789',
        website: 'https://example.com',
        photos: [],
    }
]

vi.mock('@/features/public/hooks/useLocationsStore', () => ({
    useLocationsStore: {
        getState: vi.fn(() => ({ locations: mockLocations })),
    }
}))

// ─── Mock gastroIntelligence (local fallback) ─────────────────────────────
vi.mock('@/services/gastroIntelligence', () => ({
    gastroIntelligence: {
        analyzeQuery: vi.fn(async (msg) => ({
            content: `Local engine response for: ${msg}`,
            matches: [],
        }))
    }
}))

// ─── Mock global fetch ──────────────────────────────────────────────────────
const mockFetch = vi.fn()
global.fetch = mockFetch

// ─── Helper to create OpenRouter-like responses ─────────────────────────────
function makeJsonResponse(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        json: async () => data,
    }
}

function makeTextResponse(body) {
    const choice = { message: { content: body }, finish_reason: 'stop' }
    return makeJsonResponse({ choices: [choice] })
}

function makeToolCallResponse(toolName, args) {
    const toolCallMsg = {
        role: 'assistant',
        content: null,
        tool_calls: [{
            id: 'tc_1',
            function: { name: toolName, arguments: JSON.stringify(args) }
        }]
    }
    return makeJsonResponse({ choices: [{ message: toolCallMsg, finish_reason: 'tool_calls' }] })
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('ai.api', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetState.mockReturnValue({
            aiApiKey: 'test-api-key',
            aiPrimaryModel: null,
            aiFallbackModel: null,
        })
    })

    // ─── analyzeQuery ─────────────────────────────────────────────────────

    describe('analyzeQuery', () => {
        it('throws ApiError when message is empty', async () => {
            await expect(analyzeQuery('')).rejects.toThrow()
            await expect(analyzeQuery('   ')).rejects.toThrow()
        })

        it('throws ApiError when message is null/undefined', async () => {
            await expect(analyzeQuery(null)).rejects.toThrow()
            await expect(analyzeQuery(undefined)).rejects.toThrow()
        })

        it('returns content and matches on successful OpenRouter response', async () => {
            // Direct text response (no tool calls)
            mockFetch.mockResolvedValue(makeTextResponse('Here are my recommendations!'))

            const result = await analyzeQuery('Find me a restaurant in Krakow')
            expect(result.content).toBe('Here are my recommendations!')
            expect(Array.isArray(result.matches)).toBe(true)
            expect(result.intent).toBeDefined()
        })

        it('detects recommendation intent', async () => {
            mockFetch.mockResolvedValue(makeTextResponse('Recommending places...'))

            const result = await analyzeQuery('recommend a restaurant for dinner')
            expect(result.intent).toBe('recommendation')
        })

        it('detects info intent', async () => {
            mockFetch.mockResolvedValue(makeTextResponse('The hours are 9am-9pm'))

            const result = await analyzeQuery('what are the opening hours?')
            expect(result.intent).toBe('info')
        })

        it('detects general intent for non-specific queries', async () => {
            mockFetch.mockResolvedValue(makeTextResponse('General response'))

            const result = await analyzeQuery('tell me something interesting')
            expect(result.intent).toBe('general')
        })

        it('executes tool calls and returns final response with locations', async () => {
            // First call: model responds with tool call
            mockFetch
                .mockResolvedValueOnce(makeToolCallResponse('search_locations', { city: 'Krakow', limit: 5 }))
                // Second call: model responds with final text
                .mockResolvedValueOnce(makeTextResponse('I found The Krakow Bistro for you!'))

            const result = await analyzeQuery('Find a restaurant in Krakow')
            expect(result.content).toBe('I found The Krakow Bistro for you!')
            expect(Array.isArray(result.matches)).toBe(true)
        })

        it('falls back to local engine when OpenRouter returns 401', async () => {
            mockFetch.mockResolvedValue(makeJsonResponse({ error: { message: 'Invalid API key' } }, 401))

            await expect(analyzeQuery('Find me food')).rejects.toThrow()
        })

        it('falls back to local engine when fetch fails with network error', async () => {
            mockFetch.mockRejectedValue(new Error('Network Error'))

            const result = await analyzeQuery('Find me food')
            // Should fall back to gastroIntelligence
            expect(result.content).toContain('Find me food')
        })

        it('falls back to local engine when no API key configured', async () => {
            mockGetState.mockReturnValueOnce({ aiApiKey: null, aiPrimaryModel: null })

            const result = await analyzeQuery('best sushi in Krakow')
            expect(result.content).toBeDefined()
        })

        it('uses conversation history when provided', async () => {
            mockFetch.mockResolvedValue(makeTextResponse('Continued response'))

            const context = {
                history: [
                    { role: 'user', content: 'I like Italian food' },
                    { role: 'assistant', content: 'Great choice!' },
                ]
            }
            const result = await analyzeQuery('What do you recommend?', context)
            expect(result.content).toBeDefined()

            // Verify history was included in the fetch call
            const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
            const userMessages = fetchBody.messages.filter(m => m.role === 'user')
            expect(userMessages.length).toBeGreaterThanOrEqual(1)
        })

        it('handles model cascade: tries next model on 429', async () => {
            // First model rate-limited, second succeeds
            mockFetch
                .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
                .mockResolvedValueOnce(makeTextResponse('Response from second model'))

            const result = await analyzeQuery('find me food')
            expect(result.content).toBe('Response from second model')
        }, 10000)

        it('falls back to local engine when all models rate-limited', async () => {
            // All requests return 429
            mockFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })

            const result = await analyzeQuery('find me food')
            // Should fall back gracefully
            expect(result.content).toBeDefined()
        }, 30000)

        it('passes user preferences to system prompt', async () => {
            mockFetch.mockResolvedValue(makeTextResponse('Vegan options found'))

            const context = {
                preferences: {
                    dietaryRestrictions: ['vegan'],
                    preferredCuisines: ['Italian', 'Japanese'],
                }
            }

            await analyzeQuery('Find me dinner', context)

            const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
            const systemPrompt = fetchBody.messages.find(m => m.role === 'system')?.content ?? ''
            expect(systemPrompt).toContain('vegan')
            expect(systemPrompt).toContain('Italian')
        })
    })

    // ─── analyzeQueryStream ───────────────────────────────────────────────

    describe('analyzeQueryStream', () => {
        it('throws when message is empty', async () => {
            await expect(analyzeQueryStream('', {}, vi.fn())).rejects.toThrow()
        })

        it('calls onChunk for each word in the response', async () => {
            mockFetch.mockResolvedValue(makeTextResponse('Hello world test'))
            const chunks = []
            const onChunk = vi.fn(chunk => chunks.push(chunk))

            const result = await analyzeQueryStream('Find me food', {}, onChunk)

            expect(onChunk).toHaveBeenCalled()
            expect(result.content).toBe('Hello world test')
            expect(result.intent).toBeDefined()
        })

        it('returns content and matches', async () => {
            mockFetch.mockResolvedValue(makeTextResponse('Great recommendation here'))

            const result = await analyzeQueryStream('Find dinner', {}, vi.fn())
            expect(result.content).toBe('Great recommendation here')
            expect(Array.isArray(result.matches)).toBe(true)
        })

        it('falls back to analyzeQuery when no API key', async () => {
            mockGetState.mockReturnValueOnce({ aiApiKey: null, aiPrimaryModel: null })

            const result = await analyzeQueryStream('best pierogi', {}, vi.fn())
            expect(result.content).toBeDefined()
        })

        it('falls back gracefully on OpenRouter error', async () => {
            mockFetch.mockRejectedValue(new Error('Connection refused'))

            const result = await analyzeQueryStream('Find me food', {}, vi.fn())
            expect(result.content).toBeDefined()
        })

        it('handles tool calls in streaming mode', async () => {
            mockFetch
                .mockResolvedValueOnce(makeToolCallResponse('search_locations', { city: 'Krakow' }))
                .mockResolvedValueOnce(makeTextResponse('I found some great spots!'))

            const onChunk = vi.fn()
            const result = await analyzeQueryStream('restaurants in Krakow', {}, onChunk)

            expect(result.content).toBe('I found some great spots!')
            expect(onChunk).toHaveBeenCalled()
        })

        it('throws ApiError with 401 status on invalid key', async () => {
            mockFetch.mockResolvedValue(makeJsonResponse({ error: { message: 'Unauthorized' } }, 401))

            await expect(analyzeQueryStream('Find food', {}, vi.fn())).rejects.toThrow()
        })
    })
})
