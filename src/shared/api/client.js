import { createClient } from '@supabase/supabase-js'
import { config } from '@/shared/config/env'

// ─── Supabase Client ──────────────────────────────────────────────────────
if (config.supabase.isConfigured) {
    console.log('[Supabase] ✅ Client initialised:', config.supabase.url)
} else {
    console.warn(
        '[Supabase] ⚠️  NOT configured — VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.\n' +
        'All DB queries will return empty/mock data.\n' +
        'Add these variables in Vercel → Project Settings → Environment Variables, then redeploy.'
    )
}

export const supabase = config.supabase.isConfigured
    ? createClient(config.supabase.url, config.supabase.anonKey, {
        auth: {
            // Unique storage key — prevents collisions when multiple
            // Supabase projects are open in the same browser origin.
            storageKey: 'sb-gastromap-auth',
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            // Override the Web Locks API lock so concurrent requests
            // (e.g. getCuisines + getDishes + getIngredients firing at the
            // same time) don't steal each other's token-refresh lock.
            // Safe to do here because we never run multiple tabs that need
            // coordinated session refresh for the same user.
            lock: async (_name, _acquireTimeout, fn) => fn(),
        },
    })
    : null

/**
 * Generic API error — carries HTTP status for consistent error handling
 * in React Query's onError callbacks.
 */
export class ApiError extends Error {
    constructor(message, status = 500, code = 'UNKNOWN_ERROR') {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.code = code
    }
}

/**
 * Unified PGRST error handler — maps common PostgREST codes to predictable
 * behaviours so every API module doesn't duplicate the same switch blocks.
 *
 * Codes handled:
 *   PGRST116  → row not found          (returns null)
 *   PGRST202  → RPC/function missing   (returns fallback value)
 *   PGRST301  → lock timeout           (returns null, could retry)
 *   PGRST200  → missing column         (throws descriptive ApiError)
 */
export function handlePGRSTError(error, { fallback = null, context = '' } = {}) {
    if (!error) return null

    const code = error.code
    const msg = error.message || ''

    switch (code) {
        case 'PGRST116':
            // No rows found — not an error, just empty result
            return fallback

        case 'PGRST202':
            if (msg.includes('Could not find the function')) {
                return fallback
            }
            break

        case 'PGRST301':
            if (msg.includes('lock')) {
                return fallback
            }
            break

        case 'PGRST200':
            if (msg.includes('Could not find the') && msg.includes('column')) {
                throw new ApiError(
                    `${context}: Missing database column. Run pending migrations. (${msg})`,
                    500,
                    'PGRST200_MISSING_COLUMN'
                )
            }
            break
    }

    // Unhandled PGRST or other error — re-throw wrapped
    throw new ApiError(msg, 400, code || 'UNKNOWN_ERROR')
}

/**
 * Safe wrapper for Supabase RPC calls with automatic PGRST handling.
 */
export async function safeRpc(rpcPromise, { fallback = null, context = '' } = {}) {
    try {
        const { data, error } = await rpcPromise
        if (error) return handlePGRSTError(error, { fallback, context })
        return data ?? fallback
    } catch (err) {
        if (err instanceof ApiError) throw err
        return handlePGRSTError(err, { fallback, context })
    }
}

/**
 * Safe wrapper for Supabase query calls (select, insert, update, delete).
 */
export async function safeQuery(queryPromise, { fallback = null, context = '' } = {}) {
    try {
        const { data, error } = await queryPromise
        if (error) return handlePGRSTError(error, { fallback, context })
        return data ?? fallback
    } catch (err) {
        if (err instanceof ApiError) throw err
        return handlePGRSTError(err, { fallback, context })
    }
}

/** Simulate network latency in dev (used by auth.api and other mock modules). */
export const simulateDelay = (ms = 300) =>
    config.app.isDev ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()
