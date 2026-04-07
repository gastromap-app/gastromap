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
    } catch (e) {
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
    const profile = userData ? `
USER PROFILE & EXPERIENCE:
- Visited locations: ${userData.visitedNames?.join(', ') || 'none yet'} (${userData.visitedCount || 0} total)
- Favorite places: ${userData.favoritesNames?.join(', ') || 'none yet'}
- Foodie DNA (Taste Profile): ${userData.foodieDNA || 'Developing taste profile'}
- Past Experiences & Reviews:
${userData.userExperience || 'No direct review history yet.'}
- Recent Search Interests: ${userData.recentInterests?.join(', ') || 'General explorer'}
` : ''

    // 2. Fetch knowledge graph context if query is provided
    let knowledgeContext = ''
    if (queryContext) {
        try {
            const { getAIContextForQuery } = await import('../knowledge-graph.api')
            const kgContext = await getAIContextForQuery(queryContext)
            if (kgContext?.relevantCuisines?.length) {
                const cuisines = kgContext.relevantCuisines.map(c =>
                    `${c.name}: typical dishes (${c.typical_dishes?.slice(0, 3).join(', ')})`
                ).join('; ')
                knowledgeContext = `\n\nCULINARY KNOWLEDGE:\n${cuisines}\n${kgContext.contextNote}`
            }
        } catch (err) {
            // Silently continue without knowledge context
        }
    }

    return `${basePrompt}
${knowledgeContext}
${prefLines ? `\nUSER PREFERENCES:\n${prefLines}` : ''}
${profile}

INSTRUCTIONS:
- Use the USER PROFILE & EXPERIENCE to tailor your tone and recommendations.
- If they've liked certain dishes or vibes in the past, prioritize similar matches.
- Reference their past experiences naturally (e.g., "Since you enjoyed the spicy ramen at X, you'll love the Y here").`
}
