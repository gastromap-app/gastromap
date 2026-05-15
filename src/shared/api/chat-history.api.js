import { supabase } from '@/shared/api/client'
import { normalizeMessage } from '@/shared/lib/normalizeMessage'

/**
 * Column list for chat_messages queries.
 */
const MESSAGE_COLUMNS = [
  'id',
  'session_id',
  'user_id',
  'role',
  'content',
  'timestamp',
  'metadata',
  'attachments',
  'tool_calls',
  'tool_call_id',
  'intent',
  'language',
  'mentioned_location_ids',
].join(', ')

/**
 * Transform a raw database row into the client-side message shape,
 * applying normalizeMessage for attachments/matches compatibility.
 */
function transformRow(row) {
  const base = {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp ? new Date(row.timestamp).getTime() : Date.now(),
    attachments: row.attachments || [],
    toolCalls: row.tool_calls || null,
    toolCallId: row.tool_call_id || null,
    intent: row.intent || null,
    language: row.language || null,
    mentionedLocationIds: Array.isArray(row.mentioned_location_ids)
      ? row.mentioned_location_ids
      : [],
    metadata: row.metadata || {},
  }

  // Apply normalizeMessage for attachments/matches compat
  return normalizeMessage(base)
}

/**
 * fetchChatHistory — Fetch the latest active session and its messages for a user.
 *
 * @param {string} userId — The authenticated user's ID
 * @param {{ before?: string, limit?: number }} [options={}]
 *   - before: ISO timestamp cursor; only messages with timestamp < before are returned
 *   - limit: Maximum number of messages to return (default 50)
 * @returns {Promise<{ sessionId: string|null, messages: object[] }>}
 */
export async function fetchChatHistory(userId, { before, limit = 50 } = {}) {
  if (!supabase || !userId) {
    return { sessionId: null, messages: [] }
  }

  // Find the latest active session for the user
  const { data: session, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sessionError) {
    console.error('[chat-history] Error fetching session:', sessionError)
    return { sessionId: null, messages: [] }
  }

  if (!session) {
    return { sessionId: null, messages: [] }
  }

  // Query messages for the session
  let query = supabase
    .from('chat_messages')
    .select(MESSAGE_COLUMNS)
    .eq('session_id', session.id)
    .order('timestamp', { ascending: false })

  // Apply cursor filter if provided
  if (before) {
    query = query.lt('timestamp', before)
  }

  // Enforce limit
  const effectiveLimit = Number.isFinite(limit) && limit > 0 ? limit : 50
  query = query.limit(effectiveLimit)

  const { data: messages, error: messagesError } = await query

  if (messagesError) {
    console.error('[chat-history] Error fetching messages:', messagesError)
    return { sessionId: session.id, messages: [] }
  }

  // Queried DESC for pagination efficiency; reverse to return ASC order
  const ordered = (messages || []).slice().reverse().map(transformRow)

  return {
    sessionId: session.id,
    messages: ordered,
  }
}

/**
 * fetchOlderMessages — Fetch older messages for an existing session (cursor pagination).
 *
 * @param {string} sessionId — The session to fetch messages from
 * @param {{ before?: string, limit?: number }} [options={}]
 *   - before: ISO timestamp cursor; only messages with timestamp < before are returned
 *   - limit: Maximum number of messages to return (default 50)
 * @returns {Promise<object[]>} — Array of normalized messages ordered ASC by timestamp
 */
export async function fetchOlderMessages(sessionId, { before, limit = 50 } = {}) {
  if (!supabase || !sessionId) {
    return []
  }

  let query = supabase
    .from('chat_messages')
    .select(MESSAGE_COLUMNS)
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: false })

  if (before) {
    query = query.lt('timestamp', before)
  }

  const effectiveLimit = Number.isFinite(limit) && limit > 0 ? limit : 50
  query = query.limit(effectiveLimit)

  const { data, error } = await query

  if (error) {
    console.error('[chat-history] Error fetching older messages:', error)
    return []
  }

  // Reverse to return ASC order
  return (data || []).slice().reverse().map(transformRow)
}

/**
 * getOrCreateSession — Find the latest session for a user, or create a new one.
 *
 * @param {string} userId — The authenticated user's ID
 * @returns {Promise<object|null>} — The session object, or null on failure
 */
export async function getOrCreateSession(userId) {
  if (!supabase || !userId) {
    return null
  }

  // Try to find the latest existing session
  const { data: existing, error: findError } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError) {
    console.error('[chat-history] Error finding session:', findError)
    return null
  }

  if (existing) {
    return existing
  }

  // No session exists — create a new one
  const { data: created, error: createError } = await supabase
    .from('chat_sessions')
    .insert([{ user_id: userId }])
    .select()
    .single()

  if (createError) {
    console.error('[chat-history] Error creating session:', createError)
    return null
  }

  return created
}
