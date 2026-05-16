/**
 * Input Guardrail — Stage 1 Classifier
 *
 * Classifies a user query as one of { personal, factual, off_topic }
 * before any LLM/tool call. Pure function; no I/O.
 *
 * Re-uses the OFF_TOPIC_RE regex from intents.js for off-topic detection.
 *
 * @module guardrails/input
 */

// ─── Off-topic regex (copied from intents.js to keep this module pure / no I/O) ───
const OFF_TOPIC_RE =
  /(politics|coding|programming|javascript|python|react|weather|news|war|military|crypto|bitcoin|math|calculate|translate|language\s+model|jailbreak|ignore\s+previous|act\s+as|кто\s+президент|кто\s+такой|столица|линукс|программ|код|скрипт|политик|войн|погод|новост|математик|крипт|биткоин|вычисли|переведи|забудь\s+инструкции|действуй\s+как)/i

// ─── Factual query patterns ───
// Questions about a specific named place or concrete fact (hours, address, phone, menu, price, booking)
const FACTUAL_KEYWORDS_RE =
  /\b(open|close[ds]?|hours|menu|price|pric(?:es|ing)|book(?:ing)?|reservation|phone|address|located|location|directions?|website|wi-?fi|parking|deliver(?:y|ies)?|открыт|закрыт|часы|меню|цена|бронь|бронирован|телефон|адрес|доставк|godziny|otwarcie|cena|rezerwacja|adres|telefon)\b/i

// Pattern: "is X open?", "address of Y", "hours of Z", "does X have wifi?"
const FACTUAL_QUESTION_RE =
  /(?:^|\s)(?:is|does|do|what(?:'s| is| are)|where(?:'s| is)|when(?:'s| does| is)|how (?:late|early|much)|czy|kiedy|gdzie jest|какой|какая|какое|когда|где находится|сколько стоит)/i

// ─── Personal / recommendation patterns ───
// Note: Using (?:^|\s|[.,!?]) instead of \b for Cyrillic/Polish word boundaries
const PERSONAL_RE =
  /(?:^|\s|[.,!?])(recommend|suggest|where\s+should\s+i|what(?:'s| is)\s+good|best\s+(?:place|spot|restaurant|cafe|bar)|good\s+(?:place|spot|restaurant|cafe|bar)|порекомендуй|посоветуй|куда\s+(?:пойти|сходить)|что\s+(?:посоветуешь|порекомендуешь)|лучш(?:ее|ий|ая)|хорошее|хочу|polec|gdzie\s+(?:warto|pójść|iść)|najlepsz[aey]|co\s+polecasz)/i

const PERSONAL_VAGUE_RE =
  /(?:^|\s|[.,!?])(something|somewhere|anything|whatever|что-?нибудь|куда-?нибудь|где-?нибудь|coś|gdzieś)/i

// ─── Constants ───
const DEFAULT_THRESHOLD = 0.6

/** Default fallback when confidence < threshold (R1.5). */
export const FALLBACK_KIND = 'personal'

/**
 * @typedef {'personal' | 'factual' | 'off_topic'} QueryKind
 * @typedef {Object} ClassifyResult
 * @property {QueryKind} kind
 * @property {number} confidence  // [0, 1]
 * @property {string} reason       // human-readable
 */

/**
 * Classify a user query for guardrail Stage 1.
 * Pure function; no I/O. Re-uses regexes from intents.js for off_topic detection.
 *
 * @param {string} text
 * @param {{ threshold?: number }} [opts]
 * @returns {ClassifyResult}
 */
export function classifyQuery(text, opts = {}) {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD

  // Handle empty / falsy input
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { kind: FALLBACK_KIND, confidence: 0.0, reason: 'Empty or invalid input' }
  }

  const normalized = text.trim()

  // ─── Stage 1: Off-topic detection (highest priority) ───
  if (OFF_TOPIC_RE.test(normalized)) {
    return { kind: 'off_topic', confidence: 0.9, reason: 'Query matches off-topic pattern' }
  }

  // ─── Stage 2: Factual detection ───
  const hasFactualKeyword = FACTUAL_KEYWORDS_RE.test(normalized)
  const hasFactualQuestion = FACTUAL_QUESTION_RE.test(normalized)

  if (hasFactualKeyword && hasFactualQuestion) {
    // Strong factual signal: both a factual keyword and a question structure
    const result = { kind: 'factual', confidence: 0.8, reason: 'Query asks about a specific fact (keyword + question pattern)' }
    return applyThreshold(result, threshold)
  }

  // ─── Stage 3: Personal / recommendation detection ───
  const hasPersonalPattern = PERSONAL_RE.test(normalized)
  const hasVaguePattern = PERSONAL_VAGUE_RE.test(normalized)

  if (hasPersonalPattern) {
    const result = { kind: 'personal', confidence: 0.85, reason: 'Query asks for a recommendation or suggestion' }
    return applyThreshold(result, threshold)
  }

  // ─── Stage 4: Weaker signals ───
  // Factual keyword alone (without question structure) — moderate confidence
  if (hasFactualKeyword) {
    const result = { kind: 'factual', confidence: 0.65, reason: 'Query contains factual keyword' }
    return applyThreshold(result, threshold)
  }

  // Vague pattern alone — moderate personal signal
  if (hasVaguePattern) {
    const result = { kind: 'personal', confidence: 0.7, reason: 'Query is vague and likely needs personalization' }
    return applyThreshold(result, threshold)
  }

  // ─── Stage 5: Ambiguous — low confidence, falls back to personal via threshold ───
  const result = { kind: 'personal', confidence: 0.4, reason: 'Ambiguous query, defaulting to personal' }
  return applyThreshold(result, threshold)
}

/**
 * Apply the threshold gate: when confidence < threshold, override kind to FALLBACK_KIND.
 *
 * @param {ClassifyResult} result
 * @param {number} threshold
 * @returns {ClassifyResult}
 */
function applyThreshold(result, threshold) {
  if (result.confidence < threshold) {
    return {
      kind: FALLBACK_KIND,
      confidence: result.confidence,
      reason: `${result.reason} (confidence below threshold ${threshold}, falling back to '${FALLBACK_KIND}')`
    }
  }
  return result
}
