/**
 * validateMessage — Validates a chat message payload before persistence.
 *
 * @param {object} message — The message object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */

const VALID_ROLES = ['user', 'assistant', 'tool'];
const MAX_CONTENT_LENGTH = 50_000;
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024; // 10KB

export function validateMessage(message) {
  const errors = [];

  if (!message || typeof message !== 'object') {
    return { valid: false, errors: ['Message must be a non-null object'] };
  }

  // Validate role
  if (!VALID_ROLES.includes(message.role)) {
    errors.push(
      `Invalid role "${message.role}". Must be one of: ${VALID_ROLES.join(', ')}`
    );
  }

  // Validate content
  if (typeof message.content !== 'string' || message.content.length === 0) {
    errors.push('Content must be a non-empty string');
  } else if (message.content.length > MAX_CONTENT_LENGTH) {
    errors.push(
      `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters (got ${message.content.length})`
    );
  }

  // Validate timestamp — must be valid Unix milliseconds
  if (
    typeof message.timestamp !== 'number' ||
    !Number.isFinite(message.timestamp) ||
    message.timestamp <= 0
  ) {
    errors.push('Timestamp must be a valid positive Unix milliseconds number');
  }

  // Validate session_id presence
  if (!message.session_id) {
    errors.push('session_id is required');
  }

  // Validate attachments (optional field)
  if (message.attachments !== undefined && message.attachments !== null) {
    if (!Array.isArray(message.attachments)) {
      errors.push('Attachments must be an array');
    } else {
      if (message.attachments.length > MAX_ATTACHMENTS) {
        errors.push(
          `Attachments exceed maximum of ${MAX_ATTACHMENTS} items (got ${message.attachments.length})`
        );
      }

      // Check individual attachment sizes
      for (let i = 0; i < message.attachments.length; i++) {
        const serialized = JSON.stringify(message.attachments[i]);
        if (serialized.length > MAX_ATTACHMENT_SIZE_BYTES) {
          errors.push(
            `Attachment at index ${i} exceeds ${MAX_ATTACHMENT_SIZE_BYTES} bytes (got ${serialized.length})`
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
