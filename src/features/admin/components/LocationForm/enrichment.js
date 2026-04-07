/**
 * AI Enrichment for Location Form
 * 
 * Generates AI-powered suggestions for location fields:
 * - cuisine_types (array)
 * - price_range (string: $/$$/$$$/$$$$)
 * - tags, vibe, best_for, dietary_options
 * - ai_keywords, ai_context
 * 
 * Uses OpenRouter API with Step 3.5 Flash Free model.
 */

import { config } from '@/shared/config/env'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'

/**
 * Enrich location data with AI-generated fields
 * @param {Object} locationData - Basic location info
 * @param {string} apiKey - OpenRouter API key
 * @returns {Promise<Object>} Enriched location data
 */
export async function enrichLocationData(locationData, apiKey = null) {
    if (!apiKey) {
        const appCfg = useAppConfigStore.getState()
        apiKey = appCfg.aiApiKey || config.ai.openRouterKey
    }

    if (!apiKey) {
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

        // Set attempt timestamp
        locationData.ai_enrichment_last_attempt = new Date().toISOString()

        // Generate structured data using AI
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://gastromap.app',
                'X-Title': 'GastroMap',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'stepfun/step-3.5-flash:free',
                messages: [
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
                ],
                max_tokens: 500,
                response_format: { type: 'json_object' },
            }),
        })

        if (response.ok) {
            const data = await response.json()
            const content = data.choices?.[0]?.message?.content || '{}'
            
            try {
                const parsed = JSON.parse(content)
                
                // Validate and apply cuisine_types (must be array)
                if (Array.isArray(parsed.cuisine_types)) {
                    locationData.cuisine_types = parsed.cuisine_types
                }
                
                // Validate and apply price_range (must be one of valid values)
                const validPrices = ['$', '$$', '$$$', '$$$$']
                if (validPrices.includes(parsed.price_range)) {
                    locationData.price_range = parsed.price_range
                }
                
                // Apply other arrays with validation
                if (Array.isArray(parsed.tags)) {
                    locationData.tags = parsed.tags.slice(0, 8)
                }
                if (Array.isArray(parsed.vibe)) {
                    locationData.vibe = parsed.vibe
                }
                if (Array.isArray(parsed.best_for)) {
                    locationData.best_for = parsed.best_for
                }
                if (Array.isArray(parsed.dietary_options)) {
                    locationData.dietary_options = parsed.dietary_options
                }

                // Mark success
                locationData.ai_enrichment_status = 'success'
                locationData.ai_enrichment_error = null

            } catch (parseError) {
                console.warn('[enrichment] Failed to parse AI response:', parseError.message)
                locationData.ai_enrichment_status = 'failed'
                locationData.ai_enrichment_error = 'Invalid JSON response from AI'
            }
        } else {
            console.warn('[enrichment] AI API error:', response.status, response.statusText)
            locationData.ai_enrichment_status = 'failed'
            locationData.ai_enrichment_error = `API error: ${response.status}`
        }

        // Generate AI keywords separately (for search optimization)
        await generateAIKeywords(locationData, apiKey)
        
        // Generate AI context (expert summary)
        await generateAIContext(locationData, apiKey)

    } catch (error) {
        console.warn('[enrichment] AI enrichment failed (non-blocking):', error.message)
        locationData.ai_enrichment_status = 'failed'
        locationData.ai_enrichment_error = error.message
    }

    return locationData
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
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://gastromap.app',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'stepfun/step-3.5-flash:free',
                messages: [
                    {
                        role: 'system',
                        content: 'Generate 10-15 search keywords for a restaurant. Return ONLY a JSON array of strings.'
                    },
                    {
                        role: 'user',
                        content: `Generate keywords for: ${textForAI}`
                    }
                ],
                max_tokens: 300,
            }),
        })

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
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://gastromap.app',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'stepfun/step-3.5-flash:free',
                messages: [
                    {
                        role: 'system',
                        content: 'Write a 2-sentence expert summary of this restaurant for an AI assistant. Focus on uniqueness and target audience.'
                    },
                    {
                        role: 'user',
                        content: textForAI
                    }
                ],
                max_tokens: 150,
            }),
        })

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
 * @param {string} price - Price value to validate
 * @returns {string} Validated price range or default
 */
export function validatePriceRange(price) {
    const validPrices = ['$', '$$', '$$$', '$$$$']
    return validPrices.includes(price) ? price : '$$'
}

/**
 * Validate cuisine types array
 * @param {any} cuisines - Value to validate
 * @returns {string[]} Validated cuisine types array
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
