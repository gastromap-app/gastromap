import { supabase, ApiError } from './client'

export async function getUserVisits(userId) {
    if (!supabase) return []
    const { data, error } = await supabase.from('user_visits').select('*').eq('user_id', userId).order('visited_at', { ascending: false })
    if (error) throw new ApiError(error.message, 500, 'FETCH_ERROR')
    return data || []
}

export async function getUserVisitsWithLocations(userId) {
    if (!supabase) return []
    const { data, error } = await supabase.from('user_visits').select('*, locations(title, image, category, rating, city)').eq('user_id', userId).order('visited_at', { ascending: false })
    if (error) throw new ApiError(error.message, 500, 'FETCH_ERROR')
    return data || []
}

export async function addVisit(userId, locationId, rating, reviewText) {
    if (!supabase) throw new ApiError('No Supabase', 0, 'NO_CLIENT')
    const { data, error } = await supabase
        .from('user_visits')
        .upsert(
            { user_id: userId, location_id: locationId, rating, review_text: reviewText, visited_at: new Date().toISOString() },
            { onConflict: 'user_id,location_id' }
        )
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'CREATE_ERROR')
    return data
}

export async function updateVisit(visitId, updates) {
    if (!supabase) throw new ApiError('No Supabase', 0, 'NO_CLIENT')
    const { data, error } = await supabase.from('user_visits').update(updates).eq('id', visitId).select().single()
    if (error) throw new ApiError(error.message, 500, 'UPDATE_ERROR')
    return data
}

export async function deleteVisit(visitId) {
    if (!supabase) throw new ApiError('No Supabase', 0, 'NO_CLIENT')
    const { error } = await supabase.from('user_visits').delete().eq('id', visitId)
    if (error) throw new ApiError(error.message, 500, 'DELETE_ERROR')
}

export async function hasVisited(userId, locationId) {
    if (!supabase) return false
    const { data } = await supabase.from('user_visits').select('id').eq('user_id', userId).eq('location_id', locationId).maybeSingle()
    return !!data
}
