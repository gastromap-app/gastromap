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
    const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url, created_at')
        .order('created_at', { ascending: false })
    return data || []
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

export async function getPendingReviews() {
    if (!supabase) return mockPendingReviews
    const { data } = await supabase
        .from('reviews')
        .select('*, profiles(full_name), locations(title)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    return data || []
}

export async function updateReviewStatus(reviewId, status, comment) {
    if (!supabase) return { error: 'No Supabase' }
    const updates = { status, updated_at: new Date().toISOString() }
    if (comment) updates.admin_comment = comment
    const { data, error } = await supabase
        .from('reviews')
        .update(updates)
        .eq('id', reviewId)
        .select()
        .single()
    return { data, error }
}

export async function getPendingLocations() {
    if (!supabase) return mockPendingLocations
    const { data } = await supabase
        .from('locations')
        .select('id, title, category, city, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    return data || []
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
