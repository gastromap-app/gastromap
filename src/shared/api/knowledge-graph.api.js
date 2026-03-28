/**
 * Knowledge Graph API — Семантический поиск и онтология
 * 
 * Использует pgvector для семантического поиска
 * и Knowledge Graph для связей между сущностями
 */

import { supabase, ApiError } from './client'
import { config } from '@/shared/config/env'

const USE_SUPABASE = config.supabase.isConfigured

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDINGS: Генерация векторных представлений
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Сгенерировать embedding для текста
 * @param {string} text - Текст для эмбеддинга
 * @returns {Promise<number[]>} - Вектор размерности 768
 */
export async function generateEmbedding(text) {
    if (!config.ai.openRouterKey) {
        throw new ApiError('OpenRouter API key not configured', 500, 'NO_API_KEY')
    }

    try {
        // Используем бесплатную модель для генерации эмбеддингов
        // В production лучше использовать специализированный embedding API
        const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.ai.openRouterKey}`,
                'HTTP-Referer': 'https://gastromap.app',
                'X-Title': 'GastroMap Knowledge Graph',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai/text-embedding-3-small',
                input: text,
                dimensions: 768,
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new ApiError(`Embedding API error: ${error}`, response.status)
        }

        const data = await response.json()
        return data.data?.[0]?.embedding || []
    } catch (error) {
        console.error('[generateEmbedding] Error:', error)
        throw error
    }
}

/**
 * Сгенерировать embedding для ресторана на основе всех полей
 * @param {Object} location - Объект ресторана
 * @returns {Promise<number[]>} - Вектор
 */
export async function generateLocationEmbedding(location) {
    const text = [
        location.title,
        location.description,
        location.cuisine,
        location.city,
        location.country,
        ...(location.vibe || []),
        ...(location.tags || []),
        ...(location.ai_keywords || []),
        location.ai_context,
        location.insider_tip,
    ].filter(Boolean).join(' | ')

    return generateEmbedding(text)
}

// ─────────────────────────────────────────────────────────────────────────────
// SEMANTIC SEARCH: Семантический поиск
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Семантический поиск ресторанов
 * @param {string} query - Поисковый запрос
 * @param {Object} options - Опции
 * @returns {Promise<Array>} - Результаты поиска
 */
export async function semanticSearch(query, options = {}) {
    if (!USE_SUPABASE) {
        throw new ApiError('Supabase not configured', 500, 'NO_SUPABASE')
    }

    const {
        limit = 20,
        threshold = 0.7,
        filters = {},
    } = options

    try {
        // 1. Генерируем embedding для запроса
        const queryEmbedding = await generateEmbedding(query)

        // 2. Ищем похожие рестораны через RPC функцию
        const { data, error } = await supabase.rpc('search_locations_by_embedding', {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: limit,
        })

        if (error) {
            console.error('[semanticSearch] Supabase error:', error)
            throw new ApiError(`Search error: ${error.message}`, 500, error.code)
        }

        // 3. Применяем дополнительные фильтры если есть
        let results = data || []

        if (filters.category && filters.category !== 'All') {
            results = results.filter(r => r.category === filters.category)
        }

        if (filters.city) {
            results = results.filter(r => r.city?.toLowerCase().includes(filters.city.toLowerCase()))
        }

        if (filters.minRating != null) {
            results = results.filter(r => r.rating >= filters.minRating)
        }

        if (filters.priceLevel?.length) {
            results = results.filter(r => filters.priceLevel.includes(r.price_level))
        }

        return results
    } catch (error) {
        console.error('[semanticSearch] Error:', error)
        throw error
    }
}

/**
 * Найти похожие рестораны
 * @param {string} locationId - ID ресторана для поиска похожих
 * @param {Object} options - Опции
 * @returns {Promise<Array>} - Похожие рестораны
 */
export async function findSimilarLocations(locationId, options = {}) {
    if (!USE_SUPABASE) {
        throw new ApiError('Supabase not configured', 500, 'NO_SUPABASE')
    }

    const {
        threshold = 0.8,
        limit = 10,
    } = options

    try {
        const { data, error } = await supabase.rpc('find_similar_locations', {
            target_location_id: locationId,
            similarity_threshold: threshold,
            max_results: limit,
        })

        if (error) {
            console.error('[findSimilarLocations] Supabase error:', error)
            throw new ApiError(`Search error: ${error.message}`, 500, error.code)
        }

        return data || []
    } catch (error) {
        console.error('[findSimilarLocations] Error:', error)
        throw error
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE GRAPH: Онтология
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Получить все кухни с иерархией
 * @returns {Promise<Array>} - Список кухонь
 */
export async function getCuisinesTree() {
    if (!USE_SUPABASE) {
        return []
    }

    try {
        const { data, error } = await supabase
            .from('cuisines')
            .select('*')
            .order('name')

        if (error) throw error

        // Строим иерархию
        const byId = {}
        const roots = []

        data.forEach(cuisine => {
            byId[cuisine.id] = { ...cuisine, children: [] }
        })

        data.forEach(cuisine => {
            if (cuisine.parent_id && byId[cuisine.parent_id]) {
                byId[cuisine.parent_id].children.push(byId[cuisine.id])
            } else if (!cuisine.parent_id) {
                roots.push(byId[cuisine.id])
            }
        })

        return roots
    } catch (error) {
        console.error('[getCuisinesTree] Error:', error)
        return []
    }
}

/**
 * Поиск кухонь по названию
 * @param {string} query - Поисковый запрос
 * @returns {Promise<Array>} - Найденные кухни
 */
export async function searchCuisines(query) {
    if (!USE_SUPABASE) {
        return []
    }

    try {
        const { data, error } = await supabase
            .from('cuisines')
            .select('*')
            .ilike('name', `%${query}%`)
            .limit(20)

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('[searchCuisines] Error:', error)
        return []
    }
}

/**
 * Получить блюда по кухне
 * @param {string} cuisineId - ID кухни
 * @returns {Promise<Array>} - Список блюд
 */
export async function getDishesByCuisine(cuisineId) {
    if (!USE_SUPABASE) {
        return []
    }

    try {
        const { data, error } = await supabase
            .from('dishes')
            .select(`
                *,
                ingredients:dish_ingredients(
                    ingredient:ingredients(*)
                )
            `)
            .eq('cuisine_id', cuisineId)
            .order('name')

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('[getDishesByCuisine] Error:', error)
        return []
    }
}

/**
 * Поиск блюд по ингредиентам
 * @param {string[]} ingredientNames - Названия ингредиентов
 * @returns {Promise<Array>} - Найденные блюда
 */
export async function searchDishesByIngredients(ingredientNames) {
    if (!USE_SUPABASE) {
        return []
    }

    try {
        const { data, error } = await supabase
            .from('dishes')
            .select(`
                *,
                cuisine:cuisines(name),
                ingredients:dish_ingredients(
                    ingredient:ingredients(name, category)
                )
            `)
            .in('ingredients', ingredientNames)
            .limit(50)

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('[searchDishesByIngredients] Error:', error)
        return []
    }
}

/**
 * Получить настроения (vibes)
 * @returns {Promise<Array>} - Список настроений
 */
export async function getVibes() {
    if (!USE_SUPABASE) {
        return []
    }

    try {
        const { data, error } = await supabase
            .from('vibes')
            .select('*')
            .order('name')

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('[getVibes] Error:', error)
        return []
    }
}

/**
 * Получить теги
 * @param {string} category - Категория тегов (опционально)
 * @returns {Promise<Array>} - Список тегов
 */
export async function getTags(category = null) {
    if (!USE_SUPABASE) {
        return []
    }

    try {
        let query = supabase.from('tags').select('*')

        if (category) {
            query = query.eq('category', category)
        }

        const { data, error } = await query.order('name')

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('[getTags] Error:', error)
        return []
    }
}

/**
 * Получить ингредиенты по категории
 * @param {string} category - Категория
 * @returns {Promise<Array>} - Список ингредиентов
 */
export async function getIngredientsByCategory(category) {
    if (!USE_SUPABASE) {
        return []
    }

    try {
        const { data, error } = await supabase
            .from('ingredients')
            .select('*')
            .eq('category', category)
            .order('name')

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('[getIngredientsByCategory] Error:', error)
        return []
    }
}

/**
 * Поиск ингредиентов по названию
 * @param {string} query - Поисковый запрос
 * @returns {Promise<Array>} - Найденные ингредиенты
 */
export async function searchIngredients(query) {
    if (!USE_SUPABASE) {
        return []
    }

    try {
        const { data, error } = await supabase
            .from('ingredients')
            .select('*')
            .ilike('name', `%${query}%`)
            .limit(20)

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('[searchIngredients] Error:', error)
        return []
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH QUERIES: Сложные запросы к Knowledge Graph
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Найти рестораны по блюду или ингредиенту
 * @param {string} searchQuery - "паста с трюфелями", "веганский бургер"
 * @returns {Promise<Array>} - Рестораны с блюдами
 */
export async function findRestaurantsByDish(searchQuery) {
    if (!USE_SUPABASE) {
        return []
    }

    try {
        // 1. Ищем ингредиенты по запросу
        const ingredients = await searchIngredients(searchQuery)
        const ingredientIds = ingredients.map(i => i.id)

        if (ingredientIds.length === 0) {
            return []
        }

        // 2. Находим блюда с этими ингредиентами
        const { data: dishes, error: dishesError } = await supabase
            .from('dish_ingredients')
            .select('dish_id')
            .in('ingredient_id', ingredientIds)

        if (dishesError) throw dishesError

        const dishIds = [...new Set(dishes.map(d => d.dish_id))]

        if (dishIds.length === 0) {
            return []
        }

        // 3. Находим рестораны с этими блюдами
        const { data: locations, error: locationsError } = await supabase
            .from('location_dishes')
            .select(`
                location_id,
                dish_id,
                is_signature,
                price,
                locations:location_id (
                    id,
                    title,
                    description,
                    city,
                    rating,
                    price_level,
                    image
                )
            `)
            .in('dish_id', dishIds)
            .eq('available', true)

        if (locationsError) throw locationsError

        return locations || []
    } catch (error) {
        console.error('[findRestaurantsByDish] Error:', error)
        return []
    }
}

/**
 * Получить полный профиль ресторана с KG данными
 * @param {string} locationId - ID ресторана
 * @returns {Promise<Object>} - Полный профиль
 */
export async function getLocationWithKG(locationId) {
    if (!USE_SUPABASE) {
        return null
    }

    try {
        // Получаем основной профиль
        const { data: location, error: locError } = await supabase
            .from('locations')
            .select('*')
            .eq('id', locationId)
            .single()

        if (locError || !location) {
            throw new ApiError('Location not found', 404, 'LOCATION_NOT_FOUND')
        }

        // Получаем кухни
        const { data: cuisines } = await supabase
            .from('location_cuisines')
            .select(`
                is_primary,
                confidence_score,
                cuisine:cuisines(*)
            `)
            .eq('location_id', locationId)

        // Получаем блюда
        const { data: dishes } = await supabase
            .from('location_dishes')
            .select(`
                is_signature,
                price,
                available,
                dish:dishes(*)
            `)
            .eq('location_id', locationId)

        // Получаем настроения
        const { data: vibes } = await supabase
            .from('location_vibes')
            .select(`
                strength,
                vibe:vibes(*)
            `)
            .eq('location_id', locationId)

        // Получаем теги
        const { data: tags } = await supabase
            .from('location_tags')
            .select(`
                tag:tags(*)
            `)
            .eq('location_id', locationId)

        return {
            ...location,
            cuisines: cuisines || [],
            dishes: dishes || [],
            vibes: vibes || [],
            tags: tags || [],
        }
    } catch (error) {
        console.error('[getLocationWithKG] Error:', error)
        throw error
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Управление онтологией
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Создать новую кухню
 * @param {Object} cuisineData - Данные кухни
 * @returns {Promise<Object>} - Созданная кухня
 */
export async function createCuisine(cuisineData) {
    if (!USE_SUPABASE) {
        throw new ApiError('Supabase not configured', 500, 'NO_SUPABASE')
    }

    try {
        // Генерируем embedding если есть описание
        let embedding = null
        if (cuisineData.description) {
            embedding = await generateEmbedding(cuisineData.description)
        }

        const { data, error } = await supabase
            .from('cuisines')
            .insert({
                ...cuisineData,
                embedding,
            })
            .select()
            .single()

        if (error) throw error
        return data
    } catch (error) {
        console.error('[createCuisine] Error:', error)
        throw error
    }
}

/**
 * Обновить кухню
 * @param {string} cuisineId - ID кухни
 * @param {Object} updates - Данные для обновления
 * @returns {Promise<Object>} - Обновлённая кухня
 */
export async function updateCuisine(cuisineId, updates) {
    if (!USE_SUPABASE) {
        throw new ApiError('Supabase not configured', 500, 'NO_SUPABASE')
    }

    try {
        // Генерируем embedding если обновили описание
        if (updates.description) {
            updates.embedding = await generateEmbedding(updates.description)
        }

        const { data, error } = await supabase
            .from('cuisines')
            .update(updates)
            .eq('id', cuisineId)
            .select()
            .single()

        if (error) throw error
        return data
    } catch (error) {
        console.error('[updateCuisine] Error:', error)
        throw error
    }
}

/**
 * Удалить кухню
 * @param {string} cuisineId - ID кухни
 * @returns {Promise<void>}
 */
export async function deleteCuisine(cuisineId) {
    if (!USE_SUPABASE) {
        throw new ApiError('Supabase not configured', 500, 'NO_SUPABASE')
    }

    try {
        const { error } = await supabase
            .from('cuisines')
            .delete()
            .eq('id', cuisineId)

        if (error) throw error
    } catch (error) {
        console.error('[deleteCuisine] Error:', error)
        throw error
    }
}

// Экспорт для удобства
export default {
    // Embeddings
    generateEmbedding,
    generateLocationEmbedding,
    
    // Semantic Search
    semanticSearch,
    findSimilarLocations,
    
    // Knowledge Graph
    getCuisinesTree,
    searchCuisines,
    getDishesByCuisine,
    searchDishesByIngredients,
    getVibes,
    getTags,
    getIngredientsByCategory,
    searchIngredients,
    
    // Graph Queries
    findRestaurantsByDish,
    getLocationWithKG,
    
    // Admin
    createCuisine,
    updateCuisine,
    deleteCuisine,
}
