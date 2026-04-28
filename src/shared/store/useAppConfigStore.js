/**
 * useAppConfigStore — App-wide admin configuration store.
 *
 * Source of truth: Supabase `app_settings` table (key = 'ai_config').
 * localStorage is used only as a fast offline cache.
 *
 * Flow:
 *   1. On app start → load from Supabase (admin-only read via service role proxy)
 *   2. Admin changes a setting → save to Supabase immediately
 *   3. localStorage is kept in sync so non-admin pages get instant reads
 *   4. On next deploy the code defaults are NEVER applied — Supabase wins
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/shared/api/client'


// ─── Defaults (only used when Supabase row doesn't exist yet) ────────────────
const DEFAULTS = {
    appName: 'GastroMap',
    appDescription: 'Discover the world through taste. Local guides, hidden gems, and the best gastromap for foodies.',
    appStatus: 'active',
    maintenanceMessage: 'Мы проводим технические работы, чтобы стать лучше. Приложение скоро вернется!',
    downMessage: 'Приложение временно недоступно. Мы скоро вернемся!',
    seoKeywords: 'food, gastromap, restaurants, local food, travel, foodie',

    // AI config — overridden by Supabase on load
    aiApiKey: '',
    aiPrimaryModel:   'openai/gpt-oss-120b:free',
    aiFallbackModel:  'nvidia/nemotron-3-super-120b-a12b:free',
    aiGuideActive:    true,
    aiAssistantActive: true,
    aiGuideTemp:      0.7,
    aiAssistantTemp:  0.4,
    aiModelCascade:   [],
    aiGuideMaxTokens: 1024,
    aiAssistantMaxTokens: 1024,
    aiGuideTone:      'friendly',
    aiGuideSystemPrompt:     '',
    aiAssistantSystemPrompt: '',
    aiKGAgentSystemPrompt:   '',
    braveSearchApiKey: '',
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

/** Load AI config from Supabase. Returns null if table missing / no row. */
async function loadFromSupabase() {
    try {
        const { data, error, status } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'ai_config')
            .single()

        if (error) {
            // Log 401/406 softly as they are expected for non-admin users
            if (status === 401 || status === 406) {
                console.info('[AppConfig] Supabase access restricted (public user)')
            } else if (error.code !== 'PGRST116') { // PGRST116 is "no rows found", also fine
                console.warn('[AppConfig] Supabase load error:', error.message)
            }
            return null
        }
        return data?.value
    } catch (err) {
        return null
    }
}

/** Persist AI config fields to Supabase (upsert). */
async function saveToSupabase(aiFields) {
    try {
        await supabase
            .from('app_settings')
            .upsert(
                { key: 'ai_config', value: aiFields, updated_at: new Date().toISOString() },
                { onConflict: 'key' }
            )
    } catch (err) {
        console.warn('[AppConfig] Failed to save to Supabase:', err.message)
    }
}

// ─── AI fields that should be stored in Supabase ─────────────────────────────
const AI_FIELDS = [
    'aiApiKey', 'aiPrimaryModel', 'aiFallbackModel',
    'aiGuideActive', 'aiAssistantActive',
    'aiGuideTemp', 'aiAssistantTemp',
    'aiModelCascade', 'aiGuideMaxTokens', 'aiAssistantMaxTokens',
    'aiGuideTone', 'aiGuideSystemPrompt', 'aiAssistantSystemPrompt',
    'aiKGAgentSystemPrompt', 'braveSearchApiKey',
]

function pickAIFields(state) {
    return Object.fromEntries(AI_FIELDS.map(k => [k, state[k]]))
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAppConfigStore = create(
    persist(
        (set, get) => ({
            ...DEFAULTS,
            _supabaseLoaded: false,   // flag — Supabase sync done

            // ── Actions ──────────────────────────────────────────────────────

            /**
             * updateSettings — update state + persist AI fields to Supabase.
             * Non-AI fields (appName, appStatus…) are still localStorage-only.
             */
            updateSettings: async (settings) => {
                set((state) => ({ ...state, ...settings }))

                // Determine which AI fields changed
                const updated = Object.keys(settings).filter(k => AI_FIELDS.includes(k))
                if (updated.length > 0) {
                    await saveToSupabase(pickAIFields({ ...get(), ...settings }))
                }
            },

            setAppStatus: (status) => set({ appStatus: status }),

            /**
             * loadFromDB — fetch AI config from Supabase and merge into store.
             * Should be called once at app startup (e.g. in AppProviders).
             */
            loadFromDB: async (force = false) => {
                if (get()._supabaseLoaded && !force) return

                try {
                    const remote = await loadFromSupabase()
                    if (remote) {
                        // Supabase wins — override whatever was in localStorage
                        set({ ...remote, _supabaseLoaded: true })
                        console.log('[AppConfig] Loaded from Supabase')
                    } else {
                        // No row yet or table missing
                        set({ _supabaseLoaded: true })
                        console.log('[AppConfig] Using local defaults (Supabase entry not found or inaccessible)')
                        
                        // Try to seed ONLY if we didn't get a 401/404/406 (best effort)
                        // This might still fail with 401 if RLS is not set, but loadFromSupabase already failed
                    }
                } catch (err) {
                    set({ _supabaseLoaded: true })
                    console.warn('[AppConfig] Supabase sync skipped:', err.message)
                }
            },
        }),
        {
            name: 'app-config-storage',
            // Exclude _supabaseLoaded from localStorage
            partialize: (state) => {
                const EXCLUDED = ['_supabaseLoaded', 'loadFromDB', 'updateSettings', 'setAppStatus']
                return Object.fromEntries(
                    Object.entries(state).filter(([k]) => !EXCLUDED.includes(k))
                )
            },
        }
    )
)
