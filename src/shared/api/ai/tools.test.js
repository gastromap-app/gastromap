import { describe, it, expect } from 'vitest';
import { executeTool } from './tools.js';

describe('AI Tools', () => {
  it('should search for locations', async () => {
    console.log('Testing search_locations tool...');
    const results = await executeTool('search_locations', {
      query: 'Cafe in Krakow',
      city: 'Krakow'
    });
    
    console.log('Results count:', results?.length);
    if (results && results.length > 0) {
      console.log('First result:', JSON.stringify(results[0], null, 2));
      // Basic validation of fields
      const first = results[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('title');
      expect(first).toHaveProperty('cuisine');
      expect(first).toHaveProperty('rating');
    }
  });
});
