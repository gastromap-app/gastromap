import { create } from 'zustand'

/**
 * useUIStore - Transient UI state store.
 * Used for coordinating UI elements like global header scroll status.
 */
export const useUIStore = create((set) => ({
    // Global header state
    isHeaderScrolled: false,
    
    // Actions
    setHeaderScrolled: (scrolled) => set({ isHeaderScrolled: scrolled }),
    
    // Reset state
    resetUI: () => set({ isHeaderScrolled: false })
}))
