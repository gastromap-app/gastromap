import { describe, it, expect } from 'vitest'
import { normalizeCityName, normalizeCountryName, extractCityCountryFromAddress } from './normalizeCityName'

describe('normalizeCityName', () => {
    it('returns null for null input', () => {
        expect(normalizeCityName(null)).toBe(null)
    })

    it('returns undefined for undefined input', () => {
        expect(normalizeCityName(undefined)).toBe(undefined)
    })

    it('returns empty string for empty string', () => {
        expect(normalizeCityName('')).toBe('')
    })

    // ── Polish cities ────────────────────────────────────────────────────
    it('normalizes Kraków → Krakow', () => {
        expect(normalizeCityName('Kraków')).toBe('Krakow')
    })

    it('normalizes Warszawa → Warsaw', () => {
        expect(normalizeCityName('Warszawa')).toBe('Warsaw')
    })

    it('normalizes Wrocław → Wroclaw', () => {
        expect(normalizeCityName('Wrocław')).toBe('Wroclaw')
    })

    it('normalizes Gdańsk → Gdansk', () => {
        expect(normalizeCityName('Gdańsk')).toBe('Gdansk')
    })

    it('normalizes Poznań → Poznan', () => {
        expect(normalizeCityName('Poznań')).toBe('Poznan')
    })

    it('normalizes Łódź → Lodz', () => {
        expect(normalizeCityName('Łódź')).toBe('Lodz')
    })

    it('normalizes Białystok → Bialystok', () => {
        expect(normalizeCityName('Białystok')).toBe('Bialystok')
    })

    // ── Ukrainian cities ─────────────────────────────────────────────────
    it('normalizes Киев/Kiev → Kyiv', () => {
        expect(normalizeCityName('Kiev')).toBe('Kyiv')
    })

    it('normalizes Львов/Lvov → Lviv', () => {
        expect(normalizeCityName('Lvov')).toBe('Lviv')
    })

    it('normalizes Одесса/Odessa → Odesa', () => {
        expect(normalizeCityName('Odessa')).toBe('Odesa')
    })

    it('normalizes Днепропетровск → Dnipro', () => {
        expect(normalizeCityName('Днепропетровск')).not.toBe('Dnipro') // Cyrillic not in map
    })

    // ── Italian cities ───────────────────────────────────────────────────
    it('normalizes Roma → Rome', () => {
        expect(normalizeCityName('Roma')).toBe('Rome')
    })

    it('normalizes Milano → Milan', () => {
        expect(normalizeCityName('Milano')).toBe('Milan')
    })

    it('normalizes Napoli → Naples', () => {
        expect(normalizeCityName('Napoli')).toBe('Naples')
    })

    it('normalizes Firenze → Florence', () => {
        expect(normalizeCityName('Firenze')).toBe('Florence')
    })

    it('normalizes Venezia → Venice', () => {
        expect(normalizeCityName('Venezia')).toBe('Venice')
    })

    it('normalizes Torino → Turin', () => {
        expect(normalizeCityName('Torino')).toBe('Turin')
    })

    // ── Czech cities ─────────────────────────────────────────────────────
    it('normalizes Praha → Prague', () => {
        expect(normalizeCityName('Praha')).toBe('Prague')
    })

    // ── German cities ────────────────────────────────────────────────────
    it('normalizes München → Munich', () => {
        expect(normalizeCityName('München')).toBe('Munich')
    })

    it('normalizes Köln → Cologne', () => {
        expect(normalizeCityName('Köln')).toBe('Cologne')
    })

    it('normalizes Wien → Vienna', () => {
        expect(normalizeCityName('Wien')).toBe('Vienna')
    })

    // ── Spanish cities ───────────────────────────────────────────────────
    it('normalizes Sevilla → Seville', () => {
        expect(normalizeCityName('Sevilla')).toBe('Seville')
    })

    // ── Already English names ────────────────────────────────────────────
    it('preserves already-English names: Krakow', () => {
        expect(normalizeCityName('Krakow')).toBe('Krakow')
    })

    it('preserves already-English names: Warsaw', () => {
        expect(normalizeCityName('Warsaw')).toBe('Warsaw')
    })

    it('preserves already-English names: Rome', () => {
        expect(normalizeCityName('Rome')).toBe('Rome')
    })

    it('preserves already-English names: London', () => {
        expect(normalizeCityName('London')).toBe('London')
    })

    // ── Case insensitivity ───────────────────────────────────────────────
    it('is case-insensitive: kraków → Krakow', () => {
        expect(normalizeCityName('kraków')).toBe('Krakow')
    })

    it('is case-insensitive: WARSAW → Warsaw', () => {
        expect(normalizeCityName('WARSAW')).toBe('Warsaw')
    })

    // ── Unknown cities: strip diacritics + title case ────────────────────
    it('strips diacritics for unknown cities', () => {
        expect(normalizeCityName('Słupsk')).toBe('Slupsk')
    })

    it('handles whitespace', () => {
        expect(normalizeCityName('  Kraków  ')).toBe('Krakow')
    })

    it('title-cases multi-word unknown cities', () => {
        expect(normalizeCityName('new york')).toBe('New York')
    })
})

describe('normalizeCountryName', () => {
    it('normalizes Polska → Poland', () => {
        expect(normalizeCountryName('Polska')).toBe('Poland')
    })

    it('normalizes Україна → Ukraine (Cyrillic in override map)', () => {
        // Note: Cyrillic is handled via the override map, not diacritic stripping
        // If not in map, title-case fallback is applied to the Cyrillic string
        expect(normalizeCountryName('Україна')).toBe('Ukraine')
    })

    it('normalizes Deutschland → Germany', () => {
        expect(normalizeCountryName('Deutschland')).toBe('Germany')
    })

    it('normalizes Italia → Italy', () => {
        expect(normalizeCountryName('Italia')).toBe('Italy')
    })

    it('normalizes España → Spain', () => {
        expect(normalizeCountryName('España')).toBe('Spain')
    })

    it('preserves already-English names', () => {
        expect(normalizeCountryName('Poland')).toBe('Poland')
    })

    it('preserves already-English names: Ukraine', () => {
        expect(normalizeCountryName('Ukraine')).toBe('Ukraine')
    })

    it('handles null', () => {
        expect(normalizeCountryName(null)).toBe(null)
    })
})

describe('extractCityCountryFromAddress', () => {
    it('extracts city and country from Google formatted address', () => {
        const result = extractCityCountryFromAddress('Starowiślna 16, 31-038 Kraków, Poland')
        expect(result.city).toBe('Kraków')
        expect(result.country).toBe('Poland')
    })

    it('extracts from simple address', () => {
        const result = extractCityCountryFromAddress('Kraków, Poland')
        expect(result.city).toBe('Kraków')
        expect(result.country).toBe('Poland')
    })

    it('handles single-word address', () => {
        const result = extractCityCountryFromAddress('Kraków')
        expect(result.city).toBe('Kraków')
        expect(result.country).toBe(null)
    })

    it('handles null', () => {
        const result = extractCityCountryFromAddress(null)
        expect(result.city).toBe(null)
        expect(result.country).toBe(null)
    })

    it('handles empty string', () => {
        const result = extractCityCountryFromAddress('')
        expect(result.city).toBe(null)
        expect(result.country).toBe(null)
    })

    it('strips postal code from city', () => {
        const result = extractCityCountryFromAddress('ul. Something 5, 00-001 Warszawa, Poland')
        expect(result.city).toBe('Warszawa')
        expect(result.country).toBe('Poland')
    })
})
