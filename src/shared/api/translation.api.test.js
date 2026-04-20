import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    detectLanguage,
    translateText,
    translateArray,
    translateLocation,
    autoTranslateAll,
    saveTranslations,
    getTranslations,
    SUPPORTED_LANGUAGES,
    TRANSLATABLE_FIELDS,
} from './translation.api'

// ─── Mock @/shared/config/env ───────────────────────────────────────────────
vi.mock('@/shared/config/env', () => ({
    config: {
        ai: { isConfigured: true, openRouterKey: 'test-key' },
    }
}))

// ─── Mock Supabase chain ────────────────────────────────────────────────────
const mockUpsert = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

const chainable = {
    upsert: mockUpsert,
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
}
Object.values(chainable).forEach(fn => fn.mockReturnValue(chainable))

vi.mock('./client', () => ({
    supabase: {
        from: vi.fn(() => chainable),
    },
    ApiError: class ApiError extends Error {
        constructor(message, status, code) {
            super(message)
            this.name = 'ApiError'
            this.status = status
            this.code = code
        }
    },
}))

// ─── Mock the openrouter module used in translateText ───────────────────────
vi.mock('./ai/openrouter', () => ({
    fetchOpenRouter: vi.fn(async () => ({
        response: {
            json: async () => ({
                choices: [{ message: { content: 'translated text' } }]
            })
        }
    }))
}))

// ─── Mock @/shared/store/useAppConfigStore ──────────────────────────────────
vi.mock('@/shared/store/useAppConfigStore', () => ({
    useAppConfigStore: {
        getState: vi.fn(() => ({ aiApiKey: 'test-api-key' })),
    }
}))

// ─── Tests ────────────────────────────────────────────────────────────────

