/**
 * Output Guardrail — Simple PII redaction only
 *
 * Only removes personal data from responses:
 * - Emails
 * - Phone numbers
 * - Bracketed placeholders like [PERSON_NAME]
 *
 * Does NOT validate place names - the LLM is instructed in system prompt
 * to only mention places from search results. If it hallucinates, the
 * buildTemplateResponse in agents.js will replace the response with
 * real data from the database.
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

// ─── Main export ───

/**
 * @typedef {Object} ValidateResult
 * @property {string} sanitizedText
 * @property {Array<{ kind: 'pii', original: string, replacement: string }>} redactions
 */

/**
 * Simple output validation - only removes PII.
 * 
 * Place name validation is handled by:
 * 1. System prompt (LLM instructed to only use database results)
 * 2. validateGrounding() in agents.js (replaces hallucinations with template)
 * 3. buildTemplateResponse() (shows real data if needed)
 *
 * @param {string} text
 * @returns {ValidateResult}
 */
export function validateResponse(text) {
  if (!text || typeof text !== 'string') {
    return { sanitizedText: '', redactions: [] }
  }

  const redactions = []
  let sanitizedText = text

  // Only PII redaction - no place name validation
  const piiPatterns = [EMAIL_RE, PHONE_RE, BRACKETED_NAME_RE]

  for (const pattern of piiPatterns) {
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
