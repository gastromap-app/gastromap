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

    // 1. Transform technical profile and preferences into a narrative "Guest Insight"
    // This prevents the AI from reciting fields like a robot.
    const favoriteCuisines = userPrefs?.favoriteCuisines || []
    const vibePreference = userPrefs?.vibePreference || []
    
    const guestInsightParts = []
    
    // Core Preferences
    if (favoriteCuisines.length) guestInsightParts.push(`This guest has a verified love for ${favoriteCuisines.join(', ')} cuisines.`)
    if (vibePreference.length) guestInsightParts.push(`They naturally gravitate towards ${vibePreference.join(', ')} atmospheres.`)
    
    // Deep Profile (Foodie DNA, etc.)
    if (userData?.foodieDNA) guestInsightParts.push(`Their 'Foodie DNA' reveals a palate that seeks ${userData.foodieDNA}.`)
    if (userData?.atmospherePreference) guestInsightParts.push(`They've mentioned a preference for ${userData.atmospherePreference} vibes.`)
    if (userData?.features) guestInsightParts.push(`Key requirements for them include: ${userData.features}.`)
    
    // Experience & History
    if (userData?.visitedCount > 0) guestInsightParts.push(`They are an active explorer with ${userData.visitedCount} spots visited, including favorites like ${userData.favoritesNames?.slice(0, 3).join(', ')}.`)
    if (userData?.userExperience) guestInsightParts.push(`Their past feedback indicates: ${userData.userExperience}`)
    
    // Geography
    const geoLine = userData?.userCity
        ? `They are currently in ${userData.userCity}${userData.userCountry ? `, ${userData.userCountry}` : ''}. ${userData.userLat ? `(GPS: ${userData.userLat}, ${userData.userLng})` : ''}`
        : "Their current city is unknown—ask if it's relevant."
    guestInsightParts.push(geoLine)

    const guestInsight = guestInsightParts.join(' ')

    // 2. Fetch knowledge graph context if query is provided (non-blocking with timeout)
    let knowledgeContext = ''
    if (queryContext) {
        try {
            const { getAIContextForQuery } = await import('../knowledge-graph.api')
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

# INTERNAL GUEST CONTEXT (FOR YOUR EYES ONLY)
${guestInsight || 'No specific profile data available yet. Be curious and observant.'}
${recentCtx ? `\n${recentCtx}\n` : ''}

# THE CONSCIOUS PARTNER PHILOSOPHY (CRITICAL)
- ROLE: You are an expert Gastro Guide and a conscious partner in the user's culinary journey.
- You are not "matching" data; you are sharing a vibe with a friend.
- NO ROBOTIC PHRASES: NEVER say "Based on your Foodie DNA", "According to your preferences", "I've analyzed your profile", or "Учитывая твой Foodie DNA".
- If you recommend something that fits their profile, do it SUBTLY. 
  * Instead of: "This matches your Spicy preference," 
  * Say: "I have a feeling you'll really appreciate the bold, fiery kick they put in their ramen here."
- Be "Osoznanny" (Conscious): If the user's current request contradicts their profile, prioritize the CURRENT request. They might be in the mood for something new.
- YOUR TONE: An elegant, well-traveled local expert who knows the "soul" of establishments, not just their menu.
- SUBTLE REASONING: When recommending a place, explain *why* it fits the user's soul without referencing the database. "This place has that authentic, family-run feel that I think will really resonate with you."
- BE PROACTIVE BUT HUMAN: If they ask "What should I try?", don't just dump a list. Ask a clarifying question or offer a curated choice based on their mood and profile.
- GEOLOCATION: If GPS city is known, always use it as the default search filter. Mention proximity naturally ("It's just around the corner from you").
- NO OFF-TOPIC: Stay in character. If asked about non-food topics, stay helpful but redirect to the world of gastronomy.`
}
