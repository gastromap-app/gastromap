/**
 * Knowledge Graph AI Agent — API layer
 *
 * Smart Context flow (April 2026):
 *   User message
 *   → extractKeywords()  — вытаскиваем ключевые слова из запроса
 *   → filterRelevant()   — ищем только совпадения в локальном KG (без AI)
 *   → buildSmartContext() — передаём AI только: EXISTS / NOT_FOUND (2-10 строк вместо сотен)
 *   → AI генерирует только то чего нет
 *   → clientDedup()      — финальная страховка
 *
 * Было: передавали ВСЕ записи KG (~500+ имён) при каждом запросе
 * Стало: передаём только совпадения по запросу (обычно 0-5 строк)
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
        if (!resp.ok) return null
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

// ─── System prompt ────────────────────────────────────────────────────────────

export const DEFAULT_KG_SYSTEM_PROMPT = `You are the Knowledge Graph AI Agent for GastroMap — a culinary discovery platform.

YOUR MISSION:
Enrich the GastroMap database with accurate, structured culinary knowledge.

YOUR ROLE:
You populate three core entity types:
1. CUISINES — culinary traditions of the world
2. DISHES — specific dishes within each cuisine
3. INGREDIENTS — individual ingredients with flavor profiles and pairings

DEDUP CHECK (items already verified against database):
{EXISTING_NAMES}

RULES:
- Items marked EXISTS → skip them completely, do NOT include in output
- Items marked NOT_FOUND → generate and include them
- If user asks for something not in the check list → generate it freely
- Be precise with names: "Italian" = "Italian Cuisine", "olive oil" = "Olive Oil"

OUTPUT FORMAT (strict JSON):
{
  "understanding": "What the user asked for, what already existed vs what you are adding",
  "plan": "X new cuisines, Y new dishes, Z new ingredients (N items skipped)",
  "items": {
    "cuisines": [...],
    "dishes": [...],
    "ingredients": [...]
  },
  "skipped": {
    "cuisines": ["names that already exist"],
    "dishes": ["names that already exist"],
    "ingredients": ["names that already exist"]
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

// ─── Smart Context Engine ─────────────────────────────────────────────────────

/**
 * Вытаскивает ключевые слова из запроса пользователя.
 * Убирает стоп-слова, нормализует.
 *
 * "Add Italian cuisine with carbonara and pancetta"
 * → ["italian", "carbonara", "pancetta"]
 */
