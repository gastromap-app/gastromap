import { supabase } from './client'

export async function getAdminStats() {
    if (!supabase) return mockAdminStats
    const [locations, users, engagement, payments, topLocs] = await Promise.all([
        supabase.rpc('get_location_stats'),
        supabase.rpc('get_user_stats'),
        supabase.rpc('get_engagement_stats'),
        supabase.rpc('get_payment_stats'),
        supabase.from('locations')
            .select('id, title, city, category, rating')
            .order('rating', { ascending: false })
            .limit(5),
    ])
    return {
        locations: locations.data,
        users: users.data,
        engagement: engagement.data,
        payments: payments.data,
        top_locations: topLocs.data || [],
    }
}

export async function getRecentLocations(limit = 5) {
    if (!supabase) return mockRecentLocations
    const { data } = await supabase
        .from('locations')
        .select('id, title, category, city, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
    return data || []
}

export async function getRecentActivity(limit = 10) {
    if (!supabase) return mockRecentActivity
    const { data } = await supabase
        .from('user_visits')
        .select('id, user_id, location_id, visited_at, locations(title)')
        .order('visited_at', { ascending: false })
        .limit(limit)
    return data || []
}

export async function getProfiles() {
    if (!supabase) return mockProfiles
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, role, status, avatar_url, created_at, last_active_at')
        .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(p => ({
        id: p.id,
        email: p.email,
        name: p.name || p.email?.split('@')[0] || '—',
        role: p.role || 'user',
        status: p.status || 'active',
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        last_active_at: p.last_active_at,
        submittedLocations: 0,
    }))
}

export async function updateProfileRole(userId, role) {
    if (!supabase) return { error: 'No Supabase' }
    const { data, error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId)
        .select()
        .single()
    return { data, error }
}

export async function updateUserStatus(userId, status) {
    if (!supabase) throw new Error('No Supabase')
    const { data, error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', userId)
        .select()
        .single()
    if (error) throw error
    return data
}

export async function getUserDetails(userId) {
    if (!supabase) throw new Error('No Supabase')

    // Profile
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
    if (error) throw error

    // User preferences (DNA)
    let preferences = null
    try {
        const { data: prefs } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .single()
        preferences = prefs || null
    } catch {}

    // Submitted locations — locations table has no submitted_by/created_by column
    const submittedLocations = []

    // Favorites
    let favorites = []
    try {
        const { data: favs } = await supabase
            .from('user_favorites')
            .select('location_id, created_at')
            .eq('user_id', userId)
            .limit(20)
        favorites = favs || []
    } catch {}

    return {
        ...profile,
        preferences,
        submittedLocations,
        favorites,
    }
}

export async function getPendingReviews() {
    if (!supabase) return mockPendingReviews
    const { data } = await supabase
        .from('reviews')
        .select('*, profiles(full_name, name), locations(id, title, city)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    // Normalise author name across schema variants
    return (data || []).map(r => ({
        ...r,
        profiles: r.profiles
            ? { ...r.profiles, name: r.profiles.full_name || r.profiles.name || '—' }
            : null,
    }))
}

export async function updateReviewStatus(reviewId, status, _comment) {
    if (!supabase) return { error: 'No Supabase' }
    // reviews table columns: id, user_id, location_id, rating, review_text, status, created_at, updated_at
    // admin_comment column does NOT exist — only update status + updated_at
    const updates = { status, updated_at: new Date().toISOString() }
    const { data, error } = await supabase
        .from('reviews')
        .update(updates)
        .eq('id', reviewId)
        .select()
        .single()
    if (error) console.error('[admin.api] updateReviewStatus:', error.message)
    return { data, error }
}

export async function getPendingLocations() {
    if (!supabase) return mockPendingLocations
    // Check both locations table (direct entries) and user_submissions
    const [locsRes, subsRes] = await Promise.all([
        supabase.from('locations').select('id, title, category, city, created_at, status')
            .in('status', ['pending', 'revision_requested'])
            .order('created_at', { ascending: false }),
        supabase.from('user_submissions').select('id, title, category, city, submitted_at, status, user_id')
            .eq('status', 'pending')
            .order('submitted_at', { ascending: false })
    ])
    const locs = (locsRes.data || []).map(l => ({ ...l, source: 'location' }))
    const subs = (subsRes.data || []).map(s => ({ ...s, created_at: s.submitted_at, source: 'submission' }))
    return [...locs, ...subs]
}

// Mock data fallback
const mockAdminStats = {
    locations: { total: 0, published: 0, pending: 0, rejected: 0 },
    users:     { total: 0, this_month: 0, this_week: 0 },
    engagement:{ total_visits: 0, total_reviews: 0, total_favorites: 0, pending_reviews: 0 },
    payments:  { total_payments: 0, total_revenue: 0, active_subscriptions: 0, this_month_revenue: 0 },
    top_locations: [],
}
const mockRecentLocations = []
const mockRecentActivity = []
const mockProfiles = []
const mockPendingReviews = []
const mockPendingLocations = []

// ─── Analytics — Stats page ────────────────────────────────────────────────

/**
 * Top locations by activity (reviews + visits + rating)
 * Uses PostgREST embedded resource counts — no SQL function needed
 */
export async function getTopLocations(limit = 5) {
    if (!supabase) return []
    const { data, error } = await supabase
        .from('locations')
        .select('id, title, city, category, rating, reviews(count), user_visits(count)')
        .in('status', ['active', 'approved'])
        .order('rating', { ascending: false })
        .limit(limit * 3) // fetch more, sort in JS

    if (error) { console.error('[admin.api] getTopLocations:', error.message); return [] }

    return (data || [])
        .map(loc => {
            const review_count = loc.reviews?.[0]?.count ?? 0
            const visit_count  = loc.user_visits?.[0]?.count ?? 0
            return { ...loc, review_count, visit_count, score: review_count + visit_count }
        })
        .sort((a, b) => b.score - a.score || b.rating - a.rating)
        .slice(0, limit)
}

/**
 * Locations breakdown by category (from real DB data)
 */
export async function getCategoryStats() {
    if (!supabase) return []
    const { data, error } = await supabase
        .from('locations')
        .select('category, status, rating')

    if (error) { console.error('[admin.api] getCategoryStats:', error.message); return [] }

    const map = {}
    for (const loc of data || []) {
        if (!map[loc.category]) map[loc.category] = { category: loc.category, total: 0, active: 0, ratings: [] }
        map[loc.category].total++
        if (loc.status === 'active' || loc.status === 'approved') map[loc.category].active++
        if (loc.rating) map[loc.category].ratings.push(Number(loc.rating))
    }

    return Object.values(map)
        .map(c => ({
            category: c.category,
            total: c.total,
            active: c.active,
            avg_rating: c.ratings.length
                ? Math.round((c.ratings.reduce((a, b) => a + b, 0) / c.ratings.length) * 10) / 10
                : null
        }))
        .sort((a, b) => b.total - a.total)
}

/**
 * City breakdown (from real DB data)
 */
export async function getCityStats() {
    if (!supabase) return []
    const { data, error } = await supabase
        .from('locations')
        .select('city, country, rating')
        .in('status', ['active', 'approved'])

    if (error) { console.error('[admin.api] getCityStats:', error.message); return [] }

    const map = {}
    for (const loc of data || []) {
        const key = `${loc.city}|${loc.country}`
        if (!map[key]) map[key] = { city: loc.city, country: loc.country, total: 0, ratings: [] }
        map[key].total++
        if (loc.rating) map[key].ratings.push(Number(loc.rating))
    }

    return Object.values(map)
        .map(c => ({
            city: c.city,
            country: c.country,
            total: c.total,
            avg_rating: c.ratings.length
                ? Math.round((c.ratings.reduce((a, b) => a + b, 0) / c.ratings.length) * 10) / 10
                : null
        }))
        .sort((a, b) => b.total - a.total)
}

/**
 * Reviews timeline — last N days
 */
export async function getReviewsTimeline(days = 30) {
    if (!supabase) return []
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const { data, error } = await supabase
        .from('reviews')
        .select('created_at, rating')
        .gte('created_at', since)
        .order('created_at', { ascending: true })

    if (error) { console.error('[admin.api] getReviewsTimeline:', error.message); return [] }

    const byDay = {}
    for (const r of data || []) {
        const day = r.created_at.slice(0, 10)
        if (!byDay[day]) byDay[day] = { day, count: 0, ratings: [] }
        byDay[day].count++
        if (r.rating) byDay[day].ratings.push(Number(r.rating))
    }

    return Object.values(byDay).map(d => ({
        day: d.day,
        review_count: d.count,
        avg_rating: d.ratings.length
            ? Math.round((d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length) * 10) / 10
            : null
    }))
}

/**
 * User registrations — last N days
 */
export async function getUserGrowth(days = 30) {
    if (!supabase) return []
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const { data, error } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true })

    if (error) { console.error('[admin.api] getUserGrowth:', error.message); return [] }

    const byDay = {}
    for (const p of data || []) {
        const day = p.created_at.slice(0, 10)
        byDay[day] = (byDay[day] || 0) + 1
    }

    let cumulative = 0
    return Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, new_users]) => {
            cumulative += new_users
            return { day, new_users, total_cumulative: cumulative }
        })
}

