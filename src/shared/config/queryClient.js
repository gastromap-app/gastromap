import { QueryClient, MutationCache } from '@tanstack/react-query'

/**
 * Single QueryClient instance for the entire app.
 * Optimized for Supabase free tier (throttling, cold starts):
 * - Aggressive retry: 3 attempts with short delays
 * - staleTime: 5 min — avoids redundant network requests
 * - refetchOnReconnect: true — auto-retry when network comes back
 * - networkMode: 'always' — don't pause queries when offline
 * - Cache persisted to localStorage — instant load on return visits
 */
export const queryClient = new QueryClient({
    mutationCache: new MutationCache({
        onError: (error, _variables, _context, mutation) => {
            if (!mutation.options.onError) {
                console.error('[Global Mutation Error]', error?.message || error)
            }
        },
    }),
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: true,
            refetchOnMount: true,
            refetchOnReconnect: true, // Auto-retry when network reconnects
            networkMode: 'always',
            retry: (failureCount, error) => {
                // Don't retry auth errors (401/403) — they'll always fail
                if (error?.status === 401 || error?.status === 403 || error?.code === 'NOT_AUTH') return false
                // Don't retry validation errors (400)
                if (error?.status === 400) return false
                // Rate limited (429) — retry with longer delay, max 2 times
                if (error?.status === 429) return failureCount < 2
                // Don't retry AbortError more than once (timeout)
                if (error?.name === 'AbortError' && failureCount >= 1) return false
                // Retry network/timeout errors up to 3 times
                return failureCount < 3
            },
            retryDelay: (attemptIndex, error) => {
                // Rate limited — back off significantly (5s, 10s)
                if (error?.status === 429) return Math.min(5000 * (attemptIndex + 1), 15000)
                // Default: 1s → 2s → 3s
                return Math.min(1000 * (attemptIndex + 1), 3000)
            },
            staleTime: 5 * 60 * 1000, // 5 min
            gcTime: 10 * 60 * 1000,
            // On error, keep showing stale data instead of empty state
            placeholderData: (previousData) => previousData,
        },
        mutations: {
            retry: 1, // Retry mutations once (covers timeout on save)
            retryDelay: 2000,
            networkMode: 'always',
        },
    },
})

/**
 * Options for admin queries — always fetch fresh data.
 * Usage: useQuery({ queryKey: [...], queryFn: ..., ...adminQueryOptions })
 */
export const adminQueryOptions = {
    staleTime: 30_000,         // 30s — fresh enough for admin, avoids hammering DB
    gcTime: 60 * 1000,         // 1 min — keep admin data in memory between tab switches
    refetchOnWindowFocus: false, // Don't refetch on tab switch (causes timeouts)
    refetchOnMount: true,      // always fetch when component mounts
    retry: (failureCount, error) => {
        // Don't retry auth errors
        if (error?.status === 401 || error?.status === 403) return false
        // Don't retry validation errors
        if (error?.status === 400) return false
        // Rate limited — wait longer, retry twice
        if (error?.status === 429) return failureCount < 2
        // Timeout — retry once with longer delay
        if (error?.name === 'AbortError') return failureCount < 1
        // Other errors — retry twice
        return failureCount < 2
    },
    retryDelay: (attemptIndex, error) => {
        // Rate limited — wait 5s before retry
        if (error?.status === 429) return 5000
        // Timeout — wait 3s
        if (error?.name === 'AbortError') return 3000
        // Default: 2s, 4s
        return Math.min(2000 * (attemptIndex + 1), 5000)
    },
}
