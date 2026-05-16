/**
 * normalizeCityName — Ensures all city names are stored in English/international format.
 *
 * Problem: Google Places, LLMs, and Apify return city names in the local language
 * (e.g., "Kraków", "Warszawa", "Κρακοβία") but GastroMap stores everything in English.
 *
 * This utility:
 * 1. Strips diacritics (Kraków → Krakow, Kyïv → Kyiv)
 * 2. Maps known local-name variants to their English canonical form
 * 3. Returns title-case English name
 *
 * Used by:
 * - Telegram bot (api/telegram/process.js) before insertLocation()
 * - Google Places proxy (api/places/search.js) normalizePlace()
 * - AI Magic extraction (src/shared/api/ai/location.js)
 * - Admin LocationForm (before save)
 */

// ─── Canonical city name overrides ──────────────────────────────────────────
// Keys are lowercase, diacritic-stripped local names.
// Values are the canonical English name stored in the DB.
const CITY_OVERRIDES = {
    // Poland
    'krakow':       'Krakow',      // Kraków → stripped
    'warszawa':     'Warsaw',
    'wroclaw':      'Wroclaw',     // Wrocław
    'gdansk':       'Gdansk',      // Gdańsk
    'poznan':       'Poznan',      // Poznań
    'lodz':         'Lodz',        // Łódź
    'szczecin':     'Szczecin',
    'katowice':     'Katowice',
    'lublin':       'Lublin',
    'bydgoszcz':    'Bydgoszcz',
    'bialystok':    'Bialystok',   // Białystok
    'gdynia':       'Gdynia',
    'sopot':        'Sopot',
    'zakopane':     'Zakopane',
    'torun':        'Torun',       // Toruń
    'silesia':      'Silesia',

    // Ukraine
    'kyiv':         'Kyiv',
    'kyyiv':        'Kyiv',        // Київ translit
    'kiev':         'Kyiv',        // legacy Russian name
    'lviv':         'Lviv',
    'lvov':         'Lviv',        // Russian name (Latin transliteration)
    'львов':        'Lviv',        // Russian Cyrillic (Львов)
    'львів':        'Lviv',        // Ukrainian Cyrillic (Львів)
    'odesa':        'Odesa',
    'odessa':       'Odesa',       // Russian spelling
    'kharkiv':      'Kharkiv',
    'kharkov':      'Kharkiv',
    'dnipro':       'Dnipro',
    'dnipropetrovsk': 'Dnipro',
    'zaporizhzhia': 'Zaporizhzhia',
    'zaporozhye':   'Zaporizhzhia',
    'ivano-frankivsk': 'Ivano-Frankivsk',
    'ternopil':     'Ternopil',
    'uzhhorod':     'Uzhhorod',
    'chernivtsi':   'Chernivtsi',

    // Czech Republic
    'praha':        'Prague',
    'prague':       'Prague',
    'brno':         'Brno',
    'ostrava':      'Ostrava',
    'plzen':        'Plzen',       // Plzeň
    'karlovy vary': 'Karlovy Vary',

    // Hungary
    'budapest':     'Budapest',
    'debrecen':     'Debrecen',

    // Germany
    'munchen':      'Munich',      // München
    'munich':       'Munich',
    'koln':         'Cologne',     // Köln
    'cologne':      'Cologne',
    'frankfurt':    'Frankfurt',
    'berlin':       'Berlin',
    'hamburg':      'Hamburg',
    'wien':         'Vienna',      // German name for Vienna
    'vienna':       'Vienna',

    // France
    'paris':        'Paris',
    'lyon':         'Lyon',
    'marseille':    'Marseille',
    'nice':         'Nice',

    // Spain
    'barcelona':    'Barcelona',
    'madrid':       'Madrid',
    'sevilla':      'Seville',     // Sevilla → Seville
    'seville':      'Seville',

    // Italy
    'roma':         'Rome',        // Roma → Rome
    'rome':         'Rome',
    'milano':       'Milan',       // Milano → Milan
    'milan':        'Milan',
    'napoli':       'Naples',      // Napoli → Naples
    'naples':       'Naples',
    'firenze':      'Florence',    // Firenze → Florence
    'florence':     'Florence',
    'venezia':      'Venice',      // Venezia → Venice
    'venice':       'Venice',
    'torino':       'Turin',       // Torino → Turin

    // Georgia
    'tbilisi':      'Tbilisi',
    'batumi':       'Batumi',
    'kutaisi':      'Kutaisi',

    // Turkey
    'istanbul':     'Istanbul',
    'ankara':       'Ankara',
    'izmir':        'Izmir',
    'antalya':      'Antalya',

    // Israel
    'tel aviv':     'Tel Aviv',
    'tel aviv-yafo': 'Tel Aviv',
    'jerusalem':    'Jerusalem',
    'haifa':        'Haifa',

    // Japan
    'tokyo':        'Tokyo',
    'osaka':        'Osaka',
    'kyoto':        'Kyoto',

    // Other common cities
    'london':       'London',
    'new york':     'New York',
    'amsterdam':    'Amsterdam',
    'brussels':     'Brussels',
    'lisbon':       'Lisbon',
    'stockholm':    'Stockholm',
    'oslo':         'Oslo',
    'copenhagen':   'Copenhagen',
    'helsinki':     'Helsinki',
    'dubai':        'Dubai',
    'bangkok':      'Bangkok',
    'singapore':    'Singapore',
    'sydney':       'Sydney',
    'melbourne':    'Melbourne',
    'toronto':      'Toronto',
    'vancouver':    'Vancouver',
    'mexico city':  'Mexico City',
    'buenos aires': 'Buenos Aires',
    'sao paulo':    'Sao Paulo',
    'rio de janeiro': 'Rio de Janeiro',
    'lagos':        'Lagos',
    'cairo':        'Cairo',
    'nairobi':      'Nairobi',
    'cape town':    'Cape Town',
}

