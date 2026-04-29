import { describe, it, expect, vi } from 'vitest';
import { executeTool } from './tools.js';
import * as kgApi from '../knowledge-graph.api.js';

// Mock the KG API
vi.mock('../knowledge-graph.api.js', async () => {
  const actual = await vi.importActual('../knowledge-graph.api.js');
  return {
    ...actual,
    getAIContextForQuery: vi.fn(),
  };
});

describe('KG Search Extension (TDD)', () => {
  it('search_locations should return culinaryContext when KG has data', async () => {
    // 1. Setup mock data
    const mockContext = {
      relevantCuisines: [{ name: 'Thai', typical_dishes: ['Tom Yum'] }],
      contextNote: 'Thai cuisine detected'
    };
    vi.mocked(kgApi.getAIContextForQuery).mockResolvedValue(mockContext);

    // 2. Execute tool
    const result = await executeTool('search_locations', {
      query: 'Tom Yum in Krakow',
      city: 'Krakow'
    });

    // 3. Verify (Expectation for the NEW behavior)
    // We expect it to return an object with results AND culinaryContext
    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('culinaryContext');
    expect(result.culinaryContext).toEqual(mockContext);
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('search_locations should maintain backward compatibility if KG fails', async () => {
    // 1. Setup mock to fail/return null
    vi.mocked(kgApi.getAIContextForQuery).mockResolvedValue(null);

    // 2. Execute tool
    const result = await executeTool('search_locations', {
      query: 'Pizza',
      city: 'Krakow'
    });

    // 3. Verify
    // Even if KG fails, it should still return the results object
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });
});
