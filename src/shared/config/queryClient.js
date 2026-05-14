import { QueryClient, MutationCache } from '@tanstack/react-query'

/**
 * Single QueryClient instance for the entire app.
 * Configured for Realtime caching:
 * - staleTime: 5 min — avoids redundant network requests on mount/focus
 * - RealtimeSubscriber invalidates cache automatically when DB changes
 * - refetchOnWindowFocus: true (fetches fresh data if 5 min passed or cache invalidated)
 * - gcTime: 10 min — keeps data in cache between route changes
 * - networkMode: 'always' — don't pause queries when offline (let them fail fast)
 */
export const queryClient = new QueryClient({
    mutationCache: new MutationCache({
        onError: (error, _variables, _context, mutation) => {
            // Only show global error if the mutation doesn't have its own onError
            if (!mutation.options.onError) {
                console.error('[Global Mutation Error]', error?.message || error)
            }
        },
    }),
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: true,
            refetchOnMount: true,
            networkMode: 'always', // Don't pause queries when navigator.onLine is false
            retry: (failureCount, error) => {
                // Don't retry auth errors (401/403) — they'll always fail
                if (error?.status === 401 || error?.status === 403 || error?.code === 'NOT_AUTH') return 0
                // Don't retry validation errors (400)
                if (error?.status === 400) return 0
                // Retry network/timeout errors up to 2 times
                return failureCount < 2
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
            staleTime: 5 * 60 * 1000, // 5 min
            gcTime: 10 * 60 * 1000,
            // On error, keep showing stale data instead of empty state
            // This prevents the "skeleton forever" issue on flaky networks
            placeholderData: (previousData) => previousData,
        },
        mutations: {
            retry: 0,
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