// ─── Country name overrides ─────────────────────────────────────────────────
const COUNTRY_OVERRIDES = {
    // Local → English
    'polska':       'Poland',
    'ukraina':      'Ukraine',
    'україна':      'Ukraine',     // Ukrainian Cyrillic (with ї)
    'украіна':      'Ukraine',     // After diacritic stripping (ї→і)
    'украина':      'Ukraine',     // Russian Cyrillic
    'ceska republika': 'Czech Republic',
    'cesko':        'Czech Republic',
    'česko':        'Czech Republic',
    'magyarorszag': 'Hungary',
    'magyarország': 'Hungary',
    'deutschland':  'Germany',
    'france':       'France',
    'espana':       'Spain',
    'españa':       'Spain',
    'italia':       'Italy',
    'sakartvelo':   'Georgia',
    'turkiye':      'Turkey',
    'türkiye':      'Turkey',
    'israel':       'Israel',
    'россия':       'Russia',      // Russian Cyrillic
    'беларусь':     'Belarus',     // Belarusian Cyrillic
    'belarus':      'Belarus',
}

/**
 * Strip diacritics from a string (é→e, ó→o, ł→l, etc.)
 *
 * NFD decomposition handles most combining marks.
 * Some letters (ł, đ, ß, etc.) are single Unicode codepoints
 * that don't decompose, so we handle them explicitly.
 */
