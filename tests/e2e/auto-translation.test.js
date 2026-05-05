/**
 * E2E Tests for Auto-Translation System
 *
 * Tests automatic translation of locations to multiple languages
 * Run: npm run test:e2e
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mocks (must be before importing translation.api) ───────────────────────

vi.mock('../../src/shared/api/ai/openrouter', () => ({
    fetchOpenRouter: vi.fn(async (messages) => {
        const userMsg = messages.find(m => m.role === 'user')?.content || ''
        const text = userMsg.split('\n\n').slice(1).join('\n\n') || userMsg
        return {
            response: {
                json: async () => ({
                    choices: [{ message: { content: text } }]
                })
            }
        }
    })
}))

vi.mock('../../src/shared/config/env', () => ({
    config: {
        ai: { isConfigured: true, openRouterKey: 'test-key' },
        supabase: { isConfigured: false }
    }
}))

vi.mock('../../src/shared/store/useAppConfigStore', () => ({
    useAppConfigStore: {
        getState: vi.fn(() => ({ aiApiKey: 'test-api-key' }))
    }
}))

const mockUpsert = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const chainable = { upsert: mockUpsert, select: mockSelect, eq: mockEq, single: mockSingle }
Object.values(chainable).forEach(fn => fn.mockReturnValue(chainable))

vi.mock('../../src/shared/api/client', () => ({
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

import {
    translateText,
    translateArray,
    translateLocation,
    autoTranslateAll,
    detectLanguage,
    SUPPORTED_LANGUAGES,
    TRANSLATABLE_FIELDS
} from '../../src/shared/api/translation.api.js'

describe('Auto-Translation System', () => {
    const mockLocation = {
        id: 'test-123',
        title: 'Ursus Restaurant',
        description: 'Cozy Italian restaurant in the heart of Krakow',
        address: 'ul. Floriańska 15, Kraków',
        city: 'Kraków',
        country: 'Poland',
        insider_tip: 'Try the homemade pasta - it\'s amazing!',
        what_to_try: ['Carbonara', 'Tiramisu', 'Fresh bread'],
        ai_context: 'Popular among locals, romantic atmosphere'
    }

    beforeEach(() => {
        vi.clearAllMocks()
        Object.values(chainable).forEach(fn => fn.mockReturnValue(chainable))
    })

    describe('Configuration', () => {
        it('should have supported languages', () => {
            expect(SUPPORTED_LANGUAGES).toHaveProperty('en')
            expect(SUPPORTED_LANGUAGES).toHaveProperty('pl')
            expect(SUPPORTED_LANGUAGES).toHaveProperty('uk')
            expect(SUPPORTED_LANGUAGES).toHaveProperty('ru')
        })

        it('should have translatable fields defined', () => {
            expect(TRANSLATABLE_FIELDS).toBeInstanceOf(Array)
            expect(TRANSLATABLE_FIELDS).toContain('title')
            expect(TRANSLATABLE_FIELDS).toContain('description')
            expect(TRANSLATABLE_FIELDS.length).toBeGreaterThan(0)
        })
    })

    describe('Language Detection', () => {
        it('should detect English', () => {
            expect(detectLanguage('Hello, how are you?')).toBe('en')
        })

        it('should detect Polish', () => {
            expect(detectLanguage('Dzień dobry, jak się masz?')).toBe('pl')
        })

        it('should detect Ukrainian (with unique chars: і, ї, є)', () => {
            const detected = detectLanguage('Привіт! Як справи? Їжте смачно.')
            expect(detected).toBe('uk')
        })

        it('should detect Ukrainian with і', () => {
            expect(detectLanguage('Світ і краса')).toBe('uk')
        })

        it('should detect Russian', () => {
            expect(detectLanguage('Привет, как дела?')).toBe('ru')
        })

        it('should handle empty text', () => {
            expect(detectLanguage('')).toBe('en')
        })
    })

    describe('Text Translation', () => {
        it('should translate text to Polish', async () => {
            const text = 'Cozy Italian restaurant'
            const translated = await translateText(text, 'pl')
            expect(translated).toBeDefined()
            expect(typeof translated).toBe('string')
            expect(translated.length).toBeGreaterThan(0)
        })

        it('should translate text to Ukrainian', async () => {
            const text = 'Best pizza in town'
            const translated = await translateText(text, 'uk')
            expect(translated).toBeDefined()
            expect(typeof translated).toBe('string')
            expect(translated.length).toBeGreaterThan(0)
        })

        it('should translate text to Russian', async () => {
            const text = 'Fresh seafood daily'
            const translated = await translateText(text, 'ru')
            expect(translated).toBeDefined()
            expect(typeof translated).toBe('string')
            expect(translated.length).toBeGreaterThan(0)
        })

        it('should handle empty text', async () => {
            const translated = await translateText('', 'pl')
            expect(translated).toBe('')
        })

        it('should return original text on unsupported language', async () => {
            const text = 'Test translation'
            const translated = await translateText(text, 'invalid_lang')
            expect(translated).toBe(text)
        })
    })

    describe('Array Translation', () => {
        it('should translate array of strings', async () => {
            const texts = ['Pizza', 'Pasta', 'Salad']
            const translated = await translateArray(texts, 'pl')
            expect(Array.isArray(translated)).toBe(true)
            expect(translated.length).toBe(texts.length)
        })

        it('should handle non-array input', async () => {
            const translated = await translateArray('not an array', 'pl')
            expect(translated).toBe('not an array')
        })

        it('should handle empty array', async () => {
            const translated = await translateArray([], 'pl')
            expect(translated).toEqual([])
        })
    })

    describe('Location Translation', () => {
        it('should translate location to Polish', async () => {
            const translated = await translateLocation(mockLocation, 'pl')
            expect(translated).toHaveProperty('title')
            expect(translated).toHaveProperty('description')
            expect(translated).toHaveProperty('address')
        })

        it('should translate location to Ukrainian', async () => {
            const translated = await translateLocation(mockLocation, 'uk')
            expect(translated).toHaveProperty('title')
            expect(translated).toHaveProperty('description')
        })

        it('should translate location to Russian', async () => {
            const translated = await translateLocation(mockLocation, 'ru')
            expect(translated).toHaveProperty('title')
            expect(translated).toHaveProperty('description')
        })

        it('should preserve non-translatable fields', async () => {
            const translated = await translateLocation(mockLocation, 'pl')
            expect(translated.id).toBe(mockLocation.id)
            expect(translated.city).toBe(mockLocation.city)
            expect(translated.country).toBe(mockLocation.country)
        })
    })

    describe('Auto-Translate All Languages', () => {
        it('should translate to all supported languages', async () => {
            const result = await autoTranslateAll(mockLocation)
            expect(result).toHaveProperty('translations')
            expect(result.translations).toHaveProperty('en')
            expect(result.translations).toHaveProperty('pl')
            expect(result.translations).toHaveProperty('uk')
            expect(result.translations).toHaveProperty('ru')
        })

        it('should include translation timestamps', async () => {
            const result = await autoTranslateAll(mockLocation)
            Object.values(result.translations).forEach(trans => {
                expect(trans).toHaveProperty('translated_at')
            })
        })

        it('should handle null input', async () => {
            const result = await autoTranslateAll(null)
            expect(result).toBeNull()
        })
    })

    describe('Error Handling', () => {
        it('should handle translation failures gracefully', async () => {
            const badLocation = {
                title: null,
                description: undefined
            }
            const translated = await translateLocation(badLocation, 'pl')
            expect(translated).toBeDefined()
        })

        it('should continue on partial failures', async () => {
            const location = {
                title: 'Test',
                description: 'Test description',
                what_to_try: ['Item 1', 'Item 2']
            }
            const translated = await translateLocation(location, 'pl')
            expect(translated).toHaveProperty('title')
            expect(translated).toHaveProperty('description')
        })
    })
})
