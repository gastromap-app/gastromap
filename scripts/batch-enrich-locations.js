/**
 * Script: Batch enrich locations with AI keywords, context and embeddings
 * 
 * This script:
 * 1. Fetches all locations from Supabase
 * 2. Fetches all Knowledge Graph entities (cuisines, dishes, ingredients)
 * 3. For each location:
 *    a. Matches with KG entities (names, aliases)
 *    b. Generates AI keywords and context via OpenRouter
 *    c. Generates vector embeddings for pgvector search
 * 4. Updates Supabase with results
 */

import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

// Load environment variables from .env
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
const AI_MODEL = 'openrouter/auto'

async function enrichLocation(location, kgData) {
    console.log(`🧠 Enriching location: ${location.title}...`)
    
    const results = { 
        ai_keywords: [],
        ai_context: '',
        embedding: null,
        ai_enrichment_status: 'pending',
        ai_enrichment_last_attempt: new Date().toISOString()
    }

    try {
        // 1. Match with KG entities (Simple text matching)
        const textToMatch = [
            location.title,
            location.description,
            ...(location.cuisine_types || []),
            ...(location.tags || []),
            location.must_try
        ].filter(Boolean).join(' ').toLowerCase()

        const kgMatches = []
        
        kgData.cuisines.forEach(c => {
            const names = [c.name, ...(c.aliases || [])].map(n => n.toLowerCase())
            if (names.some(n => textToMatch.includes(n))) kgMatches.push(c.name)
        })

        kgData.dishes.forEach(d => {
            if (textToMatch.includes(d.name.toLowerCase())) kgMatches.push(d.name)
        })

        kgData.ingredients.forEach(i => {
            if (textToMatch.includes(i.name.toLowerCase())) kgMatches.push(i.name)
        })

        // 2. Generate AI Keywords and Context
        const apiKey = OPENROUTER_KEY
        const textForAI = [
            location.title,
            location.description,
            location.address,
            location.city,
            ...(location.cuisine_types || []),
            ...(location.tags || []),
            location.insider_tip,
        ].filter(Boolean).join(', ')

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://gastromap.app',
                'X-Title': 'GastroMap',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a gastronomy expert. Return ONLY a JSON object with "keywords" (array of strings) and "context" (2-sentence string). No prose, no backticks if possible.'
                    },
                    {
                        role: 'user',
                        content: `Location info:\n${textForAI}`
                    }
                ],
                max_tokens: 1000,
            }),
        })

        if (!response.ok) {
            console.error(`    DEBUG [${location.title}] AI Request Failed:`, response.status, response.statusText)
            const errorText = await response.text()
            console.error(`    DEBUG [${location.title}] Error details:`, errorText)
        } else {
            const data = await response.json()
            const content = data.choices?.[0]?.message?.content || '{}'
            console.log(`    DEBUG [${location.title}] Raw AI Content:`, content)
            
            let jsonStr = content;
            const startIdx = content.indexOf('{');
            const endIdx = content.lastIndexOf('}');
            
            if (startIdx !== -1) {
                if (endIdx !== -1 && endIdx > startIdx) {
                    jsonStr = content.substring(startIdx, endIdx + 1);
                } else {
                    jsonStr = content.substring(startIdx) + '\n}';
                }
            }

            try {
                const aiData = JSON.parse(jsonStr)
                const keywords = Array.isArray(aiData.keywords) ? aiData.keywords : []
                const context = aiData.context || aiData.summary || ''
                
                results.ai_keywords = Array.from(new Set([...keywords, ...kgMatches]))
                results.ai_context = context
                console.log(`    DEBUG [${location.title}] Parsed Keywords:`, results.ai_keywords.length)
                console.log(`    DEBUG [${location.title}] Parsed Context:`, results.ai_context.substring(0, 30) + '...')
            } catch (e) {
                console.warn(`    DEBUG [${location.title}] JSON Parse failed:`, e.message)
            }
        }

        // 3. Generate embedding
        const embeddingText = [
            location.title,
            location.description,
            location.category,
            ...(results.ai_keywords || []),
            results.ai_context
        ].filter(Boolean).join(' ')

        const embResponse = await fetch('https://openrouter.ai/api/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
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
            results.ai_enrichment_status = results.ai_keywords?.length > 0 ? 'success' : 'partial'
        } else {
            console.error(`    DEBUG [${location.title}] Embedding Failed:`, embResponse.status)
            results.ai_enrichment_status = 'failed'
            results.ai_enrichment_error = `Embedding status: ${embResponse.status}`
        }

    } catch (error) {
        console.error(`  ❌ Error enriching ${location.title}:`, error.message)
        results.ai_enrichment_status = 'failed'
        results.ai_enrichment_error = error.message
    }

    return results
}

async function main() {
    console.log('🚀 Starting batch location enrichment...')
    
    const [c, d, i] = await Promise.all([
        supabase.from('cuisines').select('*'),
        supabase.from('dishes').select('*'),
        supabase.from('ingredients').select('*')
    ])

    const kgData = {
        cuisines: c.data || [],
        dishes: d.data || [],
        ingredients: i.data || []
    }

    const { data: locations, error } = await supabase
        .from('locations')
        .select('*')

    if (error) {
        console.error('❌ Error fetching locations:', error.message)
        return
    }

    console.log(`📍 Found ${locations.length} locations to process.`)

    for (let k = 0; k < locations.length; k++) {
        const location = locations[k]
        const progress = `[${k + 1}/${locations.length}]`
        
        console.log(`\n${progress} Processing: ${location.title}...`)
        
        const enrichment = await enrichLocation(location, kgData)
        
        console.log(`    DEBUG [${location.title}] Final Enrichment - Keywords: ${enrichment.ai_keywords?.length}, Context: ${enrichment.ai_context?.length > 0 ? 'YES' : 'NO'}`)
        
        const { error: updateError } = await supabase
            .from('locations')
            .update({
                ai_keywords: enrichment.ai_keywords,
                ai_context: enrichment.ai_context,
                embedding: enrichment.embedding,
                ai_enrichment_status: enrichment.ai_enrichment_status,
                ai_enrichment_last_attempt: enrichment.ai_enrichment_last_attempt
            })
            .eq('id', location.id)

        if (updateError) {
            console.error(`  ❌ Update failed for ${location.title}:`, updateError.message)
        } else {
            console.log(`  ✅ Successfully updated ${location.title}`)
        }

        await new Promise(r => setTimeout(r, 1000))
    }

    console.log('\n✨ Location enrichment completed.')
}

main().catch(console.error)
