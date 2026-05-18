const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
    // Find user by email
    const { data: profiles } = await supabase.from('profiles').select('id, email').ilike('email', '%sainon2191%')
    
    if (!profiles || profiles.length === 0) {
        console.log('User not found by email. Listing all profiles...')
        const { data: all } = await supabase.from('profiles').select('id, email, full_name').limit(20)
        console.log(all?.map(p => `${p.id} | ${p.email} | ${p.full_name}`).join('\n'))
        return
    }

    const userId = profiles[0].id
    console.log('Found user:', userId, profiles[0].email)

    // Get sessions
    const { data: sessions } = await supabase.from('chat_sessions').select('id').eq('user_id', userId)
    console.log('Sessions:', sessions?.length || 0)

    if (sessions && sessions.length > 0) {
        const ids = sessions.map(s => s.id)
        
        // Delete messages (ON DELETE CASCADE should handle this, but be explicit)
        const r1 = await supabase.from('chat_messages').delete().in('session_id', ids)
        console.log('Messages:', r1.error ? r1.error.message : 'deleted')

        // Delete sessions
        const r2 = await supabase.from('chat_sessions').delete().eq('user_id', userId)
        console.log('Sessions:', r2.error ? r2.error.message : 'deleted')
    }

    console.log('\nDone! User should clear localStorage in browser too.')
}

main().catch(e => console.error(e))
