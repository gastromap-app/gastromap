/**
 * System Prompt Builder (v2 refactor)
 *
 * Constructs personalized system prompts for GastroGuide and GastroAssistant agents.
 *
 * V2 changes (behind aiBotImprovementsV2 flag):
 * - Compose: Persona + "\n\n" + Operational_Rules + dynamic_context (R7.1)
 * - Removed KG fetch from buildSystemPrompt (R17.1) — KG is now fetched only in tools.js
 * - Dropped userExperience field entirely (R16.2)
 * - Renders Guest_Insight with: Foodie DNA, dietary restrictions, location_history, favourites, visited
 * - Includes Session_Summary in labelled section "Conversation summary so far:" (R9.3)
 * - Includes session_locations in recent context
 * - Applies 10-message rolling window cap (R2.4)
 * - Uses default Persona when admin config is empty (R7.5)
 * - Never produces [object Object] in output (R16.3)
 */

import { DEFAULT_GUIDE_PROMPT, DEFAULT_ASSISTANT_PROMPT } from './constants'
import { getOperationalRules } from './operational-rules'
import { buildRecentContext } from './recent-context'

/**
 * Build a system prompt for the specified agent.
 *
 * Supports both the legacy positional-args signature and the new object-based signature.
 * Detection: if the first argument is an object containing any of the new keys
 * ('personalContext', 'sessionLocations', 'query'), it's treated as the new format.
 *
 * Legacy signature (backward compat):
 *   buildSystemPrompt(userPrefs, queryContext, agentType, userData, recentMessages, overridePrompt)
 *
 * New signature:
 *   buildSystemPrompt({ userPrefs, query, agentType, userData, personalContext, sessionLocations, recentMessages, overridePrompt })
 *
 * @param {Object|object} userPrefsOrOpts - Either userPrefs object (legacy) or full options object (new)
 * @param {string|null} [queryContext] - Query for knowledge graph context (legacy only)
 * @param {'guide'|'assistant'} [agentType] - Which agent's prompt to build (legacy only)
 * @param {Object|null} [userData] - Dynamic user profile data (legacy only)
 * @param {Array} [recentMessages] - Last N messages from the store (legacy only)
 * @param {string|null} [overridePrompt] - Override prompt for preview (legacy only)
 * @returns {Promise<string>} - Built system prompt with personalization
 */
export async function buildSystemPrompt(userPrefs = {}, queryContext = null, agentType = 'guide', userData = null, recentMessages = [], overridePrompt = null) {
    // Support new object-based call: buildSystemPrompt({ userPrefs, query, ... })
    let opts = {}
    if (
        userPrefs &&
        typeof userPrefs === 'object' &&
        !Array.isArray(userPrefs) &&
        ('personalContext' in userPrefs || 'sessionLocations' in userPrefs || 'query' in userPrefs)
    ) {
        opts = userPrefs
    } else {
        opts = { userPrefs, query: queryContext, agentType, userData, recentMessages, overridePrompt }
    }

    return _buildPrompt(opts)
}

/**
 * Internal prompt builder — dispatches to V2 or legacy based on feature flag.
 */
async function _buildPrompt({
    userPrefs = {},
    query = null,
    agentType = 'guide',
    userData = null,
    personalContext = null,
    sessionLocations = [],
    recentMessages = [],
    overridePrompt = null,
} = {}) {
    let appCfg = {}
    try {
        const { useAppConfigStore } = await import('@/shared/store/useAppConfigStore')
        appCfg = useAppConfigStore.getState()
    } catch {
        try {
            const { getActiveAIConfig } = await import('../ai-config.api')
            appCfg = getActiveAIConfig()
        } catch { /* fallback to empty */ }
    }

    // Check feature flag
    const useV2 = appCfg.aiBotImprovementsV2 ?? false

    if (!useV2) {
        // Legacy behavior — keep old prompt building for backward compat
        return _buildLegacyPrompt({ userPrefs, query, agentType, userData, recentMessages, overridePrompt, appCfg })
    }

    // ─── V2: OPERATIONAL_RULES is the SOLE source of truth ─────────────────
    // When v2 is ON, the admin System Prompts field is IGNORED.
    // The bot uses only OPERATIONAL_RULES + dynamic context.
    const operationalRules = getOperationalRules()

    // Build Guest Insight from personalContext (only for personal queries)
    const guestInsight = _buildGuestInsight(userPrefs, userData, personalContext)

    // Session Summary (R9.3)
    const summarySection = personalContext?.sessionSummary
        ? `\n# Conversation summary so far:\n${personalContext.sessionSummary}\n`
        : ''

    // Recent context — 10-message rolling window cap (R2.4)
    const cappedMessages = (recentMessages || []).slice(-10)
    const recentCtx = buildRecentContext(cappedMessages)

    // Compose final prompt: OPERATIONAL_RULES + dynamic_context (no admin prompt)
    return `${operationalRules}
${summarySection}
# INTERNAL GUEST CONTEXT (FOR YOUR EYES ONLY)
${guestInsight || 'No specific profile data available yet. Be curious and observant.'}
${recentCtx ? `\n${recentCtx}\n` : ''}

# THE CONSCIOUS PARTNER PHILOSOPHY (CRITICAL)
- ROLE: You are an expert Gastro Guide and a conscious partner in the user's culinary journey.
- NO ROBOTIC PHRASES: NEVER say "Based on your Foodie DNA", "According to your preferences", "I've analyzed your profile".
- Be "Osoznanny" (Conscious): If the user's current request contradicts their profile, prioritize the CURRENT request.
- YOUR TONE: An elegant, well-traveled local expert who knows the "soul" of establishments.
- NEVER USE PLACEHOLDERS: Never write [PERSON_NAME], [USER_NAME], or any bracketed placeholder.`
}

