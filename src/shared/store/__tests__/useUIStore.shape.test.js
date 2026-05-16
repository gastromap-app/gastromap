/**
 * Guard #1 — `useUIStore` shape is the closed set (R1.2, R2.4).
 *
 * The UI store MUST NOT cache server-owned `locations` data nor any
 * filter parameter. It is allowed to hold ephemeral UI flags only.
 *
 * Forbidden field-name patterns (R1.2):
 *   /^(locations|filtered|markers|categor|price|vibe|rating|radius|
 *      sort|city|country|isOpenNow|searchQuery|currentBounds|userLocation)/i
 *
 * Allowed today: `isHeaderScrolled` (+ its setter).
 * Phase 3 task 3.10 adds `lastMapPose`, `lastScrollPositions` and the
 * relevant setters; this test will be extended at that point. For now,
 * the closed set is asserted exactly so any accidental drift fails CI.
 *
 * @see .kiro/specs/data-loading-architecture/design.md
 *      Section "Components and Interfaces / UI Store reduction"
 */

import { describe, it, expect } from 'vitest'
import { useUIStore } from '@/shared/store/useUIStore'

const FORBIDDEN_KEY_RX =
    /^(locations|filtered|markers|categor|price|vibe|rating|radius|sort|city|country|isOpenNow|searchQuery|currentBounds|userLocation)/i

describe('useUIStore shape (Guard #1)', () => {
    it('contains exactly the allow-listed UI keys', () => {
        const state = useUIStore.getState()
        const keys = Object.keys(state).sort()

        // Allow-list: ephemeral UI state only (R1.2).
        const ALLOWED_KEYS = [
            'isHeaderScrolled',
            'lastMapPose',
            'lastScrollPositions',
            'resetUI',
            'setHeaderScrolled',
            'setLastMapPose',
            'setScrollPosition',
        ].sort()

        expect(keys).toEqual(ALLOWED_KEYS)
    })

    it('has no key matching forbidden server-data / filter patterns', () => {
        const keys = Object.keys(useUIStore.getState())
        const offenders = keys.filter((k) => FORBIDDEN_KEY_RX.test(k))
        expect(offenders).toEqual([])
    })
})
