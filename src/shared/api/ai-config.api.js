import { config } from '@/shared/config/env'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'

/**
 * @typedef {Object} ActiveAIConfig
 * @property {string}  model                - Primary OpenRouter model identifier.
 * @property {string}  fallbackModel        - Fallback model when primary is unavailable.
 * @property {boolean} isConfigured         - Always `true` — key is server-side only.
 * @property {boolean} useProxy             - Always `true` — all requests go through /api/ai/chat proxy.
 * @property {boolean} aiBotImprovementsV2  - Feature flag gating all new AI orchestration code paths (default `false`).
 * @property {number}  guardThreshold       - Stage 1 input guardrail confidence cutoff (default `0.6`).
 */

/**
 * Get active AI config — admin store overrides env vars at runtime.
 * Admin can change model in AdminAIPage without redeploying.
 *
 * API key is ALWAYS server-side only (process.env.OPENROUTER_API_KEY).
 * Client never has access to the key — all requests go through /api/ai/chat proxy.
 *
 * @returns {ActiveAIConfig}
 */
export function getActiveAIConfig() {
    const appCfg = useAppConfigStore.getState()
    return {
        model:                appCfg.aiPrimaryModel  || config.ai?.model || 'openai/gpt-oss-120b:free',
        fallbackModel:        appCfg.aiFallbackModel || config.ai?.modelFallback || 'meta-llama/llama-3.3-70b-instruct:free',
        isConfigured:         true,  // Always configured — key is server-side
        useProxy:             true,  // Always proxy — key never leaves the server
        aiBotImprovementsV2:  appCfg.aiBotImprovementsV2 ?? false,
        guardThreshold:       appCfg.guardThreshold ?? 0.6,
    }
}
