/**
 * Spoonacular API Client 
 * 
 * Used for deep culinary enrichment of the Knowledge Graph.
 * Provides data on dishes, ingredients, and cuisines.
 */

import { config } from '@/shared/config/env'
import { ApiError } from './client'

const BASE_URL = 'https://api.spoonacular.com'

/**
 * Common request wrapper for Spoonacular
 */
// Tracks if Spoonacular quota is known-exhausted this session
let _spoonacularExhausted = false

async function fetchSpoonacular(endpoint, params = {}) {
    const apiKey = config.culinary.spoonacularKey
    if (!apiKey) {
        throw new ApiError('Spoonacular API key not configured', 0, 'SPOONACULAR_NO_KEY')
    }

    // Skip immediately if quota known-exhausted (avoid wasting requests)
    if (_spoonacularExhausted) {
        throw new ApiError('Spoonacular daily quota exhausted (cached)', 402, 'SPOONACULAR_QUOTA')
    }

    const url = new URL(`${BASE_URL}${endpoint}`)
    url.searchParams.append('apiKey', apiKey)
    
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, value)
        }
    })

    let response
    try {
        response = await fetch(url.toString())
    } catch (networkErr) {
        throw new ApiError(`Spoonacular network error: ${networkErr.message}`, 0, 'SPOONACULAR_NETWORK')
    }
    
    if (!response.ok) {
        let errorData = {}
        try { errorData = await response.json() } catch { /* ignore */ }
        
        // Mark quota as exhausted for this session to prevent repeated failed calls
        if (response.status === 402 || response.status === 429) {
            _spoonacularExhausted = true
            console.warn('[Spoonacular] Quota exhausted — disabling for this session')
        }
        
        throw new ApiError(
            errorData.message || `Spoonacular API error: ${response.status}`,
            response.status,
            'SPOONACULAR_ERROR'
        )
    }

    return response.json()
}

/**
 * Reset the exhausted flag (e.g. at midnight / manual reset)
 */
export function resetSpoonacularQuota() {
    _spoonacularExhausted = false
}

/**
 * Check if Spoonacular is currently available
 */
export function isSpoonacularAvailable() {
    return Boolean(config.culinary.spoonacularKey) && !_spoonacularExhausted
}

/**
 * Search for recipes/dishes by text
 */
export async function searchDishes(query, limit = 5) {
    const data = await fetchSpoonacular('/recipes/complexSearch', {
        query,
        number: limit,
        addRecipeInformation: true,
        fillIngredients: true
    })
    
    return data.results.map(r => ({
        id: r.id.toString(),
        name: r.title,
        description: r.summary?.replace(/<[^>]*>/g, '') || '', // Strip HTML
        cuisine: r.cuisines?.[0] || '',
        ingredients: r.extendedIngredients?.map(i => i.name) || [],
        preparation_style: r.dishTypes?.[0] || '',
        dietary_tags: [
            ...(r.vegetarian ? ['vegetarian'] : []),
            ...(r.vegan ? ['vegan'] : []),
            ...(r.glutenFree ? ['gluten-free'] : [])
        ],
        image: r.image
    }))
}

/**
 * Search for ingredients by text
 */
export async function searchIngredients(query, limit = 5) {
    const data = await fetchSpoonacular('/food/ingredients/search', {
        query,
        number: limit
    })
    
    return data.results.map(i => ({
        id: i.id.toString(),
        name: i.name,
        image: `https://spoonacular.com/cdn/ingredients_100x100/${i.image}`
    }))
}

/**
 * Get detailed info for an ingredient
 */
export async function getIngredientDetails(id) {
    return fetchSpoonacular(`/food/ingredients/${id}/information`, {
        amount: 1
    })
}

/**
 * Detect cuisine from a list of dishes or description
 */
export async function detectCuisine(text) {
    const data = await fetchSpoonacular('/recipes/cuisine', {
        title: text
    }, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
    
    return data.cuisine
}

/**
 * Enrich a basic keyword with deep culinary context from Spoonacular
 */
export async function enrichCulinaryTerm(term) {
    try {
        // Try to find a dish first
        const dishes = await searchDishes(term, 1)
        if (dishes.length > 0) {
            return {
                type: 'dish',
                data: dishes[0]
            }
        }
        
        // Fallback to ingredient search
        const ingredients = await searchIngredients(term, 1)
        if (ingredients.length > 0) {
            const details = await getIngredientDetails(ingredients[0].id)
            return {
                type: 'ingredient',
                data: {
                    name: details.name,
                    category: details.aisle,
                    description: `Category: ${details.aisle}. Common units: ${details.possibleUnits?.join(', ')}`,
                    image: `https://spoonacular.com/cdn/ingredients_100x100/${details.image}`
                }
            }
        }
        
        return null
    } catch (err) {
        console.error(`[Spoonacular] Enrichment failed for "${term}":`, err.message)
        return null
    }
}
