import { supabase } from './client'

/**
 * Searches Open Food Facts for a product or category.
 * Strictly routed via Supabase Edge Function to bypass CORS.
 */
export async function getOpenFoodFactsContext(cuisine = '', description = '') {
    const searchTerm = `${cuisine} ${description}`.trim()
    if (!searchTerm) return {}

    // Versioning log to ensure we are running the latest code on Vercel
    console.log('[OpenFoodFacts] 🛰️ [v2-proxy] Fetching context for:', searchTerm)

    if (!supabase) {
        console.warn('[OpenFoodFacts] ⚠️ Supabase not initialized, skipping external enrichment.')
        return {}
    }

    try {
        const { data, error } = await supabase.functions.invoke('off-proxy', {
            body: { 
                search_terms: searchTerm,
                page_size: 5
            }
        })

        if (error) {
            // Handle edge cases where proxy might return 503 or 404
            const isServiceDown = error.status === 503 || error.message?.includes('503')
            if (isServiceDown) {
                console.warn('[OpenFoodFacts] ⚠️ OFF Service Unavailable (503). Skipping context.')
            } else {
                console.warn('[OpenFoodFacts] ❌ Proxy invocation failed:', error.message)
            }
            return {}
        }

        if (!data || !data.products) {
            return {}
        }

        const products = data.products || []

        // Extract useful terms (categories and ingredients)
        const categories = Array.from(new Set(
            products.flatMap(p => p.categories_tags || [])
                .map(t => t.replace('en:', '').replace(/-/g, ' '))
        )).slice(0, 8)

        const terms = Array.from(new Set(
            products.flatMap(p => [
                ...(p.ingredients_text_en?.split(/[,;]/) || []),
                ...(p.ingredients_text?.split(/[,;]/) || []),
                ...(p.allergens_tags || []).map(a => a.replace('en:', ''))
            ])
        )).filter(t => t && t.length > 2)
          .slice(0, 12)
          .map(t => t.trim().toLowerCase())

        return {
            source: 'OpenFoodFacts',
            categories,
            potential_ingredients: terms,
            brand_count: products.length
        }
    } catch (err) {
        // Non-critical failure
        console.warn('[OpenFoodFacts] ⚠️ Global request error:', err.message)
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
        allergens: data.potential_ingredients || [],
        source: 'OpenFoodFacts'
    }
}