function extractKeywords(message) {
    const STOP_WORDS = new Set([
        'add', 'create', 'insert', 'put', 'include', 'generate',
        'the', 'a', 'an', 'and', 'or', 'with', 'of', 'in', 'for',
        'all', 'some', 'its', 'their', 'from', 'into', 'to', 'by',
        'cuisine', 'dish', 'dishes', 'ingredient', 'ingredients',
        'top', 'best', 'classic', 'traditional', 'famous', 'popular',
        'key', 'main', 'typical', 'common', 'new', 'enrich',
        'knowledge', 'graph', 'database', 'gastromap',
    ])

    return message
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

/**
 * Нормализует строку для нечёткого сравнения:
 * "Italian Cuisine" → "italian cuisine" → "italian"
 */
function norm(str) {
    return (str || '')
        .toLowerCase()
        .replace(/\s+cuisine$/, '')   // убираем суффикс "cuisine"
        .replace(/\s+food$/, '')      // убираем "food"
        .trim()
}

/**
 * Проверяет совпадает ли keyword с именем записи (нечёткое вхождение).
 * "italian" совпадает с "Italian Cuisine" и "Italian"
 * "carbonara" совпадает с "Carbonara alla Romana"
 */
function isMatch(keyword, name) {
    const kw   = norm(keyword)
    const nm   = norm(name)
    return nm === kw || nm.includes(kw) || kw.includes(nm)
}

/**
 * ГЛАВНАЯ ФУНКЦИЯ: фильтрует только релевантные записи из KG.
 *
 * Вместо того чтобы передавать ВСЕ 500+ записей — ищем только совпадения
 * с ключевыми словами из запроса. Результат: 0-10 строк вместо сотен.
 *
 * Returns:
 *  {
 *    exists: { cuisines: [], dishes: [], ingredients: [] },   // найдено в БД
 *    context: string  // готовая строка для system prompt
 *  }
 */
function buildSmartContext(userMessage, cuisines, dishes, ingredients) {
    const keywords = extractKeywords(userMessage)

    console.debug('[KG Agent] Keywords extracted:', keywords)

    const found = { cuisines: [], dishes: [], ingredients: [] }

    // Ищем совпадения — достаточно одного keyword чтобы запись считалась релевантной
    for (const c of cuisines) {
        if (keywords.some(kw => isMatch(kw, c.name))) {
            found.cuisines.push(c.name)
        }
    }
    for (const d of dishes) {
        if (keywords.some(kw => isMatch(kw, d.name))) {
            found.dishes.push(d.name)
        }
    }
    for (const i of ingredients) {
        if (keywords.some(kw => isMatch(kw, i.name))) {
            found.ingredients.push(i.name)
        }
    }

    const totalFound = found.cuisines.length + found.dishes.length + found.ingredients.length
    const totalKG    = cuisines.length + dishes.length + ingredients.length

    console.debug(
        `[KG Agent] Smart context: ${totalFound} relevant matches from ${totalKG} total KG records`,
        found
    )

    // Если KG пустой — так и скажем
    if (totalKG === 0) {
        return { found, context: '(Knowledge Graph is empty — add freely)' }
    }

    // Если нет совпадений — всё запрошенное новое
    if (totalFound === 0) {
        return { found, context: '(Nothing in your request matches existing KG — add everything freely)' }
    }

    // Строим компактный контекст — только EXISTS/NOT_FOUND для совпадений
    const lines = []

    if (found.cuisines.length > 0) {
        lines.push(`EXISTS (cuisines): ${found.cuisines.join(', ')}`)
    }
    if (found.dishes.length > 0) {
        lines.push(`EXISTS (dishes): ${found.dishes.join(', ')}`)
    }
    if (found.ingredients.length > 0) {
        lines.push(`EXISTS (ingredients): ${found.ingredients.join(', ')}`)
    }

    return { found, context: lines.join('\n') }
}

// ─── Dynamic max_tokens ───────────────────────────────────────────────────────

function estimateMaxTokens(userMessage) {
    const msg = userMessage.toLowerCase()
    if (
        msg.includes('all ') ||
        msg.includes('every ') ||
        (msg.includes('cuisine') && msg.includes('dish') && msg.includes('ingredient'))
    ) return 3500
    if (
        msg.includes('cuisine') ||
        msg.includes('dishes') ||
        msg.includes('top ') ||
        /\d+\s+dish/.test(msg)
    ) return 2000
    return 800
}

// ─── Client-side dedup (safety net) ──────────────────────────────────────────

function clientDedup(items, existingCuisines, existingDishes, existingIngredients) {
    const n = s => s?.toLowerCase().trim() || ''
    const exC = new Set(existingCuisines.map(c => n(c.name)))
    const exD = new Set(existingDishes.map(d => n(d.name)))
    const exI = new Set(existingIngredients.map(i => n(i.name)))

    const duplicates = { cuisines: [], dishes: [], ingredients: [] }
    const filtered   = { cuisines: [], dishes: [], ingredients: [] }

    for (const c of (items.cuisines || [])) {
        if (exC.has(n(c.name))) { duplicates.cuisines.push(c.name) }
        else { filtered.cuisines.push(c); exC.add(n(c.name)) }
    }
    for (const d of (items.dishes || [])) {
        if (exD.has(n(d.name))) { duplicates.dishes.push(d.name) }
        else { filtered.dishes.push(d); exD.add(n(d.name)) }
    }
    for (const i of (items.ingredients || [])) {
        if (exI.has(n(i.name))) { duplicates.ingredients.push(i.name) }
        else { filtered.ingredients.push(i); exI.add(n(i.name)) }
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

    // ── Smart context: только релевантные совпадения из KG ────────────────────
    const { found, context: smartContext } = buildSmartContext(
        userMessage, cuisines, dishes, ingredients
    )

    // ── Brave Search enrichment (optional) ───────────────────────────────────
    const braveKey = appCfg.braveSearchApiKey || ''
    let webContext = ''
    if (braveKey.trim()) {
        try {
            const braveResults = await searchBrave(userMessage, braveKey, 5)
            if (braveResults) {
                webContext = '\n\nWEB SEARCH RESULTS (use as reference):\n' + braveResults
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
        ? basePrompt.replace('{EXISTING_NAMES}', smartContext)
        : basePrompt + '\n\nDEDUP CHECK:\n' + smartContext
    ) + webContext

    // ── Dynamic max_tokens ────────────────────────────────────────────────────
    const maxTokens = estimateMaxTokens(userMessage)

    const ctxTokens = Math.ceil(smartContext.length / 4)
    console.debug(`[KG Agent] Sending to AI — context: ~${ctxTokens} tokens | max_tokens: ${maxTokens}`)

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
                    temperature:     0.3,
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
                parsed.items, cuisines, dishes, ingredients
            )

            // Merge: AI-reported skipped + client-detected dupes
            parsed.skipped.cuisines    = [...new Set([...(parsed.skipped.cuisines    || []), ...duplicates.cuisines])]
            parsed.skipped.dishes      = [...new Set([...(parsed.skipped.dishes      || []), ...duplicates.dishes])]
            parsed.skipped.ingredients = [...new Set([...(parsed.skipped.ingredients || []), ...duplicates.ingredients])]
            parsed.items = filtered

            const totalSkipped = parsed.skipped.cuisines.length + parsed.skipped.dishes.length + parsed.skipped.ingredients.length
            if (totalSkipped > 0) {
                console.info(`[KG Agent] Dedup: skipped ${totalSkipped} duplicates`, parsed.skipped)
            }

            console.info(`[KG Agent] ✓ ${model} | ctx: ~${ctxTokens} tokens | max: ${maxTokens}`)
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
        return { ...rest, cuisine_id: match?.id ?? null }
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
