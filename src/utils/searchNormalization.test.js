import { describe, it, expect } from 'vitest'
import { normalizeSearchTerm } from './searchNormalization'

describe('normalizeSearchTerm', () => {
    describe('edge cases', () => {
        it('returns empty string for falsy input', () => {
            expect(normalizeSearchTerm('')).toBe('')
            expect(normalizeSearchTerm(null)).toBe('')
            expect(normalizeSearchTerm(undefined)).toBe('')
        })

        it('trims whitespace', () => {
            expect(normalizeSearchTerm('  hello  ')).toBe('hello')
        })

        it('keeps English queries untouched (just lowercased)', () => {
            expect(normalizeSearchTerm('good coffee')).toBe('good coffee')
            expect(normalizeSearchTerm('Wine Bar')).toBe('wine bar')
        })
    })

    describe('Russian → English (ESTABLISHMENT_TYPES)', () => {
        it('translates category "кафе" → "cafe"', () => {
            expect(normalizeSearchTerm('кафе')).toContain('cafe')
        })

        it('translates "Кафе" (capitalized) → "cafe"', () => {
            expect(normalizeSearchTerm('Кафе')).toContain('cafe')
        })

        it('translates "ресторан" → "restaurant"', () => {
            expect(normalizeSearchTerm('ресторан')).toContain('restaurant')
        })

        it('translates "пекарня" → "bakery"', () => {
            expect(normalizeSearchTerm('пекарня')).toContain('bakery')
        })
    })

    describe('Polish → English', () => {
        it('translates "Kawiarnia" → "cafe"', () => {
            expect(normalizeSearchTerm('Kawiarnia')).toContain('cafe')
        })

        it('translates "Piekarnia" → "bakery"', () => {
            expect(normalizeSearchTerm('piekarnia')).toContain('bakery')
        })

        it('translates "Restauracja" → "restaurant"', () => {
            expect(normalizeSearchTerm('Restauracja')).toContain('restaurant')
        })
    })

    describe('Ukrainian → English', () => {
        it('translates "Пекарня" (UA) → "bakery"', () => {
            expect(normalizeSearchTerm('пекарня')).toContain('bakery')
        })

        it('translates "Кондитерська" (UA) → "pastry"', () => {
            expect(normalizeSearchTerm('Кондитерська')).toContain('pastry')
        })
    })

    describe('multi-token queries', () => {
        it('translates only matching tokens, keeps rest', () => {
            const result = normalizeSearchTerm('кафе в кракове')
            expect(result).toContain('cafe')
        })

        it('translates "утро кафе" → contains both "morning" and "cafe"', () => {
            const result = normalizeSearchTerm('утро кафе')
            expect(result).toContain('morning')
            expect(result).toContain('cafe')
        })

        it('mixed-language query is handled', () => {
            const result = normalizeSearchTerm('good кафе')
            expect(result).toContain('good')
            expect(result).toContain('cafe')
        })
    })

    describe('labels from LABEL_GROUPS', () => {
        it('translates "Авторская кухня" → "signature cuisine"', () => {
            const result = normalizeSearchTerm('Авторская кухня')
            expect(result).toContain('signature cuisine')
        })

        it('translates Polish label "Menu bezglutenowe" → "gluten-free options"', () => {
            const result = normalizeSearchTerm('Menu bezglutenowe')
            expect(result.toLowerCase()).toContain('gluten-free')
        })
    })

    describe('BEST_TIMES', () => {
        it('translates "утро" → "morning"', () => {
            expect(normalizeSearchTerm('утро')).toContain('morning')
        })

        it('translates "вечер" → "evening"', () => {
            expect(normalizeSearchTerm('вечер')).toContain('evening')
        })
    })

    describe('popular Polish cities (RU spelling)', () => {
        it('translates "краков" → "krakow"', () => {
            expect(normalizeSearchTerm('краков')).toContain('krakow')
        })

        it('translates "варшава" → "warsaw"', () => {
            expect(normalizeSearchTerm('варшава')).toContain('warsaw')
        })
    })

    describe('gastro vocabulary (MANUAL_ALIASES)', () => {
        it('translates dish: "пицца" → "pizza"', () => {
            expect(normalizeSearchTerm('пицца')).toContain('pizza')
        })

        it('translates drink: "чай" → "tea"', () => {
            expect(normalizeSearchTerm('чай')).toContain('tea')
        })

        it('translates meal: "сніданок" (UA) → "breakfast"', () => {
            expect(normalizeSearchTerm('сніданок')).toContain('breakfast')
        })

        it('translates Polish dish: "pierogi" → "pierogi"', () => {
            expect(normalizeSearchTerm('pierogi')).toContain('pierogi')
        })

        it('translates dietary: "безглютеновое" → "gluten-free"', () => {
            expect(normalizeSearchTerm('безглютеновое')).toContain('gluten-free')
        })

        it('multi-token gastro query: "пицца в кракове" → contains pizza + krakow', () => {
            const r = normalizeSearchTerm('пицца в кракове')
            expect(r).toContain('pizza')
            expect(r).toContain('krakow')
        })
    })
})
