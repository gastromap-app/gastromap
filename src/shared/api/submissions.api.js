import { supabase, ApiError } from './client'
import { config } from '@/shared/config/env'

const USE_SUPABASE = config.supabase.isConfigured

// ─── Helpers ───────────────────────────────────────────────────────────────

function unwrap({ data, error }) {
    if (error) throw new ApiError(error.message, error.code)
    return data
}

// ─── API ───────────────────────────────────────────────────────────────────

/**
 * Submit a new location for moderation.
 */
export async function createSubmission(payload) {
    if (!USE_SUPABASE) {
        // Dev fallback — simulate success
        return { id: 'mock-' + Date.now(), ...payload, status: 'pending', created_at: new Date().toISOString() }
    }
    return unwrap(
        await supabase
            .from('user_submissions')
            .insert({ ...payload, status: 'pending', submitter_confirmed: true })
            .select()
            .single()
    )
}

/**
 * Get all submissions for the current user.
 */
export async function getMySubmissions(userId) {
    if (!USE_SUPABASE) return []
    return unwrap(
        await supabase
            .from('user_submissions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
    )
}

/**
 * Get all pending submissions (admin only).
 */
export async function getPendingSubmissions() {
    if (!USE_SUPABASE) return []
    return unwrap(
        await supabase
            .from('user_submissions')
            .select('*, profiles(name, avatar_url)')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
    )
}

/**
 * Approve a submission and create a location record.
 */
export async function approveSubmission(id, locationData) {
    if (!USE_SUPABASE) return { id }
    const location = unwrap(
        await supabase.from('locations').insert(locationData).select().single()
    )
    return unwrap(
        await supabase
            .from('user_submissions')
            .update({ status: 'approved', location_id: location.id, reviewed_at: new Date().toISOString() })
            .eq('id', id)
    )
}

/**
 * Reject a submission with a reason.
 */
export async function rejectSubmission(id, reason) {
    if (!USE_SUPABASE) return { id }
    return unwrap(
        await supabase
            .from('user_submissions')
            .update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() })
            .eq('id', id)
    )
}
