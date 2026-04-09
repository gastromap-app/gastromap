/**
 * AI Assistant Service
 * 
 * Provides high-level AI operations for locations and Knowledge Graph.
 * Bridging modular AI system with database operations.
 */

import { getLocationById, updateLocation, getLocations } from './locations.api'
import { generateLocationSemanticSummary } from './ai/index'
import { matchLocationWithKG } from './knowledge-graph.api'

/**
 * Admin: Trigger deep semantic indexing for a single location.
 * Fetches context, generates AI summary/keywords, and updates the database.
 * 
 * @param {string} id - Location ID
 * @returns {Promise<Object>} Updated location
 */
export async function reindexLocationSemantic(id) {
    console.log('[ai-assistant.service] Reindexing location semantic:', id)
    
    // 1. Fetch current location data
    const location = await getLocationById(id, { adminMode: true })
    if (!location) throw new Error('Location not found')
    
    // 2. Generate new semantic summary and keywords via AI
    // generateLocationSemanticSummary handles culinary enrichment internally
    const { summary, keywords } = await generateLocationSemanticSummary(location)
    
    // 3. Update the location record
    return await updateLocation(id, {
        ai_context: summary,
        ai_keywords: keywords,
        ai_enrichment_status: 'success',
        ai_enrichment_last_attempt: new Date().toISOString()
    })
}

/**
 * Admin: Trigger bulk semantic re-indexing for multiple locations.
 * 
 * @param {Object} config - Filtering config (limit, onlyPending, etc.)
 * @returns {Promise<{ success: boolean, count: number }>}
 */
export async function bulkReindexLocations(config = {}) {
    const { limit = 10, onlyPending = false } = config
    
    // 1. Fetch target locations
    const filters = { limit, all: true }
    if (onlyPending) filters.ai_enrichment_status = 'pending'
    
    const { data: locations } = await getLocations(filters)
    if (!locations?.length) return { success: true, count: 0 }
    
    console.log(`[ai-assistant.service] Bulk reindexing ${locations.length} locations...`)
    
    let count = 0
    for (const loc of locations) {
        try {
            await reindexLocationSemantic(loc.id)
            count++
        } catch (err) {
            console.error(`[ai-assistant.service] Failed to reindex location ${loc.id}:`, err.message)
        }
    }
    
    return { success: true, count }
}

/**
 * Admin: Synchronize location with updated Knowledge Graph logic.
 * Matches location against KG entities and updates ai_keywords.
 * 
 * @param {string} id - Location ID
 * @returns {Promise<Object>} Updated location
 */
export async function syncLocationWithKnowledgeGraph(id) {
    console.log('[ai-assistant.service] Synchronizing location with KG:', id)
    
    // 1. Fetch current location
    const location = await getLocationById(id, { adminMode: true })
    if (!location) throw new Error('Location not found')
    
    // 2. Perform KG matching (Cuisines, Dishes, Ingredients)
    const kgMatches = await matchLocationWithKG(location)
    
    // 3. Merge KG entities into ai_keywords
    const existingKeywords = location.ai_keywords || []
    const newKeywords = Array.from(new Set([
        ...existingKeywords,
        ...kgMatches.cuisines,
        ...kgMatches.dishes,
        ...kgMatches.ingredients
    ]))
    
    // 4. Update if changed
    if (newKeywords.length !== existingKeywords.length) {
        return await updateLocation(id, {
            ai_keywords: newKeywords,
            updated_at: new Date().toISOString()
        })
    }
    
    return location
}

export default {
    reindexLocationSemantic,
    bulkReindexLocations,
    syncLocationWithKnowledgeGraph
}
