import { supabase } from './client'

export async function fetchChatHistory(userId) {
    if (!supabase) return null;
    
    // Get the most recent open chat session
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

    // Get messages for this session
    const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', session.id)
        .order('timestamp', { ascending: true });

    if (messagesError) {
        console.error('Error fetching chat messages:', messagesError);
    }

    return { 
        sessionId: session.id, 
        messages: (messages || []).map(m => {
            const metadata = m.metadata || {};
            return {
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.timestamp).getTime(),
                matches: metadata.matches || []
            };
        })
    };
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

export async function saveChatMessage(sessionId, userId, message) {
    if (!supabase || !sessionId) return null;

    // We don't need userId in messages if it's linked via sessionId, 
    // and the table doesn't have it.
    const { error } = await supabase
        .from('chat_messages')
        .insert([{
            session_id: sessionId,
            role: message.role,
            content: message.content,
            metadata: { 
                matches: message.matches || [],
                intent: message.intent || null
            }
        }]);

    if (error) {
        console.error('Error saving chat message:', error);
    }
}

