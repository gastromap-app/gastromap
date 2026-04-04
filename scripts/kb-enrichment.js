import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ─── Setup ──────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

function loadEnv() {
    const envPath = path.join(rootDir, '.env')
    if (!fs.existsSync(envPath)) return {}
    const content = fs.readFileSync(envPath, 'utf-8')
    return content.split('\n').reduce((acc, line) => {
        const [key, ...val] = line.split('=')
        if (key && val.length > 0) acc[key.trim()] = val.join('=').trim().replace(/^"|"$/g, '')
        return acc
    }, {})
}

const env = loadEnv()
const AI_API_KEY = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || env.VITE_OPENROUTER_API_KEY
const AI_MODEL = 'openrouter/free'

if (!AI_API_KEY) {
    console.error('❌ Missing AI_API_KEY')
    process.exit(1)
}

// ─── AI Functions ─────────────────────────────────────────────────────────────

async function generateAIContent(location) {
    const textForAI = [
        location.title,
        location.description,
        location.address,
        location.city,
        location.cuisine_types?.join(', '),
        location.category
    ].filter(Boolean).join(', ')

    console.log(`🧠 Generating AI data for: ${location.title}...`)

    try {
        const kwResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [
                    { role: 'system', content: 'Generate 10-15 keywords. Return ONLY JSON array of strings.' },
                    { role: 'user', content: textForAI }
                ],
            }),
        })

        let keywords = []
        if (kwResponse.ok) {
            const kwData = await kwResponse.json()
            const content = kwData?.choices?.[0]?.message?.content || '[]'
            const match = content.match(/\[[\s\S]*\]/)
            if (match) keywords = JSON.parse(match[0])
        }

        const ctxResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [
                    { role: 'system', content: 'Write a 2-sentence expert summary focusing on uniqueness.' },
                    { role: 'user', content: textForAI }
                ],
            }),
        })

        let context = ''
        if (ctxResponse.ok) {
            const ctxData = await ctxResponse.json()
            context = ctxData.choices?.[0]?.message?.content || ''
        }

        const embResponse = await fetch('https://openrouter.ai/api/v1/embeddings', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openai/text-embedding-3-small',
                input: [location.title, location.description, ...keywords, context].filter(Boolean).join(' '),
                dimensions: 768,
            }),
        })

        let embedding = null
        if (embResponse.ok) {
            const embData = await embResponse.json()
            embedding = embData.data?.[0]?.embedding
        }

        return { keywords, context, embedding }
    } catch (err) {
        console.error(`❌ AI Error for ${location.title}:`, err.message)
        return null
    }
}

async function main() {
    // We expect input via command line or stdin? 
    // Actually, I'll fetch the data from the DB using another script and pass it?
    // No, I'll pass the locations as JSON string to this script.
    
    const locationsInputPath = path.join(rootDir, 'tmp', 'locations_to_enrich.json')
    if (!fs.existsSync(locationsInputPath)) {
      console.error('❌ Input file not found (tmp/locations_to_enrich.json)')
      process.exit(1)
    }
    
    const locations = JSON.parse(fs.readFileSync(locationsInputPath, 'utf8'))
    const enrichedLocations = []

    console.log(`📍 Enriching ${locations.length} locations...`)
    for (const loc of locations) {
        const result = await generateAIContent(loc)
        if (result) {
            enrichedLocations.push({ id: loc.id, ...result })
        }
        await new Promise(r => setTimeout(r, 500))
    }

    // Cuisines
    const cuisinesInputPath = path.join(rootDir, 'tmp', 'cuisines_to_enrich.json')
    const enrichedCuisines = []
    if (fs.existsSync(cuisinesInputPath)) {
        const cuisines = JSON.parse(fs.readFileSync(cuisinesInputPath, 'utf8'))
        console.log(`🍲 Embedding ${cuisines.length} cuisines...`)
        for (const c of cuisines) {
            const text = `${c.name} cuisine. Typical dishes: ${(c.typical_dishes || []).join(', ')}`
            const embResp = await fetch('https://openrouter.ai/api/v1/embeddings', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${AI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: text, dimensions: 768 })
            })
            if (embResp.ok) {
                const embData = await embResp.json()
                enrichedCuisines.push({ id: c.id, name: c.name, embedding: embData.data?.[0]?.embedding })
            }
            await new Promise(r => setTimeout(r, 200))
        }
    }

    const outputPath = path.join(rootDir, 'tmp', 'enrichment_results.json')
    fs.writeFileSync(outputPath, JSON.stringify({
      locations: enrichedLocations,
      cuisines: enrichedCuisines
    }, null, 2))
    
    console.log(`\n✨ Enrichment results saved to ${outputPath}`)
}

main().catch(console.error)
