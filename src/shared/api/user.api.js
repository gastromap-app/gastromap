import { supabase, ApiError, safeRpc } from './client'
import { config } from '@/shared/config/env'

const USE_SUPABASE = config.supabase.isConfigured

/**
 * Tracks user location city/country in a hidden history table.
 * Uses the `track_user_location` RPC function for atomic upsert.
 *
 * @param {string} userId
 * @param {string} city
 * @param {string} country
 * @returns {Promise<{is_new_city: boolean, visit_count: number, last_visited_at: string}>}
 */
export async function trackUserLocation(userId, city, country) {
    if (!USE_SUPABASE) return { is_new_city: true, visit_count: 1 }
    if (!userId || !city) return null

    return safeRpc(
        supabase.rpc('track_user_location', {
            p_user_id: userId,
            p_city: city,
            p_country: country,
        }),
        {
            fallback: { is_new_city: true, visit_count: 1 },
            context: 'trackUserLocation',
        }
    )
}

/**
 * Fetches user location history. 
 * Accessible by Admins or through specific RLS policies.
 * 
 * @param {string} userId
 */
export async function getUserLocationHistory(userId) {
    if (!USE_SUPABASE) return []
    
    const { data, error } = await supabase
        .from('user_location_history')
        .select('*')
        .eq('user_id', userId)
        .order('last_visited_at', { ascending: false })

    if (error) {
        console.error('[user.api] Error fetching history:', error)
        throw new ApiError(error.message, 400)
    }

    return data || []
}
