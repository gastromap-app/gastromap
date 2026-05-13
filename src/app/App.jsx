import React, { useEffect } from 'react'
import { AppProviders } from './providers/AppProviders'
import { AppRouter } from './router/AppRouter'
import ReloadPrompt from '@/components/pwa/ReloadPrompt'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator'
import { OnboardingGate } from '@/features/auth/components/OnboardingGate'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useAuthStore } from '@/shared/store/useAuthStore'

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

    // Step 3: Subscribe to Realtime updates
    useEffect(() => {
        const unsubscribe = subscribeToRealtime()
        return () => { unsubscribe() }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <AppProviders includeRouter={includeRouter}>
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
