/**
 * AI Enrichment for Location Form
 * 
 * Generates AI-powered suggestions for location fields:
 * - cuisine_types (array)
 * - price_range (string: $/$$/$$$/$$$$)
 * - tags, vibe, best_for, dietary_options
 * - ai_keywords, ai_context
 * 
 * Uses OpenRouter API with automatic model cascade.
 */

import { config } from '@/shared/config/env'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
import { fetchOpenRouter } from '@/shared/api/ai/openrouter'

/**
 * Enrich location data with AI-generated fields
 * @param {Object} locationData - Basic location info
 * @param {string} apiKey - OpenRouter API key (optional, will use store if not provided)
 * @returns {Promise<Object>} Enriched location data
 */
export async function enrichLocationData(locationData, apiKey = null) {
    const appCfg = useAppConfigStore.getState()
    const isAiReady = appCfg.aiApiKey || config.ai.openRouterKey

    if (!isAiReady && !apiKey) {
        console.warn('[enrichment] AI enrichment skipped: No API key found')
        return locationData
    }

    try {
        // Collect text for AI analysis
        const textForAI = [
            locationData.title,
            locationData.description,
            locationData.address,
            locationData.city,
            locationData.cuisine_types?.join(', '),
            locationData.category,
            ...(locationData.tags || []),
            ...(locationData.vibe || []),
            ...(locationData.best_for || []),
            locationData.insider_tip,
        ].filter(Boolean).join(', ')

        // Create a shallow copy to avoid mutating the input
        const enriched = { ...locationData }
        
        // Set attempt timestamp
        enriched.ai_enrichment_last_attempt = new Date().toISOString()

        console.log('[enrichment] Calling OpenRouter for structured data enrichment...')

        // Generate structured data using AI utility with cascade
        const { response } = await fetchOpenRouter([
            {
                role: 'system',
                content: `You are a gastronomy expert AI assistant. Analyze the restaurant information and generate structured data.

IMPORTANT RULES:
1. cuisine_types MUST be an array of strings (e.g., ["Italian", "Mediterranean"])
2. price_range MUST be ONE of: "$", "$$", "$$$", "$$$$" (based on typical prices)
3. tags MUST be an array of max 8 strings (mood, occasion, features)
4. vibe MUST be an array of strings (atmosphere descriptors)
5. best_for MUST be an array of strings (occasions, group types)
6. dietary_options MUST be an array of strings (dietary accommodations)

Return ONLY valid JSON with this exact structure:
{
  "cuisine_types": ["Cuisine1", "Cuisine2"],
  "price_range": "$$",
  "tags": ["tag1", "tag2"],
  "vibe": ["vibe1", "vibe2"],
  "best_for": ["occasion1", "occasion2"],
  "dietary_options": ["option1", "option2"]
}`
            },
            {
                role: 'user',
                content: `Analyze this restaurant and generate structured data:\n${textForAI}`
            }
        ], { 
            withTools: false,
            maxTokens: 500
        })

        if (response.ok) {
            const data = await response.json()
            const content = data.choices?.[0]?.message?.content || '{}'
            
            try {
                // Remove markdown code blocks if AI included them
                const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim()
                const parsed = JSON.parse(jsonStr)
                
                // Validate and apply fields
                if (Array.isArray(parsed.cuisine_types)) {
                    enriched.cuisine_types = parsed.cuisine_types
                }
                
                const validPrices = ['$', '$$', '$$$', '$$$$']
                if (validPrices.includes(parsed.price_range)) {
                    enriched.price_range = parsed.price_range
                }
                
                if (Array.isArray(parsed.tags)) {
                    enriched.tags = parsed.tags.slice(0, 8)
                }
                if (Array.isArray(parsed.vibe)) {
                    enriched.vibe = parsed.vibe
                }
                if (Array.isArray(parsed.best_for)) {
                    enriched.best_for = parsed.best_for
                }
                if (Array.isArray(parsed.dietary_options)) {
                    enriched.dietary_options = parsed.dietary_options
                }

                // Mark success
                enriched.ai_enrichment_status = 'success'
                enriched.ai_enrichment_error = null

                return enriched
            } catch (parseError) {
                console.warn('[enrichment] Failed to parse AI response:', parseError.message, content)
                enriched.ai_enrichment_status = 'failed'
                enriched.ai_enrichment_error = 'Invalid JSON response from AI'
            }
        } else {
            console.warn('[enrichment] AI API error:', response.status)
            enriched.ai_enrichment_status = 'failed'
            enriched.ai_enrichment_error = `API error: ${response.status}`
        }

        // Generate AI keywords and context in parallel for efficiency
        await Promise.allSettled([
            generateAIKeywords(locationData, apiKey),
            generateAIContext(locationData, apiKey)
        ])

    } catch (error) {
        console.error('[enrichment] AI enrichment failure:', error)
        const errorEnriched = { ...locationData }
        errorEnriched.ai_enrichment_status = 'failed'
        errorEnriched.ai_enrichment_error = error.message
        return errorEnriched
    }
}

/**
 * Generate search keywords for location
 */
async function generateAIKeywords(locationData, apiKey) {
    const textForAI = [
        locationData.title,
        locationData.description,
        locationData.city,
        locationData.cuisine_types?.join(', '),
        ...(locationData.tags || []),
    ].filter(Boolean).join(', ')

    try {
        const { response } = await fetchOpenRouter([
            {
                role: 'system',
                content: 'Generate 10-15 search keywords for a restaurant. Return ONLY a JSON array of strings.'
            },
            {
                role: 'user',
                content: `Generate keywords for: ${textForAI}`
            }
        ], { withTools: false, maxTokens: 300 })

        if (response.ok) {
            const data = await response.json()
            const content = data.choices?.[0]?.message?.content || '[]'
            const match = content.match(/\[[\s\S]*\]/)
            if (match) {
                locationData.ai_keywords = JSON.parse(match[0])
            }
        }
    } catch (error) {
        console.warn('[enrichment] Keyword generation failed:', error.message)
    }
}

/**
 * Generate expert summary (context) for AI assistant
 */
async function generateAIContext(locationData, apiKey) {
    const textForAI = [
        locationData.title,
        locationData.description,
        locationData.cuisine_types?.join(', '),
        locationData.insider_tip,
    ].filter(Boolean).join(', ')

    try {
        const { response } = await fetchOpenRouter([
            {
                role: 'system',
                content: 'Write a 2-sentence expert summary of this restaurant for an AI assistant. Focus on uniqueness and target audience.'
            },
            {
                role: 'user',
                content: textForAI
            }
        ], { withTools: false, maxTokens: 150 })

        if (response.ok) {
            const data = await response.json()
            locationData.ai_context = data.choices?.[0]?.message?.content || ''
        }
    } catch (error) {
        console.warn('[enrichment] Context generation failed:', error.message)
    }
}

/**
 * Validate price range value
 */
export function validatePriceRange(price) {
    const validPrices = ['$', '$$', '$$$', '$$$$']
    return validPrices.includes(price) ? price : '$$'
}

/**
 * Validate cuisine types array
 */
export function validateCuisineTypes(cuisines) {
    if (Array.isArray(cuisines)) {
        return cuisines.filter(c => typeof c === 'string' && c.trim())
    }
    if (typeof cuisines === 'string') {
        return cuisines.split(',').map(c => c.trim()).filter(Boolean)
    }
    return []
}
