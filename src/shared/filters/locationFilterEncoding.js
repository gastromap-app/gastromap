/**
 * locationFilterEncoding.js — pure encode/decode helpers for the URL-driven
 * filter state used by the data-loading-architecture migration (Phase 2).
 *
 * References:
 *   - Spec: .kiro/specs/data-loading-architecture/design.md (Section 3.2 + Section 5)
 *   - Requirements: R2.1, R2.3, R11.2, R11.3, R11.5
 *
 * Responsibilities:
 *   - Canonicalise the in-memory `LocationFilters` shape:
 *     · sort array filters,
 *     · normalise `city` / `country` via `normalizeCityName` / `normalizeCountryName`,
 *     · trim + lowercase `searchQuery`,
 *     · round `minRating` to one decimal place,
 *     · round `bounds` to 4 decimal places (≈ 11 m).
 *   - Provide `toQueryKey(filters)` — a stable React Query key producer.
 *   - Provide `encodeFilters(filters, opts)` → `URLSearchParams`.
 *   - Provide `decodeFilters(urlSearchParams, routeParams)` → `LocationFilters`.
 *   - Provide `asAPIFilters(filters)` → the existing `LocationsAPIFilterShape`
 *     consumed by `getLocations` in `locations.api.js` (backward-compat).
 *
 * Constraints (R2):
 *   - PURE FUNCTIONS ONLY. No React imports. No `react-router-dom` imports.
 *     This module is consumed by both the `useLocationFilters` hook (task 2.3)
 *     and by tests / utilities that must not depend on a React renderer.
 *
 * Output stability:
 *   - Every returned object's keys are inserted in alphabetical order so that
 *     `JSON.stringify(canonicalize(F))` is deterministic across calls. This is
 *     what makes `toQueryKey(F)` bitwise stable and what `Filter_Idempotence`
 *     (P2) asserts.
 */

import { normalizeCityName, normalizeCountryName } from '@/utils/normalizeCityName'

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Canonical default value for every `LocationFilters` field.
 * `dropDefaults()` elides any field whose canonicalised value matches its entry
 * here, which keeps the React Query key stable regardless of whether the caller
 * passed `{}` or `{ categories: [] }`.
 *
 * @type {Readonly<{
 *   adminScope: boolean,
 *   categories: string[],
 *   city: string | null,
 *   country: string | null,
 *   isOpenNow: boolean,
 *   minRating: number | null,
 *   priceLevels: string[],
 *   radius: number,
 *   searchQuery: string,
 *   sortBy: string,
 *   vibes: string[],
 * }>}
 */
export const DEFAULTS = Object.freeze({
    adminScope: false,
    categories: [],
    city: null,
    country: null,
    isOpenNow: false,
    minRating: null,
    priceLevels: [],
    radius: 0,
    searchQuery: '',
    sortBy: 'google_rating',
    vibes: [],
})

/**
 * Whitelist of accepted `sortBy` values (design Section 3.2). Any value
 * outside this list is folded back to the default `'google_rating'`.
 */
const SORT_KEYS = Object.freeze([
    'google_rating',
    'newest',
    'name',
    'price_asc',
    'price_desc',
    'trending',
    'recommended',
    'distance',
])

/** Whitelist of accepted price-level tokens (design Section 3.2). */
const PRICE_LEVELS = Object.freeze(['$', '$$', '$$$'])

// ─── Internal helpers (NOT exported) ───────────────────────────────────────

/**
 * Build a URL slug from a canonical city name.
 * Returns `null` when the input cannot be normalised.
 *
 * @param {string | null | undefined} city
 * @returns {string | null}
 */
function citySlug(city) {
    const canonical = normalizeCityName(city)
    if (!canonical) return null
    return canonical.toLowerCase().replace(/\s+/g, '-')
}

/**
 * Build a URL slug from a canonical country name.
 *
 * @param {string | null | undefined} country
 * @returns {string | null}
 */
function countrySlug(country) {
    const canonical = normalizeCountryName(country)
    if (!canonical) return null
    return canonical.toLowerCase().replace(/\s+/g, '-')
}

/**
 * Decode a URL slug back to a human-readable form so `normalizeCityName` /
 * `normalizeCountryName` can fold it to the canonical English name.
 * Handles `null` / empty input gracefully.
 *
 * @param {string | null | undefined} slug
 * @returns {string | null}
 */