/**
 * Detailed engagement stats (replaces basic get_engagement_stats)
 */
export async function getDetailedEngagement() {
    if (!supabase) return {}
    const [reviews, visits, locations, users] = await Promise.all([
        supabase.from('reviews').select('status, rating'),
        supabase.from('user_visits').select('user_id'),
        supabase.from('locations').select('status'),
        supabase.from('profiles').select('role'),
    ])

    const rv = reviews.data || []
    const vv = visits.data || []
    const lv = locations.data || []
    const uv = users.data || []

    const approvedRatings = rv.filter(r => r.status === 'approved' && r.rating).map(r => Number(r.rating))

    return {
        total_reviews:    rv.length,
        approved_reviews: rv.filter(r => r.status === 'approved').length,
        pending_reviews:  rv.filter(r => r.status === 'pending').length,
        total_visits:     vv.length,
        unique_visitors:  new Set(vv.map(v => v.user_id)).size,
        avg_rating: approvedRatings.length
            ? Math.round((approvedRatings.reduce((a, b) => a + b, 0) / approvedRatings.length) * 100) / 100
            : null,
        total_locations:   lv.length,
        active_locations:  lv.filter(l => l.status === 'active' || l.status === 'approved').length,
        pending_locations: lv.filter(l => l.status === 'pending').length,
        total_users:       uv.length,
        admin_users:       uv.filter(u => u.role === 'admin').length,
        moderator_users:   uv.filter(u => u.role === 'moderator').length,
        regular_users:     uv.filter(u => u.role === 'user').length,
        // Canonical roles: 'admin' | 'moderator' | 'user' (no premium in system)
    }
}
