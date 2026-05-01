/**
 * Apply a specific migration using direct PG connection.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'myyzguendoruefiiufop.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'hf/w_8EAp8SHW8!',
  ssl: { rejectUnauthorized: false }
});

const file = '20260504_user_location_history.sql';
const filePath = path.join(__dirname, '..', 'supabase', 'migrations', file);

async function run() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL\n');

  if (!fs.existsSync(filePath)) {
    console.error(`FATAL: ${file} not found at ${filePath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`RUNNING: ${file} ...`);

  try {
    // We run it as one block. 
    // Since it has CREATE OR REPLACE, it should be fine to run multiple times if needed,
    // but the table creation has IF NOT EXISTS.
    await client.query(sql);
    console.log(`✅ SUCCESS: Migration applied.`);
  } catch (err) {
    console.error(`❌ ERROR: ${err.message}`);
    if (err.detail) console.error(`   Detail: ${err.detail}`);
    if (err.where) console.error(`   Where: ${err.where}`);
  }

  await client.end();
  console.log('\nDone!');
}

run().catch(err => {
  console.error('Fatal:', err);
  client.end().catch(() => {});
  process.exit(1);
});
