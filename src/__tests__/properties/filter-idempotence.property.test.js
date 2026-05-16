/**
 * Property test: Filter_Idempotence (P2)
 *
 * Validates: Requirements R2.2, R2.3, R2.6, R11.2, R11.3, R11.5, R20.2
 * Feature: data-loading-architecture
 * Phase: 2 — URL-Driven Filters
 *
 * Two sub-invariants per design Section 5 / R20.2:
 *
 *  1. Pure-function stability: for any LocationFilters value F,
 *     `toQueryKey(F)` is structurally equal across two consecutive
 *     invocations (deep-equal arrays + nested object).
 *
 *  2. Round-trip equivalence: for any LocationFilters value F, applying
 *     `setFilters(F)` to a `useLocationFilters()` hook (rendered inside a
 *     MemoryRouter) updates the URL such that the hook's next `queryKey`
 *     equals `toQueryKey(F)` — the same tuple the pure encoder would
 *     produce for F directly. Each property iteration runs in its own
 *     `renderHook` invocation, so URL state from one iteration cannot leak
 *     into the next.
 *
 *  3. `asAPIFilters` is also bitwise stable across invocations on the same
 *     input — the API-shape emitter must agree with itself.
 *
 * NOTE: This is a test-first property test. The two production modules
 * imported below do NOT yet exist (they land in tasks 2.2 and 2.3). This
 * file is expected to FAIL at module resolution until those tasks land —
 * the same intentional red state used for Property 3 before task 1.2.
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Not-yet-existing production modules. Their absence is the intended
// red state — the test file MUST fail at module resolution until tasks
// 2.2 and 2.3 land.
import { toQueryKey, asAPIFilters } from '@/shared/filters/locationFilterEncoding'
import { useLocationFilters } from '@/shared/filters/useLocationFilters'

// ─── Realistic arbitraries ────────────────────────────────────────────────
// Cities deliberately mix canonical English form, diacritic native form,
// localised native form, and case-shifted variants so the canonicaliser
// (R11.5 normalisation) is forced to fold all of them to the same key.
const cityArb = fc.constantFrom(
    null,
    'Krakow',
    'Kraków',
    'Warsaw',
    'Warszawa',
    'Tbilisi',
    'kraków',
    'WARSAW',
    'gdansk',
    'Gdańsk',
    'Lviv',
    'Львов',
)

const countryArb = fc.constantFrom(
    null,
    'Poland',
    'Polska',
    'Ukraine',
    'Україна',
    'Georgia',
    'Sakartvelo',
)

const categoryArb = fc.constantFrom(
    'Cafe',
    'Restaurant',
    'Bar',
    'Fine Dining',
    'Bakery',
    'Fast Food',
)
const categoriesArb = fc.uniqueArray(categoryArb, { maxLength: 4 })

const priceArb = fc.constantFrom('$', '$$', '$$$')
const priceLevelsArb = fc.uniqueArray(priceArb, { maxLength: 3 })

const vibeArb = fc.constantFrom('cozy', 'lively', 'romantic', 'casual', 'upscale')
const vibesArb = fc.uniqueArray(vibeArb, { maxLength: 3 })

const minRatingArb = fc.option(fc.float({ min: 0, max: 5, noNaN: true }), { nil: null })
const radiusArb = fc.integer({ min: 0, max: 50 })

const sortByArb = fc.constantFrom(
    'google_rating',
    'newest',
    'name',
    'price_asc',
    'price_desc',
    'trending',
    'recommended',
    'distance',
)

const searchQueryArb = fc.string({ maxLength: 32 })

const filtersArb = fc.record({
    country: countryArb,
    city: cityArb,
    categories: categoriesArb,
    priceLevels: priceLevelsArb,
    vibes: vibesArb,
    minRating: minRatingArb,
    radius: radiusArb,
    sortBy: sortByArb,
    isOpenNow: fc.boolean(),
    searchQuery: searchQueryArb,
    adminScope: fc.boolean(),
})

// Wrapper for `useLocationFilters` — the hook reads `useSearchParams` /
// `useParams`, so we render it inside a MemoryRouter starting at a blank
// path with no search params. Each `renderHook` invocation gets its own
// router instance so URL state cannot leak between property iterations.
function Wrapper({ children }) {
    return React.createElement(MemoryRouter, { initialEntries: ['/'] }, children)
}

describe('Filter_Idempotence (P2)', () => {
    it('Feature: data-loading-architecture, Property 2: Filter_Idempotence — toQueryKey is bitwise stable across invocations', () => {
        fc.assert(
            fc.property(filtersArb, (filters) => {
                const a = toQueryKey(filters)
                const b = toQueryKey(filters)
                expect(a).toEqual(b)
            }),
            { numRuns: 100 },
        )
    })

    it('Feature: data-loading-architecture, Property 2: Filter_Idempotence — setFilters round-trip via URL produces the same queryKey as toQueryKey', () => {
        fc.assert(
            fc.property(filtersArb, (F) => {
                const { result, unmount } = renderHook(() => useLocationFilters(), {
                    wrapper: Wrapper,
                })
                act(() => {
                    result.current.setFilters(F)
                })
                const observed = result.current.queryKey
                const expected = toQueryKey(F)
                expect(observed).toEqual(expected)
                unmount()
            }),
            { numRuns: 100 },
        )
    })

    it('Feature: data-loading-architecture, Property 2: Filter_Idempotence — asAPIFilters is bitwise stable across invocations', () => {
        fc.assert(
            fc.property(filtersArb, (filters) => {
                const a = asAPIFilters(filters)
                const b = asAPIFilters(filters)
                expect(a).toEqual(b)
            }),
            { numRuns: 100 },
        )
    })
})
