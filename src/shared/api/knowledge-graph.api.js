/**
 * Knowledge Graph API - Cuisines, Dishes, Ingredients with semantic embeddings
 * 
 * This enables Gastro AI to have deep culinary knowledge for better recommendations.
 * Uses Supabase with pgvector for semantic search.
 */

import { supabase } from './client'
import { simulateDelay, ApiError } from './client'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Cuisine
 * @property {string} id
 * @property {string} name - e.g. "Italian", "Japanese"
 * @property {string} description
 * @property {string[]} aliases - e.g. ["Italiana", "Italia"]
 * @property {string[]} typical_dishes - e.g. ["pasta", "pizza", "risotto"]
 * @property {string[]} key_ingredients - e.g. ["olive oil", "tomatoes", "parmesan"]
 * @property {string} flavor_profile - e.g. "herbal, savory, rich"
 * @property {string} region - e.g. "Mediterranean"
 * @property {number[]} embedding - Vector embedding for semantic search
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Dish
 * @property {string} id
 * @property {string} name - e.g. "Carbonara"
 * @property {string} cuisine_id
 * @property {string} description
 * @property {string[]} ingredients - Key ingredients
 * @property {string} preparation_style - e.g. "pasta", "grilled", "raw"
 * @property {string[]} dietary_tags - e.g. ["vegetarian", "gluten-free"]
 * @property {string} flavor_notes - e.g. "creamy, rich, savory"
 * @property {string} best_pairing - e.g. "white wine, crusty bread"
 * @property {number[]} embedding
 * @property {string} created_at
 */

/**
 * @typedef {Object} Ingredient
 * @property {string} id
 * @property {string} name - e.g. "Truffle Oil"
 * @property {string} category - e.g. "oil", "spice", "vegetable"
 * @property {string} flavor_profile - e.g. "earthy, intense, aromatic"
 * @property {string[]} common_pairings - Ingredients that go well with it
 * @property {string[]} dietary_info - e.g. ["vegan", "gluten-free"]
 * @property {string} season - e.g. "fall", "year-round"
 * @property {number[]} embedding
 * @property {string} created_at
 */

// ─── Mock Data for Development ──────────────────────────────────────────────

