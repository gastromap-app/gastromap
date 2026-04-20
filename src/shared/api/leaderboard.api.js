import { supabase } from './client'

export async function getLeaderboard(limit = 50) {
    if (!supabase) return []
    try {
        // Try `profiles` (legacy: full_name column) then `user_profiles` (new: display_name column)
        let profiles = []
        const profilesRes = await supabase.from('profiles').select('id, full_name, avatar_url')
        if (!profilesRes.error && profilesRes.data?.length) {
            profiles = profilesRes.data.map(p => ({ id: p.id, name: p.full_name, avatar: p.avatar_url }))
        } else {
            const upRes = await supabase.from('user_profiles').select('id, display_name, avatar_url')
            profiles = (upRes.data || []).map(p => ({ id: p.id, name: p.display_name, avatar: p.avatar_url }))
        }

        // Reviews with status 'approved' (admin approved) or 'published'
        const [reviewsRes, visitsRes] = await Promise.all([
            supabase.from('reviews').select('user_id').in('status', ['approved', 'published']),
            supabase.from('user_visits').select('user_id'),
        ])
        const reviews = reviewsRes.data || []
        const visits  = visitsRes.data  || []

        // Aggregate points
        const reviewCount = {}
        reviews.forEach(r => { reviewCount[r.user_id] = (reviewCount[r.user_id] || 0) + 1 })
        const visitCount = {}
        visits.forEach(v => { visitCount[v.user_id] = (visitCount[v.user_id] || 0) + 1 })

        return profiles
            .map(p => ({
                user_id:         p.id,
                user_name:       p.name || 'User',
                user_avatar:     p.avatar || null,
                total_points:    (reviewCount[p.id] || 0) * 5 + (visitCount[p.id] || 0) * 2,
                reviews_count:   reviewCount[p.id] || 0,
                visits_count:    visitCount[p.id]  || 0,
                locations_added: 0,
            }))
            .filter(u => u.total_points > 0)
            .sort((a, b) => b.total_points - a.total_points)
            .slice(0, limit)
    } catch (err) {
        console.error('[Leaderboard] error:', err)
        return []
    }
}

export async function getUserRank(userId) {
    if (!supabase || !userId) return { rank: 0, points: 0 }
    try {
        const all = await getLeaderboard(200)
        const idx = all.findIndex(u => u.user_id === userId)
        if (idx === -1) return { rank: 0, points: 0 }
        return { rank: idx + 1, points: all[idx].total_points }
    } catch {
        return { rank: 0, points: 0 }
    }
}
