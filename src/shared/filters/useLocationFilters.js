/**
 * useLocationFilters — single read/write API for the URL-driven filter state.
 *
 * References:
 *   - Spec: .kiro/specs/data-loading-architecture/design.md (Section 3.2)
 *   - Requirements: R2.1, R2.2, R2.5, R2.6, R10.2, R11.2, R11.5
 *   - Phase: 2 — URL-Driven Filters
 *
 * Composition:
 *   This hook is a thin React adapter over the pure helpers in
 *   `locationFilterEncoding.js` (task 2.2). All canonicalisation,
 *   normalisation and key-derivation lives in that module — this file only
 *   wires it to `react-router-dom`'s `useSearchParams()` / `useParams()` and
 *   exposes stable writers `setFilter` / `setFilters` / `resetFilters`.
 *
 * Read path:
 *   1. `useSearchParams()` provides the URL searchParams (source of truth).
 *   2. `useParams()` provides the route segments (`:country`, `:city`) which
 *      take precedence over searchParams when present (R2.6).
 *   3. `decodeFilters(...)` converts URL → canonical filter shape.
 *   4. `canonicalize(...)` re-asserts the canonical shape and folds in
 *      the hook-driven `adminScope` flag (R10.2 — not URL-serialised).
 *   5. `toQueryKey(...)` produces a stable React Query key tuple.
 *
 * Write path (R11.5 — normalisation runs on both read AND write):
 *   - `setFilters(partial)` merges with the current canonical filters,
 *     re-canonicalises, encodes via `encodeFilters` and calls
 *     `setSearchParams(next, { replace: true })` to keep history clean
 *     (R2.2). When the route currently exposes `country`/`city` as path
 *     segments AND the partial mutates either of them, the hook also
 *     navigates to `/explore/<country>/<city>?<rest>` so the route
 *     segments and searchParams stay consistent (R2.6).
 *   - `setFilter(key, value)` is a 1-key shorthand for `setFilters`.
 *   - `resetFilters()` clears all searchParams without navigating away
 *     from the current route — on `/explore/:country/:city` the path
 *     segments are intentionally preserved (the user stays in the city
 *     they were exploring; only the optional filters are cleared).
 *
 * @see src/shared/filters/locationFilterEncoding.js — pure helpers
 * @see src/__tests__/properties/filter-idempotence.property.test.js — P2
 */

import { useCallback, useMemo, useState } from 'react'
import {
    useSearchParams,
    useParams,
    useNavigate,
} from 'react-router-dom'

import {
    canonicalize,
    decodeFilters,
    encodeFilters,
    toQueryKey,
    asAPIFilters as asAPIFiltersImpl,
} from './locationFilterEncoding'
import {
    normalizeCityName,
    normalizeCountryName,
} from '@/utils/normalizeCityName'

// ─── Internal slug helpers ─────────────────────────────────────────────────
// These mirror the slug rules used by `encodeFilters(... , { countryCity:
// 'searchParams' })` so the hook can build a `/explore/<country>/<city>?…`
// path when route segments are involved (R2.6). The helpers fold the input
// through the city/country normalisers first to guarantee idempotent slugs
// regardless of user-facing input form.

/**
 * @param {string | null | undefined} city
 * @returns {string | null}
 */
function citySlug(city) {
    const canonical = normalizeCityName(city)
    if (!canonical) return null
    return canonical.toLowerCase().replace(/\s+/g, '-')
}

/**
 * @param {string | null | undefined} country
 * @returns {string | null}
 */
function countrySlug(country) {
    const canonical = normalizeCountryName(country)
    if (!canonical) return null
    return canonical.toLowerCase().replace(/\s+/g, '-')
}

// ─── Public hook ───────────────────────────────────────────────────────────

/**
 * @typedef {import('./locationFilterEncoding.types').LocationFilters} LocationFilters
 *
 * @typedef {Object} UseLocationFiltersResult
 * @property {LocationFilters} filters                       Canonical, normalised filter shape.
 * @property {<K extends keyof LocationFilters>(key: K, value: LocationFilters[K]) => void} setFilter
 *   Set a single filter parameter; routes through `setFilters` so the same
 *   normalisation contract applies.
 * @property {(partial: Partial<LocationFilters>) => void} setFilters
 *   Merge `partial` into the current filter set, normalise, encode, and
 *   write to the URL.
 * @property {() => void} resetFilters
 *   Clear all searchParams. Route segments are preserved.
 * @property {readonly unknown[]} queryKey
 *   Stable React Query key tuple via `toQueryKey(filters)`.
 * @property {() => Record<string, unknown>} asAPIFilters
 *   Translate the current canonical filter set to the legacy
 *   `LocationsAPIFilterShape` consumed by `getLocations` /
 *   `getLocationsInBounds` in `locations.api.js`.
 */

