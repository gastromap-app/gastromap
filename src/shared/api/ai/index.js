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

// Re-export all from constants for now
export * from './constants'

// TODO: Once ai.api.js is fully split, import and re-export from individual modules:
// export { semanticSearch } from './search'
// export { analyzQuery, analyzeQueryStream } from './analysis'
// export { testAIConnection } from './utils'
// etc.

// For now, maintain backward compatibility by importing from the original file
// This will be removed once migration is complete
import {
    semanticSearch,
    executeTool,
    buildSystemPrompt,
    fetchOpenRouter,
    detectIntent,
    runAgentPass,
    analyzeQuery,
    analyzeQueryStream,
    generateLocationSemanticSummary,
    testAIConnection,
    robustParseJSON,
    extractLocationData,
} from '../ai.api'

export {
    semanticSearch,
    executeTool,
    buildSystemPrompt,
    fetchOpenRouter,
    detectIntent,
    runAgentPass,
    analyzeQuery,
    analyzeQueryStream,
    generateLocationSemanticSummary,
    testAIConnection,
    robustParseJSON,
    extractLocationData,
}