/**
 * Build the Guest Insight narrative from personalContext, userData, and userPrefs.
 * Never references userExperience (R16.2).
 * Never produces [object Object] (R16.3).
 *
 * @param {Object} userPrefs
 * @param {Object|null} userData
 * @param {Object|null} personalContext - from context-loader.js
 * @returns {string}
 */
function _buildGuestInsight(userPrefs, userData, personalContext) {
    const parts = []

    // From personalContext (loaded by context-loader.js) — preferred source
    if (personalContext) {
        if (personalContext.foodieDNA) {
            parts.push(`Their 'Foodie DNA' reveals: ${_safeStr(personalContext.foodieDNA)}.`)
        }
        if (personalContext.dietaryRestrictions?.length) {
            parts.push(`Important dietary needs: ${personalContext.dietaryRestrictions.map(_safeStr).join(', ')}.`)
        }
        if (personalContext.locationHistory?.length) {
            const cities = personalContext.locationHistory.slice(0, 3)
                .map(h => `${_safeStr(h.city)} (${h.visits}x)`).join(', ')
            parts.push(`Frequently visits: ${cities}.`)
        }
        if (personalContext.favorites?.length) {
            const names = personalContext.favorites.slice(0, 5).map(f => _safeStr(f.title)).filter(Boolean).join(', ')
            if (names) parts.push(`Saved favorites include: ${names}.`)
        }
        if (personalContext.visited?.length) {
            parts.push(`They've explored ${personalContext.visited.length} places recently.`)
        }
    }

    // Fallback to userData if personalContext not available
    if (!personalContext && userData) {
        const favoriteCuisines = userPrefs?.favoriteCuisines || []
        const vibePreference = userPrefs?.vibePreference || []

        if (favoriteCuisines.length) parts.push(`Loves ${favoriteCuisines.map(_safeStr).join(', ')} cuisines.`)
        if (vibePreference.length) parts.push(`Gravitates towards ${vibePreference.map(_safeStr).join(', ')} atmospheres.`)
        if (userData.foodieDNA) parts.push(`Foodie DNA: ${_safeStr(userData.foodieDNA)}.`)
        if (userData.visitedCount > 0) parts.push(`Active explorer with ${userData.visitedCount} spots visited.`)
        if (userData.favoritesNames?.length) parts.push(`Favorites: ${userData.favoritesNames.slice(0, 3).map(_safeStr).join(', ')}.`)
    }

    // Geolocation (always include if available) — fixed: no partial coordinates (R10.5)
    if (userData?.userCity) {
        const gps = (userData.userLat != null && userData.userLng != null && isFinite(userData.userLat) && isFinite(userData.userLng))
            ? ` (GPS: ${Number(userData.userLat).toFixed(4)}, ${Number(userData.userLng).toFixed(4)})`
            : ''
        parts.push(`Currently in ${_safeStr(userData.userCity)}${userData.userCountry ? `, ${_safeStr(userData.userCountry)}` : ''}${gps}.`)
    } else {
        parts.push("Current city unknown — ask if relevant.")
    }

    return parts.join(' ')
}

/**
 * Safely convert a value to string, preventing [object Object] (R16.3).
 * @param {*} val
 * @returns {string}
 */
