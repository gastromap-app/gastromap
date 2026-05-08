/**
 * Dine With Me API — Phase 1: Presence + Nearby Diners
 *
 * Safety-first design:
 * - Only venue-level coordinates are stored (never raw GPS)
 * - Presence auto-expires after 30 minutes
 * - Users control what contact info to share
 * - Report/block mechanism for safety
 * - Waves are one-way interest signals (no reply mechanism)
 */

import { supabase, ApiError, safeQuery } from '@/shared/api/client'
import { calculateDistance } from '@/lib/geo'

const PRESENCE_TTL_MS = 30 * 60 * 1000  // 30 minutes
const WAVE_RATE_LIMIT = 10               // max 10 waves per hour
const DEFAULT_RADIUS_M = 5000            // 5 km search radius

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getUserId() {
    if (!supabase) throw new ApiError('Supabase not configured', 503, 'NO_SUPABASE')
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) throw new ApiError('Not authenticated', 401, 'NOT_AUTH')
    return data.user.id
}

/**
 * Derive first name + last initial for privacy.
 * "Anna Kowalska" → "Anna K.", "Marco" → "Marco"
 */
export function formatDisplayName(fullName) {
    if (!fullName) return 'Foodie'
    const parts = fullName.trim().split(/\s+/)
    if (parts.length === 1) return parts[0]
    return `${parts[0]} ${parts[1][0]}.`
}

// ─── Presence Management ────────────────────────────────────────────────────

/**
 * Create or update the current user's dining presence.
 * @param {Object} params
 * @param {string} params.locationId - Venue ID from locations table
 * @param {number} params.lat - Venue latitude (copied for query perf)
 * @param {number} params.lng - Venue longitude (copied for query perf)
 * @param {'looking'|'eating'|'heading_to'} params.status
 * @param {string} [params.message] - Max 200 chars
 * @param {string} [params.contactInfo] - Max 200 chars, user-controlled
 * @param {string[]} [params.cuisinePrefs]
 * @param {number} [params.partySize=1]
 * @param {string} [params.arrivingAt] - ISO timestamp
 * @param {'everyone'|'friends_only'} [params.visibility='everyone']
 * @returns {Promise<Object>} The upserted presence row
 */
export async function upsertPresence({
    locationId, lat, lng, status, message, contactInfo,
    cuisinePrefs, partySize = 1, arrivingAt, visibility = 'everyone',
}) {
    const userId = await getUserId()
    const expiresAt = new Date(Date.now() + PRESENCE_TTL_MS).toISOString()

    const row = {
        user_id: userId,
        location_id: locationId,
        lat,
        lng,
        status,
        message: message?.slice(0, 200) || null,
        contact_info: contactInfo?.slice(0, 200) || null,
        cuisine_prefs: cuisinePrefs || [],
        party_size: partySize,
        arriving_at: arrivingAt || null,
        visibility,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
        .from('dining_presence')
        .upsert(row, { onConflict: 'user_id' })
        .select()
        .single()

    if (error) throw new ApiError(error.message, 400, error.code)
    return data
}

/**
 * Clear the current user's dining presence (go invisible).
 */
export async function clearPresence() {
    if (!supabase) return
    const userId = await getUserId()
    await supabase
        .from('dining_presence')
        .delete()
        .eq('user_id', userId)
}

/**
 * Get the current user's active presence (if any).
 * @returns {Promise<Object|null>}
 */
export async function getMyPresence() {
    if (!supabase) return null
    const userId = await getUserId()
    return safeQuery(
        supabase
            .from('dining_presence')
            .select('*')
            .eq('user_id', userId)
            .gte('expires_at', new Date().toISOString())
            .maybeSingle(),
        { fallback: null, context: 'getMyPresence' }
    )
}

// ─── Nearby Diners ──────────────────────────────────────────────────────────

/**
 * Get nearby diners within a bounding box around the given coordinates.
 * Uses venue-level coordinates, not user GPS.
 *
 * @param {Object} params
 * @param {number} params.lat - Center latitude (user's current position or city center)
 * @param {number} params.lng - Center longitude
 * @param {number} [params.radiusMeters=5000]
 * @returns {Promise<Array>} Filtered diners with profile + venue info
 */
export async function getNearbyDiners({ lat, lng, radiusMeters = DEFAULT_RADIUS_M }) {
    if (!supabase) return []

    const userId = await getUserId()

    // Bounding box approximation
    const latRange = radiusMeters / 111320
    const lngRange = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))

    const { data, error } = await supabase
        .from('dining_presence')
        .select(`
            *,
            profile:profiles(id, full_name, name, avatar_url),
            location:locations(id, title, name, address, image_url)
        `)
        .gte('lat', lat - latRange)
        .lte('lat', lat + latRange)
        .gte('lng', lng - lngRange)
        .lte('lng', lng + lngRange)
        .gte('expires_at', new Date().toISOString())
        .eq('visibility', 'everyone')
        .neq('user_id', userId)

    if (error) {
        console.warn('[dinewithme.api] getNearbyDiners failed:', error.message)
        return []
    }

    // Client-side haversine for precision + distance calculation
    const diners = (data || [])
        .map(p => {
            const dist = calculateDistance(lat, lng, p.lat, p.lng, 'm')
            return {
                ...p,
                _distance: Math.round(dist),
                displayName: formatDisplayName(p.profile?.full_name || p.profile?.name),
                avatarUrl: p.profile?.avatar_url || null,
                venueName: p.location?.title || p.location?.name || 'Unknown venue',
                venueImageUrl: p.location?.image_url || null,
            }
        })
        .filter(p => p._distance <= radiusMeters)
        .sort((a, b) => a._distance - b._distance)

    // Filter out reported users
    const reportedIds = await getReportedUserIds()
    return diners.filter(p => !reportedIds.has(p.user_id))
}

