import { create } from 'zustand'

/**
 * useUIStore — Transient UI state store.
 *
 * Owns ONLY ephemeral UI memory (R1.2):
 *   - Header scroll state
 *   - Map viewport pose (for back-button restoration, R8.5)
 *   - Per-route scroll positions (for back-button restoration, R9.4)
 *
 * MUST NOT contain: locations, filteredLocations, mapMarkers, currentBounds,
 * userLocation, or any filter parameter (R1.2, R2.4).
 *
 * @see .kiro/specs/data-loading-architecture/design.md Section "UI Store reduction"
 */
export const useUIStore = create((set, get) => ({
    // ─── Header ────────────────────────────────────────────────────────────
    isHeaderScrolled: false,
    setHeaderScrolled: (scrolled) => set({ isHeaderScrolled: scrolled }),

    // ─── Map viewport memory (R8.5) ───────────────────────────────────────
    // Moved from the module-level `let lastMapPose` in MapTab.jsx so that
    // navigating to a detail page and pressing Back restores the exact view.
    lastMapPose: null, // { lat: number, lng: number, zoom: number } | null
    setLastMapPose: (pose) => set({ lastMapPose: pose }),

    // ─── Per-route scroll positions (R9.4) ────────────────────────────────
    // Keyed by `${pathname}${search}` so each filtered view remembers its
    // own scroll offset independently.
    lastScrollPositions: {}, // Record<string, number>
    setScrollPosition: (key, value) => set((state) => ({
        lastScrollPositions: { ...state.lastScrollPositions, [key]: value },
    })),

    // ─── Reset ────────────────────────────────────────────────────────────
    resetUI: () => set({
        isHeaderScrolled: false,
        lastMapPose: null,
        lastScrollPositions: {},
    }),
}))
