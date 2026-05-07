/**
 * Vercel Serverless Function — Check if an email is already registered.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY to query the profiles table
 * (public schema, populated by auth.users trigger).
 * Prevents duplicate account creation at the application level.
 */

import { setCorsHeaders } from '../_shared/cors.js'
import { applyRateLimit } from '../_shared/rate-limit.js'

export default async function handler(req, res) {
    // CORS
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return res.status(200).end()

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // Rate limit: 5 checks per minute per IP
    if (applyRateLimit(req, res, 'check-email', { maxRequests: 5, windowMs: 60000 })) return

    const { email } = req.body || {}
    if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Invalid email format' })
    }

    const supabaseUrl = (
        process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL
    )
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

    if (!supabaseUrl || !serviceKey) {
        console.error('[check-email] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
        return res.status(500).json({ error: 'Server configuration error' })
    }

    const cleanUrl = supabaseUrl.replace(/\/+$/, '')

    try {
        // Query profiles table (public schema, populated by auth.users trigger).
        // Using service role bypasses RLS. ON DELETE CASCADE ensures profiles
        // stay in sync with auth users.
        const resp = await fetch(
            `${cleanUrl}/rest/v1/profiles?select=id&email=eq.${encodeURIComponent(normalizedEmail)}&limit=1`,
            {
                method: 'GET',
                headers: {
                    'apikey': serviceKey,
                    'Authorization': `Bearer ${serviceKey}`,
                },
            }
        )

        if (!resp.ok) {
            const text = await resp.text()
            console.error('[check-email] Supabase error:', resp.status, text)
            return res.status(500).json({ error: 'Database query failed' })
        }

        const data = await resp.json()
        const exists = Array.isArray(data) && data.length > 0

        return res.status(200).json({ exists })
    } catch (err) {
        console.error('[check-email] Unexpected error:', err)
        return res.status(500).json({ error: 'Internal server error' })
    }
}
