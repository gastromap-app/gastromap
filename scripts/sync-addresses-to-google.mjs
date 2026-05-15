import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Skip these 6 locations (already manually verified)
const SKIP_TITLES = [
    'Kawiarnia Literacka',
    'Restauracja Nolio',
    'Hala Mirowska',
    'Dawne Smaki',
    'Noworolski',
    'Przystanek Gdańsk',
]

async function run() {
    const { data: locations, error } = await supabase.from('locations')
        .select('id, title, address, google_formatted_address, city')
        .not('google_formatted_address', 'is', null)
        .in('status', ['approved', 'active'])

    if (error) { console.error('Query error:', error.message); return }
    console.log(`Total with google_formatted_address: ${locations.length}`)

    let fixed = 0

    for (const loc of locations) {
        if (SKIP_TITLES.some(t => loc.title.startsWith(t))) continue

        const dbAddr = (loc.address || '').trim()
        const googleAddr = (loc.google_formatted_address || '').trim()

        if (!googleAddr || dbAddr === googleAddr) continue

        // Normalize for comparison
        const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
        if (norm(dbAddr) === norm(googleAddr)) continue

        // Update to Google address
        const { error: updateErr } = await supabase.from('locations')
            .update({ address: googleAddr })
            .eq('id', loc.id)

        if (updateErr) {
            console.log(`  ERROR ${loc.title}: ${updateErr.message}`)
        } else {
            console.log(`✅ ${loc.title}`)
            console.log(`   Old: ${dbAddr}`)
            console.log(`   New: ${googleAddr}`)
            fixed++
        }
    }

    console.log(`\nDone. Updated: ${fixed} locations`)
}

run()
