/**
 * Run all Supabase migrations in order.
 * Usage: node scripts/run-migrations.js
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

// Migration files in execution order
const MIGRATIONS = [
  '001_locations.sql',
  '002_seed_venues.sql',
  '003_profiles.sql',
  '20260331_payments_system.sql',
  '20260331_knowledge_graph_ontology.sql',
  '20260331_user_preferences_learning.sql',
  '20260331_auto_translation.sql',
];

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

async function run() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL\n');

  for (const file of MIGRATIONS) {
    const filePath = path.join(migrationsDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP: ${file} (not found)`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`RUN:  ${file} ...`);

    try {
      await client.query(sql);
      console.log(`  OK`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      // Continue with next migration (some may partially fail due to IF NOT EXISTS)
    }
  }

  // Verify tables
  const { rows } = await client.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `);
  console.log('\nTables created:');
  rows.forEach(r => console.log(`  - ${r.tablename}`));

  // Count locations
  try {
    const { rows: countRows } = await client.query('SELECT count(*) FROM public.locations');
    console.log(`\nLocations seeded: ${countRows[0].count}`);
  } catch (e) {
    console.log('Could not count locations:', e.message);
  }

  await client.end();
  console.log('\nDone!');
}

run().catch(err => {
  console.error('Fatal:', err);
  client.end().catch(() => {});
  process.exit(1);
});
