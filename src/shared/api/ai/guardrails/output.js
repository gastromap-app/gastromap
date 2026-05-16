/**
 * Output Guardrail — Stage 2 Validator
 *
 * Validates an assistant message before it is shown to the user.
 * - Extracts **bold** place names and verifies against allowed/session locations.
 * - Replaces unverified names with a generic phrase.
 * - Redacts PII (emails, phone numbers, bracketed user-name placeholders).
 *
 * Pure function; no I/O; synchronous.
 *
 * @module guardrails/output
 */

// ─── Default PII patterns ───

/** Standard email regex */
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

/** Phone numbers: E.164 (+1234567890), parenthesized ((123) 456-7890), dashed, dotted, spaced */
const PHONE_RE = /(?:\+\d{1,3}[-.\s]?)?(?:\(\d{1,4}\)[-.\s]?)?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,9}/g

/** Bracketed user-name placeholders: [PERSON_NAME], [USER_NAME], [NAME], [FULL_NAME], etc. */
const BRACKETED_NAME_RE = /\[(?:PERSON_NAME|USER_NAME|FULL_NAME|NAME|FIRST_NAME|LAST_NAME|EMAIL|PHONE)\]/gi

// ─── Bold extraction regex ───
const BOLD_RE = /\*\*([^*]+)\*\*/g

// ─── Generic replacement phrase ───
const GENERIC_PLACE = 'a recommended place'

// ─── Helpers ───

/**
 * Normalize a string for fuzzy matching: lowercase, remove diacritics, trim.
 *
 * @param {string} str
 * @returns {string}
 */
function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
}

/**
 * Build a Set of normalized location titles from an array of location objects.
 *
 * @param {Array<{ id: string, title: string }>} locations
 * @returns {Set<string>}
 */
function buildAllowedSet(locations) {
  const set = new Set()
  for (const loc of locations) {
    if (loc && loc.title) {
      set.add(normalize(loc.title))
    }
  }
  return set
}

/**
 * Check if a bolded name matches any allowed location using normalized comparison.
 *
 * @param {string} name - The bolded text extracted from the message
 * @param {Set<string>} allowedSet - Set of normalized allowed location titles
 * @returns {boolean}
 */
function isAllowedPlace(name, allowedSet) {
  const normalizedName = normalize(name)
  // Direct match
  if (allowedSet.has(normalizedName)) return true
  // Check if any allowed location is contained in the name or vice versa
  for (const allowed of allowedSet) {
    if (normalizedName.includes(allowed) || allowed.includes(normalizedName)) {
      return true
    }
  }
  return false
}

// ─── Main export ───

/**
 * @typedef {Object} ValidateResult
 * @property {string} sanitizedText
 * @property {Array<{ kind: 'place' | 'pii', original: string, replacement: string | null }>} redactions
 */

/**
 * Validate an assistant message before it is shown to the user.
 *
 * @param {string} text
 * @param {Array<{ id: string, title: string }>} allowedLocations  // current turn tool results
 * @param {Array<{ id: string, title: string }>} sessionLocations  // accumulated for this session
 * @param {{ piiPatterns?: RegExp[] }} [opts]
 * @returns {ValidateResult}
 */
export function validateResponse(text, allowedLocations, sessionLocations, opts = {}) {
  if (!text || typeof text !== 'string') {
    return { sanitizedText: '', redactions: [] }
  }

  const redactions = []

  // Build the union of allowed location titles (normalized)
  const allowedSet = buildAllowedSet([
    ...(Array.isArray(allowedLocations) ? allowedLocations : []),
    ...(Array.isArray(sessionLocations) ? sessionLocations : [])
  ])

  // ─── Step 1: Validate bolded place names ───
  let sanitizedText = text.replace(BOLD_RE, (match, boldContent) => {
    // Check if this bolded text is a place name that needs verification
    // Skip common non-place bold usage (single words that are clearly formatting)
    if (isAllowedPlace(boldContent, allowedSet)) {
      // Place is verified — keep it as-is
      return match
    }

    // Unverified bolded name — replace with generic phrase
    redactions.push({
      kind: 'place',
      original: boldContent,
      replacement: GENERIC_PLACE
    })
    return `**${GENERIC_PLACE}**`
  })

  // ─── Step 2: PII redaction ───
  const piiPatterns = opts.piiPatterns || [EMAIL_RE, PHONE_RE, BRACKETED_NAME_RE]

  for (const pattern of piiPatterns) {
    // Reset lastIndex for global regexes
    const regex = new RegExp(pattern.source, pattern.flags)
    sanitizedText = sanitizedText.replace(regex, (match) => {
      redactions.push({
        kind: 'pii',
        original: match,
        replacement: '[REDACTED]'
      })
      return '[REDACTED]'
    })
  }

  return { sanitizedText, redactions }
}
