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
            detectSessionInUrl: false,
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

/** Simulate network latency in dev (used by auth.api and other mock modules). */
export const simulateDelay = (ms = 300) =>
    config.app.isDev ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()
