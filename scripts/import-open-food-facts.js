/**
 * Open Food Facts Data Import Script
 * 
 * This script imports data from Open Food Facts API into Gastromap's Knowledge Graph.
 * It fetches categories, ingredients, and allergens, then inserts them into Supabase
 * with generated embeddings.
 * 
 * Usage:
 *   node scripts/import-open-food-facts.js
 * 
 * Environment:
 *   VITE_SUPABASE_URL - Supabase project URL
 *   VITE_SUPABASE_ANON_KEY - Supabase anon key
 *   VITE_OPENROUTER_API_KEY - OpenRouter API key for embeddings
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Simple .env.local parser
function loadEnvLocal() {
    try {
        const envPath = join(__dirname, '..', '.env.local')
        const content = readFileSync(envPath, 'utf-8')
        content.split('\n').forEach(line => {
            line = line.trim()
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=')
                if (key && valueParts.length > 0) {
                    process.env[key.trim()] = valueParts.join('=').trim()
                }
            }
        })
    } catch (err) {
        console.warn('⚠️  Could not load .env.local:', err.message)
    }
}

loadEnvLocal()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const openRouterKey = process.env.VITE_OPENROUTER_API_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
    process.exit(1)
}

if (!openRouterKey) {
    console.warn('⚠️  Warning: VITE_OPENROUTER_API_KEY not set. Embeddings will not be generated.')
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ─── Embedding Generation ───────────────────────────────────────────────────

async function generateEmbedding(text) {
    if (!openRouterKey) {
        console.warn('⚠️  Skipping embedding (no API key)')
        return null
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openRouterKey}`,
                'HTTP-Referer': 'https://gastromap.app',
                'X-Title': 'GastroMap',
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
        return data.data?.[0]?.embedding || null
    } catch (err) {
        console.error(`❌ Embedding error: ${err.message}`)
        return null
    }
}

// ─── Data Fetching ──────────────────────────────────────────────────────────

async function fetchOFFData(endpoint) {
    console.log(`📥 Fetching ${endpoint}...`)
    try {
        const response = await fetch(`https://world.openfoodfacts.org/${endpoint}.json`)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }
        const data = await response.json()
        console.log(`✅ Fetched ${data.tags?.length || data.ingredients?.length || 0} items`)
        return data
    } catch (err) {
        console.error(`❌ Failed to fetch ${endpoint}: ${err.message}`)
        return null
    }
}

// ─── Cuisine Import ─────────────────────────────────────────────────────────

// Map common food categories to cuisines
const CUISINE_KEYWORDS = {
    'Italian': ['italian', 'pizza', 'pasta', 'risotto'],
    'French': ['french', 'francais', 'fromage'],
    'Japanese': ['japanese', 'sushi', 'ramen', 'japonais'],
    'Chinese': ['chinese', 'chinois', 'cantonese'],
    'Indian': ['indian', 'indi', 'curry'],
    'Mexican': ['mexican', 'mexicain', 'tacos'],
    'Thai': ['thai', 'thailandais'],
    'Polish': ['polish', 'polska', 'polonais'],
    'Greek': ['greek', 'grec'],
    'Spanish': ['spanish', 'espagnol', 'spanish'],
    'American': ['american', 'burger', 'américain'],
    'Mediterranean': ['mediterranean', 'mediterraneen'],
    'Korean': ['korean', 'coreen'],
    'Vietnamese': ['vietnamese', 'vietnamien', 'pho'],
    'Turkish': ['turkish', 'turc', 'kebab'],
    'Lebanese': ['lebanese', 'libanais'],
    'Moroccan': ['moroccan', 'marocain'],
    'Brazilian': ['brazilian', 'bresilien'],
    'German': ['german', 'allemand'],
    'British': ['british', 'britannique', 'english'],
}

async function importCuisines() {
    console.log('\n' + '='.repeat(60))
    console.log('🍽️  Importing Cuisines')
    console.log('='.repeat(60))

    // Create cuisines from keyword mapping
    const cuisines = []
    for (const [cuisineName, keywords] of Object.entries(CUISINE_KEYWORDS)) {
        const textForEmbedding = `${cuisineName} cuisine ${keywords.join(' ')}`
        const embedding = await generateEmbedding(textForEmbedding)

        cuisines.push({
            name: cuisineName,
            slug: cuisineName.toLowerCase().replace(/\s+/g, '-'),
            description: `${cuisineName} cuisine with traditional dishes and flavors`,
            origin_country: cuisineName,
            characteristics: { keywords },
            embedding: embedding ? JSON.stringify(embedding) : null,
        })

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Insert into Supabase
    console.log(`📝 Inserting ${cuisines.length} cuisines...`)
    const { data, error } = await supabase
        .from('cuisines')
        .upsert(cuisines, { onConflict: 'name' })
        .select()

    if (error) {
        console.error(`❌ Error inserting cuisines: ${error.message}`)
        return 0
    }

    console.log(`✅ Inserted/updated ${data.length} cuisines`)
    return data.length
}

// ─── Ingredient Import ──────────────────────────────────────────────────────

const INGREDIENT_CATEGORY_MAP = {
    'vegetable': ['vegetable', 'legume', 'plant'],
    'fruit': ['fruit', 'fruit'],
    'meat': ['meat', 'viande', 'pork', 'beef', 'chicken'],
    'fish': ['fish', 'fish', 'salmon', 'tuna'],
    'seafood': ['seafood', 'crustacean', 'shrimp'],
    'dairy': ['dairy', 'lait', 'milk', 'cheese', 'fromage'],
    'grain': ['grain', 'cereal', 'wheat', 'rice', 'flour'],
    'spice': ['spice', 'spice', 'epice'],
    'herb': ['herb', 'herbe', 'basil', 'parsley'],
    'nut': ['nut', 'nut', 'almond', 'walnut'],
    'legume': ['legume', 'bean', 'lentil'],
}

async function importIngredients() {
    console.log('\n' + '='.repeat(60))
    console.log('🥗 Importing Ingredients')
    console.log('='.repeat(60))

    const data = await fetchOFFData('ingredients')
    if (!data || !data.ingredients) return 0

    // Common EU allergens
    const ALLERGENS = [
        'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans',
        'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites',
        'lupin', 'molluscs'
    ]

    const ingredients = []
    const seen = new Set()

    // Take top 200 most common ingredients
    const topIngredients = data.ingredients.slice(0, 200)

    for (const ing of topIngredients) {
        const name = ing.name || ing.id
        if (!name || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())

        // Determine category
        let category = 'other'
        const nameLower = name.toLowerCase()
        for (const [cat, keywords] of Object.entries(INGREDIENT_CATEGORY_MAP)) {
            if (keywords.some(kw => nameLower.includes(kw))) {
                category = cat
                break
            }
        }

        const isAllergen = ALLERGENS.some(a => nameLower.includes(a))

        const textForEmbedding = `${name} ${category} ${ing.description || ''}`
        const embedding = await generateEmbedding(textForEmbedding)

        ingredients.push({
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
            category,
            is_allergen: isAllergen,
            is_vegetarian: category !== 'meat' && category !== 'fish' && category !== 'seafood',
            is_vegan: !['meat', 'fish', 'seafood', 'dairy'].includes(category),
            origin: null,
            season: [],
            embedding: embedding ? JSON.stringify(embedding) : null,
        })

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Insert into Supabase
    console.log(`📝 Inserting ${ingredients.length} ingredients...`)
    const { data: inserted, error } = await supabase
        .from('ingredients')
        .upsert(ingredients, { onConflict: 'name' })
        .select()

    if (error) {
        console.error(`❌ Error inserting ingredients: ${error.message}`)
        return 0
    }

    console.log(`✅ Inserted/updated ${inserted.length} ingredients`)
    return inserted.length
}

// ─── Allergen/Dietary Restrictions Import ───────────────────────────────────

async function importAllergens() {
    console.log('\n' + '='.repeat(60))
    console.log('⚠️  Importing Allergens (as dietary restrictions)')
    console.log('='.repeat(60))

    // Create a tags table for allergens since dietary_restrictions may not exist
    // We'll use tags with category='dietary'
    const allergens = [
        { name: 'Gluten-Free', slug: 'gluten-free', category: 'dietary', description: 'No gluten-containing ingredients' },
        { name: 'Dairy-Free', slug: 'dairy-free', category: 'dietary', description: 'No dairy products' },
        { name: 'Nut-Free', slug: 'nut-free', category: 'dietary', description: 'No nuts or nut-derived ingredients' },
        { name: 'Egg-Free', slug: 'egg-free', category: 'dietary', description: 'No eggs or egg products' },
        { name: 'Soy-Free', slug: 'soy-free', category: 'dietary', description: 'No soy or soy-derived ingredients' },
        { name: 'Fish-Free', slug: 'fish-free', category: 'dietary', description: 'No fish or fish products' },
        { name: 'Shellfish-Free', slug: 'shellfish-free', category: 'dietary', description: 'No shellfish or crustaceans' },
        { name: 'Sesame-Free', slug: 'sesame-free', category: 'dietary', description: 'No sesame seeds or oil' },
    ]

    console.log(`📝 Inserting ${allergens.length} dietary tags...`)
    const { data, error } = await supabase
        .from('tags')
        .upsert(allergens, { onConflict: 'name' })
        .select()

    if (error) {
        console.error(`❌ Error inserting dietary tags: ${error.message}`)
        return 0
    }

    console.log(`✅ Inserted/updated ${data.length} dietary tags`)
    return data.length
}

// ─── Vibes Import ───────────────────────────────────────────────────────────

async function importVibes() {
    console.log('\n' + '='.repeat(60))
    console.log('✨ Importing Vibes')
    console.log('='.repeat(60))

    const vibes = [
        { name: 'Romantic', slug: 'romantic', category: 'atmosphere', description: 'Perfect for date nights', synonyms: ['intimate', 'candlelit'] },
        { name: 'Casual', slug: 'casual', category: 'atmosphere', description: 'Relaxed and informal', synonyms: ['laid-back', 'informal'] },
        { name: 'Fine Dining', slug: 'fine-dining', category: 'atmosphere', description: 'Upscale elegant experience', synonyms: ['elegant', 'upscale'] },
        { name: 'Family-Friendly', slug: 'family-friendly', category: 'atmosphere', description: 'Great for families with children', synonyms: ['kid-friendly', 'children welcome'] },
        { name: 'Cozy', slug: 'cozy', category: 'atmosphere', description: 'Warm and intimate atmosphere', synonyms: ['warm', 'intimate', 'comfortable'] },
        { name: 'Trendy', slug: 'trendy', category: 'atmosphere', description: 'Hip and modern', synonyms: ['modern', 'hip', 'fashionable'] },
        { name: 'Business', slug: 'business', category: 'occasion', description: 'Suitable for business meetings', synonyms: ['professional', 'meetings'] },
        { name: 'Late Night', slug: 'late-night', category: 'occasion', description: 'Open late for night owls', synonyms: ['open late', 'night'] },
        { name: 'Brunch', slug: 'brunch', category: 'occasion', description: 'Great brunch spot', synonyms: ['weekend', 'brunch'] },
        { name: 'Outdoor Seating', slug: 'outdoor', category: 'feature', description: 'Terrace or garden seating available', synonyms: ['terrace', 'patio', 'garden'] },
    ]

    console.log(`📝 Inserting ${vibes.length} vibes...`)
    const { data, error } = await supabase
        .from('vibes')
        .upsert(vibes, { onConflict: 'name' })
        .select()

    if (error) {
        console.error(`❌ Error inserting vibes: ${error.message}`)
        return 0
    }

    console.log(`✅ Inserted/updated ${data.length} vibes`)
    return data.length
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    console.log('🚀 Starting Open Food Facts Data Import')
    console.log(`📍 Supabase: ${supabaseUrl}`)
    console.log(`🤖 Embeddings: ${openRouterKey ? 'Enabled' : 'Disabled (no API key)'}`)

    const stats = {
        cuisines: 0,
        ingredients: 0,
        allergens: 0,
        vibes: 0,
    }

    try {
        // Import data
        stats.cuisines = await importCuisines()
        stats.ingredients = await importIngredients()
        stats.allergens = await importAllergens()
        stats.vibes = await importVibes()

        // Summary
        console.log('\n' + '='.repeat(60))
        console.log('📊 Import Summary')
        console.log('='.repeat(60))
        console.log(`   🍽️  Cuisines: ${stats.cuisines}`)
        console.log(`   🥗 Ingredients: ${stats.ingredients}`)
        console.log(`   ⚠️  Dietary Tags: ${stats.allergens}`)
        console.log(`   ✨ Vibes: ${stats.vibes}`)
        console.log('='.repeat(60))
        console.log('✅ Import complete!')

        // Next steps
        console.log('\n📝 Next steps:')
        console.log('   1. Run embedding generation for entities without embeddings:')
        console.log('      node scripts/generate-embeddings.js --type=kg')
        console.log('   2. Verify data in Supabase dashboard')
        console.log('   3. Test semantic search in admin panel')

    } catch (err) {
        console.error(`\n❌ Import failed: ${err.message}`)
        console.error(err.stack)
        process.exit(1)
    }
}

main()
