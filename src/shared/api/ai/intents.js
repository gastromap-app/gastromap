/**
 * Intent Detection
 *
 * Categorizes user queries into: 'recommendation', 'info', or 'general'
 * Based on keyword matching for restaurant/dining-related queries
 */

/**
 * Analyze user intent from their query text.
 *
 * @param {string} text - User query
 * @returns {'recommendation' | 'info' | 'general'} - Detected intent
 */
export function detectIntent(text) {
    const q = text.toLowerCase()

    // Recommendation intent: looking for place suggestions
    if (q.match(/\b(recommend|where|best|find|eat|drink|cafe|coffee|dinner|lunch|breakfast|date|romantic|cozy|хочу|найди|посоветуй|порекомендуй|где|лучший|хорошее)\b/)) {
        return 'recommendation'
    }

    // Info intent: asking for specific place information
    if (q.match(/\b(open|close|hours|menu|price|book|reservation|phone|address|открыт|закрыт|часы|меню|цена|бронь|телефон|адрес)\b/)) {
        return 'info'
    }

    // General: casual questions about food/dining
    return 'general'
}
