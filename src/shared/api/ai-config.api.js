import { config } from '@/shared/config/env'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'

/**
 * Get active AI config — admin store overrides env vars at runtime.
 * Admin can change model in AdminAIPage without redeploying.
 * 
 * API key is ALWAYS server-side only (process.env.OPENROUTER_API_KEY).
 * Client never has access to the key — all requests go through /api/ai/chat proxy.
 */
export function getActiveAIConfig() {
    const appCfg = useAppConfigStore.getState()
    return {
        model:         appCfg.aiPrimaryModel  || config.ai?.model || 'openai/gpt-oss-120b:free',
        fallbackModel: appCfg.aiFallbackModel || config.ai?.modelFallback || 'meta-llama/llama-3.3-70b-instruct:free',
        isConfigured:  true, // Always configured — key is server-side
        useProxy:      true, // Always proxy — key never leaves the server
    }
}
