import { supabase } from './client'

export async function getLeaderboard(limit = 50) {
    if (!supabase) return []
    try {
        // Fetch reviews and visits counts directly — no RPC needed
        const [profilesRes, reviewsRes, visitsRes] = await Promise.all([
            supabase.from('profiles').select('id, name, avatar_url'),
            supabase.from('reviews').select('user_id').eq('status', 'published'),
            supabase.from('user_visits').select('user_id'),
        ])
        const profiles = profilesRes.data || []
        const reviews  = reviewsRes.data || []
        const visits   = visitsRes.data  || []

        // Aggregate
        const reviewCount = {}
        reviews.forEach(r => { reviewCount[r.user_id] = (reviewCount[r.user_id] || 0) + 1 })
        const visitCount = {}
        visits.forEach(v => { visitCount[v.user_id] = (visitCount[v.user_id] || 0) + 1 })

        return profiles
            .map(p => ({
                user_id:        p.id,
                user_name:      p.name || 'User',
                user_avatar:    p.avatar_url || null,
                total_points:   (reviewCount[p.id] || 0) * 5 + (visitCount[p.id] || 0) * 2,
                reviews_count:  reviewCount[p.id] || 0,
                visits_count:   visitCount[p.id]  || 0,
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
