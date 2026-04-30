/**
 * Intent Detection (v2)
 *
 * Categorizes user queries into one of 6 intents:
 *   - search_nearby:    "рядом", "near me", "w pobliżu", "поруч"
 *   - search_by_filter: "recommend", "найди", "где поесть"
 *   - follow_up:        "расскажи подробнее", "а что там", "more about"
 *   - compare:          "в каком лучше", "which is better", "compare"
 *   - card_request:     "покажи карточку", "show card"
 *   - meta:             general / casual / off-topic
 *
 * Intent is used as metadata for analytics and context injection,
 * NOT for routing — the LLM uses function calling for routing.
 */

const NEARBY_RE =
    /(рядом|рядышком|поблизости|поруч|неподалеку|недалеко|ближайш|near\s?(?:me|by|here)|around\s?here|w\s?pobli[żz]u|obok|niedaleko|bl[iy]sko)/i

const FILTER_RE =
    /(recommend|where|best|find|eat|drink|cafe|coffee|dinner|lunch|breakfast|date|romantic|cozy|хочу|найди|посоветуй|порекомендуй|где|лучший|хорошее|restaurant|бар|ресторан|кафе|пицца|суши|итальянск|polec|szukam|restauracja|kawiarnia)/i

const FOLLOW_UP_RE =
    /(подробнее|расскажи|расскажи\s+больше|а\s+что\s+там|tell\s+me\s+more|more\s+about|what\s+about|первое|второе|третье|the\s+first|the\s+second|опиши|details|szczeg[oó][lł]|powiedz\s+wi[eę]cej)/i

const COMPARE_RE =
    /(лучше|уютнее|дешевле|дороже|вкуснее|compare|сравни|which\s+is\s+better|vs\b|versus|который|która|lepiej|por[oó]wn|w\s+kt[oó]rym)/i

const CARD_RE =
    /(покажи\s+карточку|show\s+card|карточк[уа]|open\s+card|pokaż\s+kartę)/i

const INFO_RE =
    /(open|close|hours|menu|price|book|reservation|phone|address|открыт|закрыт|часы|меню|цена|бронь|телефон|адрес|godziny|otwarcie|cena|rezerwacja)/i

const OFF_TOPIC_RE =
    /(politics|coding|programming|javascript|python|react|weather|news|war|military|crypto|bitcoin|math|calculate|translate|language\s+model|jailbreak|ignore\s+previous|act\s+as|кто\s+президент|кто\s+такой|столица|линукс|программ|код|скрипт|политик|войн|погод|новост|математик|крипт|биткоин|вычисли|переведи|забудь\s+инструкции|действуй\s+как)/i

/**
 * Analyze user intent from their query text.
 *
 * @param {string} text - User query
 * @returns {'search_nearby' | 'search_by_filter' | 'follow_up' | 'compare' | 'card_request' | 'off_topic' | 'meta'} - Detected intent
 */
export function detectIntent(text) {
    if (!text) return 'meta'
    const q = text.toLowerCase()

    // Order matters — specific off-topic check first to enforce guardrails
    if (OFF_TOPIC_RE.test(q))  return 'off_topic'
    if (NEARBY_RE.test(q))     return 'search_nearby'
    if (COMPARE_RE.test(q))    return 'compare'
    if (CARD_RE.test(q))       return 'card_request'
    if (FOLLOW_UP_RE.test(q))  return 'follow_up'
    if (FILTER_RE.test(q))     return 'search_by_filter'
    if (INFO_RE.test(q))       return 'search_by_filter' 

    return 'meta'
}
