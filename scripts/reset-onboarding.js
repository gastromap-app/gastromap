#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// reset-onboarding.js  —  Reset onboarding for all users via Supabase
// Run: node scripts/reset-onboarding.js
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing env vars: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
    console.error('   For local dev: npx supabase status  →  copy service_role key')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
    console.log('🔄 Resetting onboarding status for all users...\n')

    // 1. Reset profiles table
    const { error: pErr } = await supabase
        .from('profiles')
        .update({ onboarding_completed: false })
        .eq('onboarding_completed', true)

    if (pErr) {
        console.error('❌ profiles update failed:', pErr.message)
    } else {
        console.log('✅ profiles.onboarding_completed reset')
    }

    // 2. Reset user_preferences table
    const { error: upErr } = await supabase
        .from('user_preferences')
        .update({ onboarding_completed: false })
        .eq('onboarding_completed', true)

    if (upErr) {
        console.error('❌ user_preferences update failed:', upErr.message)
    } else {
        console.log('✅ user_preferences.onboarding_completed reset')
    }

    console.log('\n🎉 Done! All users will see onboarding on next app open.')
    console.log('   (LocalStorage cache will auto-refresh from Supabase on app load)')
}

main().catch(console.error)
