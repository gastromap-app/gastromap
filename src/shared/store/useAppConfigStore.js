import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAppConfigStore = create(
    persist(
        (set) => ({
            appName: 'GastroMap',
            appDescription: 'Discover the world through taste. Local guides, hidden gems, and the best gastromap for foodies.',
            appStatus: 'active', // 'active', 'maintenance', 'down'
            maintenanceMessage: 'Мы проводим технические работы, чтобы стать лучше. Приложение скоро вернется!',
            downMessage: 'Приложение временно недоступно. Мы скоро вернемся!',
            seoKeywords: 'food, gastromap, restaurants, local food, travel, foodie',

            // ─── AI model config (overrides env vars at runtime) ───────────────
            // Updated 2026-04-06: switched to gpt-oss-120b as primary (best JSON quality)
            aiApiKey: '',                                                  // overrides VITE_OPENROUTER_API_KEY
            aiPrimaryModel: 'openai/gpt-oss-120b:free',                   // overrides VITE_AI_MODEL
            aiFallbackModel: 'nvidia/nemotron-3-super-120b-a12b:free',   // overrides VITE_AI_MODEL_FALLBACK
            aiGuideActive: true,
            aiAssistantActive: true,
            aiGuideTemp: 0.7,
            aiAssistantTemp: 0.4,

            // Custom system prompts (empty = use defaults from ai.api.js / kg-ai-agent.api.js)
            aiGuideSystemPrompt: '',
            aiAssistantSystemPrompt: '',
            aiKGAgentSystemPrompt: '',   // KG Agent instructions (empty = use DEFAULT_KG_SYSTEM_PROMPT)
            braveSearchApiKey: '',        // Brave Search API key for KG Agent web enrichment (free: 2000 req/mo)

            updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
            setAppStatus: (status) => set({ appStatus: status }),
        }),
        {
            name: 'app-config-storage',
        }
    )
)
