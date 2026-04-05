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
    ? createClient(config.supabase.url, config.supabase.anonKey)
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
