/**
 * normalizeMessage — Normalizes legacy message formats for backward compatibility.
 *
 * Handles the `matches` ↔ `attachments` field migration:
 * - If `matches` exists but no `attachments`, copies `matches` to `attachments`
 * - If `attachments` exists, mirrors to `matches` for backward compatibility
 * - Defaults `attachments` to empty array if both fields are absent
 *
 * @param {object} message — The message object to normalize
 * @returns {object} — A new message object with normalized fields
 */
export function normalizeMessage(message) {
  if (!message || typeof message !== 'object') {
    return message;
  }

  const normalized = { ...message };

  const hasAttachments =
    normalized.attachments !== undefined && normalized.attachments !== null;
  const hasMatches =
    normalized.matches !== undefined && normalized.matches !== null;

  if (hasMatches && !hasAttachments) {
    // Legacy format: copy matches → attachments
    normalized.attachments = Array.isArray(normalized.matches)
      ? [...normalized.matches]
      : [];
  } else if (hasAttachments) {
    // Modern format: mirror attachments → matches for backward compat
    normalized.matches = Array.isArray(normalized.attachments)
      ? [...normalized.attachments]
      : [];
    // Ensure attachments is an array
    if (!Array.isArray(normalized.attachments)) {
      normalized.attachments = [];
    }
  } else {
    // Neither field present: default both to empty array
    normalized.attachments = [];
    normalized.matches = [];
  }

  // If we set attachments from matches, also ensure matches mirrors back
  if (hasMatches && !hasAttachments) {
    normalized.matches = Array.isArray(normalized.attachments)
      ? [...normalized.attachments]
      : [];
  }

  return normalized;
}
