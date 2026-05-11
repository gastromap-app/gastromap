const { Client } = require('pg');

const SPOONACULAR_KEY = '1b1558e8934f47daafb5a28ce844f9be';
const BASE_URL = 'https://api.spoonacular.com';

async function searchDish(name) {
  const url = `${BASE_URL}/recipes/complexSearch?query=${encodeURIComponent(name)}&number=1&addRecipeInformation=true&fillIngredients=true&apiKey=${SPOONACULAR_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 402) throw new Error('QUOTA_EXHAUSTED');
    return null;
  }
  const data = await res.json();
  const recipe = data.results?.[0];
  if (!recipe) return null;
  return {
    ingredients: (recipe.extendedIngredients || []).map(i => i.name).slice(0, 8),
    dietary_tags: [
      ...(recipe.vegetarian ? ['vegetarian'] : []),
      ...(recipe.vegan ? ['vegan'] : []),
      ...(recipe.glutenFree ? ['gluten-free'] : []),
      ...(recipe.dairyFree ? ['dairy-free'] : []),
    ],
    preparation_style: recipe.dishTypes?.[0] || null,
    serving_temp: recipe.dishTypes?.includes('soup') ? 'hot' : null,
  };
}

async function run() {
  const pw = require('child_process').execSync('npx supabase db dump --dry-run 2>&1').toString().match(/PGPASSWORD="([^"]+)"/)?.[1];
  const client = new Client({
    host: 'db.myyzguendoruefiiufop.supabase.co', port: 5432,
    user: 'cli_login_postgres', password: pw,
    database: 'postgres', ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  await client.query('SET ROLE postgres');

  // Get dishes that have empty or null ingredients
  const { rows } = await client.query(`
    SELECT id, name FROM dishes 
    WHERE ingredients IS NULL OR ingredients = '{}' OR array_length(ingredients, 1) IS NULL
    ORDER BY name
    LIMIT 150
  `);

  console.log(`${rows.length} dishes need ingredients enrichment`);
  if (rows.length === 0) { await client.end(); return; }

  let enriched = 0, failed = 0, quota = false;

  for (const dish of rows) {
    if (quota) break;

    try {
      const data = await searchDish(dish.name);
      if (!data || data.ingredients.length === 0) {
        failed++;
        console.log(`  SKIP ${dish.name} (no results)`);
      } else {
        const updates = [];
        const values = [];
        let idx = 1;

        if (data.ingredients.length > 0) {
          updates.push(`ingredients = $${idx}`);
          values.push(data.ingredients);
          idx++;
        }
        if (data.dietary_tags.length > 0) {
          updates.push(`dietary_tags = $${idx}`);
          values.push(data.dietary_tags);
          idx++;
        }
        if (data.preparation_style) {
          updates.push(`preparation_style = $${idx}`);
          values.push(data.preparation_style);
          idx++;
        }

        values.push(dish.id);
        await client.query(
          `UPDATE dishes SET ${updates.join(', ')} WHERE id = $${idx}`,
          values
        );
        enriched++;
        if (enriched % 5 === 0) console.log(`  Enriched ${enriched}/${rows.length}...`);
      }
    } catch (err) {
      if (err.message === 'QUOTA_EXHAUSTED') {
        console.error('\n⚠️  Spoonacular quota exhausted! Stopping.');
        quota = true;
      } else {
        console.error(`  ERR ${dish.name}: ${err.message}`);
        failed++;
      }
    }

    // 1.5s pause between requests (free tier: ~1 req/sec)
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\nDone: ${enriched} enriched, ${failed} failed${quota ? ' (quota hit)' : ''}`);
  await client.end();
}

run();
