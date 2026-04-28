/**
 * Recent Context Builder
 *
 * Extracts a structured "recent context" block from the last N messages.
 * This block is injected into the system prompt so the LLM can:
 *   - Reference previously mentioned locations by name + ID
 *   - Do comparative follow-ups ("а в каком уютнее?")
 *   - Avoid redundant tool calls for data already in context
 *
 * Shape injected into the prompt:
 *   [RECENT CONTEXT]
 *   Recently discussed locations:
 *     1. Młyn Café (id: abc-123) — cozy café, $, rating 4.8
 *     2. Baker's Corner (id: def-456) — bakery/brunch, $$, rating 4.6
 *   Detected intents so far: search_by_filter, follow_up
 *   User language: ru
 */

/**
 * Build the [RECENT CONTEXT] block from the last N messages in the store.
 *
 * @param {Array} messages - The message array from the Zustand store (already has .attachments, .intent, .language)
 * @param {number} [window=10] - How many recent messages to scan
 * @returns {string} Multiline text block (empty string if nothing relevant found)
 */
export function buildRecentContext(messages = [], window = 10) {
    const recent = messages.slice(-window)
    if (!recent.length) return ''

    // Collect unique locations referenced across recent messages.
    const seenIds = new Set()
    const locations = []
    const intents = new Set()
    let detectedLang = null

    for (const msg of recent) {
        // Collect attachments (location cards).
        const cards = msg.attachments || msg.matches || []
        for (const card of cards) {
            if (!card?.id || seenIds.has(card.id)) continue
            seenIds.add(card.id)
            locations.push({
                name: card.title || card.name || 'Unknown',
                id: card.id,
                category: card.category || '',
                priceRange: card.price_range || '',
                rating: card.google_rating ?? card.rating ?? null,
                cuisine: card.cuisine || card.cuisine_types?.[0] || '',
            })
        }

        // Track intents seen.
        if (msg.intent) intents.add(msg.intent)

        // Detect user language from last user message.
        if (msg.role === 'user' && msg.language) {
            detectedLang = msg.language
        }
    }

    // If nothing useful was gathered, skip injection.
    if (!locations.length && !intents.size) return ''

    const lines = ['[RECENT CONTEXT]']

    if (locations.length) {
        lines.push('Recently discussed locations:')
        locations.forEach((loc, i) => {
            const parts = [loc.category, loc.cuisine, loc.priceRange].filter(Boolean).join(', ')
            const ratingStr = loc.rating ? `, rating ${loc.rating}` : ''
            lines.push(`  ${i + 1}. ${loc.name} (id: ${loc.id}) — ${parts}${ratingStr}`)
        })
    }

    if (intents.size) {
        lines.push(`Detected intents so far: ${[...intents].join(', ')}`)
    }

    if (detectedLang) {
        lines.push(`User language: ${detectedLang}`)
    }

    return lines.join('\n')
}
