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
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'

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
// Updated 2026-04-14 — verified working models (tested against OpenRouter /v1/models)
const AGENT_MODELS = [
    'openai/gpt-oss-120b:free',               // ✅ 131K ctx, best JSON quality
    'nvidia/nemotron-3-super-120b-a12b:free', // ✅ 262K ctx, best RAG
    'arcee-ai/trinity-large-preview:free',    // ✅ 131K ctx, reliable
    'liquid/lfm-2.5-1.2b-instruct:free',      // ✅ fast fallback
    'liquid/lfm-2.5-1.2b-thinking:free',      // ✅ thinking variant
    'meta-llama/llama-3.3-70b-instruct:free', // 429 sometimes — keep as deeper fallback
    'google/gemma-4-31b-it:free',             // 429 sometimes — keep as deeper fallback
    'google/gemma-3-27b-it:free',             // 429 sometimes — deeper fallback
    'nousresearch/hermes-3-llama-3.1-405b:free', // 429 sometimes — deeper fallback
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
- Use the EXACT field names from schemas below — they map directly to database columns
- cuisine_name in dishes must match EXACTLY the name of a cuisine you are also generating in this batch (or one that already EXISTS)

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

═══════════════════════════════════════════════════════
CUISINE SCHEMA (all fields map 1:1 to database columns):
═══════════════════════════════════════════════════════
{
  "name": "string — REQUIRED, e.g. \"Italian\" (not \"Italian Cuisine\")",
  "description": "string — REQUIRED, 2-3 sentences",
  "region": "string — broad geographic region, e.g. \"Mediterranean\", \"East Asian\", \"Latin American\"",
  "origin_country": "string — primary country, e.g. \"Italy\", \"Japan\"",
  "aliases": ["array of alternative names, e.g. \"Italiana\""],
  "flavor_profile": "string — dominant flavors, e.g. \"herbal, savory, umami, spicy\"",
  "typical_dishes": ["array of dish names this cuisine is famous for"],
  "key_ingredients": ["array of most important/characteristic ingredients"],
  "spice_level": "one of: mild | medium | spicy | very_spicy",
  "meal_structure": "string — e.g. \"3-course\", \"tapas\", \"mezze\", \"family-style\"",
  "cooking_methods": ["array — e.g. \"grilling\", \"braising\", \"fermenting\", \"stir-frying\""],
  "dietary_notes": "string — e.g. \"halal-friendly\", \"heavy dairy\", \"largely plant-based\""
}

═══════════════════════════════════════════════════════
DISH SCHEMA (all fields map 1:1 to database columns):
═══════════════════════════════════════════════════════
{
  "name": "string — REQUIRED, e.g. \"Spaghetti Carbonara\"",
  "cuisine_name": "string — REQUIRED, parent cuisine name (must match cuisine name exactly)",
  "description": "string — REQUIRED, 1-2 sentences",
  "course": "one of: appetizer | main | dessert | side | drink | snack | bread",
  "preparation_style": "string — e.g. \"pasta\", \"grilled\", \"soup\", \"fried\", \"baked\", \"raw\", \"steamed\"",
  "ingredients": ["array of main ingredient names"],
  "dietary_tags": ["array — any of: vegetarian | vegan | gluten-free | dairy-free | nut-free | halal | kosher"],
  "flavor_notes": "string — e.g. \"creamy, rich, smoky, fresh\"",
  "best_pairing": "string — e.g. \"white wine, crusty bread\"",
  "serving_temp": "one of: hot | warm | cold | room_temp",
  "difficulty": "one of: easy | medium | hard",
  "cook_time_min": "integer — estimated cooking time in minutes",
  "origin_city": "string — city of origin if notable, e.g. \"Naples\", \"Bologna\"",
  "alternative_names": ["array of local/regional names"],
  "spicy_level": "integer 0-5 (0=not spicy, 5=extremely spicy)",
  "is_signature": "boolean — true if iconic/signature dish of its cuisine"
}

═══════════════════════════════════════════════════════
INGREDIENT SCHEMA (all fields map 1:1 to database columns):
═══════════════════════════════════════════════════════
{
  "name": "string — REQUIRED, e.g. \"Truffle Oil\"",
  "category": "one of: vegetable | fruit | meat | fish | seafood | dairy | grain | spice | herb | nut | legume | oil | sauce | other",
  "description": "string — REQUIRED, 1-2 sentences about this ingredient",
  "flavor_profile": "string — e.g. \"earthy, pungent, sweet, neutral\"",
  "common_pairings": ["array of ingredients that pair well with this one"],
  "dietary_info": ["array — any of: vegan | vegetarian | gluten-free | dairy-free | nut-free | halal | kosher"],
  "season": ["array — any of: spring | summer | fall | winter | year-round"],
  "origin_region": "string — geographic origin, e.g. \"Southeast Asia\", \"Mediterranean\"",
  "health_notes": "string — e.g. \"high in omega-3\", \"antioxidant-rich\", \"high protein\"",
  "substitutes": ["array of ingredient names that can substitute this one"],
  "storage_tip": "string — e.g. \"refrigerate up to 1 week\", \"store in cool dry place\"",
  "is_allergen": "boolean — true if this is a common allergen (nuts, dairy, gluten, shellfish, etc.)",
  "is_vegan": "boolean",
  "is_vegetarian": "boolean"
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
    if (!str) return ''
    return str
        .toLowerCase()
        // 1. Убираем общие артикли и стоп-слова в начале
        .replace(/^(the|a|an|le|la|el|los|las|de|di|of|для|этот|эта)\s+/i, '')
        // 2. Убираем общие суффиксы, которые модель может добавить к имени
        .replace(/\s+(cuisine|food|cooking|kitchen|dish|dishes|style|traditions|tradition|recipes|recipe|кухня|блюда|ингредиент|ингредиенты)$/i, '')
        // 3. Убираем все спецсимволы и лишние пробелы (оставляем только буквы/цифры)
        .replace(/[^a-z0-9а-яё]/gi, '')
        // 4. Очень грубый де-плурализатор (только для EN: s/es)
        .replace(/e?s$/, '') 
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

/**
 * Фильтрует сгенерированные AI объекты, если они уже есть в БД.
 * Использует нормализацию имен для нечёткого сравнения.
 */
function clientDedup(items, existingCuisines, existingDishes, existingIngredients) {
    const normalize = s => norm(s) || ''
    
    const exC = new Set(existingCuisines.map(c => normalize(c.name)))
    const exD = new Set(existingDishes.map(d => normalize(d.name)))
    const exI = new Set(existingIngredients.map(i => normalize(i.name)))

    // Также добавляем альтернативные имена в сеты для более умного дедупа
    existingCuisines.forEach(c => (c.aliases || []).forEach(a => exC.add(normalize(a))))
    existingDishes.forEach(d => (d.alternative_names || []).forEach(a => exD.add(normalize(a))))
    existingIngredients.forEach(i => (i.substitutes || []).forEach(a => exI.add(normalize(a))))

    const duplicates = { cuisines: [], dishes: [], ingredients: [] }
    const filtered   = { cuisines: [], dishes: [], ingredients: [] }

    // 1. Cuisines
    for (const c of (items.cuisines || [])) {
        const n = normalize(c.name)
        if (exC.has(n)) { duplicates.cuisines.push(c.name) }
        else { filtered.cuisines.push(c); exC.add(n) }
    }

    // 2. Dishes
    for (const d of (items.dishes || [])) {
        const n = normalize(d.name)
        if (exD.has(n)) { duplicates.dishes.push(d.name) }
        else { filtered.dishes.push(d); exD.add(n) }
    }

    // 3. Ingredients
    for (const i of (items.ingredients || [])) {
        const n = normalize(i.name)
        if (exI.has(n)) { duplicates.ingredients.push(i.name) }
        else { filtered.ingredients.push(i); exI.add(n) }
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

    // Track consecutive 429s — if all models rate-limited, wait for window reset
    let consecutive429 = 0
    const MAX_CONSECUTIVE_429 = 3
    const RATE_LIMIT_RESET_MS = 62_000 // OpenRouter resets every 60s, +2s buffer

    for (let _mi = 0; _mi < cascade.length; _mi++) {
        const model = cascade[_mi]
        onModelAttempt?.(model)
        KGDebug.model(model, _mi + 1, cascade.length)
        const _modelStart = performance.now()
        // Small inter-model delay to avoid hitting rate limit on burst
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
                consecutive429++
                KGDebug.modelFail(model, `rate-limited (${resp.status}) [${consecutive429} consecutive]`)
                errors.push(`${model}: rate-limited (${resp.status})`)

                // If enough consecutive 429s — wait for full window reset, then retry from start
                if (consecutive429 >= MAX_CONSECUTIVE_429) {
                    KGDebug.stepWarn('RATELIMIT',
                        `${consecutive429} models rate-limited — waiting ${RATE_LIMIT_RESET_MS / 1000}s for window reset...`)
                    onModelAttempt?.('__rate_limit_wait__')
                    await new Promise(r => setTimeout(r, RATE_LIMIT_RESET_MS))
                    consecutive429 = 0
                    _mi = -1 // restart cascade (loop will _mi++ to 0)
                    errors.length = 0 // clear errors for fresh attempt
                    KGDebug.step('RETRY', 'Retrying after rate limit reset')
                    continue
                }

                // Short back-off before next model
                await new Promise(r => setTimeout(r, 2_000))
                continue
            }
            // Successful response — reset consecutive counter
            consecutive429 = 0
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

export async function callEnrichmentAI(cuisine, fieldsToEnrich, onModelAttempt) {
    const appCfg = useAppConfigStore.getState()
    const apiKey = appCfg.aiApiKey || config.ai.openRouterKey

    if (!apiKey) {
        throw new Error('AI API key is not configured. Please add it in Admin → AI Settings.')
    }

    const prompt = `You are a Senior Culinary Knowledge Expert. Your goal is to accurately fill in missing metadata for a specific cuisine entry.

Cuisine: "${cuisine.name}"
${cuisine.description ? `Description: ${cuisine.description}` : ''}
${cuisine.origin_country ? `Origin country: ${cuisine.origin_country}` : ''}

REQUIRED FIELDS TO FILL: ${fieldsToEnrich.join(', ')}

SCHEMAS & RULES:
- origin_country: string (canonical country name)
- flavor_profile: string (descriptive, comma-separated dominant tastes)
- aliases: array of strings (local or alternative names)
- typical_dishes: array of strings (top 3-5 iconic dishes)
- key_ingredients: array of strings (top 3-5 foundation ingredients)

OUTPUT FORMAT (STRICT JSON):
Return ONLY a valid JSON object containing only the requested fields. No explanations, no markdown fences.
{
  ${fieldsToEnrich.map(f => `"${f}": ...`).join(',\n  ')}
}`

    // Reuse the same cascade as KG Agent
    const primaryModel  = appCfg.aiPrimaryModel  || config.ai.model  || AGENT_MODELS[0]
    const cascade = [primaryModel, ...AGENT_MODELS.filter(m => m !== primaryModel)]

    KGDebug.header(`Enriching: ${cuisine.name}`)
    KGDebug.info('Missing fields:', fieldsToEnrich)

    const errors = []

    for (let _mi = 0; _mi < cascade.length; _mi++) {
        const model = cascade[_mi]
        onModelAttempt?.(model)
        KGDebug.model(model, _mi + 1, cascade.length)
        const _modelStart = performance.now()

        if (_mi > 0) await new Promise(r => setTimeout(r, 1000))

        try {
            const controller = new AbortController()
            const timeoutId  = setTimeout(() => controller.abort(), 30_000)

            const resp = await fetch(OPENROUTER_URL, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://gastromap.app',
                    'X-Title': 'GastroMap KG Enrichment',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 800,
                    temperature: 0.2,
                    response_format: { type: 'json_object' }
                }),
            })
            clearTimeout(timeoutId)

            if (!resp.ok) {
                const errBody = await resp.text().catch(() => '')
                const errCode = resp.status
                errors.push(`${model}: ${errCode} ${errBody.slice(0, 80)}`)
                // 404 = deprecated/not-found → skip immediately
                if (errCode === 404) { continue }
                // 429 = rate limit → wait 2s before next model
                if (errCode === 429 || errCode === 402) {
                    await new Promise(r => setTimeout(r, 2000))
                }
                continue
            }

            const data = await resp.json()
            const raw = data.choices?.[0]?.message?.content?.trim()

            if (!raw) {
                errors.push(`${model}: empty response`)
                continue
            }

            // Cleanup potential markdown if response_format was ignored by model provider
            const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
            const parsed = JSON.parse(clean)

            KGDebug.modelOk(model, performance.now() - _modelStart, data.usage?.total_tokens || '?')
            KGDebug.footer(parsed)

            return parsed
        } catch (err) {
            errors.push(`${model}: ${err.message}`)
            KGDebug.modelFail(model, err.message)
        }
    }

    KGDebug.footer(null)
    throw new Error(`Enrichment failed after trying ${cascade.length} models:\n${errors.join('\n')}`)
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


