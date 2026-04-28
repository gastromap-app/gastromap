import 'dotenv/config';
import { aiTools } from '../src/shared/api/ai/tools.js';

async function testSearch() {
  console.log('Testing search_locations tool...');
  try {
    const results = await aiTools.search_locations.execute({
      query: 'Italian restaurant in London',
      city: 'London'
    });
    console.log('Results:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Search failed:', error);
  }
}

testSearch();
