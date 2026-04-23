/**
 * System Prompt Builder
 *
 * Constructs personalized system prompts for GastroGuide and GastroAssistant
 * agents, incorporating user preferences, history, and knowledge graph context.
 */

import { DEFAULT_GUIDE_PROMPT, DEFAULT_ASSISTANT_PROMPT } from './constants'

/**
 * Build a system prompt for the specified agent.
 *
 * @param {Object} [userPrefs={}] - User preferences (cuisines, vibe, price, dietary)
 * @param {string | null} [queryContext=null] - Query for knowledge graph context
 * @param {'guide' | 'assistant'} [agentType='guide'] - Which agent's prompt to build
 * @param {Object} [userData=null] - Dynamic user profile data (history, favorites)
 * @returns {Promise<string>} - Built system prompt with personalization
 */
export async function buildSystemPrompt(userPrefs = {}, queryContext = null, agentType = 'guide', userData = null) {
    let appCfg = {}
    try {
        const { useAppConfigStore } = await import('@/shared/store/useAppConfigStore')
        appCfg = useAppConfigStore.getState()
    } catch {
        const { getActiveAIConfig } = await import('../ai-config.api')
        appCfg = getActiveAIConfig()
    }

    // Use custom prompt if set, otherwise default
    const basePrompt = agentType === 'guide'
        ? (appCfg.aiGuideSystemPrompt || DEFAULT_GUIDE_PROMPT)
        : (appCfg.aiAssistantSystemPrompt || DEFAULT_ASSISTANT_PROMPT)

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
- Past Experiences & Reviews:
${userData.userExperience || 'No direct review history yet.'}
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

    return `${basePrompt}
${knowledgeContext}
${prefLines ? `\nUSER PREFERENCES:\n${prefLines}` : ''}
${profile}

PERSONALIZATION GUIDELINES:
- The USER PREFERENCES and USER PROFILE are context for smarter responses, NOT strict search filters.
- Use them to personalize your tone, add relevant warnings, and suggest better alternatives when appropriate.
- If the user's preferences conflict with what they're asking about, acknowledge it helpfully but still answer their question fully.
- Reference their past experiences naturally when relevant (e.g., "Since you enjoyed Pod Baranem, you might also like...").
- When the user explicitly asks for something outside their profile, respect their current intent over stored preferences.
- Always search broadly first, then apply preference-aware analysis to the results.
- GEOLOCATION: If the user's city is listed in their profile (detected via GPS), ALWAYS pass city=<that city> to search_locations unless they ask about a different place. Never ask what city they are in if GPS detected it.`
}
