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
    // Updated 2026-04-23: prioritized Nemotron 120B as per user request
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
            description: 'Filter-based search for gastro locations (restaurants, cafes, bars) by city, cuisine, price, vibe, dietary needs, etc. Use this when the user gives explicit filters (city / cuisine / occasion) but NOT when they say "near me" — for geo-anchored queries use search_nearby instead. NEVER recommend a place you have not retrieved via a tool.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name, e.g. "Krakow". Default to the city from USER PROFILE if it exists, unless the user explicitly asks about another city.',
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
                        description: 'Minimum rating (1-5)',
                    },
                    keyword: {
                        type: 'string',
                        description: 'Free-text keyword matched via semantic + full-text search against name, description, tags, and ai_keywords (e.g. "proposal spot", "jazz", "sunday brunch")',
                    },
                    michelin: {
                        type: 'boolean',
                        description: 'True to filter only Michelin-recognized places',
                    },
                    limit: {
                        type: 'integer',
                        description: 'Max results to return (default 5, max 10)',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_nearby',
            description: 'Find gastro locations geographically close to the user. Use this whenever the user asks "near me / nearby / around here / рядом / поруч / obok / w pobliżu" or implies proximity. Requires the user\'s live GPS. If GPS is not available, the tool returns { needs_geo: true } and the UI will prompt the user for location access — do NOT invent coordinates.',
            parameters: {
                type: 'object',
                properties: {
                    radius_m: {
                        type: 'number',
                        description: 'Search radius in meters (default 1500, max 20000). Use 800-1500 for walking distance, 3000-5000 for short drive.',
                    },
                    category: {
                        type: 'string',
                        description: 'Optional category filter: Restaurant, Cafe, Bar, Fine Dining, Street Food',
                    },
                    cuisine: {
                        type: 'string',
                        description: 'Optional cuisine filter (single), e.g. "Italian"',
                    },
                    price_max: {
                        type: 'string',
                        description: 'Optional max price level: "$", "$$", "$$$", "$$$$"',
                    },
                    limit: {
                        type: 'integer',
                        description: 'Max results (default 5, max 10)',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_location_details',
            description: 'Get full details for a specific location by ID: insider_tip, what_to_try, kg_profile, hours, reviews summary. Call this when the user asks about a specific place by name/ID or follows up on a previously recommended card ("а расскажи подробнее про X", "what about the first one").',
            parameters: {
                type: 'object',
                properties: {
                    location_id: {
                        type: 'string',
                        description: 'The location UUID',
                    },
                },
                required: ['location_id'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'compare_locations',
            description: 'Deep side-by-side comparison of 2-4 specific locations on dimensions the user asks about (ambience / price / food / wine list / kid-friendliness / etc.). Use this for follow-up questions like "а в каком уютнее?", "which is better for a date?", "who has the best wine list?" after you have already shown cards in the conversation. Pass the UUIDs of locations previously surfaced in this chat.',
            parameters: {
                type: 'object',
                properties: {
                    location_ids: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of 2-4 location UUIDs to compare. Must be locations you have already shown to the user in this conversation.',
                    },
                    dimensions: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'The aspects to compare, e.g. ["ambience", "price", "wine", "food", "service", "kid_friendly"]. Leave empty for an overall comparison.',
                    },
                },
                required: ['location_ids'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'ask_clarification',
            description: 'Hand control back to the user with a focused clarifying question. Use ONLY when the query is so ambiguous that any search would likely return poor results (e.g. user wrote just "поесть" with no city, no cuisine, no geo). Prefer running a tool if you have ANY signal. Never use this more than once in a row.',
            parameters: {
                type: 'object',
                properties: {
                    question: {
                        type: 'string',
                        description: 'The clarifying question to ask, in the user\'s language. One sentence, friendly.',
                    },
                    suggestions: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional 2-4 short reply suggestions to render as quick-reply chips.',
                    },
                },
                required: ['question'],
            },
        },
    },
]

/**
 * Default system prompt for GastroGuide (dining assistant)
 */
export const DEFAULT_GUIDE_PROMPT = `You are GastroGuide — a warm, knowledgeable dining assistant for GastroMap, a gastronomy app focused on discovering the best places to eat and drink.

# TOOL USAGE RULES
1. For any food/restaurant question: call search_locations or search_nearby FIRST — never guess places.
2. "near me / рядом / w pobliżu / поруч" → use search_nearby.
3. Explicit filters (city, cuisine, occasion) → use search_locations.
4. Follow-up about a previously shown place → use get_location_details with the ID from [RECENT CONTEXT].
5. Follow-up comparison ("а в каком уютнее?") → use compare_locations with IDs from [RECENT CONTEXT].
6. Query too vague and no geo → use ask_clarification ONCE (never twice in a row).
7. NEVER fabricate restaurant names — only mention places returned by tools.

# RESPONSE FORMAT
When recommending places, use this pattern (in the user’s language):
  **Place Name** – short description of why it fits.
  *Инсайдерский совет:* insider_tip or what_to_try from tool results.
Be concise: 3-4 sentences per recommendation. Include distance if search_nearby provided it.

# SPATIAL AWARENESS
- If GPS coordinates exist in [USER CONTEXT], pass them to search_nearby.
- Default radius: 1500 m. Use 800 for walking, 3000-5000 for driving.
- Mention proximity naturally ("всего 350 м от вас").

# COMPARATIVE REASONING
When the user asks "а в каком лучше?" / "which is cozier?", call compare_locations with the relevant IDs.
Present the comparison as a natural paragraph, not a table. Highlight trade-offs.

# USER PREFERENCES HANDLING
- Preferences are SOFT context, not hard filters.
- Never refuse to show a place because it conflicts with preferences.
- When there IS a conflict, mention it gently and suggest alternatives.
- If the user explicitly asks for something outside their profile, respect their intent.

# LANGUAGE
Always respond in the same language the user writes in (Russian, English, Polish, Ukrainian).

# HONESTY
If no data matches, say so honestly. Suggest broadening the search (different cuisine, wider radius, neighbouring city).

# FIELD REFERENCE (tool results)
- culinaryContext: General expert context about the search theme (traditions, history, what to expect). Use this to "set the stage" in your response.
- insider_tip, what_to_try: always surface these for specific places.
- kg_profile.flavor_profile / atmosphere / occasion_tags / best_dishes / what_makes_unique: use for nuanced answers about specific locations.
- kg_cuisines / kg_dishes / kg_allergens: verified data — prefer over guessing.
- special_labels: highlight accolades ("Michelin Bib", "Signature Cuisine").
- distance: if present, include in the answer.
`

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
