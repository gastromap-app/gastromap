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

// ─── 🔍 KG Agent Debugger ─────────────────────────────────────────────────────
//
// Автоматически активируется в localStorage: localStorage.setItem('KG_DEBUG', '1')
// Деактивируется:                            localStorage.removeItem('KG_DEBUG')
// Или из консоли:                            window.KGDebug.enable() / .disable()
//
// Показывает: все этапы, тайминги, размеры payload, ответы моделей, ошибки

const KGDebug = (() => {
    const isEnabled = () => {
        try { return localStorage.getItem('KG_DEBUG') === '1' } catch { return false }
    }

    const C = {
        HEADER:  'color:#a78bfa;font-weight:bold;font-size:13px',
        STEP:    'color:#60a5fa;font-weight:600',
        SUCCESS: 'color:#34d399;font-weight:600',
        WARN:    'color:#fbbf24;font-weight:600',
        ERROR:   'color:#f87171;font-weight:600',
        INFO:    'color:#94a3b8',
        TIME:    'color:#c084fc;font-style:italic',
        KEY:     'color:#e2e8f0;font-weight:600',
        VAL:     'color:#7dd3fc',
    }

    let _sessionStart = null
    let _stepTimers   = {}

    const fmt = ms => ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(2)}s`

    const header = (title) => {
        if (!isEnabled()) return
        _sessionStart = performance.now()
        _stepTimers   = {}
        console.group(
            `%c🧠 KG Agent Session — ${new Date().toLocaleTimeString()}`,
            C.HEADER
        )
        console.log('%c' + '─'.repeat(60), C.INFO)
        console.log(`%c📝 Query: %c"${title}"`, C.KEY, C.VAL)
        console.log('%c' + '─'.repeat(60), C.INFO)
    }

    const footer = (result) => {
        if (!isEnabled()) return
        const total = fmt(performance.now() - _sessionStart)
        console.log('%c' + '─'.repeat(60), C.INFO)
        console.log(`%c✅ Session complete %c${total} total`, C.SUCCESS, C.TIME)
        if (result) {
            const c = result.items?.cuisines?.length  || 0
            const d = result.items?.dishes?.length    || 0
            const i = result.items?.ingredients?.length || 0
            const sc = (result.skipped?.cuisines?.length || 0) +
                       (result.skipped?.dishes?.length   || 0) +
                       (result.skipped?.ingredients?.length || 0)
            console.log(
                `%c📦 Result: %c${c} cuisines, ${d} dishes, ${i} ingredients %c(${sc} skipped)`,
                C.KEY, C.SUCCESS, C.WARN
            )
        }
        console.groupEnd()
    }

    const step = (id, label) => {
        if (!isEnabled()) return
        _stepTimers[id] = performance.now()
        console.log(`%c⏱ [${id}] %c${label}`, C.STEP, C.KEY)
    }

    const stepDone = (id, label, data) => {
        if (!isEnabled()) return
        const t = _stepTimers[id] ? fmt(performance.now() - _stepTimers[id]) : '?'
        console.log(`%c✓ [${id}] %c${label} %c${t}`, C.SUCCESS, C.KEY, C.TIME)
        if (data !== undefined) console.log('   ', data)
    }

    const stepWarn = (id, label, data) => {
        if (!isEnabled()) return
        const t = _stepTimers[id] ? fmt(performance.now() - _stepTimers[id]) : '?'
        console.log(`%c⚠ [${id}] %c${label} %c${t}`, C.WARN, C.WARN, C.TIME)
        if (data !== undefined) console.log('   ', data)
    }

    const stepFail = (id, label, err) => {
        if (!isEnabled()) return
        const t = _stepTimers[id] ? fmt(performance.now() - _stepTimers[id]) : '?'
        console.log(`%c✗ [${id}] %c${label} %c${t}`, C.ERROR, C.ERROR, C.TIME)
        if (err) console.log('   ', typeof err === 'string' ? err : err.message || err)
    }

    const info = (label, data) => {
        if (!isEnabled()) return
        console.log(`%c   ℹ ${label}`, C.INFO, data !== undefined ? data : '')
    }

    const model = (name, attempt, total) => {
        if (!isEnabled()) return
        console.log(`%c🤖 Model [${attempt}/${total}]: %c${name}`, C.STEP, C.VAL)
    }

    const modelFail = (name, reason) => {
        if (!isEnabled()) return
        console.log(`%c   ↳ Failed: %c${reason}`, C.WARN, C.ERROR)
    }

    const modelOk = (name, ms, tokens) => {
        if (!isEnabled()) return
        console.log(
            `%c   ↳ ✓ Response %c${fmt(ms)} %c| ${tokens} tokens`,
            C.SUCCESS, C.TIME, C.INFO
        )
    }

    // Public API
    const api = {
        enable:   () => { localStorage.setItem('KG_DEBUG', '1');    console.log('%c🔍 KG Debug ENABLED', C.SUCCESS)  },
        disable:  () => { localStorage.removeItem('KG_DEBUG');       console.log('%c🔕 KG Debug DISABLED', C.WARN)   },
        status:   () => console.log(isEnabled() ? '%c🔍 KG Debug: ON' : '%c🔕 KG Debug: OFF', isEnabled() ? C.SUCCESS : C.WARN),
        header, footer, step, stepDone, stepWarn, stepFail, info, model, modelFail, modelOk,
        _enabled: isEnabled,
    }

    // Экспортируем в window для удобного доступа из консоли
    if (typeof window !== 'undefined') {
        window.KGDebug = api
        if (isEnabled()) {
            console.log('%c🔍 KG Agent Debugger active — window.KGDebug.disable() to turn off', C.SUCCESS)
        } else {
            console.log('%c🔍 KG Debug available — run: window.KGDebug.enable()', C.INFO)
        }
    }

    return api
})()



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

// Cascade priority (updated 2026-04-06):
// 1. gpt-oss-120b  — большая модель OpenAI, лучше держит JSON-схему на больших запросах
// 2. llama-3.3-70b — мощная, стабильная, хорошо следует JSON-схеме (65k ctx)
// 3. gemma-3-27b   — Google, хороша для структурированных JSON ответов (131k ctx)
// 4. nemotron-super — NVIDIA 120B, огромный контекст 262k (но медленная)
// 5. gpt-oss-20b   — резерв (иногда rate-limit)
// 6. stepfun-flash — быстрая но иногда пустой ответ на сложных запросах
// REMOVED: mistral-small-3.1 (404), qwen-2-7b (404), z-ai/glm-4.5-air (часто timeout)
const AGENT_MODELS = [
    'openai/gpt-oss-120b:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-3-27b-it:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'openai/gpt-oss-20b:free',
    'stepfun/step-3.5-flash:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'arcee-ai/trinity-large-preview:free',
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
        // English
        'add', 'create', 'insert', 'put', 'include', 'generate',
        'the', 'a', 'an', 'and', 'or', 'with', 'of', 'in', 'for',
        'all', 'some', 'its', 'their', 'from', 'into', 'to', 'by',
        'cuisine', 'dish', 'dishes', 'ingredient', 'ingredients',
        'top', 'best', 'classic', 'traditional', 'famous', 'popular',
        'key', 'main', 'typical', 'common', 'new', 'enrich',
        'knowledge', 'graph', 'database', 'gastromap',
        // Русский
        'добавь', 'добавить', 'создай', 'создать', 'включи', 'включить',
        'все', 'всех', 'всё', 'это', 'для', 'или', 'что', 'как',
        'кухня', 'кухни', 'кухню', 'блюда', 'блюдо', 'блюд',
        'ингредиент', 'ингредиенты', 'ингредиентов', 'ингредиентами',
        'топ', 'лучшие', 'классические', 'традиционные', 'популярные',
        'основные', 'главные', 'типичные', 'новые', 'его', 'её', 'их',
        'самые', 'самых', 'самое',
        // Польский  
        'dodaj', 'kuchnia', 'danie', 'dania', 'skladnik', 'skladniki',
    ])

    // Поддержка кириллицы, латиницы, цифр — всё остальное заменяем пробелом
    return message
        .toLowerCase()
        .replace(/[^a-zA-Zа-яёА-ЯЁ0-9\s]/g, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

/**
 * Русско-английский словарь кухонь для матчинга.
 * "немецкую" → "german", чтобы найти "German" в БД.
 */
const CUISINE_TRANSLATIONS = {
    // RU → EN
    'немецк': 'german', 'итальянск': 'italian', 'французск': 'french',
    'японск': 'japanese', 'китайск': 'chinese', 'мексиканск': 'mexican',
    'испанск': 'spanish', 'греческ': 'greek', 'индийск': 'indian',
    'тайск': 'thai', 'турецк': 'turkish', 'польск': 'polish',
    'русск': 'russian', 'украинск': 'ukrainian', 'американск': 'american',
    'британск': 'british', 'корейск': 'korean', 'вьетнамск': 'vietnamese',
    'арабск': 'arabic', 'марокканск': 'moroccan', 'перуанск': 'peruvian',
    'аргентинск': 'argentinian', 'бразильск': 'brazilian',
    // Прямые совпадения
    'немецкая': 'german', 'итальянская': 'italian', 'французская': 'french',
    'японская': 'japanese', 'китайская': 'chinese', 'мексиканская': 'mexican',
}

function translateKeywords(keywords) {
    const result = [...keywords]
    for (const kw of keywords) {
        // Прямой матч
        if (CUISINE_TRANSLATIONS[kw]) {
            result.push(CUISINE_TRANSLATIONS[kw])
            continue
        }
        // Матч по префиксу (немецкую → немецк → german)
        for (const [prefix, en] of Object.entries(CUISINE_TRANSLATIONS)) {
            if (kw.startsWith(prefix) && !result.includes(en)) {
                result.push(en)
                break
            }
        }
    }
    return result
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
    const rawKeywords = extractKeywords(userMessage)
    // Переводим русские ключевые слова в английские для матчинга с БД
    const keywords = translateKeywords(rawKeywords)

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

    return { found, context: lines.join('\n'), rawKeywords, keywords }
}

// ─── Dynamic max_tokens ───────────────────────────────────────────────────────

function estimateMaxTokens(userMessage) {
    const msg = userMessage.toLowerCase()

    // Большой запрос — всё сразу (EN + RU)
    const isMassive =
        msg.includes('all ') || msg.includes('every ') || msg.includes('все ') ||
        msg.includes('всё ') || msg.includes('полный') || msg.includes('весь') ||
        (msg.includes('cuisine') && msg.includes('dish') && msg.includes('ingredient')) ||
        (msg.includes('кухн') && msg.includes('блюд') && msg.includes('ингред'))
    if (isMassive) return 6000

    // Средний — кухня + блюда или топ N (EN + RU)
    const isMedium =
        msg.includes('cuisine') || msg.includes('dishes') ||
        msg.includes('кухн') || msg.includes('блюд') ||
        msg.includes('top ') || msg.includes('топ ') ||
        /\d+\s*(dish|блюд)/.test(msg)
    if (isMedium) return 4000

    // Маленький — один ингредиент / уточнение
    return 2000
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

    // ── 🔍 Debug session start ────────────────────────────────────────────────
    KGDebug.header(userMessage)

    if (!apiKey) {
        KGDebug.stepFail('AUTH', 'API key missing')
        throw new Error('AI API key is not configured. Please add it in Admin → AI Settings.')
    }

    const { cuisines = [], dishes = [], ingredients = [] } = context

    KGDebug.step('CTX', 'Building smart context')
    KGDebug.info(`KG state: ${cuisines.length} cuisines, ${dishes.length} dishes, ${ingredients.length} ingredients`)

    // ── Smart context: только релевантные совпадения из KG ────────────────────
    const { found, context: smartContext, rawKeywords, keywords } = buildSmartContext(
        userMessage, cuisines, dishes, ingredients
    )

    const ctxTokens = Math.ceil(smartContext.length / 4)
    KGDebug.stepDone('CTX', 'Smart context built', {
        rawKeywords,
        translatedKeywords: keywords,
        matches: found,
        contextSize: `~${ctxTokens} tokens (${smartContext.length} chars)`,
        context: smartContext,
    })

    // ── Brave Search enrichment (optional) ───────────────────────────────────
    const braveKey = appCfg.braveSearchApiKey || ''
    let webContext = ''
    if (braveKey.trim()) {
        KGDebug.step('BRAVE', 'Brave Search enrichment')
        try {
            // Всегда ищем на английском — берём translatedKeywords если есть,
            // иначе используем оригинальный запрос (brave-search.js сам добавит EN bias)
            const braveQuery = keywords?.join(' ') || userMessage
            KGDebug.info(`Brave query (EN): "${braveQuery}"`)
            const braveResults = await searchBrave(braveQuery, braveKey, 3)
            if (braveResults) {
                // Обрезаем до 400 символов чтобы не раздувать prompt (экономим токены)
                const trimmedBrave = braveResults.slice(0, 400)
                webContext = '\n\nWEB CONTEXT (brief reference only):\n' + trimmedBrave
                KGDebug.stepDone('BRAVE', `Brave results fetched (trimmed to ${trimmedBrave.length} chars)`, trimmedBrave)
            } else {
                KGDebug.stepWarn('BRAVE', 'No Brave results')
            }
        } catch (e) {
            KGDebug.stepFail('BRAVE', 'Brave search failed', e.message)
            console.warn('[KG Agent] Brave search skipped:', e.message)
        }
    } else {
        KGDebug.info('Brave Search: skipped (no API key)')
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

    KGDebug.step('AI', 'Calling AI model cascade')
    KGDebug.info(`max_tokens: ${maxTokens} | prompt size: ~${Math.ceil(systemPrompt.length / 4)} tokens`)

    console.debug(`[KG Agent] Sending to AI — context: ~${ctxTokens} tokens | max_tokens: ${maxTokens}`)

    // ── Model cascade ─────────────────────────────────────────────────────────
    const primaryModel  = appCfg.aiPrimaryModel  || config.ai.model  || AGENT_MODELS[0]
    const fallbackModel = appCfg.aiFallbackModel || null
    const cascade = [primaryModel]
    if (fallbackModel && fallbackModel !== primaryModel) cascade.push(fallbackModel)
    for (const m of AGENT_MODELS) {
        if (!cascade.includes(m)) cascade.push(m)
    }

    KGDebug.info(`Model cascade (${cascade.length} models):`, cascade)
    const errors = []

    for (let _mi = 0; _mi < cascade.length; _mi++) {
        const model = cascade[_mi]
        onModelAttempt?.(model)
        KGDebug.model(model, _mi + 1, cascade.length)
        const _modelStart = performance.now()
        // Small delay between model attempts to avoid rate limits
        if (_mi > 0) await new Promise(r => setTimeout(r, 1500))

        try {
            // 45 sec timeout — если модель молчит дольше, пробуем следующую
            const controller = new AbortController()
            const timeoutId  = setTimeout(() => controller.abort(), 45_000)

            const resp = await fetch(OPENROUTER_URL, {
                method: 'POST',
                signal: controller.signal,
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
            clearTimeout(timeoutId)

            if (resp.status === 429 || resp.status === 503) {
                KGDebug.modelFail(model, `rate-limited (${resp.status})`)
                errors.push(`${model}: rate-limited (${resp.status})`)
                // Exponential backoff: 2s → 4s → 8s per model attempt
                const delay = Math.min(2000 * Math.pow(2, _mi), 10000)
                await new Promise(r => setTimeout(r, delay))
                continue
            }
            if (!resp.ok) {
                const body = await resp.text().catch(() => '')
                errors.push(`${model}: HTTP ${resp.status} — ${body.slice(0, 80)}`)
                continue
            }

            const data = await resp.json()
            const rawContent = data.choices?.[0]?.message?.content?.trim()
            const _usage = data.usage || {}

            if (!rawContent) {
                KGDebug.modelFail(model, 'empty response')
                errors.push(`${model}: empty response`)
                continue
            }

            KGDebug.modelOk(model, performance.now() - _modelStart, _usage.total_tokens || '?')
            KGDebug.step('PARSE', 'Parsing AI response')
            KGDebug.info(`Raw response size: ${rawContent.length} chars`)

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

            KGDebug.stepDone('PARSE', 'Response parsed & deduped', {
                new: {
                    cuisines:    parsed.items.cuisines.length,
                    dishes:      parsed.items.dishes.length,
                    ingredients: parsed.items.ingredients.length,
                },
                skipped: {
                    total: totalSkipped,
                    names: parsed.skipped,
                },
                understanding: parsed.understanding,
                plan:          parsed.plan,
            })

            if (totalSkipped > 0) {
                KGDebug.stepWarn('DEDUP', `Skipped ${totalSkipped} duplicates`, parsed.skipped)
                console.info(`[KG Agent] Dedup: skipped ${totalSkipped} duplicates`, parsed.skipped)
            }

            console.info(`[KG Agent] ✓ ${model} | ctx: ~${ctxTokens} tokens | max: ${maxTokens}`)
            KGDebug.footer(parsed)
            return parsed

        } catch (err) {
            const isTimeout = err.name === 'AbortError'
            const errMsg    = isTimeout ? 'timeout (45s)' : err.message
            KGDebug.stepFail('AI', `${model} — ${errMsg}`, errMsg)
            errors.push(`${model}: ${errMsg}`)
        }
    }

    KGDebug.footer(null)
    KGDebug.info('All models failed:', errors)
    // Check if ALL errors are rate-limits
    const allRateLimited = errors.every(e => e.includes('rate-limited') || e.includes('429'))
    if (allRateLimited) {
        throw new Error(
            'OpenRouter rate limit reached (20 req/min). ' +
            'Подожди 60 секунд и попробуй снова. ' +
            'Лимит: 50 запросов/день (до $10) или 1000/день (от $10 на счету).'
        )
    }
    throw new Error(`KG Agent: all models failed.\n${errors.join('\n')}`)
}

// ─── Resolve cuisine_id for dishes ───────────────────────────────────────────

/**
 * Fuzzy match cuisine name to handle cases where AI returns
 * "Italian Cuisine" but DB has "Italian", or "French" vs "French Cuisine".
 * 
 * Match order:
 *  1. Exact match (case-insensitive)
 *  2. Strip " cuisine" suffix from dish.cuisine_name → match against DB name
 *  3. DB name is contained in dish.cuisine_name (e.g. "Italian" ⊂ "Italian Cuisine")
 *  4. dish.cuisine_name is contained in DB name
 */
function matchCuisine(cuisineName, allCuisines) {
    if (!cuisineName) return null
    const raw = cuisineName.trim().toLowerCase()
    // Strip common suffixes AI adds: " cuisine", " food", " cooking"
    const stripped = raw.replace(/\s+(cuisine|food|cooking|kitchen)$/i, '').trim()

    // 1. Exact
    let match = allCuisines.find(c => c.name?.toLowerCase() === raw)
    if (match) return match

    // 2. Exact after stripping suffix
    match = allCuisines.find(c => c.name?.toLowerCase() === stripped)
    if (match) return match

    // 3. DB name ⊂ raw (e.g. DB="Italian", raw="italian cuisine")
    match = allCuisines.find(c => raw.includes(c.name?.toLowerCase()))
    if (match) return match

    // 4. raw ⊂ DB name (e.g. DB="Italian Cuisine", raw="italian")
    match = allCuisines.find(c => c.name?.toLowerCase().includes(raw))
    if (match) return match

    // 5. Stripped ⊂ DB name
    match = allCuisines.find(c => c.name?.toLowerCase().includes(stripped))
    if (match) return match

    return null
}

export function resolveDishCuisineIds(dishes, allCuisines) {
    return dishes.map(dish => {
        const match = matchCuisine(dish.cuisine_name, allCuisines)
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

