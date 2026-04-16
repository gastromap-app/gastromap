/**
 * @deprecated — legacy re-export shim.
 *
 * All AI functionality has been moved to the modular ai/ namespace:
 *   import { analyzeQuery }   from '@/shared/api/ai/analysis'
 *   import { fetchOpenRouter } from '@/shared/api/ai/openrouter'
 *   import { MODEL_CASCADE }  from '@/shared/api/ai/constants'
 *   ...or use the barrel: import { ... } from '@/shared/api'
 *
 * This file is kept for backward-compatibility only.
 * Do NOT add new code here — use ai/ modules directly.
 */
export * from './ai/index'
