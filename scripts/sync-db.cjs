/**
 * Run ALL Supabase migrations in order.
 * Usage: node scripts/sync-db.cjs
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'db.myyzguendoruefiiufop.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'hf/w_8EAp8SHW8!',
  ssl: { rejectUnauthorized: false }
});

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

// Get all .sql files in order
const MIGRATION_FILES = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

async function run() {
  console.log('Connecting to Supabase PostgreSQL...');
  await client.connect();
  console.log('Connected!\n');

  for (const file of MIGRATION_FILES) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`RUNNING: ${file} ...`);
    
    try {
      // Split the script by semicolon to run statements separately (optional, but safer for RLS)
      // Actually, pg client can handle multiple statements if they don't contain DO blocks or similar?
      // Standard approach is to run the whole file.
      await client.query(sql);
      console.log(`  SUCCESS: ${file}`);
    } catch (err) {
      console.error(`  ERROR in ${file}: ${err.message}`);
      // Continue with next migration as some may fail due to already existing objects
    }
  }

  // Final check: table list
  console.log('\n--- SYSTEM CHECK ---\n');
  
  const { rows: tables } = await client.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `);
  console.log('Available tables:');
  tables.forEach(t => console.log(`  - ${t.tablename}`));

  const { rows: functions } = await client.query(`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name IN ('get_location_stats', 'get_user_stats', 'get_engagement_stats', 'get_payment_stats')
  `);
  console.log('\nAvailable RPC functions:');
  functions.forEach(f => console.log(`  - ${f.routine_name}`));

  await client.end();
  console.log('\nDB Sync Complete!');
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
