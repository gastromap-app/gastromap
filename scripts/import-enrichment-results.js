import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BATCH_SIZE = 50;

async function main() {
  const filePath = resolve(process.cwd(), 'tmp/enrichment_results.json');
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error('Failed to read enrichment_results.json:', err.message);
    process.exit(1);
  }

  // Actual structure: { "locations": [ { id, keywords, context, embedding } ] }
  const records = Array.isArray(data) ? data : (data.locations || data.results || []);
  console.log(`Loaded ${records.length} enrichment records`);

  let updated = 0, skipped = 0, errors = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    for (const record of batch) {
      if (!record.id) { skipped++; continue; }

      const updateData = {};
      if (record.keywords) updateData.ai_keywords = record.keywords;
      if (record.context) updateData.ai_context = record.context;
      if (record.embedding) updateData.embedding = record.embedding;

      if (Object.keys(updateData).length === 0) { skipped++; continue; }

      const { error } = await supabase
        .from('locations')
        .update(updateData)
        .eq('id', record.id);

      if (error) {
        console.warn(`Failed to update ${record.id}: ${error.message}`);
        errors++;
      } else {
        updated++;
      }
    }

    console.log(`Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} (updated: ${updated}, errors: ${errors}, skipped: ${skipped})`);
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch(console.error);
