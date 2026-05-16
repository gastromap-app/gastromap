/**
 * Shared admin authentication helper for Vercel serverless functions.
 *
 * Verifies the Supabase JWT from the Authorization header and checks
 * that the user has admin role in the profiles table.
 *
 * Usage:
 *   import { verifyAdmin } from '../_shared/auth.js'
 *   const { user, error: authError, status: authStatus } = await verifyAdmin(req)
 *   if (authError) return res.status(authStatus).json({ error: authError })
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Verify admin access from Authorization header.
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ user: object|null, error: string|null, status: number }>}
 */
export async function verifyAdmin(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { user: null, error: 'Missing or invalid Authorization header', status: 401 }
    }

    const token = authHeader.replace('Bearer ', '')

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return { user: null, error: 'Server configuration error', status: 500 }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
        return { user: null, error: 'Invalid or expired token', status: 401 }
    }

    // Check admin role from profiles table
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'admin') {
        return { user: null, error: 'Admin access required', status: 403 }
    }

    return { user, error: null, status: 200 }
}