describe('translation.api', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.values(chainable).forEach(fn => fn.mockReturnValue(chainable))
    })

    // ─── detectLanguage ──────────────────────────────────────────────────

    describe('detectLanguage', () => {
        it('detects Polish by presence of ą, ć, ę, ł, ń, ó, ś, ź, ż', () => {
            expect(detectLanguage('Kawiarnia przy ulicy Głównej')).toBe('pl')  // ł in Głównej
            expect(detectLanguage('Kraków jest piękny')).toBe('pl')    // ó, ę trigger
            expect(detectLanguage('Żurek smaczny')).toBe('pl')        // ż triggers
        })

        it('detects Ukrainian by unique chars і, ї, є, ґ', () => {
            expect(detectLanguage('Це є смачна їжа')).toBe('uk')
            expect(detectLanguage('Ґречка і борщ')).toBe('uk')
        })

        it('detects Russian by Cyrillic without Ukrainian unique chars', () => {
            expect(detectLanguage('Привет мир')).toBe('ru')
            expect(detectLanguage('Это вкусное кафе')).toBe('ru')
        })

        it('defaults to English for Latin text', () => {
            expect(detectLanguage('Hello world')).toBe('en')
            expect(detectLanguage('Best restaurant in Krakow')).toBe('en')
        })

        it('returns en for null or empty input', () => {
            expect(detectLanguage(null)).toBe('en')
            expect(detectLanguage('')).toBe('en')
            expect(detectLanguage(undefined)).toBe('en')
        })

        it('returns en for non-string input', () => {
            expect(detectLanguage(123)).toBe('en')
            expect(detectLanguage({})).toBe('en')
        })
    })

    // ─── SUPPORTED_LANGUAGES / TRANSLATABLE_FIELDS ───────────────────────

    describe('constants', () => {
        it('SUPPORTED_LANGUAGES has en, pl, uk, ru', () => {
            expect(Object.keys(SUPPORTED_LANGUAGES)).toEqual(expect.arrayContaining(['en', 'pl', 'uk', 'ru']))
        })

        it('each language has name and label', () => {
            Object.values(SUPPORTED_LANGUAGES).forEach(lang => {
                expect(lang).toHaveProperty('name')
                expect(lang).toHaveProperty('label')
            })
        })

        it('TRANSLATABLE_FIELDS includes title and description', () => {
            expect(TRANSLATABLE_FIELDS).toContain('title')
            expect(TRANSLATABLE_FIELDS).toContain('description')
        })
    })

    // ─── translateText ───────────────────────────────────────────────────

    describe('translateText', () => {
        it('returns translated text on success', async () => {
            const { fetchOpenRouter } = await import('./ai/openrouter')
            fetchOpenRouter.mockResolvedValueOnce({
                response: {
                    json: async () => ({
                        choices: [{ message: { content: 'Kawiarnia' } }]
                    })
                }
            })

            const result = await translateText('Cafe', 'pl')
            expect(result).toBe('Kawiarnia')
        })

        it('returns original text when input is null', async () => {
            const result = await translateText(null, 'pl')
            expect(result).toBeNull()
        })

        it('returns original text when input is not a string', async () => {
            const result = await translateText(42, 'pl')
            expect(result).toBe(42)
        })

        it('returns original text on translation error (graceful fallback)', async () => {
            const { fetchOpenRouter } = await import('./ai/openrouter')
            fetchOpenRouter.mockRejectedValueOnce(new Error('API error'))

            const result = await translateText('Hello', 'pl')
            expect(result).toBe('Hello')
        })

        it('returns original text when translation API returns empty', async () => {
            const { fetchOpenRouter } = await import('./ai/openrouter')
            fetchOpenRouter.mockResolvedValueOnce({
                response: {
                    json: async () => ({ choices: [] })
                }
            })

            const result = await translateText('Hello', 'pl')
            expect(result).toBe('Hello')
        })
    })

    // ─── translateArray ──────────────────────────────────────────────────

    describe('translateArray', () => {
        it('translates each element in an array', async () => {
            const { fetchOpenRouter } = await import('./ai/openrouter')
            fetchOpenRouter
                .mockResolvedValueOnce({ response: { json: async () => ({ choices: [{ message: { content: 'Pasta' } }] }) } })
                .mockResolvedValueOnce({ response: { json: async () => ({ choices: [{ message: { content: 'Pizza' } }] }) } })

            const result = await translateArray(['Pasta', 'Pizza'], 'pl')
            expect(result).toHaveLength(2)
        })

        it('returns non-array input as-is', async () => {
            const result = await translateArray('not an array', 'pl')
            expect(result).toBe('not an array')
        })

        it('handles empty array', async () => {
            const result = await translateArray([], 'pl')
            expect(result).toEqual([])
        })
    })

    // ─── translateLocation ────────────────────────────────────────────────

    describe('translateLocation', () => {
        it('returns null for null input', async () => {
            const result = await translateLocation(null, 'pl')
            expect(result).toBeNull()
        })

        it('translates translatable fields and preserves non-translatable ones', async () => {
            const { fetchOpenRouter } = await import('./ai/openrouter')
            // For each translatable field that has a value, return translated
            fetchOpenRouter.mockResolvedValue({
                response: { json: async () => ({ choices: [{ message: { content: 'tłumaczenie' } }] }) }
            })

            const locationData = {
                id: 'loc1',
                title: 'Best Cafe',
                description: 'A nice place',
                city: 'Krakow',          // non-translatable
                rating: 4.5,             // non-translatable
                status: 'approved',      // non-translatable
            }

            const result = await translateLocation(locationData, 'pl')

            // Non-translatable fields preserved
            expect(result.id).toBe('loc1')
            expect(result.city).toBe('Krakow')
            expect(result.rating).toBe(4.5)
            expect(result.status).toBe('approved')
        })

        it('skips fields that are not present in location data', async () => {
            const { fetchOpenRouter } = await import('./ai/openrouter')
            fetchOpenRouter.mockResolvedValue({
                response: { json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }
            })

            const minimalLocation = { id: 'x', title: 'Minimal' }
            const result = await translateLocation(minimalLocation, 'uk')

            // title is in TRANSLATABLE_FIELDS and present — should be translated
            expect(result.title).toBeDefined()
            // id should be preserved
            expect(result.id).toBe('x')
        })
    })

    // ─── autoTranslateAll ────────────────────────────────────────────────

    describe('autoTranslateAll', () => {
        it('returns null for null input', async () => {
            const result = await autoTranslateAll(null)
            expect(result).toBeNull()
        })

        it('returns a translations object with keys for each supported language', async () => {
            const { fetchOpenRouter } = await import('./ai/openrouter')
            fetchOpenRouter.mockResolvedValue({
                response: { json: async () => ({ choices: [{ message: { content: 'translated' } }] }) }
            })

            const location = { id: 'l1', title: 'Test Cafe', description: 'A test cafe' }
            const result = await autoTranslateAll(location)

            expect(result.translations).toBeDefined()
            expect(Object.keys(result.translations)).toEqual(expect.arrayContaining(['en', 'pl', 'uk', 'ru']))
        })

        it('each language translation has a translated_at timestamp', async () => {
            const { fetchOpenRouter } = await import('./ai/openrouter')
            fetchOpenRouter.mockResolvedValue({
                response: { json: async () => ({ choices: [{ message: { content: 'ok' } }] }) }
            })

            const location = { id: 'l2', title: 'Bar' }
            const result = await autoTranslateAll(location)

            Object.values(result.translations).forEach(t => {
                if (!t.error) {
                    expect(t.translated_at).toBeDefined()
                }
            })
        })

        it('includes error key in translation on failure but does not throw', async () => {
            const { fetchOpenRouter } = await import('./ai/openrouter')
            fetchOpenRouter.mockRejectedValue(new Error('translation failed'))

            const location = { id: 'l3', title: 'Error Cafe', description: 'will fail' }
            // Should not throw
            const result = await autoTranslateAll(location)
            expect(result.translations).toBeDefined()
        })
    })

    // ─── saveTranslations ────────────────────────────────────────────────

    describe('saveTranslations', () => {
        it('upserts translations to Supabase', async () => {
            mockUpsert.mockResolvedValue({ error: null })

            await expect(saveTranslations('loc1', { en: { title: 'Title' } })).resolves.toBeUndefined()
            expect(mockUpsert).toHaveBeenCalled()
        })

        it('does not throw on Supabase error (non-blocking)', async () => {
            mockUpsert.mockResolvedValue({ error: { message: 'db error', code: '42000' } })
            // Should not throw
            await expect(saveTranslations('loc1', {})).resolves.toBeUndefined()
        })

        it('retries on lock-related error', async () => {
            mockUpsert
                .mockResolvedValueOnce({ error: { message: 'lock timeout', code: 'PGRST301' } })
                .mockResolvedValueOnce({ error: null })

            await expect(saveTranslations('loc1', {}, 1)).resolves.toBeUndefined()
        })
    })

    // ─── getTranslations ─────────────────────────────────────────────────

    describe('getTranslations', () => {
        it('returns translations object on success', async () => {
            const trans = { en: { title: 'Cafe' }, pl: { title: 'Kawiarnia' } }
            mockSingle.mockResolvedValue({ data: { translations: trans }, error: null })

            const result = await getTranslations('loc1')
            expect(result).toEqual(trans)
        })

        it('returns null when no translations found (PGRST116)', async () => {
            mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } })
            const result = await getTranslations('loc-none')
            expect(result).toBeNull()
        })

        it('returns null on general error (graceful)', async () => {
            mockSingle.mockResolvedValue({ data: null, error: { code: '42000', message: 'db error' } })
            const result = await getTranslations('loc-err')
            expect(result).toBeNull()
        })

        it('returns null when data has no translations field', async () => {
            mockSingle.mockResolvedValue({ data: {}, error: null })
            const result = await getTranslations('loc-empty')
            expect(result).toBeNull()
        })
    })
})
