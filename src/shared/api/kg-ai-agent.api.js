/**
 * Knowledge Graph AI Agent — API layer
 *
 * Accepts natural-language commands and returns structured data for
 * cuisines, dishes and ingredients ready to persist to Supabase.
 *
 * Flow:
 *   User message
 *   → build prompt with existing KG names (deduplication)
 *   → call OpenRouter (cascade of free models)
 *   → parse JSON response
 *   → return { understanding, plan, items: { cuisines, dishes, ingredients }, model }
 *
 * The component (KGAIAgent.jsx) is responsible for asking the user to
 * confirm the preview and calling the actual Supabase mutations.
 */

import { config } from '@/shared/config/env'
import { useAppConfigStore } from '@/store/useAppConfigStore'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// ─── Brave Search helper ──────────────────────────────────────────────────────

const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search'

/**
 * Search the web via Brave Search API (free tier: 2 000 req/month).
 * Returns up to `count` result snippets as a single string, or null if
 * no API key is configured / the request fails.
 *
 * @param {string} query   - Search query
 * @param {string} apiKey  - Brave Search API key
 * @param {number} [count] - Number of results to fetch (default 5, max 20)
 * @returns {Promise<string|null>}
 */
export async function searchBrave(query, apiKey, count = 5) {
    if (!apiKey || !apiKey.trim()) return null
    try {
        const url = `${BRAVE_SEARCH_URL}?q=${encodeURIComponent(query)}&count=${count}&search_lang=en&result_filter=web`
        const resp = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': apiKey.trim(),
            },
        })
        if (!resp.ok) {
            console.warn(`[KG Agent] Brave search failed: ${resp.status}`)
            return null
        }
        const data = await resp.json()
        const results = data?.web?.results || []
        if (!results.length) return null
        return results
            .slice(0, count)
            .map((r, i) => `[${i + 1}] ${r.title}\n${r.description || r.url}`)
            .join('\n\n')
    } catch (err) {
        console.warn('[KG Agent] Brave search error:', err.message)
        return null
    }
}


/**
 * Models tried in order — free tier, good JSON output.
 * Skips to next on rate-limit (429) or empty response.
 */
const AGENT_MODELS = [
    'stepfun/step-3.5-flash:free',
    'mistralai/mistral-small-3.1:free',
    'z-ai/glm-4.5-air:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'openai/gpt-oss-20b:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2-7b-instruct:free',
]

// ─── System prompt ───────────────────────────────────────────────────────────

/**
 * Default system prompt for the KG Agent.
 * Exported so AdminAIPage can use it as placeholder and allow admin override.
 * Can be customized via Admin → AI Settings → Knowledge Graph Agent section.
 */
