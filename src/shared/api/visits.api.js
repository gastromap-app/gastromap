import { supabase } from './client'

export async function getUserVisits(userId) {
    if (!supabase) return []
    const { data } = await supabase.from('user_visits').select('*').eq('user_id', userId).order('visited_at', { ascending: false })
    return data || []
}

export async function getUserVisitsWithLocations(userId) {
    if (!supabase) return []
    const { data } = await supabase.from('user_visits').select('*, locations(title, image, category, rating, city)').eq('user_id', userId).order('visited_at', { ascending: false })
    return data || []
}

export async function addVisit(userId, locationId, rating, reviewText) {
    if (!supabase) return { error: 'No Supabase' }
    const { data, error } = await supabase.from('user_visits').upsert({ user_id: userId, location_id: locationId, rating, review_text: reviewText, visited_at: new Date().toISOString() }).select().single()
    return { data, error }
}

export async function updateVisit(visitId, updates) {
    if (!supabase) return { error: 'No Supabase' }
    const { data, error } = await supabase.from('user_visits').update(updates).eq('id', visitId).select().single()
    return { data, error }
}

export async function deleteVisit(visitId) {
    if (!supabase) return { error: 'No Supabase' }
    const { error } = await supabase.from('user_visits').delete().eq('id', visitId)
    return { error }
}

export async function hasVisited(userId, locationId) {
    if (!supabase) return false
    const { data } = await supabase.from('user_visits').select('id').eq('user_id', userId).eq('location_id', locationId).maybeSingle()
    return !!data
}
