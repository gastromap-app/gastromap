import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/shared/config/queryClient'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import SmoothScroll from '@/components/ui/smooth-scroll'
import { RealtimeSubscriber } from '@/shared/components/RealtimeSubscriber'

/**
 * AppProviders — top-level context tree.
 *
 * Order matters:
 * 1. ErrorBoundary  — catches everything below
 * 2. BrowserRouter  — routing context
 * 3. QueryClient    — server-state cache
 * 4. RealtimeSubscriber - listens to DB changes to update cache
 * 5. SmoothScroll   — Lenis wrapper
 */
export const AppProviders = ({ children, includeRouter = true }) => {
    const content = (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <RealtimeSubscriber />
                <SmoothScroll>
                    {children}
                </SmoothScroll>
            </QueryClientProvider>
        </ErrorBoundary>
    )

    if (includeRouter) {
        return (
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                {content}
            </BrowserRouter>
        )
    }

    return content
}
