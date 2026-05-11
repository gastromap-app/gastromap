import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const url = new URL(req.url)
    const placeId = url.searchParams.get('place_id')
    const maxWidth = url.searchParams.get('width') || '800'
    const mode = url.searchParams.get('mode') // 'json' or 'image' (default)

    if (!placeId) {
      return new Response(
        JSON.stringify({ error: 'place_id is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    if (!GOOGLE_API_KEY) {
      console.error('[get-google-photo] ❌ Missing GOOGLE_PLACES_API_KEY')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[get-google-photo] 🔍 Resolving photos for Place ID: ${placeId}, mode: ${mode || 'image'}`)

    // 1. Get Place Details to find photo references
    // If photo_reference is provided, we skip details fetch
    const photoReferenceParam = url.searchParams.get('photo_reference')
    let photos = []

    if (!photoReferenceParam) {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_API_KEY}`
      const detailsRes = await fetch(detailsUrl)
      const details = await detailsRes.json()

      if (details.status !== 'OK' || !details.result?.photos?.length) {
        console.warn(`[get-google-photo] ⚠️ No photos found for ${placeId}. Status: ${details.status}`)
        return new Response(
          JSON.stringify({ error: 'No photos available', status: details.status }),
          { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        )
      }
      photos = details.result.photos
    }

    // MODE: JSON - Returns a list of stable CDN URLs and their references
    if (mode === 'json') {
      console.log(`[get-google-photo] 📋 Extracting CDN URLs for ${photos.length} photos`)
      
      // We'll try to resolve the first 10 photos to their final CDN URLs
      const photoData = await Promise.all(
        photos.slice(0, 10).map(async (p: any) => {
          const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${p.photo_reference}&key=${GOOGLE_API_KEY}`
          
          // Google Photo API redirects to a stable lh3.googleusercontent.com URL
          const res = await fetch(photoUrl, { method: 'HEAD', redirect: 'follow' })
          return {
            url: res.url,
            photo_reference: p.photo_reference
          }
        })
      )

      return new Response(
        JSON.stringify({ photos: photoData }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // MODE: IMAGE (default) - Return binary data
    const photoReference = photoReferenceParam || photos[0].photo_reference
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`
    
    console.log(`[get-google-photo] 📸 Fetching photo: ${photoReference.substring(0, 20)}...`)
    const imageRes = await fetch(photoUrl)

    if (!imageRes.ok) {
      throw new Error(`Google Photo API returned ${imageRes.status}`)
    }

    const imageHeaders = new Headers(CORS_HEADERS)
    imageHeaders.set('Content-Type', imageRes.headers.get('Content-Type') || 'image/jpeg')
    imageHeaders.set('Cache-Control', 'public, max-age=86400, s-maxage=86400')

    return new Response(imageRes.body, {
      status: 200,
      headers: imageHeaders,
    })

  } catch (err) {
    console.error('[get-google-photo] ❌ Error:', err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
