import { supabase } from './client'

export async function getUserFavorites(userId) {
    if (!supabase) return []
    const { data } = await supabase.from('user_favorites').select('location_id, created_at').eq('user_id', userId).order('created_at', { ascending: false })
    return data || []
}

export async function getUserFavoritesWithLocations(userId) {
    if (!supabase) return []
    const { data } = await supabase.from('user_favorites').select('location_id, created_at, locations(*)').eq('user_id', userId).order('created_at', { ascending: false })
    return data || []
}

export async function addFavorite(userId, locationId) {
    if (!supabase) return { error: 'No Supabase' }
    const { data, error } = await supabase.from('user_favorites').insert({ user_id: userId, location_id: locationId }).select().single()
    return { data, error }
}

export async function removeFavorite(userId, locationId) {
    if (!supabase) return { error: 'No Supabase' }
    const { error } = await supabase.from('user_favorites').delete().eq('user_id', userId).eq('location_id', locationId)
    return { error }
}

export async function isFavorite(userId, locationId) {
    if (!supabase) return false
    const { data } = await supabase.from('user_favorites').select('id').eq('user_id', userId).eq('location_id', locationId).maybeSingle()
    return !!data
}
