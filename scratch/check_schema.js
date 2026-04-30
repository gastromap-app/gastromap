
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkSchema() {
  console.log(`Connecting to: ${supabaseUrl}`)
  
  // Try to fetch one row from locations to see columns
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error fetching locations:', error)
    return
  }

  if (data && data.length > 0) {
    console.log('Successfully fetched a location row. Columns:')
    console.log(Object.keys(data[0]).sort().join(', '))
    console.log('\nSample data:', JSON.stringify(data[0], null, 2))
  } else {
    console.log('Locations table is empty, trying to get column names via RPC or information_schema (if possible)')
    // Since we are using anon key, we might not have access to information_schema directly via PostgREST
    // but we can try a trick by selecting a non-existent column to see the error message which often lists columns
    const { error: schemaError } = await supabase
      .from('locations')
      .select('non_existent_column_for_schema_discovery')
    
    if (schemaError) {
      console.log('\nColumn discovery error (useful for info):', schemaError.message)
    }
  }
}

checkSchema()
