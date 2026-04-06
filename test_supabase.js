
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

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing Supabase connection...');
  console.log('URL:', supabaseUrl);
  
  const { data: cuisines, error: cError } = await supabase.from('cuisines').select('*').limit(5);
  if (cError) {
    console.error('Cuisines error:', cError);
  } else {
    console.log('Cuisines found:', (cuisines || []).length);
    if (cuisines?.[0]) console.log('First cuisine:', cuisines[0].name);
  }

  const { data: dishes, error: dError } = await supabase.from('dishes').select('*').limit(5);
  if (dError) {
    console.error('Dishes error:', dError);
  } else {
    console.log('Dishes found:', (dishes || []).length);
  }

  const { data: ingredients, error: iError } = await supabase.from('ingredients').select('*').limit(5);
  if (iError) {
    console.error('Ingredients error:', iError);
  } else {
    console.log('Ingredients found:', (ingredients || []).length);
  }
}

test();
