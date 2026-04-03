import { supabase } from './client'

export async function getLocationReviews(locationId) {
    if (!supabase) return []
    const { data } = await supabase.from('reviews').select('*, profiles(name, avatar_url)').eq('location_id', locationId).eq('status', 'published').order('created_at', { ascending: false })
    return data || []
}

export async function getUserReviews(userId) {
    if (!supabase) return []
    const { data } = await supabase.from('reviews').select('*, locations(title)').eq('user_id', userId).order('created_at', { ascending: false })
    return data || []
}

export async function createReview(userId, locationId, rating, reviewText) {
    if (!supabase) return { error: 'No Supabase' }
    const { data, error } = await supabase.from('reviews').insert({ user_id: userId, location_id: locationId, rating, review_text: reviewText, status: 'pending' }).select().single()
    return { data, error }
}

export async function updateReview(reviewId, updates) {
    if (!supabase) return { error: 'No Supabase' }
    const { data, error } = await supabase.from('reviews').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', reviewId).select().single()
    return { data, error }
}

export async function deleteReview(reviewId) {
    if (!supabase) return { error: 'No Supabase' }
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId)
    return { error }
}
