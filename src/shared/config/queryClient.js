import { QueryClient } from '@tanstack/react-query'

/**
 * Single QueryClient instance for the entire app.
 * Configured for Realtime caching:
 * - staleTime: 5 min — avoids redundant network requests on mount/focus
 * - RealtimeSubscriber invalidates cache automatically when DB changes
 * - refetchOnWindowFocus: true (fetches fresh data if 5 min passed or cache invalidated)
 * - gcTime: 10 min — keeps data in cache between route changes
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: true,
            refetchOnMount: true,
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 min
            gcTime: 10 * 60 * 1000,
        },
        mutations: {
            retry: 0,
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
