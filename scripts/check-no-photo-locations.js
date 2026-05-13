import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data, error } = await supabase
    .from('locations')
    .select('id, title, image_url, google_place_id, city')
    .in('status', ['active', 'approved'])

if (error) { console.error(error); process.exit(1) }

const noPhoto = data.filter(loc => !loc.image_url || loc.image_url.trim() === '')
const withPlaceId = noPhoto.filter(loc => loc.google_place_id)
const withoutPlaceId = noPhoto.filter(loc => !loc.google_place_id)

console.log(`Locations without photos: ${noPhoto.length}`)
console.log(`  With google_place_id: ${withPlaceId.length}`)
console.log(`  Without google_place_id: ${withoutPlaceId.length}`)
console.log('')
console.log('Without place_id (cannot fetch photos):')
withoutPlaceId.slice(0, 10).forEach(loc => console.log(`  - ${loc.title} (${loc.city})`))
if (withoutPlaceId.length > 10) console.log(`  ... and ${withoutPlaceId.length - 10} more`)
