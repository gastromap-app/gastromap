/**
 * AI Assistant Service
 *
 * High-level AI operations for locations and Knowledge Graph.
 */

import { getLocationById, updateLocation, getLocations } from './locations.api'
import { generateEmbeddingForLocation } from './ai/search'
import { generateLocationSemanticSummary } from './ai/index'
import { matchLocationWithKG } from './knowledge-graph.api'

// ─── Semantic indexing ───────────────────────────────────────────────────────

/**
 * Admin: Deep semantic indexing for a single location.
 */
export async function reindexLocationSemantic(id) {
    console.log('[ai-assistant.service] Reindexing semantic:', id)
    const location = await getLocationById(id, { adminMode: true })
    if (!location) throw new Error('Location not found')

    const { summary, keywords } = await generateLocationSemanticSummary(location)

    return await updateLocation(id, {
        ai_context:                  summary,
        ai_keywords:                 keywords,
        ai_enrichment_status:        'success',
        ai_enrichment_last_attempt:  new Date().toISOString(),
    })
}

/**
 * Admin: Bulk semantic re-indexing.
 */
export async function bulkReindexLocations(config = {}) {
    const { limit = 10, onlyPending = false } = config

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
            console.error(`[ai-assistant.service] Failed ${loc.id}:`, err.message)
        }
    }
    return { success: true, count }
}

// ─── Embedding indexing ──────────────────────────────────────────────────────

/**
 * Admin: Generate & save vector embedding for a single location.
 * Uses all semantic fields: title, cuisine, description, tags, vibe, ai_keywords, ai_context.
 */
export async function updateLocationEmbedding(id) {
    console.log('[ai-assistant.service] Updating embedding:', id)
    const location = await getLocationById(id, { adminMode: true })
    if (!location) throw new Error('Location not found')

    const embedding = await generateEmbeddingForLocation(location)
    if (!embedding) throw new Error('Embedding generation failed')

    return await updateLocation(id, { embedding })
}

/**
 * Admin: Bulk update embeddings.
 * @param {Object} config
 * @param {number} [config.limit=50]
 * @param {boolean} [config.onlyEmpty=false] — only locations where embedding is null
 */
export async function bulkUpdateEmbeddings(config = {}) {
    const { limit = 50, onlyEmpty = false } = config

    const { data: locations } = await getLocations({ limit, all: true })
    if (!locations?.length) return { success: true, count: 0 }

    const targets = onlyEmpty
        ? locations.filter(l => !l.embedding)
        : locations

    console.log(`[ai-assistant.service] Bulk embedding update for ${targets.length} locations...`)

    let count = 0
    for (const loc of targets) {
        try {
            await updateLocationEmbedding(loc.id)
            count++
            // Small delay to avoid rate limits
            await new Promise(r => setTimeout(r, 500))
        } catch (err) {
            console.error(`[ai-assistant.service] Embedding failed ${loc.id}:`, err.message)
        }
    }
    return { success: true, count, total: targets.length }
}

// ─── KG sync ────────────────────────────────────────────────────────────────

/**
 * Synchronize a location with Knowledge Graph.
 * Writes structured data to kg_cuisines / kg_dishes / kg_ingredients / kg_allergens.
 *
 * @param {string} id - Location ID
 * @returns {Promise<Object>} Updated location
 */
export async function syncLocationWithKnowledgeGraph(id) {
    console.log('[ai-assistant.service] KG sync for:', id)

    const location = await getLocationById(id, { adminMode: true })
    if (!location) throw new Error('Location not found')

    const kgMatches = await matchLocationWithKG(location)

    // 1. Deduplicate kg_ arrays
    const kg_cuisines    = Array.from(new Set(kgMatches.cuisines    || []))
    const kg_dishes      = Array.from(new Set(kgMatches.dishes      || []))
    const kg_ingredients = Array.from(new Set(kgMatches.ingredients || []))

    // 2. Derive allergens from matched ingredients
    const kg_allergens   = deriveAllergens(kg_ingredients)

    // 3. Merge into ai_keywords as well (for backward compat & search)
    const existingKeywords = location.ai_keywords || []
    const ai_keywords = Array.from(new Set([
        ...existingKeywords,
        ...kg_cuisines,
        ...kg_dishes,
        ...kg_ingredients,
    ]))

    const hasChanges =
        JSON.stringify(location.kg_cuisines)    !== JSON.stringify(kg_cuisines)    ||
        JSON.stringify(location.kg_dishes)      !== JSON.stringify(kg_dishes)      ||
        JSON.stringify(location.kg_ingredients) !== JSON.stringify(kg_ingredients)

    if (!hasChanges && ai_keywords.length === existingKeywords.length) {
        console.log('[ai-assistant.service] No KG changes for:', id)
        return location
    }

    return await updateLocation(id, {
        kg_cuisines,
        kg_dishes,
        kg_ingredients,
        kg_allergens,
        ai_keywords,
        kg_enriched_at: new Date().toISOString(),
    })
}

/**
 * Full KG enrichment pipeline for a location:
 *   1. Semantic reindex (ai_context + ai_keywords)
 *   2. KG match (kg_cuisines / kg_dishes / kg_ingredients / kg_allergens)
 *
 * @param {string} id - Location ID
 * @returns {Promise<{ semantic: Object, kg: Object }>}
 */
export async function enrichLocationFull(id) {
    const [semantic, kg] = await Promise.allSettled([
        reindexLocationSemantic(id),
        syncLocationWithKnowledgeGraph(id),
    ])
    return {
        semantic: semantic.status === 'fulfilled' ? semantic.value : { error: semantic.reason?.message },
        kg:       kg.status       === 'fulfilled' ? kg.value       : { error: kg.reason?.message },
    }
}

/**
 * Bulk KG sync for all locations.
 */
export async function bulkSyncKG(limit = 50) {
    const { data: locations } = await getLocations({ limit, all: true })
    if (!locations?.length) return { success: true, count: 0 }

    console.log(`[ai-assistant.service] Bulk KG sync for ${locations.length} locations...`)
    let count = 0
    for (const loc of locations) {
        try {
            await syncLocationWithKnowledgeGraph(loc.id)
            count++
        } catch (err) {
            console.error(`[ai-assistant.service] KG sync failed ${loc.id}:`, err.message)
        }
    }
    return { success: true, count }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALLERGEN_MAP = {
    gluten:  ['wheat', 'flour', 'bread', 'pasta', 'rye', 'barley', 'oat', 'semolina'],
    dairy:   ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'lactose'],
    nuts:    ['almond', 'walnut', 'cashew', 'peanut', 'hazelnut', 'pistachio', 'pecan'],
    eggs:    ['egg', 'eggs', 'mayonnaise'],
    soy:     ['soy', 'tofu', 'edamame', 'miso'],
    fish:    ['fish', 'cod', 'salmon', 'tuna', 'anchovy', 'sardine'],
    shellfish: ['shrimp', 'crab', 'lobster', 'oyster', 'mussel', 'scallop', 'clam'],
    sesame:  ['sesame', 'tahini'],
}

function deriveAllergens(ingredients) {
    const lower = ingredients.map(i => i.toLowerCase())
    return Object.entries(ALLERGEN_MAP)
        .filter(([, keywords]) => keywords.some(kw => lower.some(ing => ing.includes(kw))))
        .map(([allergen]) => allergen)
}

export default {
    reindexLocationSemantic,
    bulkReindexLocations,
    updateLocationEmbedding,
    bulkUpdateEmbeddings,
    syncLocationWithKnowledgeGraph,
    enrichLocationFull,
    bulkSyncKG,
}
