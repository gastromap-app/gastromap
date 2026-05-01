import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let supabaseUrl = '';
let supabaseAnonKey = '';

try {
  const env = fs.readFileSync('.env', 'utf8');
  supabaseUrl = (env.match(/VITE_SUPABASE_URL=([^\n]*)/)?.[1] || '').trim();
  supabaseAnonKey = (env.match(/VITE_SUPABASE_ANON_KEY=([^\n]*)/)?.[1] || '').trim();
} catch (e) {
  console.error('Cant read .env:', e.message);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testMinimalSubmission() {
    console.log('Testing minimal submission to user_submissions...');
    
    // Using only fields confirmed in 20260331_user_preferences_learning.sql
    const payload = {
        title: 'Minimal Test Place',
        description: 'Testing if basic submission works',
        address: 'Test Street 1',
        city: 'Test City',
        category: 'restaurant',
        price_level: 2,
        images: ['https://example.com/photo.jpg'],
        must_try: ['Test Dish'],
        status: 'pending'
    };

    const { data, error } = await supabase
        .from('user_submissions')
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error('❌ Minimal submission failed:', error.message);
        if (error.details) console.error('Details:', error.details);
    } else {
        console.log('✅ Minimal submission successful!', data.id);
    }
}

testMinimalSubmission();
