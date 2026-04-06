/**
 * Knowledge Graph AI Agent — API layer
 *
 * Flow:
 *   User message
 *   → build context: FULL existing data (names + ingredients per dish)
 *   → call OpenRouter — AI returns ONLY missing items (diff-aware)
 *   → client-side dedup filter (safety net)
 *   → return { understanding, plan, items, diffReport, model }
 *
 * The component (KGAIAgent.jsx) shows each item with status: 'new' | 'exists' | 'partial'
 * 'partial' = dish exists but missing some ingredients → only new ingredients offered
 */

import { config } from '@/shared/config/env'
import { useAppConfigStore } from '@/store/useAppConfigStore'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// ─── Brave Search helper ──────────────────────────────────────────────────────

export async function searchBrave(query, apiKey, count = 5) {
    if (!apiKey || !apiKey.trim()) return null
    try {
        const resp = await fetch('/api/brave-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, count, apiKey }),
        })
        if (!resp.ok) {
            console.warn(`[KG Agent] Brave search proxy failed: ${resp.status}`)
            return null
        }
        const data = await resp.json()
        const results = data?.results || []
        if (!results.length) return null
        return results
            .map((r, i) => `[${i + 1}] ${r.title}\n${r.description || r.url}`)
            .join('\n\n')
    } catch (err) {
        console.warn('[KG Agent] Brave search error:', err.message)
        return null
    }
}

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

export const DEFAULT_KG_SYSTEM_PROMPT = `You are the Knowledge Graph AI Agent for GastroMap — a culinary discovery platform.

YOUR MISSION:
Enrich the GastroMap database with accurate, structured culinary knowledge.

YOUR ROLE:
You populate three core entity types:
1. CUISINES — culinary traditions of the world
2. DISHES — specific dishes within each cuisine
3. INGREDIENTS — individual ingredients with flavor profiles and pairings

EXISTING KNOWLEDGE GRAPH (do NOT add anything already listed here):
{EXISTING_NAMES}

SMART DIFF RULES — read carefully:
- Compare the user's request against the EXISTING DATA above
- Only generate items that are MISSING from the existing data
- If a cuisine exists → skip it, but still add its missing dishes
- If a dish exists → check its ingredients list; only add missing ingredients
- If everything requested already exists → return empty arrays and explain in "understanding"
- Be precise: "Italian" and "Italian Cuisine" are the same — do not duplicate
- Ingredient names: "olive oil" = "Olive Oil" = "extra virgin olive oil" — treat as same, pick the best name

OUTPUT FORMAT (strict JSON):
{
  "understanding": "What the user asked for, and what already existed vs what you're adding",
  "plan": "X new cuisines, Y new dishes, Z new ingredients (N items skipped — already in KG)",
  "items": {
    "cuisines": [...],
    "dishes": [...],
    "ingredients": [...]
  },
  "skipped": {
    "cuisines": ["name of cuisine that already exists"],
    "dishes": ["name of dish that already exists"],
    "ingredients": ["name of ingredient that already exists"]
  },
  "summary": "Added X cuisines, Y dishes, Z ingredients. Skipped N duplicates."
}

CUISINE SCHEMA:
{
  "name": "string — required",
  "description": "string — 2-3 sentences, required",
  "region": "string — e.g. Mediterranean, East Asian, Latin American",
  "aliases": ["alternative names"],
  "typical_dishes": ["dish names this cuisine is famous for"],
  "key_ingredients": ["most important ingredients"],
  "flavor_profile": "string — e.g. herbal, savory, umami, spicy"
}

DISH SCHEMA:
{
  "name": "string — required",
  "cuisine_name": "string — parent cuisine name (required)",
  "description": "string — 1-2 sentences, required",
  "ingredients": ["main ingredients array"],
  "preparation_style": "string — e.g. pasta, grilled, soup, fried, baked",
  "dietary_tags": ["vegetarian|vegan|gluten-free|dairy-free|nut-free"],
  "flavor_notes": "string — e.g. creamy, rich, smoky, fresh",
  "best_pairing": "string — e.g. white wine, crusty bread"
}

INGREDIENT SCHEMA:
{
  "name": "string — required",
  "category": "string — oil|spice|vegetable|protein|grain|dairy|fruit|herb|sauce|other",
  "description": "string — 1-2 sentences, required",
  "flavor_profile": "string — e.g. earthy, pungent, sweet, neutral",
  "common_pairings": ["ingredients that pair well"],
  "dietary_info": ["vegan|gluten-free|dairy-free"],
  "season": "year-round|spring|summer|fall|winter"
}`

const SYSTEM_PROMPT = DEFAULT_KG_SYSTEM_PROMPT

// ─── Build rich existing context for AI ──────────────────────────────────────

/**
 * Builds a detailed context string for the AI prompt.
 * Includes dish→ingredients mapping so AI can detect partial matches.
 */
function buildExistingContext(cuisines, dishes, ingredients) {
    const lines = []

    if (cuisines.length > 0) {
        lines.push('=== EXISTING CUISINES ===')
        cuisines.forEach(c => {
            lines.push(`[cuisine] ${c.name}${c.region ? ` (${c.region})` : ''}`)
        })
    }

    if (dishes.length > 0) {
        lines.push('\n=== EXISTING DISHES ===')
        dishes.forEach(d => {
            const ings = Array.isArray(d.ingredients) && d.ingredients.length > 0
                ? ` | ingredients: ${d.ingredients.join(', ')}`
                : ''
            lines.push(`[dish] ${d.name}${d.cuisine_name ? ` (${d.cuisine_name})` : ''}${ings}`)
        })
    }

    if (ingredients.length > 0) {
        lines.push('\n=== EXISTING INGREDIENTS ===')
        ingredients.forEach(i => {
            lines.push(`[ingredient] ${i.name}${i.category ? ` (${i.category})` : ''}`)
        })
    }

    return lines.length > 0 ? lines.join('\n') : '(Knowledge Graph is empty — add freely)'
}

