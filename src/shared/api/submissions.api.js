import { supabase, ApiError } from './client'
import { config } from '@/shared/config/env'
import { sendNotificationToUser, NOTIFICATION_TYPES } from './notifications.api'

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
            .order('submitted_at', { ascending: false })
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
            .order('submitted_at', { ascending: true })
    )
}

/**
 * Approve a submission and create a location record.
 */
export async function approveSubmission(id, locationData) {
    if (!USE_SUPABASE) return { id }

    // Fetch submission to get submitter's user_id for notification
    const submission = unwrap(
        await supabase
            .from('user_submissions')
            .select('user_id, title')
            .eq('id', id)
            .single()
    )

    const location = unwrap(
        await supabase.from('locations').insert(locationData).select().single()
    )

    const result = unwrap(
        await supabase
            .from('user_submissions')
            .update({ status: 'approved', location_id: location.id, reviewed_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()
    )

    // Notify the submitter about approval (non-blocking — failure won't break the flow)
    const locationName = locationData.title || submission.title || 'Your location'
    await sendNotificationToUser({
        userId: submission.user_id,
        type: NOTIFICATION_TYPES.LOCATION_APPROVED.id,
        title: 'Location approved!',
        body: `Your location "${locationName}" has been approved and is now visible to users.`,
    })

    return result
}

/**
 * Reject a submission with a reason.
 */
export async function rejectSubmission(id, reason) {
    if (!USE_SUPABASE) return { id }

    // Fetch submission to get submitter's user_id for notification
    const submission = unwrap(
        await supabase
            .from('user_submissions')
            .select('user_id, title')
            .eq('id', id)
            .single()
    )

    const result = unwrap(
        await supabase
            .from('user_submissions')
            .update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() })
            .eq('id', id)
    )

    // Notify the submitter about rejection (non-blocking — failure won't break the flow)
    const locationName = submission.title || 'Your location'
    await sendNotificationToUser({
        userId: submission.user_id,
        type: NOTIFICATION_TYPES.LOCATION_REJECTED.id,
        title: 'Location needs changes',
        body: `"${locationName}" was not approved. Reason: ${reason}`,
        data: { reason },
    })

    return result
}

// ─── Photo upload ──────────────────────────────────────────────────────────

/**
 * Compress an image file using the Canvas API.
 * Returns a new JPEG File, never larger than the original.
 *
 * @param {File}   file
 * @param {object} opts
 * @param {number} opts.maxWidth    — default 1400px
 * @param {number} opts.maxHeight   — default 1050px
 * @param {number} opts.quality     — JPEG quality 0–1, default 0.82
 */
export function compressImage(file, { maxWidth = 1400, maxHeight = 1050, quality = 0.82 } = {}) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const objectUrl = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(objectUrl)
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
            const canvas = document.createElement('canvas')
            canvas.width  = Math.round(img.width  * scale)
            canvas.height = Math.round(img.height * scale)
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
            canvas.toBlob(
                (blob) => {
                    if (!blob) return reject(new Error('Compression failed'))
                    const safeName = file.name.replace(/\.\w+$/, '.jpg')
                    resolve(new File([blob], safeName, { type: 'image/jpeg' }))
                },
                'image/jpeg',
                quality,
            )
        }
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')) }
        img.src = objectUrl
    })
}

/**
 * Upload a single (already-compressed) photo to Supabase Storage.
 * Bucket: 'submissions'  (create it in Supabase with public read access).
 *
 * @param {File}   file
 * @param {string} userId
 * @returns {Promise<string>} public URL
 */
export async function uploadSubmissionPhoto(file, userId) {
    if (!USE_SUPABASE) {
        // Dev mock — return a local object URL (valid for current session only)
        return URL.createObjectURL(file)
    }
    const path = `${userId}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('submissions').upload(path, file, { upsert: false })
    if (error) throw new ApiError(error.message, 400, 'PHOTO_UPLOAD_ERROR')
    const { data } = supabase.storage.from('submissions').getPublicUrl(path)
    return data.publicUrl
}
