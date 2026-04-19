import { useMemo } from 'react'
import { useCuisines } from '@/shared/api/queries'
import { CUISINE_OPTIONS, CUISINE_EMOJI_MAP } from '@/shared/constants/taxonomy'

/**
 * useCuisineOptions
 *
 * Single source of truth for cuisine lists across the app.
 * The Knowledge Graph (Supabase `cuisines` table) is the authoritative source.
 * Falls back to the static CUISINE_OPTIONS list while loading or if KG is empty.
 *
 * Usage:
 *   const { options, isLoading, fromKG } = useCuisineOptions()
 *
 * Each option: { id, name, label, emoji }
 *   id    — KG uuid (from Supabase) or slugified name (fallback)
 *   name  — canonical English name, e.g. "Italian"
 *   label — same as name (alias for UI compatibility)
 *   emoji — derived from CUISINE_EMOJI_MAP, falls back to '🍴'
 *
 * Surfaces that consume this hook:
 *   - OnboardingFlow  (cuisine preference chips)
 *   - LocationFormSlideOver  (cuisine dropdown in admin edit form)
 *   - FilterModal  (cuisine filter chips)
 *
 * To add a new cuisine: add it in the KG admin panel. Optionally add its
 * emoji to CUISINE_EMOJI_MAP in src/shared/constants/taxonomy.js.
 */
export function useCuisineOptions() {
    const { data: kgCuisines = [], isLoading } = useCuisines()

    const options = useMemo(() => {
        const source = kgCuisines.length > 0 ? kgCuisines : null

        if (source) {
            return [...source]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(c => ({
                    id:    c.id,
                    name:  c.name,
                    label: c.name,
                    emoji: CUISINE_EMOJI_MAP[c.name.toLowerCase()] ?? '🍴',
                }))
        }

        // Static fallback — used while KG is loading or empty
        return CUISINE_OPTIONS.map(name => ({
            id:    name.toLowerCase().replace(/\s+/g, '-'),
            name,
            label: name,
            emoji: CUISINE_EMOJI_MAP[name.toLowerCase()] ?? '🍴',
        }))
    }, [kgCuisines])

    return {
        options,
        isLoading,
        /** true when options originate from live KG data (not static fallback) */
        fromKG: kgCuisines.length > 0,
    }
}