export const DEFAULT_KG_SYSTEM_PROMPT = `You are the Knowledge Graph AI Agent for GastroMap — a culinary discovery platform.

YOUR MISSION:
Enrich the GastroMap database with accurate, structured culinary knowledge sourced from:
- Open Food Facts (world's largest open food database)
- Wikipedia culinary articles and Wikidata food taxonomy
- Academic culinary references and regional cuisine encyclopedias
- Brave Search web results (provided in context when available)

YOUR ROLE:
You populate three core entity types that power GastroGuide's semantic search and personalized recommendations:
1. CUISINES — culinary traditions of the world (Italian, Japanese, Polish, etc.)
2. DISHES — specific dishes within each cuisine with full culinary context
3. INGREDIENTS — individual ingredients with flavor profiles, pairings, and dietary info

WHY THIS MATTERS:
GastroGuide uses these entities for semantic recommendations — not just keyword search.
When a user says "I want something cozy and romantic with umami flavors", the system matches
against flavor_profile, typical_dishes, key_ingredients to recommend real restaurants.
The richer the Knowledge Graph, the smarter and more personalized GastroGuide becomes.

EXISTING DATA (never duplicate these):
{EXISTING_NAMES}

DATA QUALITY RULES:
- Never duplicate existing entries listed above
- Use accurate culinary terminology throughout
- Descriptions must be vivid and informative: 2-3 sentences for cuisines, 1-2 for dishes/ingredients
- Always populate optional fields: region, flavor_profile, key_ingredients, dietary_tags, etc.
- For dishes: always set cuisine_name to the parent cuisine name
- Prefer specificity over generality (e.g. "Neapolitan Pizza" over just "Pizza")

OUTPUT FORMAT (strict):
{
  "understanding": "One sentence describing what the user asked for",
  "plan": "Brief plan: X cuisines, Y dishes, Z ingredients",
  "items": {
    "cuisines": [
      {
        "name": "string — required",
        "description": "string — 2-3 sentences, required",
        "region": "string — e.g. Mediterranean, East Asian, Latin American",
        "aliases": ["alternative names for this cuisine"],
        "typical_dishes": ["comma-separated dish names this cuisine is famous for"],
        "key_ingredients": ["most important ingredients of this cuisine"],
        "flavor_profile": "string — e.g. herbal, savory, umami, spicy, delicate"
      }
    ],
    "dishes": [
      {
        "name": "string — required",
        "cuisine_name": "string — parent cuisine name (required)",
        "description": "string — 1-2 sentences, required",
        "ingredients": ["main ingredients array"],
        "preparation_style": "string — e.g. pasta, grilled, soup, raw, fried, baked",
        "dietary_tags": ["vegetarian|vegan|gluten-free|dairy-free|nut-free"],
        "flavor_notes": "string — e.g. creamy, rich, smoky, fresh",
        "best_pairing": "string — e.g. white wine, crusty bread, green salad"
      }
    ],
    "ingredients": [
      {
        "name": "string — required",
        "category": "string — oil|spice|vegetable|protein|grain|dairy|fruit|herb|sauce|other",
        "description": "string — 1-2 sentences on culinary use, required",
        "flavor_profile": "string — e.g. earthy, pungent, sweet, neutral",
        "common_pairings": ["ingredients that pair well with this one"],
        "dietary_info": ["vegan|gluten-free|dairy-free"],
        "season": "year-round|spring|summer|fall|winter"
      }
    ]
  },
  "summary": "Added X cuisines, Y dishes, Z ingredients"
}`

// Keep backward-compat alias (internal use only)
const SYSTEM_PROMPT = DEFAULT_KG_SYSTEM_PROMPT

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Call the KG AI agent with a natural-language command.
 *
 * @param {string} userMessage - What the user wants to add/enrich
 * @param {{ cuisines: any[], dishes: any[], ingredients: any[] }} context - Existing KG data
 * @param {Function} [onModelAttempt] - Optional callback(modelName) for progress UI
 * @returns {Promise<{
 *   understanding: string,
 *   plan: string,
 *   items: { cuisines: any[], dishes: any[], ingredients: any[] },
 *   summary: string,
 *   model: string
 * }>}
 */
