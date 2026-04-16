/**
 * AI Module — barrel export
 *
 * All AI functionality is now fully modularized:
 *   constants.js  — OPENROUTER_URL, MODEL_CASCADE, TOOLS, DEFAULT_PROMPTS
 *   openrouter.js — fetchOpenRouter()
 *   prompts.js    — buildSystemPrompt()
 *   intents.js    — detectIntent()
 *   agents.js     — runAgentPass()
 *   analysis.js   — analyzeQuery(), analyzeQueryStream()
 *   search.js     — semanticSearch()
 *   tools.js      — executeTool()
 *   location.js   — generateLocationSemanticSummary(), extractLocationData()
 *   enrichment.js — enrichLocation()
 *   utils.js      — testAIConnection(), robustParseJSON()
 *
 * Import path: '@/shared/api/ai' or via barrel '@/shared/api'
 */

export * from './constants'
export { semanticSearch }                                   from './search'
export { executeTool }                                      from './tools'
export { buildSystemPrompt }                                from './prompts'
export { fetchOpenRouter }                                  from './openrouter'
export { detectIntent }                                     from './intents'
export { runAgentPass }                                     from './agents'
export { analyzeQuery, analyzeQueryStream }                 from './analysis'
export { generateLocationSemanticSummary, extractLocationData } from './location'
export { testAIConnection, robustParseJSON }                from './utils'
export { enrichLocation }                                   from './enrichment'
