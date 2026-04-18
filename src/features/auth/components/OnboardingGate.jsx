import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useUserPrefsStore } from '@/shared/store/useUserPrefsStore'
import { OnboardingFlow } from './OnboardingFlow'

/**
 * OnboardingGate — shows OnboardingFlow once after first login,
 * then never again (uses persisted flag in useUserPrefsStore).
 *
 * Rules:
 * - Only shown to authenticated users
 * - Only if favoriteCuisines is still empty (never set)
 * - OnboardingFlow calls onComplete() → sets the flag
 */
export function OnboardingGate({ children }) {
    const { isAuthenticated } = useAuthStore()
    const { prefs, updatePrefs } = useUserPrefsStore()

    // Determine if this is a fresh user (no cuisine preferences set)
    const [showOnboarding, setShowOnboarding] = useState(false)

    useEffect(() => {
        if (isAuthenticated && prefs.favoriteCuisines.length === 0) {
            // Small delay so the app layout renders first
            const t = setTimeout(() => setShowOnboarding(true), 600)
            return () => clearTimeout(t)
        }
    }, [isAuthenticated, prefs.favoriteCuisines.length])

    const handleComplete = () => {
        setShowOnboarding(false)
        // Mark onboarding as done even if user picked nothing (via Skip)
        if (prefs.favoriteCuisines.length === 0) {
            updatePrefs({ favoriteCuisines: ['any'] })
        }
    }

    return (
        <>
            {children}
            {showOnboarding && <OnboardingFlow onComplete={handleComplete} />}
        </>
    )
}
