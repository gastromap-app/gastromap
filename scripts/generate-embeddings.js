/**
 * Script: Generate embeddings for locations and Knowledge Graph entities
 * Usage: 
 *   node scripts/generate-embeddings.js              # Generate for locations (default)
 *   node scripts/generate-embeddings.js --type=kg    # Generate for KG entities
 *   node scripts/generate-embeddings.js --type=all   # Generate for both
 * 
 * This script:
 * 1. Fetches entities from Supabase (locations, cuisines, dishes, ingredients)
 * 2. Generates embeddings for each entity
 * 3. Updates the database with vectors
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables from .env
dotenv.config()

// Dynamic import to ensure dotenv.config() runs first
const { config } = await import('../src/shared/config/env.js')

// Parse command line arguments
const args = process.argv.slice(2)
const typeArg = args.find(arg => arg.startsWith('--type='))
const type = typeArg ? typeArg.split('=')[1] : 'locations'

const supabase = createClient(config.supabase.url, config.supabase.anonKey)

async function generateEmbedding(text) {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.ai.openRouterKey}`,
            'HTTP-Referer': 'https://gastromap.app',
            'X-Title': 'GastroMap Embeddings',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'openai/text-embedding-3-small',
            input: text,
            dimensions: 768,
        }),
    })

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.[0]?.embedding || []
}

async function generateLocationEmbedding(location) {
    const text = [
        location.title,
        location.description,
        location.cuisine,
        location.city,
        location.country,
        ...(location.vibe || []),
        ...(location.tags || []),
        location.ai_context,
        location.insider_tip,
    ].filter(Boolean).join(' | ')

    return generateEmbedding(text)
}

// ─── Knowledge Graph Entity Embeddings ──────────────────────────────────────

async function generateCuisineEmbedding(cuisine) {
    const text = [
        cuisine.name,
        cuisine.description || '',
        ...(cuisine.characteristics?.typical_dishes || []),
        ...(cuisine.characteristics?.key_ingredients || []),
        cuisine.origin_country || '',
    ].filter(Boolean).join(' | ')

    return generateEmbedding(text)
}

async function generateDishEmbedding(dish) {
    const text = [
        dish.name,
        dish.description || '',
        ...(dish.ingredients || []),
        dish.category || '',
        dish.price_range || '',
    ].filter(Boolean).join(' | ')

    return generateEmbedding(text)
}

async function generateIngredientEmbedding(ingredient) {
    const text = [
        ingredient.name,
        ingredient.category || '',
        ingredient.origin || '',
        ...(ingredient.season || []),
    ].filter(Boolean).join(' | ')

    return generateEmbedding(text)
}

async function generateEmbeddingsForTable(tableName, embeddingFn) {
    console.log(`\n📊 Processing ${tableName}...`)
    
    const { data: entities, error } = await supabase
        .from(tableName)
        .select('*')
    
    if (error) {
        console.error(`❌ Error fetching ${tableName}:`, error.message)
        return { success: 0, error: 0, total: 0 }
    }

    // Filter out entities that already have embeddings
    const entitiesWithoutEmbeddings = entities.filter(e => !e.embedding || (Array.isArray(e.embedding) && e.embedding.length === 0))
    const entitiesWithEmbeddings = entities.length - entitiesWithoutEmbeddings.length
    
    console.log(`📍 Found ${entities.length} total, ${entitiesWithoutEmbeddings.length} need embeddings, ${entitiesWithEmbeddings} already have embeddings\n`)

    if (entitiesWithoutEmbeddings.length === 0) {
        console.log(`✅ All ${entities.length} ${tableName} already have embeddings\n`)
        return { success: 0, error: 0, total: 0 }
    }

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < entitiesWithoutEmbeddings.length; i++) {
        const entity = entitiesWithoutEmbeddings[i]
        const progress = `[${i + 1}/${entitiesWithoutEmbeddings.length}]`

        try {
            console.log(`${progress} Processing: ${entity.name || entity.title || entity.id}`)
            
            const embedding = await embeddingFn(entity)
            
            if (!embedding || embedding.length === 0) {
                throw new Error('Empty embedding')
            }

            const { error: updateError } = await supabase
                .from(tableName)
                .update({ embedding })
                .eq('id', entity.id)

            if (updateError) {
                throw updateError
            }

            successCount++
            console.log(`${progress} ✅ Success (${embedding.length} dimensions)\n`)

            // Rate limiting: wait 100ms between requests
            await new Promise(resolve => setTimeout(resolve, 100))

        } catch (err) {
            errorCount++
            console.error(`${progress} ❌ Error: ${err.message}\n`)
        }
    }

    return { success: successCount, error: errorCount, total: entitiesWithoutEmbeddings.length }
}

async function main() {
    console.log('🚀 Starting embedding generation...')
    console.log(`📋 Type: ${type}\n`)

    const stats = {
        locations: { success: 0, error: 0, total: 0 },
        cuisines: { success: 0, error: 0, total: 0 },
        dishes: { success: 0, error: 0, total: 0 },
        ingredients: { success: 0, error: 0, total: 0 },
    }

    // Generate for locations
    if (type === 'locations' || type === 'all') {
        console.log('\n' + '='.repeat(60))
        console.log('📍 Generating Location Embeddings')
        console.log('='.repeat(60))

        const { data: locations, error } = await supabase
            .from('locations')
            .select('id, title, description, cuisine, city, country, vibe, tags, ai_context, insider_tip')
            .in('status', ['active', 'approved'])

        if (error) {
            console.error('❌ Error fetching locations:', error.message)
        } else {
            console.log(`📍 Found ${locations.length} active locations\n`)

            let successCount = 0
            let errorCount = 0

            for (let i = 0; i < locations.length; i++) {
                const location = locations[i]
                const progress = `[${i + 1}/${locations.length}]`

                try {
                    console.log(`${progress} Processing: ${location.title}`)
                    
                    const embedding = await generateLocationEmbedding(location)
                    
                    if (!embedding || embedding.length === 0) {
                        throw new Error('Empty embedding')
                    }

                    const { error: updateError } = await supabase
                        .from('locations')
                        .update({ embedding })
                        .eq('id', location.id)

                    if (updateError) {
                        throw updateError
                    }

                    successCount++
                    console.log(`${progress} ✅ Success (${embedding.length} dimensions)\n`)

                    await new Promise(resolve => setTimeout(resolve, 100))

                } catch (err) {
                    errorCount++
                    console.error(`${progress} ❌ Error: ${err.message}\n`)
                }
            }

            stats.locations = { success: successCount, error: errorCount, total: locations.length }
        }
    }

    // Generate for Knowledge Graph entities
    if (type === 'kg' || type === 'all') {
        console.log('\n' + '='.repeat(60))
        console.log('🧠 Generating Knowledge Graph Embeddings')
        console.log('='.repeat(60))

        // Cuisines
        stats.cuisines = await generateEmbeddingsForTable(
            'cuisines',
            generateCuisineEmbedding
        )

        // Dishes
        stats.dishes = await generateEmbeddingsForTable(
            'dishes',
            generateDishEmbedding
        )

        // Ingredients
        stats.ingredients = await generateEmbeddingsForTable(
            'ingredients',
            generateIngredientEmbedding
        )
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Final Results')
    console.log('='.repeat(60))

    if (type === 'locations' || type === 'all') {
        console.log(`📍 Locations: ${stats.locations.success}✅ ${stats.locations.error}❌ / ${stats.locations.total}`)
    }
    if (type === 'kg' || type === 'all') {
        console.log(`🍽️  Cuisines: ${stats.cuisines.success}✅ ${stats.cuisines.error}❌ / ${stats.cuisines.total}`)
        console.log(`🍜 Dishes: ${stats.dishes.success}✅ ${stats.dishes.error}❌ / ${stats.dishes.total}`)
        console.log(`🥗 Ingredients: ${stats.ingredients.success}✅ ${stats.ingredients.error}❌ / ${stats.ingredients.total}`)
    }

    const totalSuccess = stats.locations.success + stats.cuisines.success + stats.dishes.success + stats.ingredients.success
    const totalError = stats.locations.error + stats.cuisines.error + stats.dishes.error + stats.ingredients.error
    const total = stats.locations.total + stats.cuisines.total + stats.dishes.total + stats.ingredients.total

    console.log('-'.repeat(60))
    console.log(`📈 Total: ${totalSuccess}✅ ${totalError}❌ / ${total}`)
    console.log('='.repeat(60))
}

main().catch(console.error)
