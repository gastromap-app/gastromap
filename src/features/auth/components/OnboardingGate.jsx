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
 * On fresh devices (empty localStorage) we check Supabase first before
 * deciding to show the flow — fixes repeat-onboarding after reinstall (BUG-ON1).
 */
export function OnboardingGate({ children }) {
    const { isAuthenticated, user } = useAuthStore()
    const { prefs, resetPrefs, loadFromSupabase } = useUserPrefsStore()

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
        if (!isAuthenticated || hasTriggeredRef.current) return

        // Local prefs already populated — no onboarding needed
        if (prefs.favoriteCuisines.length > 0) return

        // Local store is empty — check Supabase before showing onboarding
        // (handles fresh-device / reinstall scenario — BUG-ON1)
        hasTriggeredRef.current = true
        loadFromSupabase().then((found) => {
            if (!found) {
                // Truly first time — show onboarding after layout renders
                setTimeout(() => setShowOnboarding(true), 600)
                // Note: no cleanup needed — hasTriggeredRef prevents double-fire
            }
            // If found, prefs store was updated → cuisines.length > 0, gate stays closed
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