function _safeStr(val) {
    if (val == null) return ''
    if (typeof val === 'string') return val
    if (typeof val === 'number' || typeof val === 'boolean') return String(val)
    // For objects/arrays, use JSON.stringify to avoid [object Object]
    try {
        return JSON.stringify(val)
    } catch {
        return ''
    }
}

// ─── Legacy prompt builder (pre-v2, kept for backward compat when flag is off) ───

async function _buildLegacyPrompt({
    userPrefs = {},
    query = null,
    agentType = 'guide',
    userData = null,
    recentMessages = [],
    overridePrompt = null,
    appCfg = {},
}) {
    const basePrompt = overridePrompt ?? (agentType === 'guide'
        ? (appCfg.aiGuideSystemPrompt || DEFAULT_GUIDE_PROMPT)
        : (appCfg.aiAssistantSystemPrompt || DEFAULT_ASSISTANT_PROMPT))

    const favoriteCuisines = userPrefs?.favoriteCuisines || []
    const vibePreference = userPrefs?.vibePreference || []

    const guestInsightParts = []

    // Core Preferences
    if (favoriteCuisines.length) guestInsightParts.push(`This guest has a verified love for ${favoriteCuisines.join(', ')} cuisines.`)
    if (vibePreference.length) guestInsightParts.push(`They naturally gravitate towards ${vibePreference.join(', ')} atmospheres.`)

    // Deep Profile (Foodie DNA, etc.) — userExperience intentionally excluded (R16.2)
    if (userData?.foodieDNA) guestInsightParts.push(`Their 'Foodie DNA' reveals a palate that seeks ${_safeStr(userData.foodieDNA)}.`)
    if (userData?.visitedCount > 0) guestInsightParts.push(`Active explorer with ${userData.visitedCount} spots visited, including favorites like ${userData.favoritesNames?.slice(0, 3).map(_safeStr).join(', ')}.`)

    // Geography — fixed: no partial coordinates (R10.5)
    if (userData?.userCity) {
        const gps = (userData.userLat != null && userData.userLng != null && isFinite(userData.userLat) && isFinite(userData.userLng))
            ? ` (GPS: ${Number(userData.userLat).toFixed(4)}, ${Number(userData.userLng).toFixed(4)})`
            : ''
        guestInsightParts.push(`Currently in ${_safeStr(userData.userCity)}${userData.userCountry ? `, ${_safeStr(userData.userCountry)}` : ''}${gps}.`)
    } else {
        guestInsightParts.push("Current city unknown — ask if relevant.")
    }

    const guestInsight = guestInsightParts.join(' ')

    // KG fetch — kept in legacy for backward compat (removed in V2 per R17.1)
    let knowledgeContext = ''
    if (query) {
        try {
            const { getAIContextForQuery } = await import('../knowledge-graph.api')
            const kgContext = await Promise.race([
                getAIContextForQuery(query),
                new Promise(resolve => setTimeout(() => resolve(null), 5000)),
            ])
            if (kgContext?.relevantCuisines?.length) {
                const cuisines = kgContext.relevantCuisines.map(c =>
                    `${c.name}: typical dishes (${c.typical_dishes?.slice(0, 3).join(', ')})`
                ).join('; ')
                knowledgeContext = `\n\nCULINARY KNOWLEDGE:\n${cuisines}\n${kgContext.contextNote}`
            }
        } catch { /* KG not available */ }
    }

    // Recent context — 10-message rolling window cap (R2.4)
    const recentCtx = buildRecentContext((recentMessages || []).slice(-10))

    return `${basePrompt}
${knowledgeContext}

# INTERNAL GUEST CONTEXT (FOR YOUR EYES ONLY)
${guestInsight || 'No specific profile data available yet. Be curious and observant.'}
${recentCtx ? `\n${recentCtx}\n` : ''}

# THE CONSCIOUS PARTNER PHILOSOPHY (CRITICAL)
- ROLE: You are an expert Gastro Guide and a conscious partner in the user's culinary journey.
- NO ROBOTIC PHRASES: NEVER say "Based on your Foodie DNA", "According to your preferences", "I've analyzed your profile".
- Be "Osoznanny" (Conscious): If the user's current request contradicts their profile, prioritize the CURRENT request.
- YOUR TONE: An elegant, well-traveled local expert who knows the "soul" of establishments.
- NEVER USE PLACEHOLDERS: Never write [PERSON_NAME], [USER_NAME], or any bracketed placeholder.`
}
