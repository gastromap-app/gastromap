
import { config } from './src/shared/config/env.js';

console.log('Supabase Config:');
console.log('URL:', config.supabase.url);
console.log('Is Configured:', config.supabase.isConfigured);

if (config.supabase.isConfigured) {
    console.log('PASS: Configuration matches .env');
} else {
    console.log('FAIL: Configuration missing or invalid');
}
