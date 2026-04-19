/**
 * Knowledge Graph API - Cuisines, Dishes, Ingredients with semantic embeddings
 * 
 * This enables Gastro AI to have deep culinary knowledge for better recommendations.
 * Uses Supabase with pgvector for semantic search.
 */

import { supabase } from './client'
import { simulateDelay, ApiError } from './client'
import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
import { config } from '@/shared/config/env'
import { getCachedData, setCachedData, invalidateCacheGroup, TTL } from '@/shared/lib/cache'

// ─── Embedding Generation ───────────────────────────────────────────────────

/**
 * Generate embedding for text using OpenRouter's text-embedding-3-small model.
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector (dimensions match pgvector column)
 */
async function generateEmbedding(text) {
    const appCfg = useAppConfigStore.getState()
    const apiKey = appCfg.aiApiKey || config.ai.openRouterKey

    if (!apiKey) {
        throw new Error('OpenRouter API key not configured')
    }

    // Try primary model, fallback to alternative
    // Model dimensions: text-embedding-3-small → 1536, nemotron-embed → 768
    const models = [
        { name: 'openai/text-embedding-3-small', dimensions: 768 },
        { name: 'nvidia/nemotron-embed-20250702:free', dimensions: 768 },
    ]

    for (const { name: model, dimensions } of models) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://gastromap.app',
                    'X-Title': 'GastroMap',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    input: text,
                    dimensions,
                }),
            })

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}))
                console.warn(`[KG] Embedding model ${model} failed: ${response.status}`, errBody.message)
                continue
            }

            const data = await response.json()
            const embedding = data.data?.[0]?.embedding
            if (embedding && embedding.length > 0) return embedding
        } catch (err) {
            console.warn(`[KG] Embedding fetch error for ${model}:`, err.message)
            continue
        }
    }

    throw new Error('All embedding models failed')
}

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

// ─── Smart Schema Filter (Filter out fields that don't exist in DB) ──────────
const SCHEMA_WHITELIST = {
    cuisines: [
        'name', 'slug', 'description', 'parent_id', 'origin_country', 
        'region', 'flavor_profile', 'aliases', 'typical_dishes', 'key_ingredients'
    ],
    dishes: [
        'name', 'description', 'cuisine_id', 'category', 'price_range', 
        'is_signature', 'vegetarian', 'vegan', 'gluten_free', 
        'spicy_level', 'ingredients', 'allergens', 'preparation_style',
        'dietary_tags', 'flavor_notes', 'best_pairing', 'course', 'origin_city'
    ],
    ingredients: [
        'name', 'slug', 'category', 'is_allergen', 'is_vegetarian', 
        'is_vegan', 'origin', 'season', 'flavor_profile', 'common_pairings', 
        'dietary_info', 'description', 'origin_region', 'health_notes', 
        'substitutes', 'storage_tip'
    ]
}

const slugify = (text) => {
    if (!text) return ''
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w-]+/g, '')  // Remove all non-word chars
        .replace(/--+/g, '-')     // Replace multiple - with single -
}

function sanitizeForDB(type, data) {
    const table = type.endsWith('s') ? type : `${type}s`
    const allowed = SCHEMA_WHITELIST[table] || []
    const clean = {}
    
    // Default values for mandatory fields
    if (table === 'ingredients' && !data.category) {
        data.category = 'other'
    }
    
    // Auto-generate slug if missing but name is present
    if (!data.slug && data.name) {
        data.slug = slugify(data.name)
    }

    // Only keep fields that are in our whitelist
    Object.keys(data).forEach(key => {
        if (allowed.includes(key)) {
            clean[key] = data[key]
        }
    })
    
    return clean
}

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
    // L2: localStorage cache — skip Supabase if data is fresh
    const cached = getCachedData('cuisines')
    if (cached) {
        console.debug('[KG] cuisines served from localStorage cache')
        return cached
    }

    // L3: Supabase
    if (!supabase) {
        console.warn('[KG] Supabase not configured — returning mock cuisines')
        return mockCuisines
    }
    const { data, error } = await supabase
        .from('cuisines')
        .select('*')
        .order('name', { ascending: true })
    if (error) {
        console.error('[KG] getCuisines error:', error.message, '— returning mock data as fallback')
        return mockCuisines  // L4: mock fallback
    }

    const result = data || []
    setCachedData('cuisines', result, TTL.cuisines)  // populate L2
    return result
}

