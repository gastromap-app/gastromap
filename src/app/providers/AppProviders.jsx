import React, { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { queryClient } from '@/shared/config/queryClient'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import SmoothScroll from '@/components/ui/smooth-scroll'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
import { startLocationsRealtime } from '@/shared/api/locationsRealtime'

// Persist React Query cache to localStorage — instant load on return visits.
// Cache survives page reloads and PWA updates → no skeleton flash.
const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: 'GASTROMAP_QUERY_CACHE',
    throttleTime: 1000, // Batch writes to localStorage
})

const persistOptions = {
    persister,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours — cache up to 1 day
    // Bust cache when app version changes (key includes build hash)
    buster: import.meta.env.VITE_BUILD_ID || 'v1',
    // Don't persist failed queries or infinite queries (they have pagination state
    // that doesn't restore cleanly — better to re-fetch fresh on reload)
    dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
            // Persist only successful queries
            if (query.state.status !== 'success') return false
            // Skip infinite queries — they cause stale pagination state on restore
            const queryKey = Array.isArray(query.queryKey) ? query.queryKey : []
            if (queryKey.includes('infinite')) return false
            return true
        },
    },
}

/**
 * AppProviders — top-level context tree.
 *
 * Order matters:
 * 1. ErrorBoundary  — catches everything below
 * 2. BrowserRouter  — routing context
 * 3. QueryClient    — server-state cache
 * 4. SmoothScroll   — Lenis wrapper
 *
 * Also bootstraps Supabase-backed app config on mount so admin
 * settings (AI model, keys, etc.) are never reset by a new deploy.
 */

function AppConfigBootstrap() {
    const loadFromDB = useAppConfigStore((s) => s.loadFromDB)

    useEffect(() => {
        // Load AI config from Supabase — Supabase wins over code defaults
        loadFromDB()
    }, [loadFromDB])

    return null
}

/**
 * Mounts the singleton Supabase Realtime → React Query bridge once at the
 * QueryClientProvider level. Replaces the legacy useLocationsStore.subscribeToRealtime.
 * Phase 4 task 4.4.
 */
function RealtimeBootstrap() {
    useEffect(() => {
        const cleanup = startLocationsRealtime(queryClient)
        return cleanup
    }, [])
    return null
}

export const AppProviders = ({ children, includeRouter = true }) => {
    const content = (
        <ErrorBoundary>
            <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
                <AppConfigBootstrap />
                <RealtimeBootstrap />
                <SmoothScroll>
                    {children}
                </SmoothScroll>
            </PersistQueryClientProvider>
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
