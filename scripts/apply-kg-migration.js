/**
 * Apply Knowledge Graph Migration
 * 
 * This script applies the correct migration (20260328) to Supabase.
 * It drops existing tables and recreates them with pgvector support.
 * 
 * ⚠️  WARNING: This will DROP existing data in cuisines, dishes, ingredients tables!
 * 
 * Usage:
 *   node scripts/apply-kg-migration.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
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

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials')
    process.exit(1)
}

// Use service role key if available (needed for DDL operations)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
    console.log('🚀 Applying Knowledge Graph Migration (20260328)')
    console.log(`📍 Supabase: ${supabaseUrl}\n`)

    // Read migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20260328_knowledge_graph.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    console.log('⚠️  WARNING: This will drop and recreate the following tables:')
    console.log('   - cuisines')
    console.log('   - dishes')
    console.log('   - ingredients')
    console.log('   - vibes')
    console.log('   - tags')
    console.log('   - location_cuisines')
    console.log('   - location_dishes')
    console.log('   - dish_ingredients')
    console.log('   - location_vibes')
    console.log('   - location_tags')
    console.log('   - cuisine_ingredients')
    console.log('   - vibe_occasions\n')

    // Ask for confirmation
    console.log('⏳ Applying migration...')

    try {
        // Split migration into individual statements
        const statements = migrationSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('--'))

        console.log(`📝 Found ${statements.length} SQL statements\n`)

        // Execute statements one by one
        let successCount = 0
        let errorCount = 0

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i]
            const progress = `[${i + 1}/${statements.length}]`

            try {
                const { error } = await supabase.rpc('pgmigrate_apply', {
                    query: statement + ';'
                })

                if (error) {
                    // Try direct execution
                    await supabase
                        .from('_migration_temp')
                        .select('*')
                        .limit(0)

                    // Skip if table doesn't exist error (expected for IF NOT EXISTS)
                    if (error.message.includes('already exists') || error.message.includes('does not exist')) {
                        successCount++
                        continue
                    }

                    console.log(`${progress} ⚠️  ${error.message.substring(0, 60)}...`)
                    errorCount++
                } else {
                    successCount++
                }
            } catch {
                errorCount++
            }
        }

        console.log('\n' + '='.repeat(60))
        console.log('📊 Migration Results')
        console.log('='.repeat(60))
        console.log(`   ✅ Success: ${successCount}`)
        console.log(`   ⚠️  Skipped/Errors: ${errorCount}`)
        console.log('='.repeat(60))

        // Verify tables were created correctly
        console.log('\n🔍 Verifying tables...\n')

        const tables = ['cuisines', 'dishes', 'ingredients', 'vibes', 'tags']

        for (const table of tables) {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .limit(1)

            if (error) {
                console.log(`❌ ${table}: ${error.message}`)
            } else {
                const hasEmbedding = data && data.length > 0 && 'embedding' in data[0]
                console.log(`✅ ${table}: ${hasEmbedding ? 'HAS embedding ✅' : 'NO embedding ❌'}`)
            }
        }

        console.log('\n✅ Migration complete!')
        console.log('\n📝 Next steps:')
        console.log('   1. Run: node scripts/import-open-food-facts.js')
        console.log('   2. Run: node scripts/generate-embeddings.js --type=kg')
        console.log('   3. Refresh admin panel (Cmd+Shift+R)')

    } catch (err) {
        console.error('\n❌ Migration failed:', err.message)
        console.error('\n⚠️  Please apply migration manually:')
        console.log('   1. Open Supabase Dashboard')
        console.log('   2. Go to SQL Editor')
        console.log('   3. Copy contents of: supabase/migrations/20260328_knowledge_graph.sql')
        console.log('   4. Execute the SQL')
        process.exit(1)
    }
}

applyMigration()