export async function getCuisineById(id) {
    if (!supabase) return mockCuisines.find(c => c.id === id)
    const { data, error } = await supabase
        .from('cuisines')
        .select('*')
        .eq('id', id)
        .single()
    if (error) throw new ApiError(error.message, 500, 'FETCH_ERROR')
    return data
}


/**
 * Internal helper — saves a KG item via the server-side proxy.
 * Uses Supabase Edge Function (primary) or /api/kg/save (fallback).
 * Falls back to direct Supabase insert if proxy returns 404 (local dev without serverless).
 */
async function saveViaProxy(type, data) {
    console.log(`[proxy] 🛰️ POST kg-save | type: ${type} | item: "${data.name}"`)

    // ── 1. Proactive JWT Retrieval with Timeout ──────────────────────────────
    // If it hangs at getSession, it might be due to auth-refresh locking.
    let jwt = ''
    try {
        console.log('[saveViaProxy] ⏳ Checking session...')
        
        // Race getSession against a 3s timeout
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Session check timeout')), 3000))
        
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise])
        
        if (session?.access_token) {
            jwt = session.access_token
            console.log(`[saveViaProxy] ✅ JWT ready (len: ${jwt.length})`)
        } else {
            console.warn('[saveViaProxy] ⚠️ No active session found — proxy might reject with 401')
        }
    } catch (e) {
        console.warn('[saveViaProxy] ❌ Session retrieval failed/timed out:', e.message)
    }

    if (!jwt) {
        // We try once more from localStorage before giving up
        try {
            const stored = localStorage.getItem('sb-gastromap-auth')
            if (stored) {
                const parsed = JSON.parse(stored)
                jwt = parsed.access_token
                console.log('[saveViaProxy] 📥 Recovered JWT from localStorage')
            }
        } catch (e) { /* ignore */ }
    }

    if (!jwt) {
        console.error('[proxy] 🛑 No JWT available — proxy will likely fail')
        // We still TRY the fetch, maybe it's local dev without auth
    }

    console.log('[saveViaProxy] 🌐 Sending POST to kg-save Edge Function with JWT (len:', jwt.length, ')')

    // ── 2. fetch with AbortController timeout (10s) ──────────────────────────
    const controller = new AbortController()
    const timeout = setTimeout(() => {
        console.error('[saveViaProxy] ⏱️ ERROR: fetch timed out after 10s')
        controller.abort()
    }, 10_000)

    let res
    try {
        res = await fetch(config.kg?.saveUrl || '/api/kg/save', {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify({ type, data }),
        })
        console.log(`[saveViaProxy] 📡 Fetch response status: ${res.status} (${res.statusText})`)
    } catch (fetchErr) {
        clearTimeout(timeout)
        const msg = fetchErr.name === 'AbortError'
            ? 'Request timed out after 10s'
            : `Network error: ${fetchErr.message}`
        console.error('[proxy] ❌ fetch failed:', msg)
        throw new ApiError(msg, 0, 'NETWORK_ERROR')
    } finally {
        clearTimeout(timeout)
    }

    if (res.status === 404 || res.status === 401 || res.status === 500) {
        const reason = res.status === 404 ? 'Proxy not found' : res.status === 401 ? 'Auth failure' : 'Server error'
        console.warn(`[proxy] ${res.status} (${reason}) — falling back to direct Supabase insert`)
        return null
    }

    let result
    try {
        result = await res.json()
    } catch (parseErr) {
        const raw = await res.text().catch(() => '')
        console.error('[proxy] Could not parse JSON:', raw.slice(0, 200))
        throw new ApiError(`kg-save returned non-JSON (${res.status})`, res.status, 'PARSE_ERROR')
    }

    console.log(`[proxy] Response body`, result)

    if (!res.ok) {
        console.error(`[proxy] Save failed`, { status: res.status, error: result.error, details: result.details })
        throw new ApiError(result.error || `KG save failed: ${res.status}`, res.status, 'SAVE_ERROR')
    }

    if (result.duplicate) {
        console.log(`[proxy] Duplicate — already exists: "${data.name}"`)
    } else {
        console.log(`[proxy] ✓ Saved "${data.name}" → id: ${result.data?.id}`)
    }

    return result.data
}