// ─── Waves (One-way Interest Signal) ────────────────────────────────────────

/**
 * Send a wave to another diner. Rate-limited to 10 per hour.
 * @param {string} targetUserId - The user to wave at
 * @param {string} venueName - Name of the venue (for the notification message)
 * @returns {Promise<Object>}
 */
export async function waveAtDiner(targetUserId, venueName) {
    const userId = await getUserId()

    // Rate limit check: count waves sent in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count, error: countError } = await supabase
        .from('dine_waves')
        .select('id', { count: 'exact', head: true })
        .eq('from_id', userId)
        .gte('created_at', oneHourAgo)

    if (countError) throw new ApiError(countError.message, 400, countError.code)
    if (count >= WAVE_RATE_LIMIT) {
        throw new ApiError('Wave rate limit exceeded', 429, 'WAVE_RATE_LIMIT')
    }

    const { data, error } = await supabase
        .from('dine_waves')
        .insert({
            from_id: userId,
            to_id: targetUserId,
            venue_name: venueName,
        })
        .select()
        .single()

    if (error) throw new ApiError(error.message, 400, error.code)
    return data
}

/**
 * Get waves sent to the current user (for toast notifications).
 * @param {number} [limit=20]
 * @returns {Promise<Array>}
 */
export async function getIncomingWaves(limit = 20) {
    if (!supabase) return []
    return safeQuery(
        supabase
            .from('dine_waves')
            .select('*')
            .eq('to_id', await getUserId())
            .order('created_at', { ascending: false })
            .limit(limit),
        { fallback: [], context: 'getIncomingWaves' }
    )
}

// ─── Reports & Safety ───────────────────────────────────────────────────────

/**
 * Report a diner for inappropriate behavior.
 * @param {Object} params
 * @param {string} params.reportedId - The user being reported
 * @param {'harassment'|'spam'|'inappropriate'|'other'} params.reason
 * @param {string} [params.details] - Max 500 chars
 */
export async function reportDiner({ reportedId, reason, details }) {
    const userId = await getUserId()
    const { error } = await supabase
        .from('diner_reports')
        .insert({
            reporter_id: userId,
            reported_id: reportedId,
            reason,
            details: details?.slice(0, 500) || null,
        })

    if (error) {
        // Ignore unique violation — already reported
        if (error.code === '23505') return
        throw new ApiError(error.message, 400, error.code)
    }
}

/**
 * Get IDs of users the current user has reported (for client-side filtering).
 * @returns {Promise<Set<string>>}
 */
export async function getReportedUserIds() {
    if (!supabase) return new Set()
    try {
        const userId = await getUserId()
        const { data } = await supabase
            .from('diner_reports')
            .select('reported_id')
            .eq('reporter_id', userId)
        return new Set((data || []).map(r => r.reported_id))
    } catch {
        return new Set()
    }
}
