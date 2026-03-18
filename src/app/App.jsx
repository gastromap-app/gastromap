import React from 'react'
import { AppProviders } from './providers/AppProviders'
import { AppRouter } from './router/AppRouter'
import ReloadPrompt from '@/components/pwa/ReloadPrompt'
import { OnboardingGate } from '@/features/auth/components/OnboardingGate'

const App = ({ includeRouter = true }) => {
    return (
        <AppProviders includeRouter={includeRouter}>
            <OnboardingGate>
                <AppRouter />
            </OnboardingGate>
            <ReloadPrompt />
        </AppProviders>
    )
}

export default App
