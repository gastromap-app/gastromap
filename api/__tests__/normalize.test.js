import { describe, it, expect } from 'vitest'
import { normalizeCity, normalizeDiacritics, CITY_MAP } from '../_shared/normalize.js'

describe('normalizeCity', () => {
  it('returns canonical English name for known Polish cities', () => {
    expect(normalizeCity('kraków')).toBe('Krakow')
    expect(normalizeCity('warszawa')).toBe('Warsaw')
    expect(normalizeCity('gdańsk')).toBe('Gdansk')
    expect(normalizeCity('wrocław')).toBe('Wroclaw')
    expect(normalizeCity('łódź')).toBe('Lodz')
    expect(normalizeCity('poznań')).toBe('Poznan')
    expect(normalizeCity('białystok')).toBe('Bialystok')
    expect(normalizeCity('toruń')).toBe('Torun')
    expect(normalizeCity('rzeszów')).toBe('Rzeszow')
  })

  it('handles English variants in the map', () => {
    expect(normalizeCity('krakow')).toBe('Krakow')
    expect(normalizeCity('cracow')).toBe('Krakow')
    expect(normalizeCity('warsaw')).toBe('Warsaw')
    expect(normalizeCity('gdansk')).toBe('Gdansk')
    expect(normalizeCity('wroclaw')).toBe('Wroclaw')
    expect(normalizeCity('lodz')).toBe('Lodz')
    expect(normalizeCity('poznan')).toBe('Poznan')
    expect(normalizeCity('bialystok')).toBe('Bialystok')
    expect(normalizeCity('torun')).toBe('Torun')
    expect(normalizeCity('rzeszow')).toBe('Rzeszow')
  })

  it('is case-insensitive', () => {
    expect(normalizeCity('KRAKÓW')).toBe('Krakow')
    expect(normalizeCity('Warszawa')).toBe('Warsaw')
    expect(normalizeCity('GDAŃSK')).toBe('Gdansk')
    expect(normalizeCity('Wrocław')).toBe('Wroclaw')
    expect(normalizeCity('ŁÓDŹ')).toBe('Lodz')
  })

  it('trims whitespace', () => {
    expect(normalizeCity('  kraków  ')).toBe('Krakow')
    expect(normalizeCity('\twarszawa\n')).toBe('Warsaw')
    expect(normalizeCity('  gdańsk')).toBe('Gdansk')
  })

  it('returns trimmed input for unknown cities', () => {
    expect(normalizeCity('Berlin')).toBe('Berlin')
    expect(normalizeCity('  Paris  ')).toBe('Paris')
    expect(normalizeCity('New York')).toBe('New York')
  })

  it('handles cities already in canonical form', () => {
    expect(normalizeCity('Katowice')).toBe('Katowice')
    expect(normalizeCity('Szczecin')).toBe('Szczecin')
    expect(normalizeCity('Lublin')).toBe('Lublin')
    expect(normalizeCity('Sopot')).toBe('Sopot')
    expect(normalizeCity('Gdynia')).toBe('Gdynia')
  })

  it('handles null/undefined/empty input', () => {
    expect(normalizeCity(null)).toBe(null)
    expect(normalizeCity(undefined)).toBe(undefined)
    expect(normalizeCity('')).toBe('')
  })
})

describe('normalizeDiacritics', () => {
  it('strips Polish lowercase diacritics', () => {
    expect(normalizeDiacritics('ą')).toBe('a')
    expect(normalizeDiacritics('ć')).toBe('c')
    expect(normalizeDiacritics('ę')).toBe('e')
    expect(normalizeDiacritics('ł')).toBe('l')
    expect(normalizeDiacritics('ń')).toBe('n')
    expect(normalizeDiacritics('ó')).toBe('o')
    expect(normalizeDiacritics('ś')).toBe('s')
    expect(normalizeDiacritics('ź')).toBe('z')
    expect(normalizeDiacritics('ż')).toBe('z')
  })

  it('strips Polish uppercase diacritics', () => {
    expect(normalizeDiacritics('Ą')).toBe('A')
    expect(normalizeDiacritics('Ć')).toBe('C')
    expect(normalizeDiacritics('Ę')).toBe('E')
    expect(normalizeDiacritics('Ł')).toBe('L')
    expect(normalizeDiacritics('Ń')).toBe('N')
    expect(normalizeDiacritics('Ó')).toBe('O')
    expect(normalizeDiacritics('Ś')).toBe('S')
    expect(normalizeDiacritics('Ź')).toBe('Z')
    expect(normalizeDiacritics('Ż')).toBe('Z')
  })

  it('normalizes full Polish words', () => {
    expect(normalizeDiacritics('Kraków')).toBe('Krakow')
    expect(normalizeDiacritics('Gdańsk')).toBe('Gdansk')
    expect(normalizeDiacritics('Wrocław')).toBe('Wroclaw')
    expect(normalizeDiacritics('Łódź')).toBe('Lodz')
    expect(normalizeDiacritics('Białystok')).toBe('Bialystok')
  })

  it('normalizes Polish addresses', () => {
    expect(normalizeDiacritics('ul. Świętokrzyska 12')).toBe('ul. Swietokrzyska 12')
    expect(normalizeDiacritics('Żółta 5, Łódź')).toBe('Zolta 5, Lodz')
  })

  it('passes through non-diacritical text unchanged', () => {
    expect(normalizeDiacritics('Hello World')).toBe('Hello World')
    expect(normalizeDiacritics('123 Main St')).toBe('123 Main St')
    expect(normalizeDiacritics('')).toBe('')
  })

  it('handles mixed content', () => {
    expect(normalizeDiacritics('Café in Kraków')).toBe('Cafe in Krakow')
  })

  it('is idempotent — applying twice gives same result', () => {
    const input = 'Kraków Gdańsk Łódź'
    const once = normalizeDiacritics(input)
    const twice = normalizeDiacritics(once)
    expect(twice).toBe(once)
  })

  it('handles null/undefined gracefully', () => {
    expect(normalizeDiacritics(null)).toBe(null)
    expect(normalizeDiacritics(undefined)).toBe(undefined)
    expect(normalizeDiacritics('')).toBe('')
  })
})

describe('CITY_MAP', () => {
  it('is exported and contains expected entries', () => {
    expect(CITY_MAP).toBeDefined()
    expect(typeof CITY_MAP).toBe('object')
    expect(CITY_MAP['kraków']).toBe('Krakow')
    expect(CITY_MAP['warszawa']).toBe('Warsaw')
  })
})
