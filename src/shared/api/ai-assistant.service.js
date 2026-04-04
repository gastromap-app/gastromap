/**
 * AI Assistant Service
 * 
 * Coordinater for all backend AI tasks: 
 * - Semantic enrichment of locations
 * - Knowledge Graph synchronization
 * - Bulk indexing and vector maintenance
 */

import { supabase, ApiError } from './client'
import { generateLocationSemanticSummary } from './ai.api'
import { getOpenFoodFactsContext } from './openfoodfacts.api'
import * as locationsApi from './locations.api'

/**
 * Perform a deep semantic indexing of a location.
 * Fetches external culinary context, generates an AI summary, 
 * and stores it with a vector embedding for intelligent search.
 */
export async function reindexLocationSemantic(locationId) {
    if (!supabase) return null

    console.log(`[AIAssistant] Starting semantic indexing for location: ${locationId}`)

    // 1. Fetch location
    const location = await locationsApi.getLocation(locationId, { adminMode: true })
    if (!location) throw new ApiError('Location not found', 404, 'NOT_FOUND')

    // 2. Fetch external context (Spoonacular for deep culinary metadata)
    let extraContext = {}
    try {
        const { enrichCulinaryTerm } = await import('./spoonacular.api')
        const culinaryData = await enrichCulinaryTerm(location.cuisine || location.title)
        if (culinaryData) {
            extraContext = culinaryData.data
        } else {
            // Fallback to basic OpenFoodFacts context
            extraContext = await getOpenFoodFactsContext(location.cuisine, location.description)
        }
    } catch (err) {
        console.warn(`[AIAssistant] External context fetch failed for ${locationId}:`, err.message)
    }

    // 3. Generate AI Semantic Summary & Keywords
    // We import generateLocationSemanticSummary dynamically if needed to avoid cycles, 
    // but here we are in a new service file.
    let aiResult = { summary: location.description || '', keywords: [] }
    try {
        aiResult = await generateLocationSemanticSummary(location, extraContext)
    } catch (err) {
        console.error(`[AIAssistant] AI Summary generation failed:`, err)
    }

    // 4. Generate Embedding (requires the embedding tool from knowledge-graph)
    let embedding = null
    try {
        const { generateEmbedding } = await import('./knowledge-graph.api')
        embedding = await generateEmbedding(aiResult.summary)
    } catch (err) {
        console.error(`[AIAssistant] Embedding generation failed:`, err)
    }

    // 5. Save changes
    const updates = {
        ai_keywords: aiResult.keywords,
        ai_context: aiResult.summary,
    }
    if (embedding) updates.embedding = embedding

    const updated = await locationsApi.updateLocation(locationId, updates, false) // false = avoid recursion if updateLocation triggers sync
    
    console.log(`[AIAssistant] Semantic indexing complete for: ${location.title}`)
    return updated
}

/**
 * Bulk re-index all locations that don't have embeddings or need an update.
 */
export async function bulkReindexLocations({ limit = 10, onlyMissing = true } = {}) {
    if (!supabase) return { processed: 0 }

    let query = supabase.from('locations').select('id')
    if (onlyMissing) {
        query = query.is('embedding', null)
    }
    
    const { data: locs, error } = await query.limit(limit)
    if (error) throw new ApiError(error.message, 500, 'FETCH_ERROR')

    const results = []
    for (const loc of (locs || [])) {
        try {
            const res = await reindexLocationSemantic(loc.id)
            results.push({ id: loc.id, status: 'success' })
        } catch (err) {
            results.push({ id: loc.id, status: 'error', error: err.message })
        }
    }

    return {
        total: (locs || []).length,
        processed: results.length,
        results
    }
}

/**
 * Sync location data with the current Knowledge Graph context.
 * Called when the admin adds new entries to the Cuisine/Dish/Ingredient database.
 */
export async function syncLocationWithKnowledgeGraph(locationId) {
    const { getAIContextForQuery } = await import('./knowledge-graph.api')
    const location = await locationsApi.getLocation(locationId)
    
    // Search KG for this location's specific themes
    const kgContext = await getAIContextForQuery(`${location.cuisine} ${location.description}`)
    
    if (!kgContext) return null

    // If KG has new insights, we merge them into ai_context
    return reindexLocationSemantic(locationId)
}