const mockCuisines = [
    {
        id: '1',
        name: 'Italian',
        description: 'Classic Italian cuisine known for regional diversity, fresh ingredients, and simple preparations that highlight quality.',
        aliases: ['Italiana', 'Italia'],
        typical_dishes: ['pasta', 'pizza', 'risotto', 'osso buco', 'tiramisu'],
        key_ingredients: ['olive oil', 'tomatoes', 'garlic', 'basil', 'parmesan', 'mozzarella'],
        flavor_profile: 'herbal, savory, rich',
        region: 'Mediterranean',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: '2',
        name: 'Japanese',
        description: 'Refined cuisine emphasizing seasonal ingredients, precise techniques, and beautiful presentation.',
        aliases: ['Nihon', 'Japan'],
        typical_dishes: ['sushi', 'ramen', 'tempura', 'sashimi', 'tonkatsu'],
        key_ingredients: ['soy sauce', 'miso', 'rice', 'fish', 'seaweed', 'wasabi'],
        flavor_profile: 'umami, delicate, balanced',
        region: 'East Asian',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: '3',
        name: 'French',
        description: 'Sophisticated cuisine with emphasis on technique, sauces, and high-quality ingredients.',
        aliases: ['Française', 'France'],
        typical_dishes: ['coq au vin', 'boeuf bourguignon', 'croissant', 'crème brûlée', 'ratatouille'],
        key_ingredients: ['butter', 'cream', 'wine', 'herbs', 'cheese'],
        flavor_profile: 'rich, buttery, complex',
        region: 'Western European',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: '4',
        name: 'Polish',
        description: 'Hearty Eastern European cuisine with warming soups, dumplings, and preserved meats.',
        aliases: ['Polska', 'Poland'],
        typical_dishes: ['pierogi', 'bigos', 'żurek', 'kielbasa', 'placki ziemniaczane'],
        key_ingredients: ['potatoes', 'cabbage', 'mushrooms', 'pork', 'sour cream'],
        flavor_profile: 'hearty, savory, comforting',
        region: 'Eastern European',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
]

const mockDishes = [
    {
        id: '1',
        name: 'Carbonara',
        cuisine_id: '1',
        description: 'Classic Roman pasta dish with eggs, pecorino, guanciale, and black pepper.',
        ingredients: ['spaghetti', 'guanciale', 'eggs', 'pecorino romano', 'black pepper'],
        preparation_style: 'pasta',
        dietary_tags: [],
        flavor_notes: 'creamy, rich, savory, peppery',
        best_pairing: 'crisp white wine, crusty bread',
        created_at: new Date().toISOString(),
    },
    {
        id: '2',
        name: 'Sushi Omakase',
        cuisine_id: '2',
        description: 'Chef\'s choice sushi selection, showcasing the freshest fish of the day.',
        ingredients: ['rice', 'fish', 'nori', 'wasabi', 'soy sauce'],
        preparation_style: 'raw',
        dietary_tags: ['gluten-free option'],
        flavor_notes: 'fresh, clean, umami',
        best_pairing: 'sake, green tea',
        created_at: new Date().toISOString(),
    },
]

const mockIngredients = [
    {
        id: '1',
        name: 'Truffle Oil',
        category: 'oil',
        flavor_profile: 'earthy, intense, aromatic, luxurious',
        common_pairings: ['pasta', 'risotto', 'eggs', 'potatoes', 'mushrooms'],
        dietary_info: ['vegan', 'gluten-free'],
        season: 'year-round',
        created_at: new Date().toISOString(),
    },
    {
        id: '2',
        name: 'Yuzu',
        category: 'citrus',
        flavor_profile: 'floral, tart, aromatic, complex',
        common_pairings: ['fish', 'cocktails', 'desserts', 'sauces'],
        dietary_info: ['vegan', 'gluten-free'],
        season: 'fall-winter',
        created_at: new Date().toISOString(),
    },
]

// ─── Cuisines API ───────────────────────────────────────────────────────────

export async function getCuisines() {
    if (!supabase) return mockCuisines
    const { data, error } = await supabase
        .from('knowledge_cuisines')
        .select('*')
        .order('name', { ascending: true })
    if (error) {
        console.warn('[KnowledgeGraph] getCuisines error, using mock:', error.message)
        return mockCuisines
    }
    return data || []
}

export async function getCuisineById(id) {
    if (!supabase) return mockCuisines.find(c => c.id === id)
    const { data, error } = await supabase
        .from('knowledge_cuisines')
        .select('*')
        .eq('id', id)
        .single()
    if (error) throw new ApiError(error.message, 500, 'FETCH_ERROR')
    return data
}

export async function createCuisine(cuisine) {
    if (!supabase) {
        await simulateDelay(300)
        return { ...cuisine, id: Date.now().toString(), created_at: new Date().toISOString() }
    }
    const { data, error } = await supabase
        .from('knowledge_cuisines')
        .insert([cuisine])
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'CREATE_ERROR')
    return data
}

export async function updateCuisine(id, updates) {
    if (!supabase) {
        await simulateDelay(300)
        return { ...updates, id }
    }
    const { data, error } = await supabase
        .from('knowledge_cuisines')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'UPDATE_ERROR')
    return data
}

export async function deleteCuisine(id) {
    if (!supabase) {
        await simulateDelay(300)
        return { success: true }
    }
    const { error } = await supabase
        .from('knowledge_cuisines')
        .delete()
        .eq('id', id)
    if (error) throw new ApiError(error.message, 500, 'DELETE_ERROR')
    return { success: true }
}

// ─── Dishes API ─────────────────────────────────────────────────────────────

export async function getDishes(cuisineId = null) {
    if (!supabase) {
        return cuisineId ? mockDishes.filter(d => d.cuisine_id === cuisineId) : mockDishes
    }
    let query = supabase.from('knowledge_dishes').select('*, cuisine:knowledge_cuisines(name)')
    if (cuisineId) query = query.eq('cuisine_id', cuisineId)
    const { data, error } = await query.order('name', { ascending: true })
    if (error) {
        console.warn('[KnowledgeGraph] getDishes error, using mock:', error.message)
        return mockDishes
    }
    return data || []
}

export async function createDish(dish) {
    if (!supabase) {
        await simulateDelay(300)
        return { ...dish, id: Date.now().toString(), created_at: new Date().toISOString() }
    }
    const { data, error } = await supabase
        .from('knowledge_dishes')
        .insert([dish])
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'CREATE_ERROR')
    return data
}

