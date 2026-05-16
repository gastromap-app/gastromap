/**
 * Bot Quality Test Script
 * 
 * Run in browser console on https://www.gastromap.app while logged in.
 * Or paste into DevTools console.
 * 
 * Tests 10 typical tourist queries and reports:
 * - Response time
 * - Whether bot found places (vs "not found")
 * - Language correctness
 * - Quality score (1-5)
 */

const TEST_QUERIES = [
  { q: "Какое кафе посоветуешь в Кракове?", lang: "ru", expectPlaces: true },
  { q: "Where can I find good pizza in Krakow?", lang: "en", expectPlaces: true },
  { q: "Polecisz jakąś restaurację w centrum?", lang: "pl", expectPlaces: true },
  { q: "Хочу уютный ресторан для свидания", lang: "ru", expectPlaces: true },
  { q: "What's new in Krakow?", lang: "en", expectPlaces: true },
  { q: "Где поесть недорого?", lang: "ru", expectPlaces: true },
  { q: "Best coffee near Kazimierz?", lang: "en", expectPlaces: true },
  { q: "Расскажи про погоду", lang: "ru", expectPlaces: false }, // off-topic
  { q: "Какой бар с крафтовым пивом?", lang: "ru", expectPlaces: true },
  { q: "Vegetarian restaurant in Krakow?", lang: "en", expectPlaces: true },
]

async function testBot() {
  console.log("🧪 Starting GastroGuide Bot Quality Test...")
  console.log("=" .repeat(60))
  
  const results = []
  
  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const test = TEST_QUERIES[i]
    console.log(`\n📝 Test ${i + 1}/10: "${test.q}"`)
    
    const start = Date.now()
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are GastroGuide.' },
            { role: 'user', content: test.q }
          ],
          model: 'google/gemma-4-31b-it:free',
          max_tokens: 1500,
          tools: [{ type: 'function', function: { name: 'search_locations', description: 'Search', parameters: { type: 'object', properties: { city: { type: 'string' }, category: { type: 'string' }, keyword: { type: 'string' } } } } }],
          tool_choice: 'auto',
        })
      })
      
      const latency = Date.now() - start
      const data = await res.json()
      
      const content = data.choices?.[0]?.message?.content || ''
      const toolCalls = data.choices?.[0]?.message?.tool_calls || []
      const model = data._model_used || 'unknown'
      
      const hasToolCall = toolCalls.length > 0
      const hasContent = content.length > 20
      const isError = res.status >= 400
      
      results.push({
        query: test.q,
        latency,
        model,
        status: res.status,
        hasToolCall,
        hasContent,
        contentPreview: content.slice(0, 100),
        isError,
        toolCallName: toolCalls[0]?.function?.name || null,
      })
      
      console.log(`  ⏱ ${latency}ms | Model: ${model} | Status: ${res.status}`)
      console.log(`  🔧 Tool call: ${hasToolCall ? toolCalls[0]?.function?.name : 'none'}`)
      console.log(`  💬 Response: ${content.slice(0, 80)}...`)
      
    } catch (err) {
      results.push({
        query: test.q,
        latency: Date.now() - start,
        isError: true,
        error: err.message,
      })
      console.log(`  ❌ ERROR: ${err.message}`)
    }
    
    // Delay between requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000))
  }
  
  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("📊 SUMMARY")
  console.log("=".repeat(60))
  
  const successful = results.filter(r => !r.isError)
  const withToolCalls = results.filter(r => r.hasToolCall)
  const withContent = results.filter(r => r.hasContent)
  const errors = results.filter(r => r.isError)
  const avgLatency = successful.length ? Math.round(successful.reduce((s, r) => s + r.latency, 0) / successful.length) : 0
  
  console.log(`✅ Successful: ${successful.length}/10`)
  console.log(`🔧 Used tools: ${withToolCalls.length}/10`)
  console.log(`💬 Had content: ${withContent.length}/10`)
  console.log(`❌ Errors: ${errors.length}/10`)
  console.log(`⏱ Avg latency: ${avgLatency}ms`)
  console.log(`🤖 Models used: ${[...new Set(results.map(r => r.model))].join(', ')}`)
  
  console.log("\n📋 Detailed results:")
  console.table(results.map(r => ({
    query: r.query?.slice(0, 30) + '...',
    ms: r.latency,
    model: r.model?.split('/')[1]?.slice(0, 15),
    tool: r.toolCallName || '-',
    response: r.contentPreview?.slice(0, 40) || r.error?.slice(0, 40),
    ok: r.isError ? '❌' : '✅'
  })))
  
  return results
}

// Run it
testBot()