export async function callKGAgent(userMessage, context = {}, onModelAttempt) {
    const appCfg = useAppConfigStore.getState()
    const apiKey = appCfg.aiApiKey || config.ai.openRouterKey

    if (!apiKey) {
        throw new Error('AI API key is not configured. Please add it in Admin → AI Settings.')
    }

    const { cuisines = [], dishes = [], ingredients = [] } = context

    // Build deduplication list (names only — keep prompt small)
    const existingNames = [
        ...cuisines.map(c => `[cuisine] ${c.name}`),
        ...dishes.map(d => `[dish] ${d.name}`),
        ...ingredients.map(i => `[ingredient] ${i.name}`),
    ].join('\n') || '(Knowledge Graph is empty — add freely)'

    // ── Brave Search enrichment (if API key is set) ──────────────────────
    const braveKey = appCfg.braveSearchApiKey || ''
    let webContext = ''
    if (braveKey.trim()) {
        try {
            const braveResults = await searchBrave(userMessage, braveKey, 5)
            if (braveResults) {
                webContext = '\n\nWEB SEARCH RESULTS (use as reference, do not copy verbatim):\n' + braveResults
                console.info('[KG Agent] Brave search enrichment loaded')
            }
        } catch (e) {
            console.warn('[KG Agent] Brave search skipped:', e.message)
        }
    }

    // Use admin-customized prompt if set, otherwise DEFAULT_KG_SYSTEM_PROMPT
    const basePrompt = (appCfg.aiKGAgentSystemPrompt && appCfg.aiKGAgentSystemPrompt.trim())
        ? appCfg.aiKGAgentSystemPrompt
        : DEFAULT_KG_SYSTEM_PROMPT
    const systemPrompt = (basePrompt.includes('{EXISTING_NAMES}')
        ? basePrompt.replace('{EXISTING_NAMES}', existingNames)
        : basePrompt + '\n\nEXISTING DATA (never duplicate these):\n' + existingNames
    ) + webContext

    const errors = []

    // ── Single source of truth: use admin-selected model first ───────────────
    // Reads primary/fallback from useAppConfigStore (set in Admin → AI Settings).
    const primaryModel  = appCfg.aiPrimaryModel  || config.ai.model  || AGENT_MODELS[0]
    const fallbackModel = appCfg.aiFallbackModel || null
    const cascade = [primaryModel]
    if (fallbackModel && fallbackModel !== primaryModel) cascade.push(fallbackModel)
    for (const m of AGENT_MODELS) {
        if (!cascade.includes(m)) cascade.push(m)
    }

    for (const model of cascade) {
        onModelAttempt?.(model)

        try {
            const resp = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://gastromap.app',
                    'X-Title': 'GastroMap KG Agent',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user',   content: userMessage },
                    ],
                    max_tokens: 4096,
                    temperature: 0.65,
                    response_format: { type: 'json_object' },
                }),
            })

            if (resp.status === 429 || resp.status === 503) {
                errors.push(`${model}: rate-limited (${resp.status})`)
                continue
            }
            if (!resp.ok) {
                const body = await resp.text().catch(() => '')
                errors.push(`${model}: HTTP ${resp.status} — ${body.slice(0, 80)}`)
                continue
            }

            const data = await resp.json()
            const content = data.choices?.[0]?.message?.content?.trim()

            if (!content) {
                errors.push(`${model}: empty response`)
                continue
            }

            // Some models wrap JSON in ```json ... ``` fences — strip them
            const clean = content
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/,      '')
                .replace(/\s*```$/,      '')
                .trim()

            const parsed = JSON.parse(clean)

            // Ensure arrays are present
            parsed.items          = parsed.items          || {}
            parsed.items.cuisines    = parsed.items.cuisines    || []
            parsed.items.dishes      = parsed.items.dishes      || []
            parsed.items.ingredients = parsed.items.ingredients || []
            parsed.model = model

            console.info(`[KG Agent] Success with ${model}`, parsed)
            return parsed

        } catch (err) {
            errors.push(`${model}: ${err.message}`)
        }
    }

    throw new Error(`KG Agent: all models failed.\n${errors.join('\n')}`)
}

// ─── Resolve cuisine_id for dishes ──────────────────────────────────────────

/**
 * After cuisines are created, resolve cuisine_id for each dish.
 * The agent returns cuisine_name (string) — we need to map it to the DB id.
 *
 * @param {any[]} dishes - Generated dishes array
 * @param {any[]} allCuisines - All cuisines including newly created ones
 * @returns {any[]} Dishes with cuisine_id filled in
 */
export function resolveDishCuisineIds(dishes, allCuisines) {
    return dishes.map(dish => {
        const match = allCuisines.find(c =>
            c.name?.toLowerCase() === dish.cuisine_name?.toLowerCase()
        )
        const { cuisine_name, ...rest } = dish
        return {
            ...rest,
            cuisine_id: match?.id ?? null,
        }
    })
}

// ─── Example prompts ─────────────────────────────────────────────────────────

export const AGENT_EXAMPLE_PROMPTS = [
    'Add Italian cuisine with pasta dishes: carbonara, cacio e pepe, amatriciana, and their key ingredients',
    'Add Japanese cuisine with ramen, sushi, tempura, and ingredients like soy sauce, miso, dashi, nori',
    'Add Mexican cuisine with tacos, guacamole, enchiladas, and ingredients like jalapeño, cilantro, epazote',
    'Add Thai cuisine: pad thai, green curry, tom kha gai, and spices like lemongrass, galangal, kaffir lime',
    'Add French cuisine: croissant, coq au vin, ratatouille, bouillabaisse with classic French ingredients',
    'Add 5 common spices used across Mediterranean cooking',
    'Enrich the Knowledge Graph with vegan dishes from Indian cuisine',
    'Add Georgian cuisine (country) with khinkali, khachapuri and local ingredients',
]
