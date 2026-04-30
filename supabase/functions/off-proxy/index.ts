import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { search_terms, page_size = 5 } = await req.json()

    if (!search_terms) {
      return new Response(
        JSON.stringify({ error: 'search_terms is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(search_terms)}&json=1&page_size=${page_size}`
    
    console.log(`[off-proxy] 🛰️ Fetching from OFF: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GastroMap/2.0 (contact@gastromap.app)'
      }
    })

    if (!response.ok) {
      console.warn(`[off-proxy] ⚠️ OFF returned ${response.status}`)
      
      // If OFF is down (503), return a graceful 200 with empty data instead of breaking the chain
      if (response.status === 503 || response.status === 502 || response.status === 504) {
        return new Response(
          JSON.stringify({ products: [], source: 'OpenFoodFacts', note: 'OFF Service Unavailable' }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        )
      }

      const errorText = await response.text()
      return new Response(
        JSON.stringify({ error: 'OpenFoodFacts API error', detail: errorText, status: response.status }),
        { status: response.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[off-proxy] ❌ Fatal Error:', err.message)
    // Always return CORS headers even on fatal errors
    return new Response(
      JSON.stringify({ error: err.message, products: [] }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
