/**
 * Open Food Facts API - Lightweight Culinary Context
 * 
 * Used as a fallback for barcode lookups and basic ingredient search.
 */

const BASE_URL = 'https://world.openfoodfacts.org/cgi/search.pl'

/**
 * Searches Open Food Facts for a product or category.
 * Used to get alternate names (aliases) or basic categories.
 */
export async function getOpenFoodFactsContext(cuisine = '', description = '') {
    const searchTerm = `${cuisine} ${description}`.trim()
    if (!searchTerm) return {}

    try {
        const response = await fetch(`${BASE_URL}?search_terms=${encodeURIComponent(searchTerm)}&json=1&page_size=5`, {
            headers: {
                'User-Agent': 'GastroMap/2.0 (contact@gastromap.app)'
            }
        })

        if (!response.ok) return {}

        const data = await response.json()
        const products = data.products || []

        // Extract useful terms
        const categories = Array.from(new Set(
            products.flatMap(p => p.categories_tags || [])
                .map(t => t.replace('en:', '').replace(/-/g, ' '))
        )).slice(0, 8)

        const terms = Array.from(new Set(
            products.flatMap(p => p.ingredients_text_with_allergens_en?.split(', ') || [])
        )).slice(0, 10).map(t => t.toLowerCase())

        return {
            source: 'OpenFoodFacts',
            categories,
            potential_ingredients: terms,
            brand_count: products.length
        }
    } catch (err) {
        console.warn('[OpenFoodFacts] Fetch failed:', err.message)
        return {}
    }
}

/**
 * Get culinary/ingredient context for a cuisine or category (AI enrichment mode)
 */
export async function getIngredientCulinaryContext(searchTerm = '') {
    const data = await getOpenFoodFactsContext(searchTerm, '')
    return {
        categories: data.categories || [],
        allergens: data.potential_ingredients || [], // Using this as potential culinary tags
        source: 'OpenFoodFacts'
    }
}
