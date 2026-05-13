import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Find Relaks
const { data: loc } = await supabase
    .from('locations')
    .select('id, title, status')
    .eq('title', 'Relaks')
    .single()

if (!loc) { console.log('Relaks not found'); process.exit(0) }
console.log('Found:', loc.title, loc.id, 'status:', loc.status)

// Check related records
const tables = ['user_favorites', 'user_visits', 'reviews', 'location_cuisines', 'location_dishes', 'location_translations']
for (const table of tables) {
    try {
        const { count } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('location_id', loc.id)
        if (count > 0) console.log('  Related in', table + ':', count)
    } catch (e) {
        // table might not exist
    }
}

// Now test delete with service_role (bypasses RLS)
console.log('')
console.log('Testing delete with service_role key...')
const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', loc.id)

if (error) {
    console.log('DELETE FAILED:', error.message)
    console.log('  code:', error.code)
    console.log('  details:', error.details)
} else {
    console.log('DELETE SUCCESS')
    // Verify it is gone
    const { data: check } = await supabase
        .from('locations')
        .select('id')
        .eq('id', loc.id)
        .single()
    console.log('Verification - still exists?', check ? 'YES (problem!)' : 'NO (deleted)')
}