export async function createCuisine(cuisine) {
    if (!supabase) {
        await simulateDelay(300)
        return { ...cuisine, id: Date.now().toString(), created_at: new Date().toISOString() }
    }
    // Try server proxy first (bypasses RLS with service_role key)
    const proxyResult = await saveViaProxy('cuisine', cuisine)
    if (proxyResult) {
        invalidateCacheGroup('cuisines')
        return proxyResult
    }
    const cleanData = sanitizeForDB('cuisines', cuisine)
    // Fallback: direct Supabase (works only if RLS allows anon writes)
    const { data, error } = await supabase
        .from('cuisines')
        .insert([cleanData])
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'CREATE_ERROR')
    invalidateCacheGroup('cuisines')
    return data
}

export async function updateCuisine(id, updates) {
    if (!supabase) {
        await simulateDelay(300)
        return { ...updates, id }
    }
    const { data, error } = await supabase
        .from('cuisines')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'UPDATE_ERROR')
    invalidateCacheGroup('cuisines')  // bust L2
    return data
}

export async function deleteCuisine(id) {
    if (!supabase) {
        await simulateDelay(300)
        return { success: true }
    }
    const { error } = await supabase
        .from('cuisines')
        .delete()
        .eq('id', id)
    if (error) throw new ApiError(error.message, 500, 'DELETE_ERROR')
    invalidateCacheGroup('cuisines')  // bust L2
    return { success: true }
}

// ─── Dishes API ─────────────────────────────────────────────────────────────

export async function getDishes(cuisineId = null) {
    const cacheKey = `dishes_${cuisineId ?? 'all'}`

    // L2: localStorage cache
    const cached = getCachedData(cacheKey)
    if (cached) {
        console.debug('[KG] dishes served from localStorage cache', { cuisineId })
        return cached
    }

    // L3: Supabase
    if (!supabase) {
        console.warn('[KG] Supabase not configured — returning mock dishes')
        return cuisineId ? mockDishes.filter(d => d.cuisine_id === cuisineId) : mockDishes
    }
    let query = supabase.from('dishes').select('*, cuisine:cuisines(name)')
    if (cuisineId) query = query.eq('cuisine_id', cuisineId)
    const { data, error } = await query.order('name', { ascending: true })
    if (error) {
        console.error('[KG] getDishes error:', error.message, '— returning mock data as fallback')
        return cuisineId ? mockDishes.filter(d => d.cuisine_id === cuisineId) : mockDishes  // L4
    }

    const result = data || []
    setCachedData(cacheKey, result, TTL.dishes)  // populate L2
    return result
}

export async function createDish(dish) {
    if (!supabase) {
        await simulateDelay(300)
        return { ...dish, id: Date.now().toString(), created_at: new Date().toISOString() }
    }
    // Try server proxy first (bypasses RLS with service_role key)
    const proxyResult = await saveViaProxy('dish', dish)
    if (proxyResult) {
        invalidateCacheGroup('dishes')
        return proxyResult
    }
    const cleanData = sanitizeForDB('dishes', dish)
    // Fallback: direct Supabase
    const { data, error } = await supabase
        .from('dishes')
        .insert([cleanData])
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'CREATE_ERROR')
    invalidateCacheGroup('dishes')
    return data
}