function stripDiacritics(str) {
    if (!str) return ''
    // Explicit replacements for non-decomposing characters
    const EXPLICIT = {
        'ł': 'l', 'Ł': 'L',
        'đ': 'd', 'Đ': 'D',
        'ø': 'o', 'Ø': 'O',
        'æ': 'ae', 'Æ': 'Ae',
        'ß': 'ss',
        'ð': 'd', 'Ð': 'D',
        'þ': 'th', 'Þ': 'Th',
    }
    let result = str
    for (const [from, to] of Object.entries(EXPLICIT)) {
        result = result.replaceAll(from, to)
    }
    // Normalize to NFD (decomposed), then remove combining marks
    return result.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Title-case a string (handles multi-word: "new york" → "New York")
 */
function toTitleCase(str) {
    if (!str) return ''
    return str.replace(/\b\w+/g, word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
}

/**
 * Normalize a city name to its canonical English form.
 *
 * @param {string} city - City name in any language/format
 * @returns {string} - Canonical English city name
 *
 * @example
 * normalizeCityName('Kraków')   // → 'Krakow'
 * normalizeCityName('Warszawa') // → 'Warsaw'
 * normalizeCityName('Roma')     // → 'Rome'
 * normalizeCityName('New York') // → 'New York'
 * normalizeCityName('Қарағанды') // → 'Қарағанды' (unknown → stripped diacritics + title-case)
 */
export function normalizeCityName(city) {
    if (!city || typeof city !== 'string') return typeof city === 'string' ? null : city

    const trimmed = city.trim()
    if (!trimmed) return null

    // 1. Check override map (case-insensitive, diacritic-stripped key)
    const key = stripDiacritics(trimmed).toLowerCase()
    if (CITY_OVERRIDES[key]) {
        return CITY_OVERRIDES[key]
    }

    // 2. Strip diacritics + title-case as fallback
    //    Kraków → Krakow, Kyïv → Kyiv, Białystok → Bialystok
    const stripped = stripDiacritics(trimmed)
    return toTitleCase(stripped)
}

/**
 * Normalize a country name to its canonical English form.
 *
 * @param {string} country - Country name in any language/format
 * @returns {string} - Canonical English country name
 *
 * @example
 * normalizeCountryName('Polska')      // → 'Poland'
 * normalizeCountryName('Україна')     // → 'Ukraine'
 * normalizeCountryName('United Kingdom') // → 'United Kingdom'
 */
export function normalizeCountryName(country) {
    if (!country || typeof country !== 'string') return typeof country === 'string' ? null : country

    const trimmed = country.trim()
    if (!trimmed) return null

    // 1. Check override map
    const key = stripDiacritics(trimmed).toLowerCase()
    if (COUNTRY_OVERRIDES[key]) {
        return COUNTRY_OVERRIDES[key]
    }

    // 2. Strip diacritics + title-case as fallback
    const stripped = stripDiacritics(trimmed)
    return toTitleCase(stripped)
}

/**
 * Extract city and country from a Google Places formatted address.
 * Google addresses look like: "Street 12, 00-123 Kraków, Poland"
 * or: "Kraków, Poland" or just "Kraków"
 *
 * @param {string} address - Full formatted address
 * @returns {{ city: string|null, country: string|null }}
 */
export function extractCityCountryFromAddress(address) {
    if (!address || typeof address !== 'string') return { city: null, country: null }

    const parts = address.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length === 0) return { city: null, country: null }

    if (parts.length === 1) {
        // Single part — assume it's a city name
        return { city: parts[0], country: null }
    }

    // Known country names (last part matching = country)
    const COUNTRY_NAMES = new Set([
        'poland', 'ukraine', 'germany', 'france', 'spain', 'italy', 'czech republic',
        'czechia', 'hungary', 'austria', 'netherlands', 'belgium', 'portugal',
        'greece', 'turkey', 'georgia', 'israel', 'japan', 'united kingdom',
        'united states', 'usa', 'canada', 'australia', 'russia', 'belarus',
    ])

    // Last part might be a country
    const lastPart = parts[parts.length - 1]
    const lastPartLower = lastPart.toLowerCase()
    const isCountry = COUNTRY_NAMES.has(lastPartLower)

    if (isCountry) {
        // Format: Street, Postal City, Country
        const rawCountry = lastPart
        const rawCity = parts[parts.length - 2]
            .replace(/^\d{2}[-\s]?\d{0,3}\s*/, '').trim() // strip postal code
        return { city: rawCity || null, country: rawCountry }
    }

    // No recognized country — assume last part is the city
    // Format: Street, City  OR  Street, Postal City
    const rawCity = lastPart.replace(/^\d{2}[-\s]?\d{0,3}\s*/, '').trim()
    return { city: rawCity || null, country: null }
}
