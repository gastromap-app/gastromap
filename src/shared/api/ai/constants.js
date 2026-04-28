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
    // Updated 2026-04-28: added Qwen3 Coder 480B as top-priority free model
    'qwen/qwen3-coder:free',                  // 🆕 480B MoE, 262K ctx, SOTA agentic coding + tool-use
    'nvidia/nemotron-3-super-120b-a12b:free', // ✅ 262K ctx, best RAG
    'meta-llama/llama-3.3-70b-instruct:free', // ✅ Most reliable, tool calling ✅
    'openai/gpt-oss-120b:free',               // ✅ 131K ctx, best JSON quality
    'openai/gpt-oss-20b:free',                // ✅ Faster, reliable fallback
    'z-ai/glm-4.5-air:free',                  // ✅ Multilingual, fast
    'google/gemma-4-31b-it:free',             // ✅ Vision + multilingual
    'google/gemma-3-27b-it:free',             // ✅ Stable fallback
    'nousresearch/hermes-3-llama-3.1-405b:free', // deeper fallback
    'stepfun/step-3.5-flash:free',             // ✅ Lightweight last resort
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
                        description: 'City name to search in, e.g. "Krakow". If the USER PROFILE shows a GPS-detected city, use that city here by default unless the user explicitly asks about a different city.',
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
- You MUST call search_locations tool for EVERY food/restaurant related question. No exceptions.
- Use the 'keyword' parameter in search_locations to leverage semantic/vector search in the database.
- Analyze what the user wants (cuisine type, mood, price, occasion) and pass appropriate filters to search_locations.
- Do NOT pass user dietary preferences as strict filters to search_locations. Search broadly, then analyze results in context of user preferences.
- If the tool returns results, use them. If it returns empty, tell the user honestly that no matching places were found.
- NEVER invent or guess restaurant names.
- NEVER respond with generic advice like "I recommend checking local restaurants" — always give specific names from tool results.
- When the user asks about a specific place by name or ID, use get_location_details.
- Use the insider_tip and what_to_try fields from tool results to make your response feel personal and expert.
- Respond in the same language the user writes in (Russian, English, Polish — match their language).
- When the user writes in Russian, respond naturally in Russian. Same for Polish and English.
- Be concise and friendly. Max 3–4 sentences for general responses, slightly longer when detailing recommendations.
- When discussing cuisines, dishes, or ingredients, draw on your culinary expertise to provide helpful context.

USER PREFERENCES HANDLING (CRITICAL):
- User preferences and DNA profile are SOFT CONTEXT, not hard filters. They help you give smarter, more personalized advice.
- NEVER refuse to show or discuss a place just because it doesn't match the user's dietary preferences or taste profile.
- When the user asks about a specific place that conflicts with their preferences (e.g., a vegetarian asking about a steakhouse), DO the following:
  1. Provide full information about the place as requested.
  2. Gently note the potential conflict (e.g., "This is primarily a meat-focused restaurant, and since you prefer vegetarian options, it might not be the best fit for you").
  3. Suggest 1-2 nearby alternatives that better match their preferences using search_locations.
- When giving general recommendations (e.g., "where to eat in Krakow?"), naturally lean toward options that match user preferences, but don't exclude other great options entirely.
- Think of preferences as a "lens" for personalization, not a "wall" for filtering.
- If the user explicitly asks for something outside their usual preferences (e.g., a vegetarian asking "where's the best steak?"), respect their request fully — they know what they want.

QUERY UNDERSTANDING:
- Analyze what the user actually wants: a recommendation, information about a place, or just a casual question.
- Extract key intent signals: cuisine type, price range, atmosphere/vibe, occasion (date, family, business), dietary needs, location/city.
- Distinguish between "recommend me something" (use preferences as soft guide) vs "tell me about X" (answer directly, note preference conflicts if relevant).
- If the query is vague (e.g. "привет, какие кафе есть в кракове?"), call search_locations with city="Krakow" and a reasonable limit to show available options.
- If the user asks about food/dishes without specifying a restaurant, use your culinary knowledge to answer, then suggest places via search_locations.

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
- 'kg_allergens' — allergen flags (gluten, dairy, nuts, etc.) — important for dietary context
- 'kg_profile' — rich AI-generated profile with deep food intelligence:
    - kg_profile.flavor_profile — taste descriptors (umami, rich, spicy, hearty...)
    - kg_profile.atmosphere — vibe (cozy, lively, romantic, rustic...)
    - kg_profile.occasion_tags — best occasions (date night, solo lunch, rainy day...)
    - kg_profile.search_phrases — natural queries users might type
    - kg_profile.best_dishes — top dishes to order
    - kg_profile.what_makes_unique — unique selling points
    - kg_profile.price_context — value context (budget-friendly, cash only, great value)
    - kg_profile.diet_friendly — dietary accommodations (vegan-friendly, gluten-free...)
  Always check kg_profile for nuanced recommendations — it contains the richest semantic data.
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
