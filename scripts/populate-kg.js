
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

// Load environment variables
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
    console.error('❌ Missing environment variables')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const AI_MODEL = 'openrouter/auto'

function cleanJSON(str) {
    // Remove potential markdown blocks
    let cleaned = str.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1) {
        cleaned = cleaned.substring(startIdx, endIdx + 1);
    }
    return cleaned;
}

async function callAI(systemPrompt, userPrompt) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_KEY}`,
            'HTTP-Referer': 'https://gastromap.app',
            'X-Title': 'GastroMap Data Seeder',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        }),
    })

    if (!response.ok) {
        throw new Error(`AI Request Failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content;
    
    try {
        return JSON.parse(cleanJSON(content))
    } catch (e) {
        console.warn('⚠️ JSON parse failed, retrying cleaning...')
        console.log('--- RAW CONTENT ---')
        console.log(content)
        console.log('-------------------')
        throw new Error(`Critical JSON parse error: ${e.message}`)
    }
}

async function populateCuisines() {
    console.log('🌍 Generating world cuisines in batches...')
    const regions = [
        'Europe', 'Asia', 'Middle East & North Africa', 
        'South & Central America', 'North America', 'Sub-saharan Africa'
    ]
    
    let allCuisines = []
    
    for (const region of regions) {
        console.log(`   Fetching ${region} cuisines...`)
        const systemPrompt = 'Return a JSON object with a "cuisines" array. Cuisine properties: name, slug (lowercase, hyphenated), description (1 sentence), region, origin_country, aliases (array).'
        const userPrompt = `Generate 8 significant ${region} cuisines with their metadata.`
        
        try {
            const data = await callAI(systemPrompt, userPrompt)
            if (data.cuisines) {
                allCuisines = [...allCuisines, ...data.cuisines]
            }
        } catch (e) {
            console.error(`   ❌ Failed for ${region}:`, e.message)
        }
    }
    
    console.log(`✅ Total generated: ${allCuisines.length} cuisines.`)
    
    const { data: inserted, error } = await supabase
        .from('cuisines')
        .upsert(allCuisines, { onConflict: 'slug' })
        .select()
        
    if (error) throw error
    return inserted
}

async function populateDishesForCuisine(cuisine) {
    console.log(`🍲 Generating dishes for ${cuisine.name}...`)
    const systemPrompt = 'Return a JSON object with a "dishes" array. Dish properties: name, slug (lowercase, hyphenated), description (1 sentence), preparation_style, flavor_notes, ingredients (array of names), dietary_tags (array).'
    const userPrompt = `Generate 6 most iconic dishes for ${cuisine.name} cuisine.`
    
    try {
        const data = await callAI(systemPrompt, userPrompt)
        
        const dishesToInsert = (data.dishes || []).map(d => ({
            ...d,
            cuisine_id: cuisine.id
        }))
        
        // Create unique batch by name
        const uniqueBatch = [];
        const seenNames = new Set();
        
        for (const item of dishesToInsert) {
          if (!seenNames.has(item.name)) {
            uniqueBatch.push(item);
            seenNames.add(item.name);
          }
        }
        
        const { data: inserted, error } = await supabase
            .from('dishes')
            .upsert(uniqueBatch, { onConflict: 'slug' })
            .select()
            
        if (error) {
            console.error(`  ❌ Supabase error for ${cuisine.name}:`, error.message)
            return []
        }
        return inserted || []
    } catch (e) {
        console.error(`  ❌ AI Error for ${cuisine.name}:`, e.message)
        return []
    }
}

async function main() {
    try {
        console.log('🚀 Starting Knowledge Graph full population...')
        
        // 1. Cuisines
        const cuisines = await populateCuisines()
        
        // 2. Dishes (Batched to avoid timeouts)
        console.log('🍱 Populating dishes and extracting ingredients...')
        
        const allIngredients = new Set()
        
        for (const cuisine of cuisines) {
            const dishes = await populateDishesForCuisine(cuisine)
            dishes.forEach(d => {
                if (d.ingredients) {
                    d.ingredients.forEach(i => allIngredients.add(i.toLowerCase()))
                }
            })
            // Small pause
            await new Promise(r => setTimeout(r, 500))
        }
        
        // 3. Ingredients (Unique collection)
        console.log(`🌿 Generating metadata for ${allIngredients.size} unique ingredients...`)
        const ingredientList = Array.from(allIngredients)
        
        // Process ingredients in chunks of 50 to avoid massive prompt
        const chunkSize = 50
        for (let i = 0; i < ingredientList.length; i += chunkSize) {
            const chunk = ingredientList.slice(i, i + chunkSize)
            console.log(`   Processing ingredients ${i + 1} to ${Math.min(i + chunkSize, ingredientList.length)}...`)
            
            const systemPrompt = 'Return a JSON object with an "ingredients" array. Each ingredient: name, slug, category (e.g. spice, vegetable, dairy, meat, oil), flavor_profile, dietary_info (array like ["vegan", "gluten-free"]), common_pairings (array).'
            const userPrompt = `Generate metadata for these ingredients: ${chunk.join(', ')}`
            
            const data = await callAI(systemPrompt, userPrompt)
            
            const { error } = await supabase
                .from('ingredients')
                .upsert(data.ingredients, { onConflict: 'slug' })
            
            if (error) console.error('  ❌ Error inserting ingredients:', error.message)
        }
        
        console.log('\n✨ Knowledge Graph population COMPLETE!')
        
    } catch (error) {
        console.error('💥 Critical Error:', error.message)
    }
}

main()
