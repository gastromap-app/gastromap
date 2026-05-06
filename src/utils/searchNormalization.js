/**
 * searchNormalization.js
 *
 * Normalizes multilingual search queries (EN/RU/PL/UA) into English canonical
 * terms so they can match the English data stored in the DB (FTS column built
 * on `to_tsvector('english', ...)`) and the English values used in client-side
 * filters.
 *
 * Strategy:
 *   1. Build a single Map<lowercasedForeign, lowercasedEnglish> on module load
 *      from existing multilingual sources:
 *        - ESTABLISHMENT_TYPES (labelRu/Pl/Ua → label)
 *        - BEST_TIMES          (labelRu/Pl/Ua → label)
 *        - LABEL_GROUPS        (itemsRu/Pl/Ua → items)
 *        - LABEL_TRANSLATIONS  (existing RU → EN dictionary)
 *        - Manual city aliases (RU/UA spellings of Polish city names)
 *   2. For each query:
 *        a. Try the whole trimmed lowercased phrase — handles multi-word labels
 *           like "Авторская кухня" → "signature cuisine".
 *        b. Fallback: tokenize by whitespace, translate each token individually.
 *           Unknown tokens are kept (lowercased).
 *
 * No schema / DB changes required: DB data is English, so normalizing the
 * *query* is sufficient for the existing `to_tsvector('english', ...)` FTS.
 */

import {
    ESTABLISHMENT_TYPES,
    BEST_TIMES,
    LABEL_GROUPS,
} from '@/shared/config/filterOptions'
import { LABEL_TRANSLATIONS } from '@/utils/translation'

