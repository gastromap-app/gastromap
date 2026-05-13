import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data, error } = await supabase
    .from('locations')
    .select('id, title, image_url, photos')
    .in('status', ['active', 'approved'])

if (error) { console.error(error); process.exit(1) }

let withR2 = 0, withGoogle = 0, withUnsplash = 0, withNoPhoto = 0, withOther = 0
let totalR2Photos = 0, totalGooglePhotos = 0

data.forEach(loc => {
    const mainUrl = loc.image_url || ''
    const photos = loc.photos || []

    if (mainUrl.includes('r2.dev')) {
        withR2++
        totalR2Photos++
    } else if (mainUrl.includes('googleusercontent.com') || mainUrl.includes('googleapis.com')) {
        withGoogle++
        totalGooglePhotos++
    } else if (mainUrl.includes('unsplash.com')) {
        withUnsplash++
    } else if (!mainUrl) {
        withNoPhoto++
    } else {
        withOther++
    }

    photos.forEach(p => {
        if (p && p.includes('r2.dev')) totalR2Photos++
        else if (p && (p.includes('googleusercontent.com') || p.includes('googleapis.com'))) totalGooglePhotos++
    })
})

console.log('Total active locations:', data.length)
console.log('')
console.log('By image_url source:')
console.log('  R2 (migrated):    ', withR2)
console.log('  Google CDN (old): ', withGoogle)
console.log('  Unsplash:         ', withUnsplash)
console.log('  No photo:         ', withNoPhoto)
console.log('  Other:            ', withOther)
console.log('')
console.log('Total R2 photos (main + gallery):', totalR2Photos)
console.log('Total Google photos still remaining:', totalGooglePhotos)