function parseSlug(slug) {
    if (!slug || typeof slug !== 'string') return null
    let decoded
    try {
        decoded = decodeURIComponent(slug)
    } catch {
        decoded = slug
    }
    return decoded.replace(/-/g, ' ').trim() || null
}

/**
 * Round a `bounds` rectangle to 4 decimal places per axis (≈ 11 m at the
 * equator). This keeps micro-pan within a tile from busting the React Query
 * cache (R8.5).
 *
 * @param {{ sw: { lat: number, lng: number }, ne: { lat: number, lng: number } }} bounds
 * @returns {{ sw: { lat: number, lng: number }, ne: { lat: number, lng: number } }}
 */
function roundBounds(bounds) {
    const round4 = (n) => Math.round(n * 10000) / 10000
    return {
        ne: { lat: round4(bounds.ne.lat), lng: round4(bounds.ne.lng) },
        sw: { lat: round4(bounds.sw.lat), lng: round4(bounds.sw.lng) },
    }
}

/**
 * Build a NEW object whose keys are inserted in alphabetical order. This makes
 * `JSON.stringify` deterministic which in turn keeps React Query keys stable.
 *
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function withSortedKeys(obj) {
    /** @type {Record<string, unknown>} */
    const out = {}
    for (const key of Object.keys(obj).sort()) {
        out[key] = /** @type {Record<string, unknown>} */ (obj)[key]
    }
    return /** @type {T} */ (out)
}

/**
 * Drop fields whose canonical value equals the default. Bounds and any other
 * extension field that has no entry in `DEFAULTS` is preserved as-is.
 *
 * @param {Record<string, unknown>} canonical
 * @returns {Record<string, unknown>}
 */
function dropDefaults(canonical) {
    /** @type {Record<string, unknown>} */
    const out = {}
    for (const key of Object.keys(canonical).sort()) {
        if (!(key in DEFAULTS)) {
            // Extension fields (e.g. `bounds`) are kept verbatim — they have
            // no default and exist only when explicitly provided.
            out[key] = canonical[key]
            continue
        }
        const defaultJSON = JSON.stringify(/** @type {Record<string, unknown>} */ (DEFAULTS)[key])
        const valueJSON = JSON.stringify(canonical[key])
        if (defaultJSON !== valueJSON) {
            out[key] = canonical[key]
        }
    }
    return out
}

// ─── Canonicalisation ──────────────────────────────────────────────────────

/**
 * Normalise an arbitrary `Partial<LocationFilters>` (plus optional `bounds`)
 * into the canonical shape used everywhere downstream. Every field is filled
 * in from `DEFAULTS` when absent.
 *
 * @param {Partial<import('./locationFilterEncoding.types').LocationFilters> & { bounds?: object }} [filters]
 * @returns {Record<string, unknown>}
 */
