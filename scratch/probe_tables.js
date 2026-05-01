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

async function listTables() {
    console.log('Listing tables using a common table check...');
    
    // We can't list all tables directly via anon key usually,
    // but we can try to select from information_schema if allowed, 
    // or just probe common names.
    
    const tables = ['profiles', 'user_profiles', 'users', 'user_roles', 'user_submissions', 'locations'];
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`❌ ${table}: ${error.message}`);
        } else {
            console.log(`✅ ${table}: Found (${data.length} rows)`);
        }
    }
}

listTables();
