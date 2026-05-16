// Helper to get env vars from either import.meta.env (Vite) or process.env (Node)
const getEnv = (key, fallback = '') => {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
        return import.meta.env[key]
    }
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key]
    }
    return fallback
}

// Supabase Edge Functions base URL
const SUPABASE_FUNCTIONS_URL = getEnv('VITE_SUPABASE_URL')
  ? `${getEnv('VITE_SUPABASE_URL')}/functions/v1`
  : 'https://myyzguendoruefiiufop.supabase.co/functions/v1'

export const config = {
    // ─── Supabase ─────────────────────────────────────────────────────────────
    supabase: {
        url: getEnv('VITE_SUPABASE_URL'),
        anonKey: getEnv('VITE_SUPABASE_ANON_KEY'),
        /** Edge Functions base URL — lower latency than Vercel Functions */
        functionsUrl: SUPABASE_FUNCTIONS_URL,
        get isConfigured() {
            return Boolean(this.url && this.anonKey)
        },
    },

    // ─── AI / LLM (OpenRouter — free models, cascading) ──────────────────────
    ai: {
        model: getEnv('VITE_AI_MODEL', 'nvidia/nemotron-3-super-120b-a12b:free'),
        modelFallback: getEnv('VITE_AI_MODEL_FALLBACK', 'meta-llama/llama-3.3-70b-instruct:free'),
        maxHistoryLength: 50,
        maxStorageBytes: 512 * 1024, // ~500KB cap for persisted chat history (IndexedDB)
        maxResponseTokens: 1024,
        /**
         * Primary proxy: Vercel Function (reliable, always deployed).
         * Supabase Edge Function can be added later if deployed.
         */
        proxyUrl: '/api/ai/chat',
        semanticSearchUrl: `${SUPABASE_FUNCTIONS_URL}/semantic-search`,
        semanticSearchFallback: '/api/ai/semantic-search',
        get isConfigured() {
            return true
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
        spoonacularKey: getEnv('VITE_SPOONACULAR_API_KEY'),
        get isSpoonacularConfigured() {
            return Boolean(this.spoonacularKey)
        },
    },

    // ─── Map ──────────────────────────────────────────────────────────────────
    map: {
        defaultCenter: { lat: 50.0619, lng: 19.9368 },
        defaultZoom: 14,
        tiles: {
            light: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
            dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        },
        attribution: '&copy; Google Maps',
    },

    // ─── App ──────────────────────────────────────────────────────────────────
    app: {
        name: 'GastroMap',
        version: getEnv('VITE_APP_VERSION', '2.0.0'),
        isDev: (typeof import.meta !== 'undefined' && import.meta.env?.DEV) || false,
        isProd: (typeof import.meta !== 'undefined' && import.meta.env?.PROD) || false,
    },

    // ─── Images ───────────────────────────────────────────────────────────────
    images: {
        unsplashQuality: '?q=80&w=800&auto=format&fit=crop',
    },
}

// ─── DEV-only: warn when critical env vars are missing ──────────────────────
if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    const required = [
        ['VITE_SUPABASE_URL',       config.supabase.url],
        ['VITE_SUPABASE_ANON_KEY',  config.supabase.anonKey],
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
