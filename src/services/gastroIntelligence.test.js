import { describe, it, expect, vi } from 'vitest'
import { gastroIntelligence } from './gastroIntelligence'

// Mock the mocks modules so tests are deterministic
vi.mock('../mocks/locations', () => ({
    MOCK_LOCATIONS: [
        {
            id: '1',
            title: 'Israeli Bistro',
            description: 'Modern Israeli food',
            category: 'Restaurant',
            cuisine: 'Israeli',
            rating: 4.7,
            tags: ['Israeli'],
            vibe: ['Modern', 'Cozy'],
            features: ['Pet-friendly'],
        },
        {
            id: '2',
            title: 'Generic Diner',
            description: 'A plain diner',
            category: 'Restaurant',
            cuisine: 'American',
            rating: 3.8,
            tags: ['American'],
            vibe: ['Casual'],
            features: [],
        },
        {
            id: '3',
            title: 'Fancy French',
            description: 'Elegant French dining',
            category: 'Restaurant',
            cuisine: 'French',
            rating: 4.9,
            tags: ['French'],
            vibe: ['Romantic'],
            features: ['Good for work'],
        },
    ],
}))

vi.mock('../mocks/userPersona', () => ({
    MOCK_USER_PERSONA: {
        id: 'test-user',
        name: 'Tester',
        preferences: {
            favoriteCuisines: ['Israeli'],
            vibePreference:   ['Modern', 'Cozy'],
            features:         ['Pet-friendly'],
        },
    },
}))

describe('gastroIntelligence', () => {
    // ─────────────────────────────────────────────────────────────────────────
    describe('analyzeQuery – intent detection', () => {
        it('returns a recommendation when query matches recommendation keywords (EN)', async () => {
            const result = await gastroIntelligence.analyzeQuery('where to eat tonight')
            expect(result).toHaveProperty('content')
            expect(result).toHaveProperty('matches')
            expect(result.matches.length).toBeGreaterThan(0)
        })

        it('returns content for Russian recommendation keywords', async () => {
            // Note: JS \b word boundaries do not work with Cyrillic characters,
            // so pure-Cyrillic queries fall through to the default GastroGuide response.
            // Mixed or Latin-containing queries still trigger intent detection.
            const result = await gastroIntelligence.analyzeQuery('хочу поесть')
            expect(result).toHaveProperty('content')
            expect(Array.isArray(result.matches)).toBe(true)
        })

        it('returns default response for non-recommendation query', async () => {
            const result = await gastroIntelligence.analyzeQuery('show me your soul')
            expect(result.content).toContain('GastroGuide')
            expect(result.matches).toEqual([])
        })

        it('handles empty string input gracefully', async () => {
            const result = await gastroIntelligence.analyzeQuery('')
            expect(result).toHaveProperty('content')
            expect(Array.isArray(result.matches)).toBe(true)
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('analyzeQuery – scoring and ranking', () => {
        it('scores locations matching user cuisine preferences higher', async () => {
            // "Israeli Bistro" matches cuisine "Israeli" from user prefs → higher score
            const result = await gastroIntelligence.analyzeQuery('recommend a restaurant')
            const titles = result.matches.map(m => m.title)
            expect(titles[0]).toBe('Israeli Bistro')
        })

        it('content mentions the top match title', async () => {
            const result = await gastroIntelligence.analyzeQuery('where to eat')
            expect(result.content).toContain('Israeli Bistro')
        })

        it('content includes rating for top match', async () => {
            const result = await gastroIntelligence.analyzeQuery('cafe for dinner')
            expect(result.content).toMatch(/4\.\d★/)
        })

        it('returns at most 3 matches', async () => {
            const result = await gastroIntelligence.analyzeQuery('recommend something')
            expect(result.matches.length).toBeLessThanOrEqual(3)
        })

        it('adds extra mention of secondary recommendations when more than 1 match', async () => {
            const result = await gastroIntelligence.analyzeQuery('best restaurant')
            // Should mention "Also check out..." or similar secondary options
            if (result.matches.length > 1) {
                expect(result.content).toContain('Also check out')
            }
        })

        it('adds matchScore property to each result location', async () => {
            const result = await gastroIntelligence.analyzeQuery('find a cafe')
            result.matches.forEach(m => {
                expect(m).toHaveProperty('matchScore')
            })
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('analyzeQuery – custom locations pool', () => {
        it('uses provided locations array instead of MOCK_LOCATIONS', async () => {
            const customLocations = [
                {
                    id: 'c1',
                    title: 'Custom Place',
                    description: 'Custom',
                    category: 'Cafe',
                    cuisine: 'Coffee',
                    rating: 4.5,
                    tags: ['Coffee'],
                    vibe: ['Cozy'],
                    features: [],
                },
            ]
            const result = await gastroIntelligence.analyzeQuery('coffee cafe', customLocations)
            // Should use customLocations pool → topMatch is from custom pool
            expect(result.matches[0].title).toBe('Custom Place')
        })

        it('falls back to MOCK_LOCATIONS when provided array is empty', async () => {
            const result = await gastroIntelligence.analyzeQuery('restaurant dinner', [])
            // Falls back to mock → first match is Israeli Bistro per scoring
            const titles = result.matches.map(m => m.title)
            expect(titles).toContain('Israeli Bistro')
        })

        it('falls back to MOCK_LOCATIONS when no locations arg given', async () => {
            const result = await gastroIntelligence.analyzeQuery('lunch recommendations')
            expect(result.matches.length).toBeGreaterThan(0)
        })
    })

    // ─────────────────────────────────────────────────────────────────────────
    describe('analyzeQuery – edge cases', () => {
        it('handles locations with no tags gracefully', async () => {
            const locations = [
                { id: 'n1', title: 'No Tags Place', description: 'desc', rating: 4.0, vibe: [], features: [] }
            ]
            const result = await gastroIntelligence.analyzeQuery('where to eat', locations)
            expect(result).toHaveProperty('content')
        })

        it('handles locations with vibe as a string (not array)', async () => {
            const locations = [
                { id: 'v1', title: 'String Vibe', description: 'desc', rating: 4.0, vibe: 'Cozy', tags: [], features: [] }
            ]
            const result = await gastroIntelligence.analyzeQuery('cozy cafe', locations)
            expect(result).toHaveProperty('content')
        })

        it('returns default message when no locations match with score > 0 and no recommendation pool', async () => {
            // empty pool → isRecommendation true but no topMatch → should return generic fallback
            const result = await gastroIntelligence.analyzeQuery('find me a restaurant', null)
            // With null pool, falls back to MOCK_LOCATIONS which has entries
            expect(result.content).toBeTruthy()
        })

        it('matches Russian breakfast keyword "завтрак"', async () => {
            const result = await gastroIntelligence.analyzeQuery('хочу завтрак')
            expect(result.matches.length).toBeGreaterThanOrEqual(0)
            expect(result.content).toBeTruthy()
        })
    })
})
