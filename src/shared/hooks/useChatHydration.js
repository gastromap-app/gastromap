import { useEffect, useRef } from 'react'
import { useAIChatStore } from '@/shared/store/useAIChatStore'
import { fetchChatHistory } from '@/shared/api/chat-history.api'
import { SyncQueue } from '@/shared/lib/SyncQueue'
import { normalizeMessage } from '@/shared/lib/normalizeMessage'
import { supabase } from '@/shared/api/client'

/**
 * useChatHydration — Reconciles local chat state with server state on mount.
 *
 * Responsibilities:
 * 1. User isolation: if stored userId ≠ authenticated user, clear local history
 * 2. Fetch latest chat history from Supabase (server = source of truth)
 * 3. Identify local messages not present on server → enqueue for sync
 * 4. Flush queue immediately if online and unsynced messages exist
 *
 * IMPORTANT: Does NOT delete local-only messages — syncs them to server instead.
 *
 * @param {string|null} userId — The authenticated user's ID
 * @param {{ flushQueue?: () => Promise<any> }} [options={}]
 */
export function useChatHydration(userId, { flushQueue } = {}) {
  const hydrated = useRef(false)
  const syncQueueRef = useRef(null)

  // Lazy-init a SyncQueue instance for enqueuing unsynced local messages
  if (!syncQueueRef.current) {
    syncQueueRef.current = new SyncQueue()
  }

  useEffect(() => {
    if (!userId) return
    // Only hydrate once per userId change
    if (hydrated.current) return
    hydrated.current = true

    let cancelled = false

    async function hydrate() {
      const store = useAIChatStore.getState()
      const queue = syncQueueRef.current

      // ── Step 1: User isolation check ──────────────────────────────────
      if (store.userId && store.userId !== userId) {
        // Different user — clear all local history to prevent data leakage
        useAIChatStore.getState().clearHistory()
        useAIChatStore.setState({ userId })
      }

      // ── Step 2: Fetch server state ────────────────────────────────────
      let serverData
      try {
        serverData = await fetchChatHistory(userId)
      } catch (err) {
        console.error('[useChatHydration] Failed to fetch server history:', err)
        // If fetch fails, stamp userId and bail — local state is authoritative
        useAIChatStore.setState({ userId })
        return
      }

      if (cancelled) return

      // No server session — local is authoritative, just stamp userId
      if (!serverData || !serverData.sessionId) {
        useAIChatStore.setState({ userId })
        return
      }

      // ── Step 3: Identify local messages not on server ─────────────────
      const currentMessages = useAIChatStore.getState().messages
      const serverMsgIds = new Set(serverData.messages.map((m) => m.id))
      const unsyncedLocal = currentMessages.filter((m) => !serverMsgIds.has(m.id))

      // Enqueue unsynced local messages for sync (don't lose them!)
      if (unsyncedLocal.length > 0) {
        for (const msg of unsyncedLocal) {
          const normalized = normalizeMessage(msg)
          const payload = {
            id: normalized.id,
            session_id: serverData.sessionId,
            user_id: userId,
            role: normalized.role,
            content: normalized.content,
            timestamp: new Date(normalized.timestamp).toISOString(),
            metadata: normalized.metadata || {},
            attachments: normalized.attachments || [],
            tool_calls: normalized.toolCalls || null,
            tool_call_id: normalized.toolCallId || null,
            intent: normalized.intent || null,
            language: normalized.language || null,
            mentioned_location_ids: normalized.mentionedLocationIds || [],
          }
          queue.enqueue({ sessionId: serverData.sessionId, userId, payload })
        }
      }

      if (cancelled) return

      // ── Step 4: Load server state as source of truth ──────────────────
      useAIChatStore.getState().loadHistory(
        serverData.sessionId,
        serverData.messages,
        userId
      )

      // ── Step 5: Flush queue if online and unsynced messages exist ──────
      if (navigator.onLine && queue.size > 0) {
        if (flushQueue) {
          // Use the provided flushQueue from useChatSync (preferred)
          flushQueue().catch((err) => {
            console.error('[useChatHydration] Queue flush failed:', err)
          })
        } else if (supabase) {
          // Fallback: flush directly via queue
          queue.flush(supabase).catch((err) => {
            console.error('[useChatHydration] Direct queue flush failed:', err)
          })
        }
      }
    }

    hydrate()

    return () => {
      cancelled = true
    }
  }, [userId, flushQueue])

  // Reset hydration flag when userId changes
  useEffect(() => {
    hydrated.current = false
  }, [userId])
}
