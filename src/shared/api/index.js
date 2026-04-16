/**
 * Barrel export — import everything from '@/shared/api'
 *
 * @example
 * import { getLocations, getLocationById } from '@/shared/api'
 * import { signIn, signOut } from '@/shared/api'
 * import { analyzeQuery, analyzeQueryStream } from '@/shared/api'
 * import { getActiveAIConfig } from '@/shared/api'
 */

export * from './locations.api'
export * from './auth.api'
export * from './ai/index'       // ← напрямую из ai/ модулей (убрана прослойка ai.api.js)
export * from './ai-config.api'
export { ApiError, simulateDelay } from './client'
