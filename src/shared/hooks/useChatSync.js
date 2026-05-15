import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/shared/api/client'
import { SyncQueue } from '@/shared/lib/SyncQueue'
import { validateMessage } from '@/shared/lib/validateMessage'
import { normalizeMessage } from '@/shared/lib/normalizeMessage'

/**
 * useChatSync — Orchestrates the sync lifecycle between Zustand store and Supabase.
 *
 * Handles online/offline transitions, message persistence (immediate or queued),
 * and queue flushing on reconnection.
 *
 * @returns {{
 *   syncStatus: 'idle' | 'syncing' | 'offline' | 'error',
 *   pendingCount: number,
 *   isOnline: boolean,
 *   persistMessage: (sessionId: string, userId: string, message: object) => Promise<{ synced: boolean, queued: boolean }>,
 *   flushQueue: () => Promise<{ synced: number, failed: number }>,
 * }}
 */
export function useChatSync() {
  const [syncStatus, setSyncStatus] = useState(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle'
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  const syncQueueRef = useRef(null)

  // Initialize SyncQueue instance once
  if (!syncQueueRef.current) {
    syncQueueRef.current = new SyncQueue()
  }

  // Update pendingCount from queue on mount
  useEffect(() => {
    setPendingCount(syncQueueRef.current.size)
  }, [])

  /**
   * flushQueue — Flush all pending messages from the SyncQueue to Supabase.
   * Updates syncStatus during the operation.
   */
  const flushQueue = useCallback(async () => {
    const queue = syncQueueRef.current
    if (!supabase || queue.size === 0) {
      setPendingCount(queue.size)
      return { synced: 0, failed: 0 }
    }

    setSyncStatus('syncing')

    try {
      const result = await queue.flush(supabase)
      setPendingCount(queue.size)
      setSyncStatus('idle')
      return result
    } catch (err) {
      setPendingCount(queue.size)
      setSyncStatus('error')
      return { synced: 0, failed: queue.size }
    }
  }, [])

  // Listen to online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setSyncStatus('idle')
      // Auto-flush queue when coming back online
      flushQueue()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [flushQueue])

  /**
   * persistMessage — Persist a single message to Supabase (if online) or queue it.
   *
   * @param {string} sessionId — Target chat session ID
   * @param {string} userId — Owner user ID
   * @param {object} message — Client-side message object
   * @returns {Promise<{ synced: boolean, queued: boolean }>}
   */
  const persistMessage = useCallback(async (sessionId, userId, message) => {
    const queue = syncQueueRef.current

    // Normalize message before building payload
    const normalized = normalizeMessage(message)

    // Build the payload for Supabase
    const payload = {
      id: normalized.id,
      session_id: sessionId,
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

    // Validate message before persistence
    const validation = validateMessage({
      ...normalized,
      session_id: sessionId,
    })

    if (!validation.valid) {
      console.warn('[useChatSync] Message validation failed:', validation.errors)
      // Still enqueue invalid messages to avoid data loss, but log the issue
    }

    // If offline, enqueue immediately
    if (!isOnline || !supabase) {
      queue.enqueue({ sessionId, userId, payload })
      setPendingCount(queue.size)
      return { synced: false, queued: true }
    }

    // Attempt direct UPSERT to Supabase
    try {
      const { error } = await supabase
        .from('chat_messages')
        .upsert([payload], { onConflict: 'id' })

      if (error) {
        // Write failed — enqueue for retry
        queue.enqueue({ sessionId, userId, payload })
        setPendingCount(queue.size)
        return { synced: false, queued: true }
      }

      return { synced: true, queued: false }
    } catch (err) {
      // Network error during write — enqueue for retry
      queue.enqueue({ sessionId, userId, payload })
      setPendingCount(queue.size)
      return { synced: false, queued: true }
    }
  }, [isOnline])

  return {
    syncStatus,
    pendingCount,
    isOnline,
    persistMessage,
    flushQueue,
  }
}