// ─── Client-side dedup filter ─────────────────────────────────────────────────

/**
 * After AI returns items, do a final client-side dedup pass.
 * Returns { filtered: items, duplicates: { cuisines, dishes, ingredients } }
 */
function clientDedup(items, existingCuisines, existingDishes, existingIngredients) {
    const norm = s => s?.toLowerCase().trim() || ''

    const exCuisineNames = new Set(existingCuisines.map(c => norm(c.name)))
    const exDishNames    = new Set(existingDishes.map(d => norm(d.name)))
    const exIngNames     = new Set(existingIngredients.map(i => norm(i.name)))

    const duplicates = { cuisines: [], dishes: [], ingredients: [] }
    const filtered = {
        cuisines:    [],
        dishes:      [],
        ingredients: [],
    }

    items.cuisines.forEach(c => {
        if (exCuisineNames.has(norm(c.name))) {
            duplicates.cuisines.push(c.name)
        } else {
            filtered.cuisines.push(c)
            exCuisineNames.add(norm(c.name)) // prevent dupes within the batch itself
        }
    })

    items.dishes.forEach(d => {
        if (exDishNames.has(norm(d.name))) {
            duplicates.dishes.push(d.name)
        } else {
            filtered.dishes.push(d)
            exDishNames.add(norm(d.name))
        }
    })

    items.ingredients.forEach(i => {
        if (exIngNames.has(norm(i.name))) {
            duplicates.ingredients.push(i.name)
        } else {
            filtered.ingredients.push(i)
            exIngNames.add(norm(i.name))
        }
    })

    return { filtered, duplicates }
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function callKGAgent(userMessage, context = {}, onModelAttempt) {
    const appCfg = useAppConfigStore.getState()
    const apiKey = appCfg.aiApiKey || config.ai.openRouterKey

    if (!apiKey) {
        throw new Error('AI API key is not configured. Please add it in Admin → AI Settings.')
    }

    const { cuisines = [], dishes = [], ingredients = [] } = context

    // Build rich context (includes dish→ingredients for partial matching)
    const existingContext = buildExistingContext(cuisines, dishes, ingredients)

    // Brave Search enrichment
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

    const basePrompt = (appCfg.aiKGAgentSystemPrompt && appCfg.aiKGAgentSystemPrompt.trim())
        ? appCfg.aiKGAgentSystemPrompt
        : DEFAULT_KG_SYSTEM_PROMPT

    const systemPrompt = (basePrompt.includes('{EXISTING_NAMES}')
        ? basePrompt.replace('{EXISTING_NAMES}', existingContext)
        : basePrompt + '\n\nEXISTING DATA (never duplicate these):\n' + existingContext
    ) + webContext

    const errors = []

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
            const rawContent = data.choices?.[0]?.message?.content?.trim()

            if (!rawContent) {
                errors.push(`${model}: empty response`)
                continue
            }

            const clean = rawContent
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/,      '')
                .replace(/\s*```$/,      '')
                .trim()

            const parsed = JSON.parse(clean)

            parsed.items             = parsed.items          || {}
            parsed.items.cuisines    = parsed.items.cuisines    || []
            parsed.items.dishes      = parsed.items.dishes      || []
            parsed.items.ingredients = parsed.items.ingredients || []
            parsed.skipped           = parsed.skipped        || { cuisines: [], dishes: [], ingredients: [] }
            parsed.model             = model

            // ── Client-side safety dedup ──────────────────────────────────
            const { filtered, duplicates } = clientDedup(
                parsed.items,
                cuisines,
                dishes,
                ingredients,
            )

            // Merge AI-reported skipped + client-detected dupes
            parsed.skipped.cuisines    = [...new Set([...(parsed.skipped.cuisines || []),    ...duplicates.cuisines])]
            parsed.skipped.dishes      = [...new Set([...(parsed.skipped.dishes || []),      ...duplicates.dishes])]
            parsed.skipped.ingredients = [...new Set([...(parsed.skipped.ingredients || []), ...duplicates.ingredients])]
            parsed.items = filtered

            const totalSkipped =
                parsed.skipped.cuisines.length +
                parsed.skipped.dishes.length +
                parsed.skipped.ingredients.length

            if (totalSkipped > 0) {
                console.info(
                    `[KG Agent] Dedup: skipped ${totalSkipped} duplicates`,
                    parsed.skipped,
                )
            }

            console.info(`[KG Agent] Success with ${model}`, parsed)
            return parsed

        } catch (err) {
            errors.push(`${model}: ${err.message}`)
        }
    }

    throw new Error(`KG Agent: all models failed.\n${errors.join('\n')}`)
}

// ─── Resolve cuisine_id for dishes ──────────────────────────────────────────

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
    'Add all European cuisines, their top 10 dishes and all ingredients',
    'Add Italian cuisine with pasta dishes: carbonara, cacio e pepe, amatriciana, and their key ingredients',
    'Add Japanese cuisine with ramen, sushi, tempura, and ingredients like soy sauce, miso, dashi, nori',
    'Add Mexican cuisine with tacos, guacamole, enchiladas, and ingredients like jalapeño, cilantro, epazote',
    'Add Thai cuisine: pad thai, green curry, tom kha gai, and spices like lemongrass, galangal, kaffir lime',
    'Add French cuisine: croissant, coq au vin, ratatouille, bouillabaisse with classic French ingredients',
    'Add 5 common spices used across Mediterranean cooking',
    'Enrich the Knowledge Graph with vegan dishes from Indian cuisine',
]
