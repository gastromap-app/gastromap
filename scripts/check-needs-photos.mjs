import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await supabase.from('locations').select('id, title, city, google_place_id, image_url, address').in('status', ['active', 'approved', 'draft'])
const needPhotos = data.filter(l => !l.image_url || !l.image_url.includes('r2.dev'))
console.log('Locations without R2 photos:', needPhotos.length)
console.log('')
const withId = needPhotos.filter(l => l.google_place_id)
const withoutId = needPhotos.filter(l => !l.google_place_id)
console.log('  With place_id (can fetch directly):', withId.length)
withId.forEach((l, i) => console.log('    ' + (i+1) + '. ' + l.title + ' (' + l.city + ')'))
console.log('')
console.log('  Without place_id (need text search):', withoutId.length)
withoutId.forEach((l, i) => console.log('    ' + (i+1) + '. ' + l.title + ' (' + (l.city || '?') + ') - ' + (l.address || 'no address')))
