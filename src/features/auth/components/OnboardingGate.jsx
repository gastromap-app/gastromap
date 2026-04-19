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
 * - Only if favoriteCuisines is still empty (never set / never completed)
 * - OnboardingFlow owns all data-saving; onComplete() just closes the gate
 *
 * "Never show again" guarantee: OnboardingFlow always saves
 * favoriteCuisines with length > 0 (uses ['any'] as the skip marker).
 */
export function OnboardingGate({ children }) {
    const { isAuthenticated, user } = useAuthStore()
    const { prefs, resetPrefs } = useUserPrefsStore()

    const [showOnboarding, setShowOnboarding] = useState(false)

    // Reset stale prefs when the user identity changes (logout / account switch)
    const prevUserIdRef = React.useRef(null)
    // Guard: once triggered in this session, don't show again even if deps re-fire
    const hasTriggeredRef = React.useRef(false)

    useEffect(() => {
        const currentId = user?.id ?? null
        if (prevUserIdRef.current !== null && prevUserIdRef.current !== currentId) {
            // User switched — reset both prefs and the session guard
            resetPrefs()
            hasTriggeredRef.current = false
        }
        prevUserIdRef.current = currentId
    }, [user?.id, resetPrefs])

    useEffect(() => {
        if (isAuthenticated && prefs.favoriteCuisines.length === 0 && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true
            // Small delay so the app layout renders first
            const t = setTimeout(() => setShowOnboarding(true), 600)
            return () => clearTimeout(t)
        }
    }, [isAuthenticated, prefs.favoriteCuisines.length])

    // OnboardingFlow is solely responsible for saving prefs.
    // We just close the gate here — no updatePrefs to avoid stale-closure overwrites.
    const handleComplete = () => {
        setShowOnboarding(false)
    }

    return (
        <>
            {children}
            {showOnboarding && <OnboardingFlow onComplete={handleComplete} />}
        </>
    )
}
