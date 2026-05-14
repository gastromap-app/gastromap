import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data } = await supabase
    .from('locations')
    .select('id, title, image_url, google_place_id, status')
    .in('status', ['active', 'approved', 'draft'])

const noPhoto = data.filter(l => !l.image_url || l.image_url.trim() === '')
const noPlaceId = noPhoto.filter(l => !l.google_place_id)
const hasPlaceId = noPhoto.filter(l => !!l.google_place_id)

console.log(`Total locations: ${data.length}`)
console.log(`Without photo: ${noPhoto.length}`)
console.log(`  - No google_place_id (can't fetch): ${noPlaceId.length}`)
console.log(`  - HAS google_place_id (should work): ${hasPlaceId.length}`)
console.log('')

if (noPlaceId.length > 0) {
    console.log('--- No place_id (need manual fix or text search): ---')
    noPlaceId.forEach(l => console.log(`  ${l.title} [${l.status}]`))
}
console.log('')
if (hasPlaceId.length > 0) {
    console.log('--- Has place_id but no photo (retry needed): ---')
    hasPlaceId.forEach(l => console.log(`  ${l.title} | ${l.google_place_id}`))
}
