import { createClient } from '@supabase/supabase-js'
import { applyRateLimit } from '../_shared/rate-limit.js'
import { setCorsHeaders } from '../_shared/cors.js'

/**
 * GET /api/locations/:id
 * Public endpoint — returns location data for detail page.
 * Uses service role to bypass RLS (no auth needed for approved locations).
 */
export default async function handler(req, res) {
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return res.status(200).end()

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    if (applyRateLimit(req, res, 'location-detail', { maxRequests: 30, windowMs: 60000 })) return

    const { id } = req.query

    if (!id || typeof id !== 'string' || id.length < 10) {
        return res.status(400).json({ error: 'Invalid location ID' })
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
        return res.status(500).json({ error: 'Server configuration error' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Public columns safe to expose to anonymous users
    const PUBLIC_COLS = [
        'id', 'title', 'description', 'address', 'city', 'country',
        'lat', 'lng', 'category', 'image_url', 'google_photos',
        'google_rating', 'price_range', 'status', 'created_at',
        'opening_hours', 'phone', 'website', 'tags', 'vibe',
        'must_try', 'insider_tip', 'booking_url'
    ].join(',')

    const { data, error } = await supabase
        .from('locations')
        .select(PUBLIC_COLS)
        .eq('id', id)
        .in('status', ['approved', 'active'])
        .single()

    if (error || !data) {
        return res.status(404).json({ error: 'Location not found' })
    }

    // Cache for 5 minutes, stale-while-revalidate for 1 hour
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
    return res.status(200).json(data)
}
