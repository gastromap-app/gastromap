import { supabase } from '@/shared/api/client'

/**
 * Admin Chat API — provides admin-only access to any user's chat history.
 *
 * Uses the authenticated Supabase client with admin RLS policies.
 * The admin RLS policy (`get_my_role() = 'admin'`) grants SELECT access
 * to all rows regardless of user_id.
 *
 * IMPORTANT: Does NOT use service_role key in the browser.
 */

/**
 * fetchUserSessions — Fetch all chat sessions for a target user (admin only).
 *
 * @param {string} targetUserId — The user whose sessions to retrieve
 * @param {{ limit?: number, offset?: number }} [options={}]
 * @returns {Promise<{ sessions: object[], total: number }>}
 */
export async function fetchUserSessions(targetUserId, { limit = 20, offset = 0 } = {}) {
  if (!supabase || !targetUserId) {
    return { sessions: [], total: 0 }
  }

  // Get total count for pagination metadata
  const { count, error: countError } = await supabase
    .from('chat_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', targetUserId)

  if (countError) {
    console.error('[admin-chat] Error counting sessions:', countError)
    return { sessions: [], total: 0 }
  }

  // Fetch paginated sessions
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[admin-chat] Error fetching user sessions:', error)
    return { sessions: [], total: count || 0 }
  }

  return {
    sessions: data || [],
    total: count || 0,
  }
}

/**
 * fetchSessionMessages — Fetch messages for a specific session (admin only).
 * Supports cursor-based pagination via `before` timestamp.
 *
 * @param {string} sessionId — The session to fetch messages from
 * @param {{ limit?: number, before?: string }} [options={}]
 *   - limit: Maximum messages to return (default 50)
 *   - before: ISO timestamp cursor; only messages older than this are returned
 * @returns {Promise<object[]>} — Array of messages ordered ASC by timestamp
 */
export async function fetchSessionMessages(sessionId, { limit = 50, before } = {}) {
  if (!supabase || !sessionId) {
    return []
  }

  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: false })

  if (before) {
    query = query.lt('timestamp', before)
  }

  const effectiveLimit = Number.isFinite(limit) && limit > 0 ? limit : 50
  query = query.limit(effectiveLimit)

  const { data, error } = await query

  if (error) {
    console.error('[admin-chat] Error fetching session messages:', error)
    return []
  }

  // Reverse to return ASC order (queried DESC for cursor efficiency)
  return (data || []).slice().reverse()
}

/**
 * searchChatMessages — Full-text search across chat message content (admin only).
 * Uses ILIKE for pattern matching (trigram GIN index supports this efficiently).
 *
 * @param {string} query — Search text to match against message content
 * @param {{ userId?: string, dateFrom?: string, dateTo?: string, limit?: number }} [options={}]
 *   - userId: Filter to a specific user's messages
 *   - dateFrom: ISO timestamp; only messages after this date
 *   - dateTo: ISO timestamp; only messages before this date
 *   - limit: Maximum results to return (default 50)
 * @returns {Promise<{ messages: object[], total: number }>}
 */
export async function searchChatMessages(query, { userId, dateFrom, dateTo, limit = 50 } = {}) {
  if (!supabase || !query) {
    return { messages: [], total: 0 }
  }

  // Build the base query with ILIKE for trigram-indexed search
  let countQuery = supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .ilike('content', `%${query}%`)

  let dataQuery = supabase
    .from('chat_messages')
    .select('*')
    .ilike('content', `%${query}%`)
    .order('timestamp', { ascending: false })

  // Apply optional filters
  if (userId) {
    countQuery = countQuery.eq('user_id', userId)
    dataQuery = dataQuery.eq('user_id', userId)
  }

  if (dateFrom) {
    countQuery = countQuery.gte('timestamp', dateFrom)
    dataQuery = dataQuery.gte('timestamp', dateFrom)
  }

  if (dateTo) {
    countQuery = countQuery.lte('timestamp', dateTo)
    dataQuery = dataQuery.lte('timestamp', dateTo)
  }

  const effectiveLimit = Number.isFinite(limit) && limit > 0 ? limit : 50
  dataQuery = dataQuery.limit(effectiveLimit)

  // Execute both queries
  const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([
    countQuery,
    dataQuery,
  ])

  if (countError) {
    console.error('[admin-chat] Error counting search results:', countError)
  }

  if (dataError) {
    console.error('[admin-chat] Error searching messages:', dataError)
    return { messages: [], total: 0 }
  }

  return {
    messages: data || [],
    total: count || 0,
  }
}
