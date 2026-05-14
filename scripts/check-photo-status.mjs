import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data } = await supabase.from('locations').select('id, image_url').in('status', ['active','approved'])
const r2 = data.filter(l => l.image_url?.includes('r2.dev'))
const noPhoto = data.filter(l => !l.image_url || l.image_url.trim() === '')
const google = data.filter(l => l.image_url?.includes('googleapis.com') || l.image_url?.includes('googleusercontent.com'))
const unsplash = data.filter(l => l.image_url?.includes('unsplash.com'))
const other = data.length - r2.length - noPhoto.length - google.length - unsplash.length

console.log('Total active locations:', data.length)
console.log('✅ R2 photos:', r2.length)
console.log('❌ No photo:', noPhoto.length)
console.log('⚠️  Google CDN (temp):', google.length)
console.log('📷 Unsplash:', unsplash.length)
console.log('🔗 Other:', other)