// ─── Manual aliases ──────────────────────────────────────────────────────────
// Covers common foreign spellings of destinations and concepts the UI data
// does not already carry. Keep this list small and high-signal.
const MANUAL_ALIASES = {
    // ── Polish cities (RU/UA spellings) ─────────────────────────────
    'краков': 'krakow', 'краків': 'krakow',
    'варшава': 'warsaw',
    'вроцлав': 'wroclaw',
    'гданьск': 'gdansk',
    'познань': 'poznan',
    'лодзь': 'lodz',
    'катовице': 'katowice',
    'закопане': 'zakopane',
    // Russian prepositional / genitive forms (common in queries like "кафе в кракове")
    'кракове': 'krakow', 'кракова': 'krakow', 'кракову': 'krakow',
    'варшаве': 'warsaw', 'варшавы': 'warsaw',
    'вроцлаве': 'wroclaw', 'вроцлава': 'wroclaw',
    'гданьске': 'gdansk', 'гданьска': 'gdansk',
    'познани': 'poznan',
    'катовицах': 'katowice',

    // ── Place types & formats ────────────────────────────────────
    'кофейня': 'cafe', 'кав’ярня': 'cafe', 'кавярня': 'cafe',
    'ресторанчик': 'restaurant',
    'столовая': 'cafeteria', 'stołówka': 'cafeteria', 'stolowka': 'cafeteria',
    'пиццерия': 'pizzeria', 'pizzeria': 'pizzeria', 'піцерія': 'pizzeria',
    'суши-бар': 'sushi bar', 'суши бар': 'sushi bar', 'суші-бар': 'sushi bar',
    'паб': 'pub', 'пивная': 'pub', 'пивбар': 'pub', 'pub': 'pub',
    'бистро': 'bistro', 'bistro': 'bistro', 'бістро': 'bistro',
    'гастропаб': 'gastropub', 'гастробар': 'gastrobar',
    'кондитерка': 'pastry', 'cukiernia': 'pastry',
    'piekarnia': 'bakery', 'булочная': 'bakery',
    'чайхана': 'teahouse', 'чайная': 'teahouse', 'herbaciarnia': 'teahouse',
    'винотека': 'winery', 'винарня': 'wine bar', 'winnica': 'winery',
    'фуд-корт': 'food court', 'фудкорт': 'food court',

    // ── Dishes (RU) ────────────────────────────────────────────────
    'пицца': 'pizza', 'суши': 'sushi', 'роллы': 'sushi rolls',
    'бургер': 'burger', 'гамбургер': 'burger', 'чизбургер': 'cheeseburger',
    'хот-дог': 'hot dog', 'хотдог': 'hot dog',
    'стейк': 'steak', 'паста': 'pasta', 'лазанья': 'lasagna',
    'равиоли': 'ravioli', 'ризотто': 'risotto',
    'блины': 'pancakes', 'оладьи': 'pancakes', 'блинчики': 'crepes',
    'хачапури': 'khachapuri', 'хинкали': 'khinkali',
    'пельмени': 'dumplings', 'вареники': 'dumplings',
    'борщ': 'borscht', 'солянка': 'solyanka',
    'шашлык': 'kebab', 'кебаб': 'kebab',
    'шаурма': 'shawarma', 'шаверма': 'shawarma',
    'фалафель': 'falafel', 'хумус': 'hummus',
    'том-ям': 'tom yum', 'пад-тай': 'pad thai',
    'рамен': 'ramen', 'удон': 'udon', 'соба': 'soba',
    'тако': 'tacos', 'буррито': 'burrito', 'кесадилья': 'quesadilla',
    'круассан': 'croissant', 'брускетта': 'bruschetta',
    'салат': 'salad', 'цезарь': 'caesar salad',
    'тартар': 'tartare', 'карпаччо': 'carpaccio',
    'десерт': 'dessert', 'десерты': 'desserts',
    'мороженое': 'ice cream', 'чизкейк': 'cheesecake',
    'тирамису': 'tiramisu', 'вафли': 'waffles',
    'яичница': 'eggs', 'омлет': 'omelette',
    'тост': 'toast', 'сэндвич': 'sandwich', 'сендвич': 'sandwich',
    'бейгл': 'bagel', 'багет': 'baguette',

    // ── Dishes (PL) ────────────────────────────────────────────────
    'pierogi': 'pierogi', 'żurek': 'zurek', 'zurek': 'zurek',
    'bigos': 'bigos', 'бигос': 'bigos',
    'rosół': 'rosol', 'rosol': 'rosol',
    'schabowy': 'schabowy',
    'kotlet': 'cutlet', 'kiełbasa': 'sausage', 'kielbasa': 'sausage',
    'obwarzanek': 'obwarzanek', 'zapiekanka': 'zapiekanka',
    'gołąbki': 'cabbage rolls', 'golabki': 'cabbage rolls',
    'placki': 'pancakes', 'makowiec': 'poppy seed roll',

    // ── Dishes (UA) ────────────────────────────────────────────────
    'деруни': 'potato pancakes', 'деруны': 'potato pancakes',
    'сало': 'salo', 'голубці': 'cabbage rolls', 'голубцы': 'cabbage rolls',
    'узвар': 'uzvar', 'сирники': 'syrniki',

    // ── Drinks ───────────────────────────────────────────────────
    'чай': 'tea', 'herbata': 'tea',
    'пиво': 'beer', 'piwo': 'beer',
    'вино': 'wine', 'wino': 'wine',
    'коктейль': 'cocktail', 'koktajl': 'cocktail',
    'эспрессо': 'espresso', 'еспресо': 'espresso',
    'латте': 'latte', 'капучино': 'cappuccino',
    'раф': 'raf coffee', 'флэт-уайт': 'flat white', 'флет-уайт': 'flat white',
    'лимонад': 'lemonade', 'сок': 'juice',
    'смузи': 'smoothie', 'смузі': 'smoothie', 'smoothie': 'smoothie',
    'какао': 'cocoa', 'шоколад': 'chocolate', 'матча': 'matcha',
    'виски': 'whiskey', 'водка': 'vodka', 'джин': 'gin',
    'ром': 'rum', 'текила': 'tequila', 'ликёр': 'liqueur',
    'просекко': 'prosecco', 'шампанское': 'champagne',
    'глинтвейн': 'mulled wine', 'grzaniec': 'mulled wine',
    'сидр': 'cider', 'крафт': 'craft',

    // ── Meals & service ────────────────────────────────────────────
    'завтрак': 'breakfast', 'śniadanie': 'breakfast', 'sniadanie': 'breakfast', 'сніданок': 'breakfast',
    'обед': 'lunch', 'обід': 'lunch', 'obiad': 'lunch',
    'ужин': 'dinner', 'вечеря': 'dinner', 'kolacja': 'dinner',
    'бранч': 'brunch', 'brunch': 'brunch',
    'полдник': 'snack', 'перекус': 'snack',
    'комплекс': 'set menu', 'дегустация': 'tasting',
    'с собой': 'takeaway', 'вынос': 'takeaway',
    'dostawa': 'delivery',

    // ── Cuisines (foreign spellings) ───────────────────────────
    'польская': 'polish', 'polska': 'polish', 'польська': 'polish',
    'украинская': 'ukrainian', 'ukraińska': 'ukrainian', 'українська': 'ukrainian',
    'паназиатская': 'asian', 'азиатская': 'asian', 'азійська': 'asian',
    'восточная': 'middle eastern', 'арабская': 'arab',
    'кавказская': 'caucasian', 'армянская': 'armenian',
    'ливанская': 'lebanese', 'балканская': 'balkan',
    'перуанская': 'peruvian', 'бразильская': 'brazilian',
    'корейская': 'korean',

    // ── Dietary ─────────────────────────────────────────────────
    'веганское': 'vegan', 'вегетарианское': 'vegetarian',
    'wegańskie': 'vegan', 'wegetariańskie': 'vegetarian',
    'безглютеновое': 'gluten-free', 'bezglutenowe': 'gluten-free',
    'безлактозное': 'lactose-free', 'кето': 'keto',
    'палео': 'paleo', 'халяль': 'halal', 'кошер': 'kosher',
    'органическое': 'organic', 'bio': 'organic',
}

