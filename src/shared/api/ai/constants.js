/**
 * AI / GastroIntelligence Constants
 *
 * This module exports all constants used by the AI system:
 * - API URLs and endpoints
 * - Model cascade (fallback chain for free models)
 * - Tool definitions for function calling
 * - Default system prompts
 */

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Cascading free models for production.
 * Ordered by reliability and availability - models less likely to be rate-limited first.
 * The system tries these in order until one succeeds.
 */
// ──────────────────────────────────────────────────────────────────────────────
// IMPORTANT: This is the TAIL FALLBACK only.
// The PRIMARY model is always read from AdminAIPage → useAppConfigStore.aiPrimaryModel
// (set in Admin → AI Agents tab). This list is used only when all configured models fail.
// Updated 2026-04-14 — verified working against OpenRouter /v1/models
// ──────────────────────────────────────────────────────────────────────────────
export const MODEL_CASCADE = [
    'openai/gpt-oss-120b:free',               // ✅ 131K ctx, best JSON quality
    'nvidia/nemotron-3-super-120b-a12b:free', // ✅ 262K ctx, best RAG
    'arcee-ai/trinity-large-preview:free',    // ✅ stable fallback
    'liquid/lfm-2.5-1.2b-instruct:free',      // ✅ fast fallback
    'liquid/lfm-2.5-1.2b-thinking:free',      // ✅ thinking variant
    'meta-llama/llama-3.3-70b-instruct:free', // sometimes 429
    'google/gemma-4-31b-it:free',             // sometimes 429
    'google/gemma-3-27b-it:free',             // sometimes 429
    'nousresearch/hermes-3-llama-3.1-405b:free', // deeper fallback
]

/**
 * Tool definitions (OpenAI function calling format)
 * These are the tools the AI can use to search and get location details
 */
export const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'search_locations',
            description: 'Search gastro locations (restaurants, cafes, bars) by filters. ALWAYS call this tool before making any specific recommendations. Do not recommend places you have not retrieved via this tool.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name, e.g. "Krakow"',
                    },
                    cuisine_types: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Cuisine types, e.g. ["French", "Italian", "Polish"]',
                    },
                    tags: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Atmosphere vibes/tags, e.g. ["Romantic", "Casual", "Sophisticated", "Energetic"]',
                    },
                    price_range: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Price levels: "$", "$$", "$$$", "$$$$"',
                    },
                    category: {
                        type: 'string',
                        description: 'Category: Restaurant, Cafe, Bar, Fine Dining, Street Food',
                    },
                    amenities: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Features/amenities, e.g. ["outdoor seating", "wifi", "pet-friendly", "river view"]',
                    },
                    best_for: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Occasion, e.g. ["date", "family", "business", "solo", "party", "anniversary"]',
                    },
                    dietary_options: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Dietary needs, e.g. ["vegan", "vegetarian", "gluten-free"]',
                    },
                    min_rating: {
                        type: 'number',
                        description: 'Minimum rating (1–5)',
                    },
                    keyword: {
                        type: 'string',
                        description: 'Free-text keyword to match against name, description, tags, and hidden ai_keywords (e.g. "proposal spot", "jazz", "sunday brunch")',
                    },
                    michelin: {
                        type: 'boolean',
                        description: 'True to filter only Michelin-recognized places',
                    },
                    limit: {
                        type: 'integer',
                        description: 'Max results to return (default 5)',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_location_details',
            description: 'Get full details for a specific location by ID, including insider tips, dishes to try, and expert notes.',
            parameters: {
                type: 'object',
                properties: {
                    location_id: {
                        type: 'string',
                        description: 'The location ID',
                    },
                },
                required: ['location_id'],
            },
        },
    },
]

/**
 * Default system prompt for GastroGuide (dining assistant)
 */
export const DEFAULT_GUIDE_PROMPT = `You are GastroGuide — a warm, knowledgeable dining assistant for GastroMap, a gastronomy app focused on discovering the best places to eat and drink.

CORE RULES:
- NEVER invent or guess restaurant names. ALWAYS use the search_locations tool before recommending any places.
- When the user asks for recommendations, call search_locations with appropriate filters first.
- When the user asks about a specific place by name or ID, use get_location_details.
- Use the insider_tip and must_try fields from tool results to make your response feel personal and expert.
- Respond in the same language the user writes in (Russian, English, Polish — match their language).
- Be concise and friendly. Max 3–4 sentences for general responses, slightly longer when detailing recommendations.
- When discussing cuisines, dishes, or ingredients, draw on your culinary expertise to provide helpful context.

When recommending places, format your response naturally — mention the name, why it fits, and include one insider tip or dish recommendation from the data.

IMPORTANT FIELD NOTES (when reading tool results):
- 'cuisine' — the restaurant's cuisine type (single string)
- 'what_to_try' — dishes to recommend (use these when asked about food)
- 'insider_tip' — exclusive expert insight (always share if available)
- 'tags' and 'vibe' — atmosphere descriptors (use for mood-based recommendations)
- 'ai_context' — deep culinary context (reference if user wants details)
- 'kg_cuisines' — verified cuisine types from Knowledge Graph
- 'kg_dishes' — verified signature dishes from Knowledge Graph (prefer these over guessing)
- 'kg_ingredients' — key ingredients used in this restaurant
- 'kg_allergens' — allergen flags (gluten, dairy, nuts, etc.) — critical for dietary questions
- 'special_labels' — accolades like "Michelin Bib", "Signature Cuisine" (highlight these)

When a user asks in Russian, respond in Russian. In Polish — in Polish. Match their language always.`

/**
 * Default system prompt for GastroAssistant (background helper)
 */
export const DEFAULT_ASSISTANT_PROMPT = `You are GastroAssistant — a background AI agent that powers smart search, recommendations, and personalization for GastroMap.

CORE RULES:
- Be precise and factual. You run silently in the background to enhance user experience.
- When analyzing queries, extract structured filters (cuisine, price, vibe, location, dietary).
- Prioritize accuracy over creativity. Return actionable data.
- Respond in the same language as the user's query.
- Keep responses concise and structured when possible.

Your output is used internally for recommendations, filtering, and personalization. Focus on extracting intent and relevant parameters.`

/**
 * Default prompts export for backward compatibility
 */
export const DEFAULT_PROMPTS = {
    guide: DEFAULT_GUIDE_PROMPT,
    assistant: DEFAULT_ASSISTANT_PROMPT,
}
