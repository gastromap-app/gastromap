/**
 * Script: Batch enrich cuisines with AI culinary data and embeddings
 * 
 * This script:
 * 1. Fetches all cuisines from Supabase
 * 2. Enriches missing data (typical_dishes, key_ingredients, flavor_profile, description) using Step 3.5 Flash Free
 * 3. Generates embeddings using openai/text-embedding-3-small
 * 4. Updates Supabase with results
 */

import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

const rootDir = process.cwd()
const envPath = path.join(rootDir, '.env')
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    envContent.split('\n').forEach(line => {
        const [key, ...val] = line.split('=')
        if (key && val.length > 0) {
            process.env[key.trim()] = val.join('=').trim().replace(/^"|"$/g, '')
        }
    })
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const OPENROUTER_KEY = process.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENROUTER_KEY) {
    console.error('❌ Missing environment variables (SUPABASE_URL, SUPABASE_KEY, or OPENROUTER_KEY)')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const AI_MODEL = 'stepfun/step-3.5-flash:free'

async function enrichCuisineData(cuisine) {
    console.log(`🧠 Enrolling AI for cuisine: ${cuisine.name}...`)
    
    const results = { ...cuisine }
    delete results.id
    delete results.created_at
    delete results.updated_at

    try {
        // Only enrich if description or typical_dishes are missing
        if (!cuisine.description || !cuisine.typical_dishes?.length) {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_KEY}`,
                    'HTTP-Referer': 'https://gastromap.app',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a culinary historian. Provide details for a cuisine. Return ONLY JSON.'
                        },
                        {
                            role: 'user',
                            content: `Provide details for "${cuisine.name}" cuisine. Include:
                            1. description (1 sentence, in Russian)
                            2. typical_dishes (array of 5 strings)
                            3. key_ingredients (array of 5 strings)
                            4. flavor_profile (string, e.g. "savory, spicy, fermented")
                            5. aliases (array of strings, e.g. ["Chinese food", "Cantonese"])
                            Format as JSON.`
                        }
                    ],
                    max_tokens: 500,
                }),
            })

            if (response.ok) {
                const data = await response.json()
                const content = data.choices?.[0]?.message?.content || '{}'
                const match = content.match(/\{[\s\S]*\}/)
                if (match) {
                    const aiData = JSON.parse(match[0])
                    results.description = aiData.description || results.description
                    results.typical_dishes = aiData.typical_dishes || results.typical_dishes
                    results.key_ingredients = aiData.key_ingredients || results.key_ingredients
                    results.flavor_profile = aiData.flavor_profile || results.flavor_profile
                    results.aliases = aiData.aliases || results.aliases
                }
            }
        }

        // Generate embedding
        const embeddingText = [
            cuisine.name,
            results.description,
            ...(results.typical_dishes || []),
            ...(results.key_ingredients || []),
            results.flavor_profile,
            cuisine.origin_country
        ].filter(Boolean).join(' | ')

        const embResponse = await fetch('https://openrouter.ai/api/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai/text-embedding-3-small',
                input: embeddingText,
                dimensions: 768
            }),
        })

        if (embResponse.ok) {
            const embData = await embResponse.json()
            results.embedding = embData.data?.[0]?.embedding || null
        }

    } catch (error) {
        console.error(`  ❌ Error enriching ${cuisine.name}:`, error.message)
    }

    return results
}

async function main() {
    console.log('🚀 Starting cuisine enrichment...')
    
    const { data: cuisines, error } = await supabase
        .from('cuisines')
        .select('*')

    if (error) {
        console.error('❌ Error fetching cuisines:', error.message)
        return
    }

    console.log(`🍲 Found ${cuisines.length} cuisines to process.`)

    for (let i = 0; i < cuisines.length; i++) {
        const cuisine = cuisines[i]
        const progress = `[${i + 1}/${cuisines.length}]`
        
        // Skip if already has embedding and we don't want to re-enrich?
        // Let's re-enrich if anything is missing OR no embedding
        if (cuisine.embedding && cuisine.description && cuisine.typical_dishes?.length) {
            console.log(`${progress} Skipping ${cuisine.name} (already fully enriched)`)
            continue
        }

        console.log(`\n${progress} Processing: ${cuisine.name}...`)
        
        const enrichment = await enrichCuisineData(cuisine)
        
        const { error: updateError } = await supabase
            .from('cuisines')
            .update(enrichment)
            .eq('id', cuisine.id)

        if (updateError) {
            console.error(`  ❌ Update failed for ${cuisine.name}:`, updateError.message)
        } else {
            console.log(`  ✅ Successfully updated ${cuisine.name}`)
        }

        await new Promise(r => setTimeout(r, 800))
    }

    console.log('\n✨ Cuisine enrichment completed.')
}

main().catch(console.error)
