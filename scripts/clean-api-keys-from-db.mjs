/**
 * Remove Google API key from all photo URLs in the database.
 * Clears google_photos and image_url fields that contain googleapis.com URLs with API key.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
    // Find all locations with Google API URLs in image_url or google_photos
    const { data, error } = await supabase
        .from('locations')
        .select('id, title, image_url, google_photos')

    if (error) { console.error('❌', error.message); process.exit(1) }

    let cleaned = 0

    for (const loc of data) {
        const updates = {}

        // Check image_url
        if (loc.image_url && loc.image_url.includes('googleapis.com')) {
            updates.image_url = null
        }

        // Check google_photos array
        if (Array.isArray(loc.google_photos) && loc.google_photos.length > 0) {
            const hasApiKey = loc.google_photos.some(url => 
                url && (url.includes('googleapis.com') || url.includes('key='))
            )
            if (hasApiKey) {
                // Keep only R2 URLs, remove Google API URLs
                const safe = loc.google_photos.filter(url => 
                    url && !url.includes('googleapis.com') && !url.includes('key=')
                )
                updates.google_photos = safe.length > 0 ? safe : []
            }
        }

        if (Object.keys(updates).length > 0) {
            const { error: upErr } = await supabase.from('locations').update(updates).eq('id', loc.id)
            if (upErr) {
                console.error(`❌ ${loc.title}: ${upErr.message}`)
            } else {
                console.log(`🧹 ${loc.title} — cleaned`)
                cleaned++
            }
        }
    }

    console.log(`\n✅ Done. Cleaned ${cleaned} locations.`)
}

main().catch(err => { console.error('💥', err); process.exit(1) })
