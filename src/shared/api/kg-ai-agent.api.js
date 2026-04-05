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

const SYSTEM_PROMPT = `You are the Knowledge Graph AI Agent for GastroMap — a culinary map application.
Your task is to analyse the user's request and generate rich, accurate data to populate the culinary Knowledge Graph.

The Knowledge Graph contains three entity types:
1. Cuisines  — types of cuisine (Italian, Japanese, etc.)
2. Dishes    — specific dishes that belong to a cuisine
3. Ingredients — individual ingredients with culinary context

EXISTING DATA (never duplicate these):
{EXISTING_NAMES}

INSTRUCTIONS:
- Analyse the user's request and decide what cuisines / dishes / ingredients to add.
- Only include items that do NOT already exist in EXISTING DATA above.
- Make descriptions vivid, culinary-focused and informative (2-3 sentences for cuisines, 1-2 for dishes/ingredients).
- Populate every optional field you can with accurate culinary knowledge.
- For dishes, set cuisine_name to the parent cuisine (either one you are creating now or an existing one).
- Return ONLY a valid JSON object. No markdown fences, no extra text, just JSON.

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

    const systemPrompt = SYSTEM_PROMPT.replace('{EXISTING_NAMES}', existingNames)

    const errors = []

    for (const model of AGENT_MODELS) {
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