export async function updateDish(id, updates) {
    if (!supabase) {
        await simulateDelay(300)
        return { ...updates, id }
    }
    const { data, error } = await supabase
        .from('knowledge_dishes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'UPDATE_ERROR')
    return data
}

export async function deleteDish(id) {
    if (!supabase) {
        await simulateDelay(300)
        return { success: true }
    }
    const { error } = await supabase
        .from('knowledge_dishes')
        .delete()
        .eq('id', id)
    if (error) throw new ApiError(error.message, 500, 'DELETE_ERROR')
    return { success: true }
}

// ─── Ingredients API ────────────────────────────────────────────────────────

export async function getIngredients(category = null) {
    if (!supabase) {
        return category ? mockIngredients.filter(i => i.category === category) : mockIngredients
    }
    let query = supabase.from('knowledge_ingredients').select('*')
    if (category) query = query.eq('category', category)
    const { data, error } = await query.order('name', { ascending: true })
    if (error) {
        console.warn('[KnowledgeGraph] getIngredients error, using mock:', error.message)
        return mockIngredients
    }
    return data || []
}

export async function createIngredient(ingredient) {
    if (!supabase) {
        await simulateDelay(300)
        return { ...ingredient, id: Date.now().toString(), created_at: new Date().toISOString() }
    }
    const { data, error } = await supabase
        .from('knowledge_ingredients')
        .insert([ingredient])
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'CREATE_ERROR')
    return data
}

export async function updateIngredient(id, updates) {
    if (!supabase) {
        await simulateDelay(300)
        return { ...updates, id }
    }
    const { data, error } = await supabase
        .from('knowledge_ingredients')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'UPDATE_ERROR')
    return data
}

export async function deleteIngredient(id) {
    if (!supabase) {
        await simulateDelay(300)
        return { success: true }
    }
    const { error } = await supabase
        .from('knowledge_ingredients')
        .delete()
        .eq('id', id)
    if (error) throw new ApiError(error.message, 500, 'DELETE_ERROR')
    return { success: true }
}

// ─── Semantic Search (requires pgvector) ─────────────────────────────────────

/**
 * Search cuisines semantically using vector similarity.
 * Falls back to text search if embeddings not available.
 */
export async function searchCuisinesSemantic(query, limit = 5) {
    if (!supabase) {
        // Fallback to text search on mock data
        const q = query.toLowerCase()
        return mockCuisines.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.aliases?.some(a => a.toLowerCase().includes(q)) ||
            c.typical_dishes?.some(d => d.toLowerCase().includes(q)) ||
            c.key_ingredients?.some(i => i.toLowerCase().includes(q))
        ).slice(0, limit)
    }

    // Try semantic search via RPC function
    const { data, error } = await supabase.rpc('search_cuisines_semantic', {
        query_text: query,
        match_limit: limit
    })

    if (error) {
        // Fallback to basic text search
        const { data: textData } = await supabase
            .from('knowledge_cuisines')
            .select('*')
            .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
            .limit(limit)
        return textData || []
    }

    return data || []
}

/**
 * Get cuisine context for AI - enriches AI responses with culinary knowledge
 */
export async function getAIContextForQuery(query) {
    try {
        const cuisines = await searchCuisinesSemantic(query, 3)
        
        if (cuisines.length === 0) return null

        return {
            relevantCuisines: cuisines.map(c => ({
                name: c.name,
                typical_dishes: c.typical_dishes,
                key_ingredients: c.key_ingredients,
                flavor_profile: c.flavor_profile,
            })),
            contextNote: `Based on your query, relevant culinary traditions include: ${cuisines.map(c => c.name).join(', ')}.`,
        }
    } catch (err) {
        console.warn('[KnowledgeGraph] getAIContext error:', err.message)
        return null
    }
}

// ─── Statistics ─────────────────────────────────────────────────────────────

export async function getKnowledgeStats() {
    if (!supabase) {
        return {
            cuisines: mockCuisines.length,
            dishes: mockDishes.length,
            ingredients: mockIngredients.length,
        }
    }

    const [cuisines, dishes, ingredients] = await Promise.all([
        supabase.from('knowledge_cuisines').select('id', { count: 'exact', head: true }),
        supabase.from('knowledge_dishes').select('id', { count: 'exact', head: true }),
        supabase.from('knowledge_ingredients').select('id', { count: 'exact', head: true }),
    ])

    return {
        cuisines: cuisines.count || 0,
        dishes: dishes.count || 0,
        ingredients: ingredients.count || 0,
    }
}