// ─── Dictionary build ────────────────────────────────────────────────────────

function addEntry(dict, foreign, english) {
    if (!foreign || !english) return
    const key = String(foreign).trim().toLowerCase()
    const val = String(english).trim().toLowerCase()
    if (!key || !val) return
    // First writer wins — established sources take precedence over later ones
    if (!dict.has(key)) dict.set(key, val)
}

function buildDictionary() {
    const dict = new Map()

    // 1. LABEL_TRANSLATIONS (RU → EN phrases)
    for (const [ru, en] of Object.entries(LABEL_TRANSLATIONS)) {
        addEntry(dict, ru, en)
    }

    // 2. ESTABLISHMENT_TYPES
    for (const t of ESTABLISHMENT_TYPES) {
        if (!t || t.id === 'all') continue
        const en = t.label
        addEntry(dict, t.labelRu, en)
        addEntry(dict, t.labelPl, en)
        addEntry(dict, t.labelUa, en)
    }

    // 3. BEST_TIMES
    for (const bt of BEST_TIMES) {
        const en = bt.label
        addEntry(dict, bt.labelRu, en)
        addEntry(dict, bt.labelPl, en)
        addEntry(dict, bt.labelUa, en)
    }

    // 4. LABEL_GROUPS items (parallel arrays)
    for (const group of LABEL_GROUPS) {
        const items = Array.isArray(group.items) ? group.items : []
        const { itemsRu = [], itemsPl = [], itemsUa = [] } = group
        items.forEach((en, i) => {
            addEntry(dict, itemsRu[i], en)
            addEntry(dict, itemsPl[i], en)
            addEntry(dict, itemsUa[i], en)
        })
        // Group names themselves (rarely used in search, but cheap to add)
        addEntry(dict, group.groupRu, group.group)
        addEntry(dict, group.groupPl, group.group)
        addEntry(dict, group.groupUa, group.group)
    }

    // 5. Manual aliases
    for (const [foreign, en] of Object.entries(MANUAL_ALIASES)) {
        addEntry(dict, foreign, en)
    }

    return dict
}

const DICT = buildDictionary()

// Token: letters (any script), digits, apostrophes, hyphens.
// We use this to extract the core of a token while preserving trailing
// punctuation (comma, period, …) in the output.
const TOKEN_CORE_RE = /^([\p{L}\p{N}'’-]+)(.*)$/u

/**
 * Normalize a multilingual search query to lowercase English canonical terms.
 *
 * @param {string} query - User input in any supported language (EN/RU/PL/UA).
 * @returns {string} Normalized (lowercased) query, safe to feed into FTS or
 *                   client-side `.includes()` matching. Empty string for
 *                   falsy input.
 *
 * @example
 *   normalizeSearchTerm('кафе')            // → 'cafe'
 *   normalizeSearchTerm('Kawiarnia')       // → 'cafe'
 *   normalizeSearchTerm('Авторская кухня') // → 'signature cuisine'
 *   normalizeSearchTerm('кафе в кракове')  // → 'cafe в krakow'
 *   normalizeSearchTerm('good coffee')     // → 'good coffee'
 */
export function normalizeSearchTerm(query) {
    if (!query || typeof query !== 'string') return ''
    const trimmed = query.trim()
    if (!trimmed) return ''

    const fullLower = trimmed.toLowerCase()

    // 1. Whole-phrase match (handles multi-word labels)
    if (DICT.has(fullLower)) return DICT.get(fullLower)

    // 2. Token-by-token
    const tokens = trimmed.split(/\s+/)
    const normalized = tokens.map(tok => {
        const m = tok.match(TOKEN_CORE_RE)
        if (!m) return tok.toLowerCase()
        const [, core, rest] = m
        const coreLower = core.toLowerCase()
        const mapped = DICT.get(coreLower)
        return (mapped || coreLower) + rest.toLowerCase()
    })

    return normalized.join(' ')
}

// Exposed for tests / debugging — size & presence checks only.
export const __DICTIONARY_SIZE__ = DICT.size
