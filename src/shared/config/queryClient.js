import { QueryClient, MutationCache } from '@tanstack/react-query'

/**
 * Single QueryClient instance for the entire app.
 * Optimized for Supabase free tier (throttling, cold starts):
 * - Aggressive retry: 3 attempts with short delays
 * - staleTime: 5 min — avoids redundant network requests
 * - refetchOnReconnect: true — auto-retry when network comes back
 * - networkMode: 'always' — don't pause queries when offline
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
                // Don't retry AbortError more than once (timeout — retrying immediately will likely timeout again)
                if (error?.name === 'AbortError' && failureCount >= 1) return false
                // Retry network/timeout errors up to 3 times
                return failureCount < 3
            },
            // Short delays: 1s → 2s → 3s (not exponential — Supabase just needs a moment)
            retryDelay: (attemptIndex) => Math.min(1000 * (attemptIndex + 1), 3000),
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
    staleTime: 0,              // always stale — refetch on every mount
    gcTime: 30 * 1000,         // don't keep admin data in memory long
    refetchOnWindowFocus: true, // refresh when admin switches tabs
    refetchOnMount: true,      // always fetch when component mounts
}