export function canonicalize(filters = {}) {
    const merged = { ...DEFAULTS, ...filters }

    // Categories: sort ascending; preserve case (the API is case-sensitive
    // for category strings such as 'Cafe' vs 'cafe').
    const categories = Array.isArray(merged.categories)
        ? [...merged.categories]
            .filter((c) => typeof c === 'string' && c.length > 0)
            .sort()
        : []

    // Price levels: sort ascending; whitelist to ['$', '$$', '$$$'].
    const priceLevels = Array.isArray(merged.priceLevels)
        ? [...merged.priceLevels]
            .filter((p) => PRICE_LEVELS.includes(p))
            .sort()
        : []

    // Vibes: lowercase + sort ascending.
    const vibes = Array.isArray(merged.vibes)
        ? [...merged.vibes]
            .filter((v) => typeof v === 'string' && v.length > 0)
            .map((v) => v.toLowerCase())
            .sort()
        : []

    // City / country: fold to canonical English form (R11.2, R11.5).
    const city = merged.city ? normalizeCityName(merged.city) : null
    const country = merged.country ? normalizeCountryName(merged.country) : null

    // searchQuery: trim + lowercase. '' is the default.
    const searchQuery = String(merged.searchQuery ?? '').trim().toLowerCase()

    // minRating: round to one decimal place. null preserved.
    const minRating =
        merged.minRating == null || !Number.isFinite(Number(merged.minRating))
            ? null
            : Math.round(Number(merged.minRating) * 10) / 10

    // radius: integer km; clamp negatives and NaN to 0.
    const radius =
        Number.isFinite(Number(merged.radius)) && Number(merged.radius) > 0
            ? Math.trunc(Number(merged.radius))
            : 0

    // sortBy: whitelist.
    const sortBy = SORT_KEYS.includes(merged.sortBy) ? merged.sortBy : 'google_rating'

    // adminScope: boolean.
    const adminScope = Boolean(merged.adminScope)

    // isOpenNow: boolean.
    const isOpenNow = Boolean(merged.isOpenNow)

    /** @type {Record<string, unknown>} */
    const out = {
        adminScope,
        categories,
        city,
        country,
        isOpenNow,
        minRating,
        priceLevels,
        radius,
        searchQuery,
        sortBy,
        vibes,
    }

    // Optional `bounds` extension — not part of the standard URL shape, but
    // accepted as an override (used by `useLocationsInBounds` in Phase 3).
    if (
        merged.bounds &&
        typeof merged.bounds === 'object' &&
        merged.bounds.sw &&
        merged.bounds.ne &&
        Number.isFinite(merged.bounds.sw.lat) &&
        Number.isFinite(merged.bounds.sw.lng) &&
        Number.isFinite(merged.bounds.ne.lat) &&
        Number.isFinite(merged.bounds.ne.lng)
    ) {
        out.bounds = roundBounds(merged.bounds)
    }

    return withSortedKeys(out)
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Produce a frozen React Query key tuple for a filter set. Two consecutive
 * invocations with the same input produce structurally equal tuples
 * (`Filter_Idempotence`, R20.2).
 *
 * Shape: `['locations', 'filtered', minimalCanonicalFilters]`
 *
 * The third element only contains fields that differ from `DEFAULTS`, so
 * `toQueryKey({})` and `toQueryKey({ categories: [] })` produce the same key.
 *
 * @param {Partial<import('./locationFilterEncoding.types').LocationFilters>} [filters]
 * @returns {readonly ['locations', 'filtered', Record<string, unknown>]}
 */
export function toQueryKey(filters = {}) {
    const canonical = canonicalize(filters)
    const minimal = dropDefaults(canonical)
    return Object.freeze(/** @type {const} */ (['locations', 'filtered', minimal]))
}

/**
 * Encode a filter set into a `URLSearchParams` instance using the rules table
 * in design Section 3.2.
 *
 * `country` and `city` are emitted as `country=<slug>` / `city=<slug>` ONLY
 * when `opts.countryCity === 'searchParams'` (default). When the caller is on
 * `/explore/:country/:city`, it should pass `opts.countryCity = 'route'` so
 * that those two fields live in the route segments instead.
 *
 * @param {Partial<import('./locationFilterEncoding.types').LocationFilters>} [filters]
 * @param {{ countryCity?: 'searchParams' | 'route' }} [opts]
 * @returns {URLSearchParams}
 */
export function encodeFilters(filters = {}, opts = {}) {
    const { countryCity = 'searchParams' } = opts
    const canonical = canonicalize(filters)
    const params = new URLSearchParams()

    if (countryCity === 'searchParams') {
        if (canonical.country) {
            const slug = countrySlug(canonical.country)
            if (slug) params.set('country', slug)
        }
        if (canonical.city) {
            const slug = citySlug(canonical.city)
            if (slug) params.set('city', slug)
        }
    }

    if (Array.isArray(canonical.categories) && canonical.categories.length > 0) {
        params.set('cats', canonical.categories.join(','))
    }
    if (Array.isArray(canonical.priceLevels) && canonical.priceLevels.length > 0) {
        params.set('price', canonical.priceLevels.join(','))
    }
    if (Array.isArray(canonical.vibes) && canonical.vibes.length > 0) {
        params.set('vibes', canonical.vibes.join(','))
    }
    if (canonical.minRating != null) {
        params.set('r', String(canonical.minRating))
    }
    if (typeof canonical.radius === 'number' && canonical.radius > 0) {
        params.set('radius', String(canonical.radius))
    }
    if (canonical.sortBy && canonical.sortBy !== 'google_rating') {
        params.set('sort', String(canonical.sortBy))
    }
    if (canonical.isOpenNow === true) {
        params.set('open', '1')
    }
    if (typeof canonical.searchQuery === 'string' && canonical.searchQuery !== '') {
        // URLSearchParams handles percent-encoding internally — pass the raw
        // trimmed/lowercased query and it will encode it on serialisation.
        params.set('q', canonical.searchQuery)
    }

    // `adminScope` is intentionally NOT URL-serialised. It is passed via the
    // `useLocationFilters({ adminScope: true })` hook option.

    return params
}

/**
 * Decode a `URLSearchParams` (and optional `useParams()` route segments) into
 * a canonical `LocationFilters` value. Missing fields fall back to defaults.
 *
 * Route segments take precedence over search params for `country` / `city` —
 * which matches the behaviour expected on `/explore/:country/:city`.
 *
 * @param {URLSearchParams | { get: (key: string) => string | null } | null | undefined} searchParams
 * @param {{ country?: string | null, city?: string | null }} [routeParams]
 * @returns {import('./locationFilterEncoding.types').LocationFilters}
 */
export function decodeFilters(searchParams, routeParams = {}) {
    const get = (key) => {
        if (!searchParams || typeof searchParams.get !== 'function') return null
        const value = searchParams.get(key)
        return value == null ? null : value
    }

    // Country / city — route segments win when present.
    const countryRaw = routeParams.country ?? get('country')
    const cityRaw = routeParams.city ?? get('city')
    const country = countryRaw ? normalizeCountryName(parseSlug(countryRaw)) : null
    const city = cityRaw ? normalizeCityName(parseSlug(cityRaw)) : null

    // Comma-joined arrays.
    const cats = get('cats')
    const categories = cats
        ? cats.split(',').map((s) => s.trim()).filter(Boolean).sort()
        : []

    const price = get('price')
    const priceLevels = price
        ? price
            .split(',')
            .map((s) => s.trim())
            .filter((s) => PRICE_LEVELS.includes(s))
            .sort()
        : []

    const vibesRaw = get('vibes')
    const vibes = vibesRaw
        ? vibesRaw
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
            .sort()
        : []

    // Numeric filters.
    const r = get('r')
    const rNum = r == null ? NaN : Number(r)
    const minRating = Number.isFinite(rNum)
        ? Math.round(rNum * 10) / 10
        : null

    const radiusRaw = get('radius')
    const radiusInt = radiusRaw == null ? 0 : parseInt(radiusRaw, 10)
    const radius = Number.isFinite(radiusInt) && radiusInt > 0 ? radiusInt : 0

    // Enum + boolean filters.
    const sortRaw = get('sort')
    const sortBy = SORT_KEYS.includes(sortRaw) ? sortRaw : 'google_rating'

    const open = get('open')
    const isOpenNow = open === '1'

    const q = get('q')
    const searchQuery = typeof q === 'string' ? q.trim() : ''

    // Build object with alphabetical keys for stability.
    return /** @type {import('./locationFilterEncoding.types').LocationFilters} */ (
        withSortedKeys({
            adminScope: false,
            categories,
            city,
            country,
            isOpenNow,
            minRating,
            priceLevels,
            radius,
            searchQuery,
            sortBy,
            vibes,
        })
    )
}

/**
 * Translate a canonical filter set into the `LocationsAPIFilterShape` consumed
 * by `getLocations(filters, { isAuthed })` in `locations.api.js`. The legacy
 * API only accepts a single `category` token, so we emit the first entry from
 * the sorted `categories` array for backward-compat.
 *
 * The returned object's keys are inserted in alphabetical order so that
 * `asAPIFilters(F)` is bitwise stable across invocations on the same input.
 *
 * @param {Partial<import('./locationFilterEncoding.types').LocationFilters> & { bounds?: object }} [filters]
 * @returns {Record<string, unknown>}
 */
export function asAPIFilters(filters = {}) {
    const canonical = canonicalize(filters)

    /** @type {Record<string, unknown>} */
    const out = {
        all: canonical.adminScope,
        category:
            Array.isArray(canonical.categories) && canonical.categories.length > 0
                ? canonical.categories[0]
                : null,
        city: canonical.city,
        country: canonical.country,
        minRating: canonical.minRating,
        price_range: canonical.priceLevels,
        showAll: canonical.adminScope,
        sortBy: canonical.sortBy,
        vibe: canonical.vibes,
    }

    if (typeof canonical.searchQuery === 'string' && canonical.searchQuery !== '') {
        out.query = canonical.searchQuery
    }

    if (canonical.bounds) {
        out.bounds = canonical.bounds
    }

    return withSortedKeys(out)
}