export async function updateDish(id, updates) {
    if (!supabase) {
        await simulateDelay(300)
        return { ...updates, id }
    }
    const { data, error } = await supabase
        .from('dishes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'UPDATE_ERROR')
    invalidateCacheGroup('dishes')
    return data
}

export async function deleteDish(id) {
    if (!supabase) {
        await simulateDelay(300)
        return { success: true }
    }
    const { error } = await supabase
        .from('dishes')
        .delete()
        .eq('id', id)
    if (error) throw new ApiError(error.message, 500, 'DELETE_ERROR')
    invalidateCacheGroup('dishes')
    return { success: true }
}

// ─── Ingredients API ────────────────────────────────────────────────────────

export async function getIngredients(category = null) {
    const cacheKey = `ingredients_${category ?? 'all'}`

    // L2: localStorage cache
    const cached = getCachedData(cacheKey)
    if (cached) {
        console.debug('[KG] ingredients served from localStorage cache', { category })
        return cached
    }

    // L3: Supabase
    if (!supabase) {
        console.warn('[KG] Supabase not configured — returning mock ingredients')
        return category ? mockIngredients.filter(i => i.category === category) : mockIngredients
    }
    let query = supabase.from('ingredients').select('*')
    if (category) query = query.eq('category', category)
    const { data, error } = await query.order('name', { ascending: true })
    if (error) {
        console.error('[KG] getIngredients error:', error.message, '— returning mock data as fallback')
        return category ? mockIngredients.filter(i => i.category === category) : mockIngredients  // L4
    }

    const result = data || []
    setCachedData(cacheKey, result, TTL.ingredients)  // populate L2
    return result
}

export async function createIngredient(ingredient) {
    if (!supabase) {
        await simulateDelay(300)
        return { ...ingredient, id: Date.now().toString(), created_at: new Date().toISOString() }
    }
    // Try server proxy first (bypasses RLS with service_role key)
    const proxyResult = await saveViaProxy('ingredient', ingredient)
    if (proxyResult) {
        invalidateCacheGroup('ingredients')
        return proxyResult
    }
    const cleanData = sanitizeForDB('ingredients', ingredient)
    // Fallback: direct Supabase
    const { data, error } = await supabase
        .from('ingredients')
        .insert([cleanData])
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'CREATE_ERROR')
    invalidateCacheGroup('ingredients')
    return data
}

export async function updateIngredient(id, updates) {
    if (!supabase) {
        await simulateDelay(300)
        return { ...updates, id }
    }
    const { data, error } = await supabase
        .from('ingredients')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) throw new ApiError(error.message, 500, 'UPDATE_ERROR')
    invalidateCacheGroup('ingredients')
    return data
}

export async function deleteIngredient(id) {
    if (!supabase) {
        await simulateDelay(300)
        return { success: true }
    }
    const { error } = await supabase
        .from('ingredients')
        .delete()
        .eq('id', id)
    if (error) throw new ApiError(error.message, 500, 'DELETE_ERROR')
    invalidateCacheGroup('ingredients')
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
    let embedding
    try {
        embedding = await generateEmbedding(query)
    } catch (err) {
        console.warn('[KG] Embedding generation failed, falling back to text search:', err.message)
        return textSearchCuisines(query, limit)
    }

    if (!embedding || embedding.length === 0) {
        return textSearchCuisines(query, limit)
    }

    const { data, error } = await supabase.rpc('search_cuisines_by_embedding', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: limit
    })

    if (error) {
        console.warn('[KG] Semantic RPC search failed:', error.message, '— falling back to text search')
        return textSearchCuisines(query, limit)
    }

    return data || []
}

/**
 * Fallback text search for cuisines when semantic search is unavailable.
 * Uses client-side filtering after fetching all cuisines (cached).
 */
