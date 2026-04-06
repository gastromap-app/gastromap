/**
 * Knowledge Graph AI Agent — API layer
 *
 * Optimized flow (April 2026):
 *   User message
 *   → build SLIM context: only names for dedup (not ingredients per dish)
 *   → dynamic max_tokens based on request size
 *   → call OpenRouter — AI returns ONLY missing items (diff-aware)
 *   → client-side dedup filter (safety net)
 *   → return { understanding, plan, items, skipped, model }
 *
 * Key optimizations vs previous version:
 *  1. buildExistingContext() — removed ingredients from dish lines (~70% fewer tokens)
 *  2. max_tokens — dynamic: 800 small / 2000 medium / 3500 large request
 *  3. temperature — lowered 0.65 → 0.3 (JSON tasks need determinism, not creativity)
 *  4. response_format — kept json_object but prompt is now tighter
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
- If everything requested already exists → return empty arrays and explain in "understanding"
- Be precise: "Italian" and "Italian Cuisine" are the same — do not duplicate
- Ingredient names: "olive oil" = "Olive Oil" — treat as same, pick the best name

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

// ─── Build SLIM context for dedup ────────────────────────────────────────────

/**
 * Builds a minimal name-only context string for the AI prompt.
 *
 * OPTIMIZATION vs old version:
 *  OLD: "[dish] Carbonara (Italian) | ingredients: egg, pancetta, pecorino, black pepper"
 *  NEW: "Carbonara"
 *
 * Why: AI already knows what's in carbonara — we're only passing names for dedup.
 * This cuts context token count by ~70% when DB has 50+ dishes with ingredients.
 *
 * Token savings example (100 dishes × avg 8 ingredients):
 *  Old: ~2400 tokens for dishes alone
 *  New: ~200 tokens for dishes alone
 */
function buildExistingContext(cuisines, dishes, ingredients) {
    const parts = []

    if (cuisines.length > 0) {
        parts.push('CUISINES: ' + cuisines.map(c => c.name).join(', '))
    }
    if (dishes.length > 0) {
        parts.push('DISHES: ' + dishes.map(d => d.name).join(', '))
    }
    if (ingredients.length > 0) {
        parts.push('INGREDIENTS: ' + ingredients.map(i => i.name).join(', '))
    }

    if (parts.length === 0) return '(Knowledge Graph is empty — add freely)'

    return parts.join('\n')
}

// ─── Dynamic max_tokens based on request complexity ───────────────────────────

/**
 * Estimates how many output tokens the request will need.
 * Small request ("add carbonara") → 800 tokens
 * Medium ("add Italian cuisine with 5 dishes") → 2000 tokens
 * Large ("add all European cuisines with top 10 dishes and ingredients") → 3500 tokens
 */
function estimateMaxTokens(userMessage) {
    const msg = userMessage.toLowerCase()

    // Large: "all X", "every", multiple cuisines + dishes + ingredients in one request
    if (
        msg.includes('all ') ||
        msg.includes('every ') ||
        (msg.includes('cuisine') && msg.includes('dish') && msg.includes('ingredient'))
    ) return 3500

    // Medium: one cuisine with dishes, or multiple dishes
    if (
        msg.includes('cuisine') ||
        msg.includes('dishes') ||
        msg.includes('top ') ||
        /\d+\s+dish/.test(msg)
    ) return 2000

    // Small: single item or a few ingredients
    return 800
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

    for (const c of (items.cuisines || [])) {
        if (exCuisineNames.has(norm(c.name))) {
            duplicates.cuisines.push(c.name)
        } else {
            filtered.cuisines.push(c)
            exCuisineNames.add(norm(c.name)) // prevent intra-batch dupes
        }
    }
    for (const d of (items.dishes || [])) {
        if (exDishNames.has(norm(d.name))) {
            duplicates.dishes.push(d.name)
        } else {
            filtered.dishes.push(d)
            exDishNames.add(norm(d.name))
        }
    }
    for (const i of (items.ingredients || [])) {
        if (exIngNames.has(norm(i.name))) {
            duplicates.ingredients.push(i.name)
        } else {
            filtered.ingredients.push(i)
            exIngNames.add(norm(i.name))
        }
    }

    return { filtered, duplicates }
}

