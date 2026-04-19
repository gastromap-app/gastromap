import { supabase, ApiError } from './client'

export async function getLocationReviews(locationId) {
    if (!supabase) return []
    const { data, error } = await supabase.from('reviews').select('*, profiles(name, avatar_url)').eq('location_id', locationId).eq('status', 'published').order('created_at', { ascending: false })
    if (error) throw new ApiError(error.message, 500, 'FETCH_ERROR')
    return data || []
}

export async function getUserReviews(userId) {
    if (!supabase) return []
    const { data, error } = await supabase.from('reviews').select('*, locations(title)').eq('user_id', userId).order('created_at', { ascending: false })
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
