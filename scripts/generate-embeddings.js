/**
 * Script: Generate embeddings for existing locations
 * Usage: node generate-embeddings.js
 * 
 * This script:
 * 1. Fetches all locations from Supabase
 * 2. Generates embeddings for each location
 * 3. Updates the database with vectors
 */

import { createClient } from '@supabase/supabase-js'
import { config } from './src/shared/config/env.js'

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

async function main() {
    console.log('🚀 Starting embedding generation...\n')

    // Fetch all locations
    const { data: locations, error } = await supabase
        .from('locations')
        .select('id, title, description, cuisine, city, country, vibe, tags, ai_context, insider_tip')
        .eq('status', 'active')

    if (error) {
        console.error('❌ Error fetching locations:', error.message)
        return
    }

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

            // Rate limiting: wait 100ms between requests
            await new Promise(resolve => setTimeout(resolve, 100))

        } catch (err) {
            errorCount++
            console.error(`${progress} ❌ Error: ${err.message}\n`)
        }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 Results:')
    console.log(`   ✅ Success: ${successCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)
    console.log(`   📍 Total: ${locations.length}`)
    console.log('='.repeat(60))
}

main().catch(console.error)
