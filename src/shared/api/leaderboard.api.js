import { supabase } from './client'

export async function getLeaderboard(limit = 50) {
    if (!supabase) return []
    const { data, error } = await supabase.rpc('get_leaderboard').limit(limit)
    if (error) { console.error('Leaderboard RPC error:', error); return [] }
    return data || []
}

export async function getUserRank(userId) {
    if (!supabase) return { rank: 0, points: 0 }
    const { data, error } = await supabase.rpc('get_leaderboard')
    if (error) return { rank: 0, points: 0 }
    const userEntry = (data || []).find(u => u.user_id === userId)
    if (!userEntry) return { rank: 0, points: 0 }
    return { rank: (data || []).indexOf(userEntry) + 1, points: userEntry.total_points }
}
