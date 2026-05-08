/**
 * Dine With Me — Admin API
 *
 * Admin-only endpoints for monitoring DWM activity,
 * managing waitlist entries, and handling reports.
 */

import { supabase } from './client'

// ─── Waitlist ────────────────────────────────────────────────────────────────

/**
 * Get all waitlist entries (admin only).
 * @param {Object} [opts]
 * @param {string} [opts.status] - Filter by status: 'pending' | 'approved' | 'rejected'
 * @returns {Promise<Array>}
 */
export async function getDineWaitlist(opts = {}) {
    if (!supabase) return []

    let query = supabase
        .from('dine_waitlist')
        .select(`
            *,
            profile:profiles(id, full_name, name, email, avatar_url, role)
        `)
        .order('created_at', { ascending: false })

    if (opts.status) {
        query = query.eq('status', opts.status)
    }

    const { data, error } = await query
    if (error) {
        console.warn('[dwm-admin.api] getDineWaitlist:', error.message)
        return []
    }
    return data || []
}

/**
 * Update a waitlist entry status (approve / reject).
 * @param {string} entryId - Waitlist entry ID
 * @param {'approved'|'rejected'} status
 */
export async function updateWaitlistStatus(entryId, status) {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
        .from('dine_waitlist')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', entryId)
        .select()
        .single()

    if (error) throw error
    return data
}

/**
 * Delete a waitlist entry.
 * @param {string} entryId
 */
export async function deleteWaitlistEntry(entryId) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase
        .from('dine_waitlist')
        .delete()
        .eq('id', entryId)

    if (error) throw error
}

/**
 * Join the waitlist (called by regular users from ProfilePage).
 * @param {string} userId
 * @param {string} [message] - Optional message from user
 */
export async function joinDineWaitlist(userId, message) {
    if (!supabase) throw new Error('Supabase not configured')
    const { data, error } = await supabase
        .from('dine_waitlist')
        .upsert({
            user_id: userId,
            message: message?.slice(0, 500) || null,
            status: 'pending',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select()
        .single()

    if (error) {
        // 23505 = unique violation — already on the list
        if (error.code === '23505') return { already_exists: true }
        throw error
    }
    return data
}

/**
 * Check if a user is already on the waitlist.
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function checkWaitlistStatus(userId) {
    if (!supabase) return null
    const { data } = await supabase
        .from('dine_waitlist')
        .select('id, status, created_at')
        .eq('user_id', userId)
        .maybeSingle()
    return data
}

// ─── Activity: Presences ─────────────────────────────────────────────────────

/**
 * Get all active dining presences (admin sees everything including expired & friends_only).
 * @param {Object} [opts]
 * @param {boolean} [opts.includeExpired=false]
 * @param {number} [opts.limit=100]
 * @returns {Promise<Array>}
 */
export async function getDinePresences(opts = {}) {
    if (!supabase) return []

    let query = supabase
        .from('dining_presence')
        .select(`
            *,
            profile:profiles(id, full_name, name, email, avatar_url, role),
            location:locations(id, title, name, address)
        `)
        .order('created_at', { ascending: false })
        .limit(opts.limit || 100)

    if (!opts.includeExpired) {
        query = query.gte('expires_at', new Date().toISOString())
    }

    const { data, error } = await query
    if (error) {
        console.warn('[dwm-admin.api] getDinePresences:', error.message)
        return []
    }
    return data || []
}

/**
 * Admin removes a user's presence (e.g. abusive user).
 * @param {string} presenceId
 */
export async function deleteDinePresence(presenceId) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase
        .from('dining_presence')
        .delete()
        .eq('id', presenceId)

    if (error) throw error
}

// ─── Activity: Waves ─────────────────────────────────────────────────────────

/**
 * Get recent dine waves (admin sees all).
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
export async function getDineWaves(limit = 50) {
    if (!supabase) return []

    const { data, error } = await supabase
        .from('dine_waves')
        .select(`
            *,
            from_profile:profiles!dine_waves_from_id_fkey(id, full_name, name, email, avatar_url),
            to_profile:profiles!dine_waves_to_id_fkey(id, full_name, name, email, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.warn('[dwm-admin.api] getDineWaves:', error.message)
        return []
    }
    return data || []
}

/**
 * Admin deletes a wave.
 * @param {string} waveId
 */
export async function deleteDineWave(waveId) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase
        .from('dine_waves')
        .delete()
        .eq('id', waveId)

    if (error) throw error
}

// ─── Reports ─────────────────────────────────────────────────────────────────

/**
 * Get all diner reports (admin only).
 * @param {Object} [opts]
 * @param {string} [opts.status] - 'open' | 'resolved' | 'dismissed'
 * @returns {Promise<Array>}
 */
export async function getDinerReports(opts = {}) {
    if (!supabase) return []

    let query = supabase
        .from('diner_reports')
        .select(`
            *,
            reporter:profiles!diner_reports_reporter_id_fkey(id, full_name, name, email, avatar_url),
            reported:profiles!diner_reports_reported_id_fkey(id, full_name, name, email, avatar_url, role, status)
        `)
        .order('created_at', { ascending: false })

    if (opts.status) {
        query = query.eq('status', opts.status)
    }

    const { data, error } = await query
    if (error) {
        console.warn('[dwm-admin.api] getDinerReports:', error.message)
        return []
    }
    return data || []
}

/**
 * Update a report's status (resolve / dismiss).
 * @param {string} reportId
 * @param {'resolved'|'dismissed'} status
 */
export async function updateReportStatus(reportId, status) {
    if (!supabase) throw new Error('Supabase not configured')
    const userId = (await supabase.auth.getUser()).data?.user?.id

    const { data, error } = await supabase
        .from('diner_reports')
        .update({
            status,
            resolved_at: new Date().toISOString(),
            resolved_by: userId,
        })
        .eq('id', reportId)
        .select()
        .single()

    if (error) throw error
    return data
}

// ─── Stats ───────────────────────────────────────────────────────────────────

/**
 * Get Dine With Me aggregate stats for admin dashboard.
 * @returns {Promise<Object>}
 */
export async function getDineStats() {
    if (!supabase) return { activePresences: 0, totalWaves: 0, openReports: 0, waitlistPending: 0 }

    const now = new Date().toISOString()

    const [presences, waves, reports, waitlist] = await Promise.allSettled([
        supabase.from('dining_presence').select('id', { count: 'exact', head: true }).gte('expires_at', now),
        supabase.from('dine_waves').select('id', { count: 'exact', head: true }),
        supabase.from('diner_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('dine_waitlist').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])

    return {
        activePresences: presences.status === 'fulfilled' ? (presences.value.count ?? 0) : 0,
        totalWaves: waves.status === 'fulfilled' ? (waves.value.count ?? 0) : 0,
        openReports: reports.status === 'fulfilled' ? (reports.value.count ?? 0) : 0,
        waitlistPending: waitlist.status === 'fulfilled' ? (waitlist.value.count ?? 0) : 0,
    }
}
