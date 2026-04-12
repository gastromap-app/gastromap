/**
 * AI Module Index
 *
 * This is the main entry point for the AI system.
 * It re-exports all functions from the modularized ai.api.js
 *
 * TODO: Gradually move functions from the main ai.api.js file to their respective modules:
 * - ai/constants.js  ✅ (constants, models, tools)
 * - ai/prompts.js    (system prompts, prompt building)
 * - ai/tools.js      (executeTool function)
 * - ai/openrouter.js (OpenRouter API requests)
 * - ai/intents.js    (intent detection)
 * - ai/agents.js     (agent passes)
 * - ai/analysis.js   (query analysis)
 * - ai/search.js     (semantic search)
 * - ai/location.js   (location-specific functions)
 * - ai/utils.js      (utility functions)
 */

// Re-export constants
export * from './constants'

// Re-export all modularized functions
export { semanticSearch } from './search'
export { executeTool } from './tools'
export { buildSystemPrompt } from './prompts'
export { fetchOpenRouter } from './openrouter'
export { detectIntent } from './intents'
export { runAgentPass } from './agents'
export { analyzeQuery, analyzeQueryStream } from './analysis'
export { generateLocationSemanticSummary, extractLocationData } from './location'
export { testAIConnection, robustParseJSON } from './utils'
export { enrichLocation } from './enrichment'
