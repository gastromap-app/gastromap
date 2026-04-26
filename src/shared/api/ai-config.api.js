import { config } from '@/shared/config/env'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'

/**
 * Get active AI config — admin store overrides env vars at runtime.
 * Admin can change model/key in AdminAIPage without redeploying.
 */
export function getActiveAIConfig() {
    const appCfg = useAppConfigStore.getState()
    const apiKey = appCfg.aiApiKey || config.ai?.openRouterKey || ''
    return {
        apiKey,
        model:         appCfg.aiPrimaryModel  || config.ai?.model || 'openai/gpt-oss-120b:free',
        fallbackModel: appCfg.aiFallbackModel || config.ai?.modelFallback || 'meta-llama/llama-3.3-70b-instruct:free',
        isConfigured:  !!apiKey && apiKey !== '',
        /** 
         * Use proxy only if NO key is provided (Store or Env) 
         * AND we are in Production. In Dev, always direct unless specified.
         */
        useProxy: (!apiKey || apiKey === '') && import.meta.env.PROD
    }
}
