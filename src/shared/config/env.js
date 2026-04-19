/**
 * Centralized application configuration.
 * All environment variables are accessed through this module — never directly
 * via import.meta.env in components or services.
 */

// Supabase Edge Functions base URL
const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : 'https://myyzguendoruefiiufop.supabase.co/functions/v1'

export const config = {
    // ─── Supabase ─────────────────────────────────────────────────────────────
    supabase: {
        url: import.meta.env.VITE_SUPABASE_URL ?? '',
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
        /** Edge Functions base URL — lower latency than Vercel Functions */
        functionsUrl: SUPABASE_FUNCTIONS_URL,
        get isConfigured() {
            return Boolean(this.url && this.anonKey)
        },
    },

    // ─── AI / LLM (OpenRouter — free models, cascading) ──────────────────────
    ai: {
        openRouterKey: import.meta.env.VITE_OPENROUTER_API_KEY ?? '',
        model: import.meta.env.VITE_AI_MODEL ?? 'openai/gpt-oss-120b:free',
        modelFallback: import.meta.env.VITE_AI_MODEL_FALLBACK ?? 'meta-llama/llama-3.3-70b-instruct:free',
        maxHistoryLength: 50,
        maxResponseTokens: 1024,
        /**
         * Primary proxy: Supabase Edge Function (lower latency, no cold starts).
         * Fallback: Vercel Function (kept for compatibility).
         */
        proxyUrl: `${SUPABASE_FUNCTIONS_URL}/ai-chat`,
        proxyUrlFallback: '/api/ai/chat',
        semanticSearchUrl: `${SUPABASE_FUNCTIONS_URL}/semantic-search`,
        semanticSearchFallback: '/api/ai/semantic-search',
        get isConfigured() {
            return Boolean(this.openRouterKey) || import.meta.env.DEV
        },
        get isOpenRouterConfigured() {
            return Boolean(this.openRouterKey) || import.meta.env.DEV
        },
        get useProxy() {
            return (!this.openRouterKey || this.openRouterKey === '') && import.meta.env.PROD
        },
    },

    // ─── Knowledge Graph ──────────────────────────────────────────────────────
    kg: {
        /**
         * Vercel serverless function — uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
         * Previously pointed to a Supabase Edge Function that was never deployed.
         */
        saveUrl: '/api/kg/save',
        saveUrlFallback: '/api/kg/save',
    },

    // ─── Culinary APIs ────────────────────────────────────────────────────────
    culinary: {
        spoonacularKey: import.meta.env.VITE_SPOONACULAR_API_KEY ?? '',
        get isSpoonacularConfigured() {
            return Boolean(this.spoonacularKey)
        },
    },

    // ─── Map ──────────────────────────────────────────────────────────────────
    map: {
        defaultCenter: { lat: 50.0619, lng: 19.9368 },
        defaultZoom: 14,
        tiles: {
            light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        },
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    },

    // ─── App ──────────────────────────────────────────────────────────────────
    app: {
        name: 'GastroMap',
        version: import.meta.env.VITE_APP_VERSION ?? '2.0.0',
        isDev: import.meta.env.DEV,
        isProd: import.meta.env.PROD,
    },

    // ─── Images ───────────────────────────────────────────────────────────────
    images: {
        unsplashQuality: '?q=80&w=800&auto=format&fit=crop',
    },
}

// ─── DEV-only: warn when critical env vars are missing ──────────────────────
if (import.meta.env.DEV) {
    const required = [
        ['VITE_SUPABASE_URL',       config.supabase.url],
        ['VITE_SUPABASE_ANON_KEY',  config.supabase.anonKey],
        ['VITE_OPENROUTER_API_KEY', config.ai.openRouterKey],
    ]
    const missing = required.filter(([, val]) => !val)
    if (missing.length) {
        console.warn(
            '[GastroMap Config] Missing env vars:',
            missing.map(([k]) => k).join(', '),
            '\n→ Copy .env.example to .env.local and fill in values'
        )
    }
}
