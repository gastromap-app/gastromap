import { supabase, ApiError } from './client'

export async function getLocationReviews(locationId) {
    if (!supabase) return []
    
    // Attempt with most probable columns — handle schema variants
    // If the join fails due to missing columns, PostgREST returns 400.
    // We catch it and try simpler variants.
    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('*, profiles(name, avatar_url)')
            .eq('location_id', locationId)
            .in('status', ['published'])
            .order('created_at', { ascending: false })

        if (!error && data) {
            return data.map(r => ({
                ...r,
                author_name: r.profiles?.name || 'User',
                author_avatar: r.profiles?.avatar_url || null
            }))
        }

        // Fallback 1: user_profiles (common in some clones)
        const { data: upData, error: upError } = await supabase
            .from('reviews')
            .select('*, user_profiles(name, avatar_url)')
            .eq('location_id', locationId)
            .in('status', ['published'])
            .order('created_at', { ascending: false })

        if (!upError && upData) {
            return upData.map(r => ({
                ...r,
                author_name: r.user_profiles?.name || 'User',
                author_avatar: r.user_profiles?.avatar_url || null
            }))
        }

        // Fallback 2: Plain fetch without join (safest)
        const { data: plain, error: e2 } = await supabase
            .from('reviews')
            .select('*')
            .eq('location_id', locationId)
            .in('status', ['published'])
            .order('created_at', { ascending: false })

        if (e2) throw e2
        return plain || []

    } catch (err) {
        console.warn('[ReviewsAPI] Fetch error (expected during schema migration):', err.message)
        return []
    }
}

export async function getUserReviews(userId) {
    if (!supabase) return []
    // Exclude 'rejected' reviews — users should only see their pending/published contributions
    const { data, error } = await supabase
        .from('reviews')
        .select('*, locations(title)')
        .eq('user_id', userId)
        .in('status', ['pending', 'published'])
        .order('created_at', { ascending: false })
    if (error) throw new ApiError(error.message, 500, 'FETCH_ERROR')
    return data || []
}

export async function createReview(userId, locationId, rating, reviewText) {
    if (!supabase) throw new ApiError('No Supabase', 0, 'NO_CLIENT')
    const { data, error } = await supabase.from('reviews').insert({ user_id: userId, location_id: locationId, rating, review_text: reviewText, status: 'pending' }).select().single()
    if (error) throw new ApiError(error.message, 500, 'CREATE_ERROR')
    return data
}

export async function updateReview(reviewId, updates) {
    if (!supabase) throw new ApiError('No Supabase', 0, 'NO_CLIENT')
    const { data, error } = await supabase.from('reviews').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', reviewId).select().single()
    if (error) throw new ApiError(error.message, 500, 'UPDATE_ERROR')
    return data
}

export async function deleteReview(reviewId) {
    if (!supabase) throw new ApiError('No Supabase', 0, 'NO_CLIENT')
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId)
    if (error) throw new ApiError(error.message, 500, 'DELETE_ERROR')
}