async function textSearchCuisines(query, limit = 5) {
    const q = query.toLowerCase()

    // Use cached cuisines if available, otherwise fetch
    let textData = getCachedData('cuisines')
    if (!textData) {
        const { data } = await supabase
            .from('cuisines')
            .select('*')
            .order('name', { ascending: true })
        textData = data || []
    }

    const filtered = textData.filter(c => {
        const name = (c.name || '').toLowerCase()
        const desc = (c.description || '').toLowerCase()
        const aliases = (c.aliases || []).map(a => a.toLowerCase())
        const dishes = (c.typical_dishes || []).map(d => d.toLowerCase())
        const ingredients = (c.key_ingredients || []).map(i => i.toLowerCase())

        return name.includes(q) ||
            desc.includes(q) ||
            aliases.some(a => a.includes(q)) ||
            dishes.some(d => d.includes(q)) ||
            ingredients.some(i => i.includes(q))
    })

    return filtered.slice(0, limit)
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
        return { cuisines: 0, dishes: 0, ingredients: 0 }
    }

    const [cuisines, dishes, ingredients] = await Promise.all([
        supabase.from('cuisines').select('id', { count: 'exact', head: true }),
        supabase.from('dishes').select('id', { count: 'exact', head: true }),
        supabase.from('ingredients').select('id', { count: 'exact', head: true }),
    ])

    return {
        cuisines: cuisines.count || 0,
        dishes: dishes.count || 0,
        ingredients: ingredients.count || 0,
    }
}

// ─── Knowledge Graph Synchronization ────────────────────────────────────────

/**
 * Matches a location's text content with Knowledge Graph entities.
 * Returns relevant cuisines, dishes, and ingredients.
 * 
 * @param {Object} location 
 * @returns {Promise<{cuisines: string[], dishes: string[], ingredients: string[]}>}
 */
export async function matchLocationWithKG(location) {
    const textToMatch = [
        location.title,
        location.description,
        location.cuisine,
        ...(location.tags || []),
        ...(location.what_to_try || [])
    ].join(' ').toLowerCase()

    const [allCuisines, allDishes, allIngredients] = await Promise.all([
        getCuisines(),
        getDishes(),
        getIngredients()
    ])

    const matches = {
        cuisines: [],
        dishes: [],
        ingredients: []
    }

    // Match Cuisines
    allCuisines.forEach(c => {
        const names = [c.name, ...(c.aliases || [])].map(n => n.toLowerCase())
        if (names.some(n => textToMatch.includes(n))) {
            matches.cuisines.push(c.name)
        }
    })

    // Match Dishes
    allDishes.forEach(d => {
        if (textToMatch.includes(d.name.toLowerCase())) {
            matches.dishes.push(d.name)
        }
    })

    // Match Ingredients
    allIngredients.forEach(i => {
        if (textToMatch.includes(i.name.toLowerCase())) {
            matches.ingredients.push(i.name)
        }
    })

    return matches
}

/**
 * Synchronizes the entire Knowledge Graph with existing locations.
 * Updates ai_keywords and enriches ai_context for matching locations.
 */
/**
 * Sync KG data for a SINGLE location.
 * Called automatically after saving a location card.
 * Matches cuisines/dishes/ingredients from text fields and writes to kg_* columns.
 */
export async function syncKGForLocation(locationId) {
    if (!supabase) return null

    const { data: loc, error: fetchErr } = await supabase
        .from('locations')
        .select('*')
        .eq('id', locationId)
        .single()

    if (fetchErr || !loc) return null

    const kgMatches = await matchLocationWithKG(loc)

    // Merge KG names into ai_keywords (additive — never remove existing ones)
    const newKeywords = Array.from(new Set([
        ...(loc.ai_keywords || []),
        ...kgMatches.cuisines,
        ...kgMatches.dishes,
        ...kgMatches.ingredients,
    ]))

    // Build update payload — merge new matches with existing, keep unique
    const updatePayload = {
        kg_cuisines:    Array.from(new Set([...(loc.kg_cuisines    || []), ...kgMatches.cuisines])),
        kg_dishes:      Array.from(new Set([...(loc.kg_dishes      || []), ...kgMatches.dishes])),
        kg_ingredients: Array.from(new Set([...(loc.kg_ingredients || []), ...kgMatches.ingredients])),
        ai_keywords:    newKeywords,
        kg_enriched_at: new Date().toISOString(),
    }

    const { error: upErr } = await supabase
        .from('locations')
        .update(updatePayload)
        .eq('id', locationId)

    if (upErr) {
        console.error('[KG] syncKGForLocation failed:', upErr.message)
        return null
    }

    return { cuisines: kgMatches.cuisines, dishes: kgMatches.dishes, ingredients: kgMatches.ingredients }
}

