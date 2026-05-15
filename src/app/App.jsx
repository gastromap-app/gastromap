import React, { useEffect } from 'react'
import { AppProviders } from './providers/AppProviders'
import { AppRouter } from './router/AppRouter'
import ReloadPrompt from '@/components/pwa/ReloadPrompt'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator'
import { OnboardingGate } from '@/features/auth/components/OnboardingGate'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useAuthStore } from '@/shared/store/useAuthStore'

/** Inline error banner — shows when location data fails to load */
const InitErrorBanner = () => {
    const initError = useLocationsStore(s => s.initError)
    const reinitialize = useLocationsStore(s => s.reinitialize)
    if (!initError) return null
    return (
        <div role="alert" className="bg-red-600 text-white text-sm px-4 py-2 flex items-center justify-between gap-3 z-50">
            <span>Failed to load locations: {initError}</span>
            <button
                onClick={reinitialize}
                className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-xs font-semibold whitespace-nowrap"
            >
                Retry
            </button>
        </div>
    )
}

const App = ({ includeRouter = true }) => {
    const initialize = useLocationsStore(s => s.initialize)
    const subscribeToRealtime = useLocationsStore(s => s.subscribeToRealtime)
    const initAuth = useAuthStore(s => s.initAuth)
    const isAuthLoading = useAuthStore(s => s.isLoading)

    // Step 1: Restore auth session
    useEffect(() => {
        initAuth()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Step 2: Load locations AFTER auth is ready (avoids RLS race condition)
    useEffect(() => {
        if (!isAuthLoading) {
            initialize()
        }
    }, [isAuthLoading]) // eslint-disable-line react-hooks/exhaustive-deps

    // Step 3: Subscribe to Realtime updates for locations table.
    // Wait until auth is resolved — Supabase Realtime drops the WebSocket
    // immediately if the anon role is blocked by RLS on postgres_changes.
    useEffect(() => {
        if (isAuthLoading) return // auth not settled yet
        const unsubscribe = subscribeToRealtime()
        return () => { unsubscribe() }
    }, [isAuthLoading]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <AppProviders includeRouter={includeRouter}>
            <InitErrorBanner />
            <OfflineIndicator />

            <OnboardingGate>
                <AppRouter />
            </OnboardingGate>

            <ReloadPrompt />
            <InstallPrompt />
        </AppProviders>
    )
}

export default App
