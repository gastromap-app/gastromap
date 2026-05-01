import { supabase } from './client'

const MESSAGE_COLUMNS = [
    'id',
    'session_id',
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
].join(', ');

/**
 * Normalize a chat_messages row into the shape used by the client store.
 * Handles legacy rows that only carried data via metadata.matches.
 */
function normalizeMessage(row) {
    const metadata = row.metadata || {};
    const legacyMatches = Array.isArray(metadata.matches) ? metadata.matches : [];
    const attachments = Array.isArray(row.attachments) && row.attachments.length > 0
        ? row.attachments
        : legacyMatches;

    return {
        id: row.id,
        role: row.role,
        content: row.content,
        timestamp: row.timestamp ? new Date(row.timestamp).getTime() : Date.now(),
        // First-class fields
        attachments,
        toolCalls: row.tool_calls || null,
        toolCallId: row.tool_call_id || null,
        intent: row.intent || metadata.intent || null,
        language: row.language || null,
        mentionedLocationIds: Array.isArray(row.mentioned_location_ids) ? row.mentioned_location_ids : [],
        metadata,
        // Backward-compat alias still consumed by some components
        matches: attachments,
    };
}

/**
 * Fetch the most recent chat session with its messages for the given user.
 * Options:
 *   - before: ISO timestamp; return messages older than this cursor
 *   - limit:  max messages to return (most recent N)
 */
export async function fetchChatHistory(userId, options = {}) {
    if (!supabase) return null;
    const { before = null, limit = null } = options;

    const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (sessionError) {
        console.error('Error fetching chat session:', sessionError);
        return { sessionId: null, messages: [] };
    }

    if (!session) return { sessionId: null, messages: [] };

    let query = supabase
        .from('chat_messages')
        .select(MESSAGE_COLUMNS)
        .eq('session_id', session.id)
        .order('timestamp', { ascending: false });

    if (before) {
        query = query.lt('timestamp', before);
    }
    if (limit && Number.isFinite(limit)) {
        query = query.limit(limit);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
        console.error('Error fetching chat messages:', messagesError);
    }

    // We queried DESC for pagination; return ASC to the UI.
    const ordered = (messages || []).slice().reverse().map(normalizeMessage);

    return {
        sessionId: session.id,
        messages: ordered,
    };
}

/**
 * Fetch older messages for an existing session (cursor pagination).
 */
export async function fetchOlderMessages(sessionId, { before, limit = 30 } = {}) {
    if (!supabase || !sessionId) return [];

    let query = supabase
        .from('chat_messages')
        .select(MESSAGE_COLUMNS)
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: false })
        .limit(limit);

    if (before) query = query.lt('timestamp', before);

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching older chat messages:', error);
        return [];
    }

    return (data || []).slice().reverse().map(normalizeMessage);
}

export async function createChatSession(userId) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('chat_sessions')
        .insert([{ user_id: userId }])
        .select()
        .single();

    if (error) {
        console.error('Error creating chat session:', error);
        return null;
    }

    return data;
}

/**
 * Persist a chat message. Writes every new column as a first-class field.
 * Accepts the client-side message shape:
 *   {
 *     role, content,
 *     attachments?, matches?           // legacy alias also accepted
 *     toolCalls?, toolCallId?,
 *     intent?, language?,
 *     mentionedLocationIds?,
 *     metadata?                        // extra free-form payload
 *   }
 */
export async function saveChatMessage(sessionId, userId, message) {
    if (!supabase || !sessionId) return null;

    const attachments = Array.isArray(message.attachments)
        ? message.attachments
        : Array.isArray(message.matches)
            ? message.matches
            : [];

    const mentionedLocationIds = Array.isArray(message.mentionedLocationIds)
        ? message.mentionedLocationIds
        : attachments
            .map((a) => a?.id || a?.location_id)
            .filter(Boolean);

    const metadata = {
        ...(message.metadata || {}),
    };
    // Never double-write attachments into metadata; they live in their own column now.
    delete metadata.matches;

    const payload = {
        session_id: sessionId,
        user_id: userId,
        role: message.role,
        content: message.content,
        metadata,
        attachments,
        tool_calls: message.toolCalls || null,
        tool_call_id: message.toolCallId || null,
        intent: message.intent || null,
        language: message.language || null,
        mentioned_location_ids: mentionedLocationIds,
    };

    const { data, error } = await supabase
        .from('chat_messages')
        .insert([payload])
        .select(MESSAGE_COLUMNS)
        .single();

    if (error) {
        console.error('Error saving chat message:', error);
        return null;
    }

    return normalizeMessage(data);
}