// ─── Main agent call ──────────────────────────────────────────────────────────

export async function callKGAgent(userMessage, context = {}, onModelAttempt) {
    const appCfg = useAppConfigStore.getState()
    const apiKey = appCfg.aiApiKey || config.ai.openRouterKey

    if (!apiKey) {
        throw new Error('AI API key is not configured. Please add it in Admin → AI Settings.')
    }

    const { cuisines = [], dishes = [], ingredients = [] } = context

    // ── Slim context (names only — no ingredients per dish) ───────────────────
    const existingContext = buildExistingContext(cuisines, dishes, ingredients)

    // Log token estimate for debugging
    const contextTokenEstimate = Math.ceil(existingContext.length / 4)
    console.debug(`[KG Agent] Context size: ${existingContext.length} chars (~${contextTokenEstimate} tokens)`)

    // ── Brave Search enrichment (optional) ───────────────────────────────────
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

    // ── Compose system prompt ─────────────────────────────────────────────────
    const basePrompt = (appCfg.aiKGAgentSystemPrompt && appCfg.aiKGAgentSystemPrompt.trim())
        ? appCfg.aiKGAgentSystemPrompt
        : DEFAULT_KG_SYSTEM_PROMPT

    const systemPrompt = (basePrompt.includes('{EXISTING_NAMES}')
        ? basePrompt.replace('{EXISTING_NAMES}', existingContext)
        : basePrompt + '\n\nEXISTING DATA (never duplicate these):\n' + existingContext
    ) + webContext

    // ── Dynamic max_tokens ────────────────────────────────────────────────────
    const maxTokens = estimateMaxTokens(userMessage)
    console.debug(`[KG Agent] max_tokens: ${maxTokens} (estimated for request size)`)

    // ── Model cascade ─────────────────────────────────────────────────────────
    const primaryModel  = appCfg.aiPrimaryModel  || config.ai.model  || AGENT_MODELS[0]
    const fallbackModel = appCfg.aiFallbackModel || null
    const cascade = [primaryModel]
    if (fallbackModel && fallbackModel !== primaryModel) cascade.push(fallbackModel)
    for (const m of AGENT_MODELS) {
        if (!cascade.includes(m)) cascade.push(m)
    }

    const errors = []

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
                    max_tokens:      maxTokens,
                    temperature:     0.3,   // lowered: JSON tasks need precision, not creativity
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

            // ── Client-side safety dedup ──────────────────────────────────────
            const { filtered, duplicates } = clientDedup(
                parsed.items,
                cuisines,
                dishes,
                ingredients,
            )

            // Merge AI-reported skipped + client-detected dupes
            parsed.skipped.cuisines    = [...new Set([...(parsed.skipped.cuisines    || []), ...duplicates.cuisines])]
            parsed.skipped.dishes      = [...new Set([...(parsed.skipped.dishes      || []), ...duplicates.dishes])]
            parsed.skipped.ingredients = [...new Set([...(parsed.skipped.ingredients || []), ...duplicates.ingredients])]
            parsed.items = filtered

            const totalSkipped =
                parsed.skipped.cuisines.length +
                parsed.skipped.dishes.length +
                parsed.skipped.ingredients.length

            if (totalSkipped > 0) {
                console.info(`[KG Agent] Dedup: skipped ${totalSkipped} duplicates`, parsed.skipped)
            }

            console.info(`[KG Agent] ✓ ${model} | tokens: ${maxTokens} | ctx: ~${contextTokenEstimate}`, parsed)
            return parsed

        } catch (err) {
            errors.push(`${model}: ${err.message}`)
        }
    }

    throw new Error(`KG Agent: all models failed.\n${errors.join('\n')}`)
}

// ─── Resolve cuisine_id for dishes ───────────────────────────────────────────

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

// ─── Example prompts ──────────────────────────────────────────────────────────

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
