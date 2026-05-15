/**
 * SyncQueue — Offline buffer for chat messages.
 *
 * Persists pending messages to localStorage in FIFO order.
 * Supports deduplication by message ID, size caps, and staleness eviction.
 */

const DEFAULT_STORAGE_KEY = 'gastro-chat-sync-queue';

export class SyncQueue {
  /**
   * @param {string} storageKey — localStorage key for persistence
   */
  constructor(storageKey = DEFAULT_STORAGE_KEY) {
    this._storageKey = storageKey;
    this._items = this._load();
  }

  /**
   * Add a message to the pending queue.
   * Deduplicates by payload.id — if a message with the same ID exists, it's skipped.
   * @param {{ sessionId: string, userId: string, payload: { id: string, [key: string]: any } }} message
   */
  enqueue(message) {
    const id = message.payload?.id;
    if (!id) return;

    // Deduplicate by message payload ID
    const exists = this._items.some((item) => item.payload?.id === id);
    if (exists) return;

    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sessionId: message.sessionId,
      userId: message.userId,
      payload: message.payload,
      enqueuedAt: Date.now(),
      retryCount: 0,
    };

    this._items.push(item);

    // Enforce 200-item max size — discard oldest on overflow
    while (this._items.length > 200) {
      this._items.shift();
    }

    this._persist();
  }

  /**
   * Get all pending items sorted by enqueuedAt ASC (FIFO).
   * Auto-evicts stale items before returning.
   * @returns {Array<{ id: string, sessionId: string, userId: string, payload: object, enqueuedAt: number, retryCount: number }>}
   */
  getPending() {
    this.evictStale();
    return [...this._items].sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  }

  /**
   * Remove successfully synced items by their queue item IDs.
   * @param {string[]} ids — queue item IDs to remove
   */
  dequeue(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const idSet = new Set(ids);
    this._items = this._items.filter((item) => !idSet.has(item.id));
    this._persist();
  }

  /**
   * Evict items older than 7 days from the queue.
   * Called automatically at the beginning of getPending().
   */
  evictStale() {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const before = this._items.length;
    this._items = this._items.filter((item) => item.enqueuedAt >= cutoff);
    if (this._items.length !== before) {
      this._persist();
    }
  }

  /**
   * Increment the retryCount for a queue item by ID.
   * @param {string} id — queue item ID
   * @returns {number} the new retryCount, or -1 if item not found
   */
  incrementRetry(id) {
    const item = this._items.find((i) => i.id === id);
    if (!item) return -1;
    item.retryCount = (item.retryCount || 0) + 1;
    this._persist();
    return item.retryCount;
  }

  /**
   * Get all items that have reached the dead-letter threshold (retryCount >= 3).
   * @returns {Array<{ id: string, sessionId: string, userId: string, payload: object, enqueuedAt: number, retryCount: number }>}
   */
  getDeadLetters() {
    return this._items.filter((item) => item.retryCount >= 3);
  }

  /**
   * Remove all dead-lettered items (retryCount >= 3) from the queue.
   * @returns {number} number of items removed
   */
  removeDeadLetters() {
    const before = this._items.length;
    this._items = this._items.filter((item) => item.retryCount < 3);
    const removed = before - this._items.length;
    if (removed > 0) {
      this._persist();
    }
    return removed;
  }

  /**
   * Flush all pending messages to Supabase in batches of 10.
   * Uses UPSERT with onConflict: 'id' for idempotent writes.
   * On failure: increments retryCount for each item in the batch.
   * After all batches: removes dead-lettered items.
   * @param {object} supabase — initialized Supabase client
   * @returns {Promise<{ synced: number, failed: number }>}
   */
  async flush(supabase) {
    const BATCH_SIZE = 10;
    const pending = this.getPending();
    let synced = 0;
    let failed = 0;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const payloads = batch.map((item) => item.payload);

      try {
        const { error } = await supabase
          .from('chat_messages')
          .upsert(payloads, { onConflict: 'id' });

        if (!error) {
          const ids = batch.map((item) => item.id);
          this.dequeue(ids);
          synced += ids.length;
        } else {
          for (const item of batch) {
            this.incrementRetry(item.id);
          }
          failed += batch.length;
        }
      } catch {
        for (const item of batch) {
          this.incrementRetry(item.id);
        }
        failed += batch.length;
      }
    }

    this.removeDeadLetters();
    return { synced, failed };
  }

  /**
   * Number of pending messages in the queue.
   * @returns {number}
   */
  get size() {
    return this._items.length;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /** Load queue state from localStorage */
  _load() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Persist current queue state to localStorage */
  _persist() {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(this._items));
    } catch {
      // localStorage full — silently fail (items remain in memory)
    }
  }
}
