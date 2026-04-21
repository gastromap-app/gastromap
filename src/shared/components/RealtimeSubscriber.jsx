import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/api/client'

/**
 * Global subscriber for Supabase Realtime.
 * Listens to database changes (INSERT, UPDATE, DELETE) via WebSockets
 * and automatically invalidates the relevant React Query caches.
 * 
 * This allows us to have long cache times (saving DB load) while
 * instantly updating the UI when data actually changes.
 */
export function RealtimeSubscriber() {
    const queryClient = useQueryClient()

    useEffect(() => {
        // Create a single channel for all public schema changes
        const channel = supabase
            .channel('global-db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public' },
                (payload) => {
                    console.log('[Realtime] Database change detected:', payload)
                    
                    // Invalidate caches based on which table changed
                    const { table } = payload
                    
                    // General fallback: invalidate everything related to that table
                    // We use the table name as the base query key in most cases
                    queryClient.invalidateQueries({ queryKey: [table] })
                    
                    // Specific invalidations for complex or nested queries
                    if (table === 'locations') {
                        queryClient.invalidateQueries({ queryKey: ['locations'] })
                        queryClient.invalidateQueries({ queryKey: ['location'] }) // individual locations
                    }
                    if (table === 'cities') {
                        queryClient.invalidateQueries({ queryKey: ['cities'] })
                    }
                    if (table === 'knowledge_graph_entities') {
                        queryClient.invalidateQueries({ queryKey: ['knowledge_graph'] })
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] Connected to Supabase WebSockets')
                }
            })

        // Cleanup on unmount
        return () => {
            supabase.removeChannel(channel)
        }
    }, [queryClient])

    return null // This is a logic-only component
}
