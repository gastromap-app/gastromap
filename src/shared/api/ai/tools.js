import { semanticSearch } from './search.js'

/**
 * Tool_Executor — the single tool dispatcher.
 */
export async function executeTool(name, args, ctx = {}) {
  if (name !== 'search_locations') {
    return { error: `Unknown tool: ${name}` }
  }

  const { query, city, category, cuisine, limit } = args ?? {}
  const result = await semanticSearch({ query, city, category, cuisine, limit })

  if (!result.ok) {
    return { error: result.error }
  }

  // Side effect: record shown locations for session memory
  if (ctx?.sessionId && ctx?.userId && result.results.length) {
    import('./session-locations.js').then(({ recordSessionLocations }) => {
      recordSessionLocations(ctx.sessionId, result.results, ctx.userId).catch(() => {})
    }).catch(() => {})
  }

  return { results: result.results }
}
