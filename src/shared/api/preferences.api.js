import { supabase } from './client'

export async function getUserPreferences(userId) {
    if (!supabase) return {}
    const { data } = await supabase.from('profiles').select('preferences').eq('id', userId).single()
    return data?.preferences || {}
}

export async function updateUserPreferences(userId, preferences) {
    if (!supabase) return { error: 'No Supabase' }
    const { data, error } = await supabase.from('profiles').update({ preferences }).eq('id', userId).select('preferences').single()
    return { data, error }
}