/**
 * @param {{ adminScope?: boolean }} [opts]
 * @returns {UseLocationFiltersResult}
 */
export function useLocationFilters(opts = {}) {
    const adminScopeOpt = opts.adminScope === true
    const [searchParams, setSearchParams] = useSearchParams()
    const params = useParams()
    const navigate = useNavigate()

    // `adminScope` is hook-driven — it is NOT URL-serialised by design
    // (R10.2). The hook MAY also be flipped via `setFilters({ adminScope })`
    // by a consumer that wants a transient escalation; that consumer-driven
    // value lives in local state and is folded over the option default.
    const [adminScopeState, setAdminScopeState] = useState(adminScopeOpt)
    const adminScope = adminScopeOpt || adminScopeState

    // Detect route shape:
    //   - `/explore/:country` or `/explore/:country/:city` ⇒ country lives in
    //     the path. The `useParams()` call returns `country` for both.
    //   - `/explore/:country/:city` ⇒ city ALSO lives in the path. We only
    //     issue a `navigate('/explore/...')` when both segments are present
    //     so that we never accidentally pull a consumer that is on `/`,
    //     `/dashboard`, `/admin/locations`, etc. into the explore route.
    const onCityRoute = Boolean(params.country && params.city)

    // ─── Read path ─────────────────────────────────────────────────────────
    // `searchParams.toString()` is the stable identity used by react-router;
    // memoising over it (rather than the `searchParams` object identity)
    // avoids redundant work when the underlying URL has not changed.
    const searchParamsKey = searchParams.toString()
    const filters = useMemo(() => {
        const decoded = decodeFilters(searchParams, {
            country: params.country ?? null,
            city: params.city ?? null,
        })
        return /** @type {LocationFilters} */ (
            canonicalize({ ...decoded, adminScope })
        )
    }, [searchParamsKey, params.country, params.city, adminScope])

    const queryKey = useMemo(() => toQueryKey(filters), [filters])

    // ─── Write path ────────────────────────────────────────────────────────
    const setFilters = useCallback(
        /** @param {Partial<LocationFilters>} partial */
        (partial) => {
            // Track adminScope locally — it is not URL-serialised.
            if (
                partial &&
                Object.prototype.hasOwnProperty.call(partial, 'adminScope')
            ) {
                setAdminScopeState(partial.adminScope === true)
            }

            const merged = canonicalize({ ...filters, ...partial })

            // When the consumer is on `/explore/:country/:city`, country and
            // city live in the route segments — encode them OUT of the
            // searchParams so we don't double-emit the same data.
            const mode = onCityRoute ? 'route' : 'searchParams'
            const nextParams = encodeFilters(merged, { countryCity: mode })

            // Detect whether this write changes the city/country dimension —
            // only those mutations should redirect. Plain filter toggles must
            // stay on the same path (R2.6).
            const partialTouchesCountry =
                Boolean(partial) &&
                Object.prototype.hasOwnProperty.call(partial, 'country')
            const partialTouchesCity =
                Boolean(partial) &&
                Object.prototype.hasOwnProperty.call(partial, 'city')

            if (
                onCityRoute &&
                (partialTouchesCountry || partialTouchesCity)
            ) {
                const cSlug = countrySlug(merged.country)
                const ciSlug = citySlug(merged.city)
                if (cSlug && ciSlug) {
                    const qs = nextParams.toString()
                    navigate(
                        `/explore/${cSlug}/${ciSlug}${qs ? `?${qs}` : ''}`,
                        { replace: true },
                    )
                    return
                }
                // If country/city was nulled out, fall through to a plain
                // searchParams write. The host route will then no longer
                // satisfy `/explore/:country/:city`, but we don't navigate
                // away on the consumer's behalf — the consumer page can
                // decide how to handle a city-less explore URL.
            }

            // Plain searchParams write — keeps history clean (R2.2).
            setSearchParams(nextParams, { replace: true })
        },
        [filters, onCityRoute, navigate, setSearchParams],
    )

    const setFilter = useCallback(
        /**
         * @template {keyof LocationFilters} K
         * @param {K} key
         * @param {LocationFilters[K]} value
         */
        (key, value) => {
            setFilters({ [key]: value })
        },
        [setFilters],
    )

    const resetFilters = useCallback(() => {
        // Reset adminScope to the option default — the consumer hook-opt
        // wins on next render via `useMemo` re-derivation.
        setAdminScopeState(adminScopeOpt)
        setSearchParams(new URLSearchParams(), { replace: true })
    }, [setSearchParams, adminScopeOpt])

    const asAPIFilters = useCallback(
        () => asAPIFiltersImpl(filters),
        [filters],
    )

    return {
        filters,
        setFilter,
        setFilters,
        resetFilters,
        queryKey,
        asAPIFilters,
    }
}

export default useLocationFilters
