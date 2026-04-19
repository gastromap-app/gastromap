import { supabase, ApiError } from './client'

export async function getUserFavorites(userId) {
    if (!supabase) return []
    const { data, error } = await supabase.from('user_favorites').select('location_id, created_at').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) throw new ApiError(error.message, 500, 'FETCH_ERROR')
    return data || []
}

export async function getUserFavoritesWithLocations(userId) {
    if (!supabase) return []
    const { data, error } = await supabase.from('user_favorites').select('location_id, created_at, locations(*)').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) throw new ApiError(error.message, 500, 'FETCH_ERROR')
    return data || []
}

export async function addFavorite(userId, locationId) {
    if (!supabase) throw new ApiError('No Supabase', 0, 'NO_CLIENT')
    const { data, error } = await supabase.from('user_favorites').insert({ user_id: userId, location_id: locationId }).select().single()
    if (error) throw new ApiError(error.message, 500, 'CREATE_ERROR')
    return data
}

export async function removeFavorite(userId, locationId) {
    if (!supabase) throw new ApiError('No Supabase', 0, 'NO_CLIENT')
    const { error } = await supabase.from('user_favorites').delete().eq('user_id', userId).eq('location_id', locationId)
    if (error) throw new ApiError(error.message, 500, 'DELETE_ERROR')
}

export async function isFavorite(userId, locationId) {
    if (!supabase) return false
    const { data } = await supabase.from('user_favorites').select('id').eq('user_id', userId).eq('location_id', locationId).maybeSingle()
    return !!data
}