export async function syncKGToLocations(onProgress) {
    if (!supabase) return { success: true, count: 0 }

    const { data: locations, error } = await supabase
        .from('locations')
        .select('*')
    
    if (error) throw new ApiError(error.message, 500, 'FETCH_ERROR')

    let updatedCount = 0
    for (let i = 0; i < locations.length; i++) {
        const loc = locations[i]
        const kgMatches = await matchLocationWithKG(loc)

        // Merge KG names into ai_keywords (additive)
        const newKeywords = Array.from(new Set([
            ...(loc.ai_keywords || []),
            ...kgMatches.cuisines,
            ...kgMatches.dishes,
            ...kgMatches.ingredients
        ]))

        // Also write to kg_* columns (additive merge)
        const updatePayload = {
            kg_cuisines:    Array.from(new Set([...(loc.kg_cuisines    || []), ...kgMatches.cuisines])),
            kg_dishes:      Array.from(new Set([...(loc.kg_dishes      || []), ...kgMatches.dishes])),
            kg_ingredients: Array.from(new Set([...(loc.kg_ingredients || []), ...kgMatches.ingredients])),
            ai_keywords:    newKeywords,
            kg_enriched_at: new Date().toISOString(),
        }

        const hasChanges =
            updatePayload.kg_cuisines.length    !== (loc.kg_cuisines    || []).length ||
            updatePayload.kg_dishes.length      !== (loc.kg_dishes      || []).length ||
            updatePayload.kg_ingredients.length !== (loc.kg_ingredients || []).length ||
            newKeywords.length                  !== (loc.ai_keywords    || []).length

        if (hasChanges) {
            const { error: upError } = await supabase
                .from('locations')
                .update(updatePayload)
                .eq('id', loc.id)
            
            if (!upError) updatedCount++
        }

        if (onProgress) onProgress(i + 1, locations.length)
    }

    return { success: true, count: updatedCount }
}


/**
 * Merges multiple entities into one master record.
 * Deletes redundant records and updates references if necessary.
 * 
 * @param {'cuisines' | 'dishes' | 'ingredients'} type 
 * @param {string} keepId - ID of the record to keep
 * @param {string[]} idsToDelete - IDs to remove
 */
export async function mergeEntities(type, keepId, idsToDelete) {
    if (!supabase) return { success: true }
    if (!idsToDelete?.length) return { success: true }

    console.log(`[KG] Merging ${idsToDelete.length} ${type} into ${keepId}`)

    try {
        // Special case: if merging cuisines, we must update all dishes that pointed to deleted cuisines
        if (type === 'cuisines') {
            const { error: relError } = await supabase
                .from('dishes')
                .update({ cuisine_id: keepId })
                .in('cuisine_id', idsToDelete)
            
            if (relError) {
                console.warn('[KG] Could not update dish relations during merge:', relError.message)
                // Continue anyway, as the main merge is priority
            }
        }

        // Delete redundant records
        const { error } = await supabase
            .from(type)
            .delete()
            .in('id', idsToDelete)

        if (error) throw error

        invalidateCacheGroup(type)
        return { success: true, count: idsToDelete.length }
    } catch (error) {
        console.error(`[KG] Merge error for ${type}:`, error.message)
        throw new ApiError(error.message, 500, 'MERGE_ERROR')
    }
}
