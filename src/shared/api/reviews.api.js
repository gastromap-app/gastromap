import { supabase, ApiError } from './client'

export async function getLocationReviews(locationId) {
    if (!supabase) return []
    // Accept both 'approved' (new moderation) and 'published' (legacy)
    const { data, error } = await supabase
        .from('reviews')
        .select('*, profiles(full_name, avatar_url)')
        .eq('location_id', locationId)
        .in('status', ['approved', 'published'])
        .order('created_at', { ascending: false })
    if (error) {
        // Profiles table might not exist — retry without the join
        const { data: plain, error: e2 } = await supabase
            .from('reviews')
            .select('*')
            .eq('location_id', locationId)
            .in('status', ['approved', 'published'])
            .order('created_at', { ascending: false })
        if (e2) throw new ApiError(e2.message, 500, 'FETCH_ERROR')
        return plain || []
    }
    // Normalize author name from profiles join
    return (data || []).map(r => ({
        ...r,
        author_name: r.profiles?.full_name || r.profiles?.display_name || 'User',
    }))
}

export async function getUserReviews(userId) {
    if (!supabase) return []
    // Exclude 'rejected' reviews — users should only see their pending/approved/published contributions
    const { data, error } = await supabase
        .from('reviews')
        .select('*, locations(title)')
        .eq('user_id', userId)
        .in('status', ['pending', 'approved', 'published'])
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
