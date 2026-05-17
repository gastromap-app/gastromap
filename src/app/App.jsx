import React, { useEffect } from 'react'
import { AppProviders } from './providers/AppProviders'
import { AppRouter } from './router/AppRouter'
import ReloadPrompt from '@/components/pwa/ReloadPrompt'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator'
import { OnboardingGate } from '@/features/auth/components/OnboardingGate'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { SpeedInsights } from '@vercel/speed-insights/react'

const App = ({ includeRouter = true }) => {
    const initAuth = useAuthStore(s => s.initAuth)

    // Restore auth session on mount
    useEffect(() => {
        initAuth()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <AppProviders includeRouter={includeRouter}>
            <OfflineIndicator />

            <OnboardingGate>
                <AppRouter />
            </OnboardingGate>

            <ReloadPrompt />
            <InstallPrompt />
            <SpeedInsights />
        </AppProviders>
    )
}

export default App
