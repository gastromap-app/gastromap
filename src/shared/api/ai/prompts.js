/**
 * System Prompt Builder
 *
 * Constructs personalized system prompts for GastroGuide and GastroAssistant
 * agents, incorporating user preferences, history, and knowledge graph context.
 */

import { DEFAULT_GUIDE_PROMPT, DEFAULT_ASSISTANT_PROMPT } from './constants'
import { buildRecentContext } from './recent-context'

/**
 * Build a system prompt for the specified agent.
 *
 * @param {Object} [userPrefs={}] - User preferences (cuisines, vibe, price, dietary)
 * @param {string | null} [queryContext=null] - Query for knowledge graph context
 * @param {'guide' | 'assistant'} [agentType='guide'] - Which agent's prompt to build
 * @param {Object} [userData=null] - Dynamic user profile data (history, favorites)
 * @param {Array} [recentMessages=[]] - Last N messages from the store, used for recent context injection
 * @returns {Promise<string>} - Built system prompt with personalization
 */
export async function buildSystemPrompt(userPrefs = {}, queryContext = null, agentType = 'guide', userData = null, recentMessages = [], overridePrompt = null) {
    let appCfg = {}
    try {
        const { useAppConfigStore } = await import('@/shared/store/useAppConfigStore')
        appCfg = useAppConfigStore.getState()
    } catch {
        const { getActiveAIConfig } = await import('../ai-config.api')
        appCfg = getActiveAIConfig()
    }

    // Use custom prompt if set, otherwise default. Use overridePrompt if provided (e.g. for preview)
    const basePrompt = overridePrompt ?? (agentType === 'guide'
        ? (appCfg.aiGuideSystemPrompt || DEFAULT_GUIDE_PROMPT)
        : (appCfg.aiAssistantSystemPrompt || DEFAULT_ASSISTANT_PROMPT))

    const { favoriteCuisines = [], vibePreference = [], priceRange = [], dietaryRestrictions = [] } = userPrefs

    const prefLines = [
        favoriteCuisines.length ? `Favourite cuisines: ${favoriteCuisines.join(', ')}` : '',
        vibePreference.length ? `Preferred vibes: ${vibePreference.join(', ')}` : '',
        priceRange.length ? `Budget: ${priceRange.join(', ')}` : '',
        dietaryRestrictions.length ? `Dietary restrictions: ${dietaryRestrictions.join(', ')}` : '',
    ].filter(Boolean).join('\n')

    // 1. Dynamic user personalization context (injecting knowledge from database)
    const geoLine = userData?.userCity
        ? `- Current location: ${userData.userCity}${userData.userCountry ? `, ${userData.userCountry}` : ''} (detected via GPS — prioritize this city in searches unless the user specifies another city)${userData.userLat ? `\n- Current GPS: ${userData.userLat}, ${userData.userLng}` : ''}`
        : '- Current location: unknown (ask if the city matters for the request)'

    const profile = userData ? `
USER PROFILE & EXPERIENCE:
${geoLine}
- Visited locations: ${userData.visitedNames?.join(', ') || 'none yet'} (${userData.visitedCount || 0} total)
- Favorite places: ${userData.favoritesNames?.join(', ') || 'none yet'}
- Foodie DNA (Taste Profile): ${userData.foodieDNA || 'Developing taste profile'}
- Atmosphere Preferences: ${userData.atmospherePreference || 'No specific atmosphere preference set'}
- Must-have Features: ${userData.features || 'None specified'}
- Past Experiences & Reviews:
${userData.userExperience || 'No direct review history yet.'}
- Location History (Cities Visited):
${userData.locationHistory?.length ? userData.locationHistory.map(h => `  * ${h.city}${h.country ? `, ${h.country}` : ''}: ${h.visits} visits (last: ${new Date(h.lastVisited).toLocaleDateString()})`).join('\n') : '  * No location history yet.'}
- Recent Search Interests: ${userData.recentInterests?.join(', ') || 'General explorer'}
` : ''

    // 2. Fetch knowledge graph context if query is provided (non-blocking with timeout)
    let knowledgeContext = ''
    if (queryContext) {
        try {
            const { getAIContextForQuery } = await import('../knowledge-graph.api')
            // Timeout after 2s — don't block the chat on slow KG lookups
            const kgContext = await Promise.race([
                getAIContextForQuery(queryContext),
                new Promise(resolve => setTimeout(() => resolve(null), 5000)),
            ])
            if (kgContext?.relevantCuisines?.length) {
                const cuisines = kgContext.relevantCuisines.map(c =>
                    `${c.name}: typical dishes (${c.typical_dishes?.slice(0, 3).join(', ')})`
                ).join('; ')
                knowledgeContext = `\n\nCULINARY KNOWLEDGE:\n${cuisines}\n${kgContext.contextNote}`
            }
        } catch (err) {
            console.warn('[prompts] KG context failed, continuing without it:', err.message)
        }
    }

    // 3. Recent conversation context (locations in the rolling window)
    const recentCtx = buildRecentContext(recentMessages)

    return `${basePrompt}
${knowledgeContext}
${prefLines ? `\nUSER PREFERENCES:\n${prefLines}` : ''}
${profile}
${recentCtx ? `\n${recentCtx}\n` : ''}
PERSONALIZATION GUIDELINES (BE OSOZNANNY / CONSCIOUS):
- Use USER PREFERENCES and USER PROFILE as internal context to find and rank the best matches.
- AVOID ROBOTIC PHRASES: Never say "Given your Foodie DNA", "Based on your preferences", or "According to your profile". These sound formulaic and robotic.
- BE AN EXPERT FRIEND: Talk like a local expert who knows the user well. Instead of "Based on your price range", say "Since you're looking for something more budget-friendly..." or "If you're in the mood for a splurge...".
- SUBTLE REASONING: When a place matches a user's DNA (e.g. "Spicy foods"), explain the recommendation by highlighting the place's features naturally: "Their curry has that bold, punchy heat you'll definitely appreciate."
- RESPECT INTENT: If the user explicitly asks for something outside their profile (e.g. a vegetarian asking for a steakhouse for a friend), respect their current intent over stored preferences.
- REFERENCE HISTORY NATURALLY: If they've visited similar places, mention it subtly: "It has a similar energy to [Place Name] which you visited recently, but with a more local twist."
- GEOLOCATION: If GPS city is known, always use it as the default search filter. Mention proximity naturally ("It's just a 5-minute walk from where you are").
- NO OFF-TOPIC: Stay in character as GastroGuide. If asked about non-gastro topics, politely decline and bring it back to food.`
}
