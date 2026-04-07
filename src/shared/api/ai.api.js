/**
 * AI / GastroIntelligence API via OpenRouter
 *
 * MODULARIZED - This is now a re-export hub for the new ai/ module structure.
 * All implementation details have been moved to separate modules:
 *
 * Two modes:
 *  1. PRODUCTION — OpenRouter API (free models) when VITE_OPENROUTER_API_KEY is set.
 *     Uses Tool Use (function calling): model decides which filters to apply,
 *     calls search_locations / get_location_details, then generates a response.
 *     Locations are NOT injected into the system prompt — only requested results
 *     are in context, keeping token count minimal.
 *
 *  2. DEVELOPMENT FALLBACK — local scoring engine when no API key.
 *     Full offline dev without any API cost.
 *
 * Models used via OpenRouter (both free):
 *   Primary : meta-llama/llama-3.3-70b-instruct:free  (131K ctx, tool use)
 *   Fallback: qwen/qwen3-coder:free                    (262K ctx, 100+ languages)
 *
 * ⚠️  SECURITY NOTE:
 *   VITE_OPENROUTER_API_KEY is embedded in the client bundle.
 *   For production, proxy all AI calls through a server-side edge function.
 */

// Re-export everything from the modularized ai/ namespace
export * from './ai/index'
