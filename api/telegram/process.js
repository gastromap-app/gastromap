/**
 * Vercel Serverless — Location Research & Create Pipeline
 * 
 * Pipeline:
 *  1. Google Places API  → базовые данные
 *  2. Apify Google Maps  → расширенные данные (отзывы, блюда, фото)
 *  3. Brave Search       → отзывы, статьи, атмосфера (параллельно)
 *  4. LLM Synthesis      → все поля карточки (OpenRouter)
 *  5. Supabase insert    → service_role (bypass RLS), статус draft
 *  6. Telegram response  → полная карточка
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { applyRateLimit } from '../_shared/rate-limit.js'
import { formatOpeningHours } from '../../src/utils/formatOpeningHours.js'
import { normalizeCityName, normalizeCountryName } from '../../src/utils/normalizeCityName.js'

// Polyfill AbortSignal.timeout for older Node.js
if (!AbortSignal.timeout) {
    AbortSignal.timeout = (ms) => {
        const controller = new AbortController()
        setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms)
        return controller.signal
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

// ── R2 Upload Helper ─────────────────────────────────────────────────────────
const r2Client = (process.env.R2_ACCESS_KEY_ID && process.env.R2_ENDPOINT)
    ? new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
    })
    : null

/**
 * Download a photo from a URL and upload it to R2.
 * Returns the R2 public URL, or null on failure.
 */
async function downloadAndUploadToR2(photoUrl, locationId, index) {
    if (!r2Client || !process.env.R2_BUCKET_NAME || !process.env.R2_PUBLIC_URL) return null
    try {
        const res = await fetch(photoUrl, { redirect: 'follow', signal: AbortSignal.timeout(10000) })
        if (!res.ok) return null
        const buffer = Buffer.from(await res.arrayBuffer())
        if (buffer.length < 1000) return null // too small, likely error page

        const key = `locations/${locationId}/${index === 0 ? 'main' : index - 1}.webp`

        // Import sharp dynamically (heavy module, only load when needed)
        const sharp = (await import('sharp')).default
        const webpBuffer = await sharp(buffer)
            .resize(1200, null, { withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer()

        await r2Client.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: webpBuffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
        }))

        return `${process.env.R2_PUBLIC_URL}/${key}`
    } catch (err) {
        console.warn(`[process] R2 upload failed for photo ${index}:`, err.message)
        return null
    }
}

// ── Step 0: Normalize query to English ──────────────────────────────────────
async function normalizeQueryToEnglish(query, apiKey) {
    if (!apiKey) return query
    // Если запрос уже на английском — не тратим токены
    const hasNonLatin = /[а-яёА-ЯЁіїєґ]/u.test(query)
    if (!hasNonLatin) return query

    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://gastromap-five.vercel.app',
                'X-Title': 'GastroMap Bot',
            },
            body: JSON.stringify({
                model: 'google/gemma-3-27b-it:free',
                messages: [{
                    role: 'user',
                    content: `Translate this restaurant/cafe search query to English. Return ONLY the translated query, nothing else:\n\n${query}`
                }],
                max_tokens: 100,
                temperature: 0,
            }),
        })
        const data = await res.json()
        const translated = data.choices?.[0]?.message?.content?.trim()
        if (translated) {
            console.log(`[process] Query normalized: "${query}" → "${translated}"`)
            return translated
        }
    } catch (err) {
        console.warn('[process] Query normalization failed:', err.message)
    }
    return query
}

// ── Auto-translate after insert ──────────────────────────────────────────────
async function triggerAutoTranslation(locationId, locationData, apiKey) {
    if (!apiKey) return
    const SUPPORTED_LANGS = ['pl', 'uk', 'ru']
    const TRANSLATABLE_FIELDS = ['title', 'description', 'insider_tip', 'what_to_try']

    const langPromises = SUPPORTED_LANGS.map(async (lang) => {
        try {
            const translated = {}
            for (const field of TRANSLATABLE_FIELDS) {
                const val = locationData[field]
                if (!val) continue
                if (Array.isArray(val)) {
                    const joined = val.join(' | ')
                    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: 'google/gemma-3-27b-it:free',
                            messages: [{ role: 'user', content: `Translate to ${lang === 'pl' ? 'Polish' : lang === 'uk' ? 'Ukrainian' : 'Russian'}. Return ONLY the translation, preserve | separators:\n\n${joined}` }],
                            max_tokens: 300,
                            temperature: 0,
                        }),
                    })
                    const data = await res.json()
                    const t = data.choices?.[0]?.message?.content?.trim()
                    if (t) translated[field] = t.split(' | ').map(s => s.trim())
                } else {
                    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: 'google/gemma-3-27b-it:free',
                            messages: [{ role: 'user', content: `Translate to ${lang === 'pl' ? 'Polish' : lang === 'uk' ? 'Ukrainian' : 'Russian'}. Return ONLY the translation:\n\n${val}` }],
                            max_tokens: 400,
                            temperature: 0,
                        }),
                    })
                    const data = await res.json()
                    const t = data.choices?.[0]?.message?.content?.trim()
                    if (t) translated[field] = t
                }
            }
            console.log(`[process] Translation done: ${lang}`)
            return [lang, translated]
        } catch (err) {
            console.warn(`[process] Translation ${lang} failed:`, err.message)
            return [lang, {}]
        }
    })

    const results = await Promise.all(langPromises)
    const translations = Object.fromEntries(results)

    // EN — оригинал
    translations['en'] = Object.fromEntries(
        TRANSLATABLE_FIELDS
            .filter(f => locationData[f])
            .map(f => [f, locationData[f]])
    )

    // Сохраняем в location_translations
    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL
        if (!supabaseUrl) {
            console.error('[process] VITE_SUPABASE_URL not configured for translations')
            return
        }
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(supabaseUrl, serviceKey)

        const { error } = await supabase
            .from('location_translations')
            .upsert({ location_id: locationId, translations }, { onConflict: 'location_id' })

        if (error) console.warn('[process] Save translations error:', error.message)
        else console.log('[process] Translations saved for', locationId)
    } catch (err) {
        console.warn('[process] Save translations exception:', err.message)
    }
}



const TELEGRAM_API = 'https://api.telegram.org'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const APIFY_API = 'https://api.apify.com/v2'

// ── Telegram helper ──────────────────────────────────────────────────────────
async function sendMessage(token, chatId, text) {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
}

// ── Step 1: Google Places API ────────────────────────────────────────────────
async function searchGooglePlaces(query) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) { console.warn('[process] No GOOGLE_PLACES_API_KEY'); return null }

    try {
        const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place'

        const searchUrl = new URL(`${PLACES_BASE}/textsearch/json`)
        searchUrl.searchParams.set('query', query)
        searchUrl.searchParams.set('language', 'en')
        searchUrl.searchParams.set('key', apiKey)

        const searchRes = await fetch(searchUrl.toString())
        const searchData = await searchRes.json()
        if (!searchData.results?.length) return null

        const placeId = searchData.results[0].place_id

        const fieldsNeeded = [
            'place_id', 'name', 'formatted_address', 'vicinity',
            'geometry', 'types', 'price_level', 'rating',
            'user_ratings_total', 'formatted_phone_number', 'website',
            'opening_hours', 'photos', 'editorial_summary',
            'delivery', 'dine_in', 'takeout', 'serves_beer',
            'serves_wine', 'serves_vegetarian_food',
            'wheelchair_accessible_entrance', 'reservable', 'url'
        ].join(',')

        const detailUrl = new URL(`${PLACES_BASE}/details/json`)
        detailUrl.searchParams.set('place_id', placeId)
        detailUrl.searchParams.set('fields', fieldsNeeded)
        detailUrl.searchParams.set('language', 'en')
        detailUrl.searchParams.set('key', apiKey)

        const detailRes = await fetch(detailUrl.toString())
        const detailData = await detailRes.json()
        const p = detailData.result
        if (!p) return null

        const CATEGORY_MAP = {
            restaurant: 'Restaurant', cafe: 'Cafe', bar: 'Bar',
            bakery: 'Bakery', night_club: 'Bar', food: 'Restaurant',
            meal_takeaway: 'Fast Food', meal_delivery: 'Fast Food',
            fine_dining_restaurant: 'Fine Dining',
        }
        const PRICE_MAP = { 0: '$', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }
        const googleTypes = p.types || []
        const category = googleTypes.reduce((f, t) => f || CATEGORY_MAP[t], null) || 'Restaurant'

        const photoUrls = (p.photos || []).slice(0, 8).map(ph =>
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${ph.photo_reference}&key=${apiKey}`
        )

        const features = []
        if (p.wheelchair_accessible_entrance) features.push('Wheelchair Accessible')
        if (p.delivery) features.push('Delivery')
        if (p.takeout) features.push('Takeout')
        if (p.dine_in) features.push('Dine-in')
        if (p.serves_beer || p.serves_wine) features.push('Alcohol')
        if (p.serves_vegetarian_food) features.push('Vegetarian Options')
        if (p.reservable) features.push('Reservations')

        return {
            title: p.name,
            category,
            address: p.formatted_address || p.vicinity,
            lat: p.geometry?.location?.lat,
            lng: p.geometry?.location?.lng,
            phone: p.formatted_phone_number,
            website: p.website,
            rating: p.rating,
            reviews_count: p.user_ratings_total,
            price_level: PRICE_MAP[p.price_level] || '$$',
            opening_hours: p.opening_hours?.weekday_text || [],
            description: p.editorial_summary?.overview || null,
            photos: photoUrls,
            image: photoUrls[0] || null,
            features,
            reservable: p.reservable || false,
            google_place_id: p.place_id,
            google_maps_url: p.url,
            _raw_types: googleTypes,
        }
    } catch (err) {
        console.error('[process] Google Places error:', err.message)
        return null
    }
}

// ── Step 2: Apify Google Maps Scraper ────────────────────────────────────────
async function searchApify(query) {
    const token = process.env.APIFY_API_TOKEN
    if (!token) { console.warn('[process] No APIFY_API_TOKEN'); return null }

    try {
        console.log('[process] Apify actor starting for:', query)

        const runUrl = `${APIFY_API}/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${token}&timeout=50`

        const res = await fetch(runUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                searchStringsArray: [query],
                maxCrawledPlacesPerSearch: 1,
                maxReviews: 8,
                language: 'en',
                includeHistogram: false,
                exportPlaceUrls: true,
                scrapeDirectories: false,
                scrapeTableReservationProvider: false,
            }),
        })

        if (!res.ok) {
            console.warn('[process] Apify HTTP error:', res.status)
            return null
        }

        const items = await res.json()
        if (!items?.length) return null

        const place = items[0]
        console.log('[process] Apify place:', place.title, '| reviews:', place.reviewsCount)

        // Парсим additionalInfo (wifi, parking, etc.)
        const about = place.additionalInfo || {}
        const aboutFlat = Object.entries(about).flatMap(([_section, items]) =>
            Array.isArray(items)
                ? items.filter(i => Object.values(i)[0] === true).map(i => Object.keys(i)[0])
                : []
        )

        return {
            apify_title: place.title,
            apify_address: place.address,
            apify_phone: place.phone,
            apify_website: place.website,
            apify_rating: place.totalScore,
            apify_reviews_count: place.reviewsCount,
            apify_price_level: place.priceLevel,
            apify_categories: place.categories || [],
            apify_photos: (place.imageUrls || []).slice(0, 10),
            apify_reviews: (place.reviews || []).slice(0, 8).map(r => ({
                text: r.text,
                rating: r.stars,
                author: r.name,
            })),
            apify_about_flat: aboutFlat, // ['Free Wi-Fi', 'Street parking', 'Outdoor seating', ...]
            apify_popular_dishes: place.popularDishes || [],
            apify_opening_hours: place.openingHours || [],
            apify_url: place.url,
            apify_permanently_closed: place.permanentlyClosed,
            apify_temporarily_closed: place.temporarilyClosed,
        }
    } catch (err) {
        console.error('[process] Apify error:', err.message)
        return null
    }
}

// ── Step 3: Brave Search ─────────────────────────────────────────────────────
async function searchBrave(query) {
    const apiKey = process.env.BRAVE_API_KEY
    if (!apiKey) { console.warn('[process] No BRAVE_API_KEY'); return null }

    try {
        const url = new URL('https://api.search.brave.com/res/v1/web/search')
        url.searchParams.set('q', `${query} review atmosphere menu must try insider tips`)
        url.searchParams.set('count', '6')
        url.searchParams.set('search_lang', 'en')

        const res = await fetch(url.toString(), {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': apiKey,
            },
        })

        if (!res.ok) return null
        const data = await res.json()
        return (data?.web?.results || []).slice(0, 6).map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.description,
        }))
    } catch (err) {
        console.error('[process] Brave error:', err.message)
        return null
    }
}

// ── Step 4: LLM Synthesis ────────────────────────────────────────────────────
async function synthesizeWithLLM(placesData, apifyData, braveResults, userQuery) {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY
    if (!apiKey) { console.warn('[process] No OPENROUTER_API_KEY for synthesis'); return {} }

    // Собираем весь контекст
    const ctx = []

    if (placesData) {
        ctx.push(`=== GOOGLE PLACES ===`)
        ctx.push(`Name: ${placesData.title}`)
        ctx.push(`Address: ${placesData.address}`)
        ctx.push(`Category: ${placesData.category}`)
        ctx.push(`Google Types: ${(placesData._raw_types || []).join(', ')}`)
        ctx.push(`Rating: ${placesData.rating} (${placesData.reviews_count} reviews)`)
        ctx.push(`Price: ${placesData.price_level}`)
        ctx.push(`Phone: ${placesData.phone || 'unknown'}`)
        ctx.push(`Website: ${placesData.website || 'unknown'}`)
        ctx.push(`Opening hours: ${Array.isArray(placesData.opening_hours) ? placesData.opening_hours.join(' | ') : (placesData.opening_hours || 'unknown')}`)
        ctx.push(`Description: ${placesData.description || 'none'}`)
        ctx.push(`Features: ${(placesData.features || []).join(', ')}`)
    }

    if (apifyData) {
        ctx.push(`\n=== APIFY GOOGLE MAPS ===`)
        ctx.push(`Categories: ${(apifyData.apify_categories || []).join(', ')}`)
        ctx.push(`Total reviews: ${apifyData.apify_reviews_count}`)
        ctx.push(`Price level: ${apifyData.apify_price_level || 'unknown'}`)
        if (apifyData.apify_opening_hours?.length) {
            ctx.push(`Hours: ${apifyData.apify_opening_hours.map(h => `${h.day}: ${h.hours}`).join(' | ')}`)
        }
        if (apifyData.apify_popular_dishes?.length) {
            ctx.push(`Popular dishes: ${apifyData.apify_popular_dishes.join(', ')}`)
        }
        if (apifyData.apify_about_flat?.length) {
            ctx.push(`Amenities/Features from Google: ${apifyData.apify_about_flat.join(', ')}`)
        }
        if (apifyData.apify_reviews?.length) {
            ctx.push(`Customer reviews:`)
            apifyData.apify_reviews.forEach(r => {
                if (r.text) ctx.push(`  [${r.rating}★] ${r.text.slice(0, 300)}`)
            })
        }
    }

    if (braveResults?.length) {
        ctx.push(`\n=== WEB SEARCH (Brave) ===`)
        braveResults.forEach(r => {
            ctx.push(`- ${r.title}: ${r.snippet}`)
        })
    }

    const prompt = `You are a GastroMap content expert creating rich location cards for a food discovery app.

Based on ALL available research data below, generate a comprehensive JSON for a restaurant/cafe/bar card.
Use every piece of information available. If some data is missing — make an educated guess based on cuisine type, reviews, and category.

Research data:
${ctx.join('\n')}

Original search query: "${userQuery}"

Generate EXACTLY this JSON structure (all fields required, no extras):
{
  "description": "2-3 sentences. Vivid, engaging, specific. Focus on what makes this place unique — atmosphere, specialty, why visit. Avoid generic phrases.",

  "cuisine": "Primary cuisine as ONE string. E.g.: 'Israeli', 'Japanese', 'Polish', 'Italian', 'Indian', 'Mediterranean'",

  "tags": ["6-10 specific tags", "e.g.", "Hummus", "Falafel", "Middle Eastern", "Cozy", "Popular", "Good for Groups"],

  "vibe": ["3-5 vibe descriptors", "e.g.", "Casual", "Lively", "Hipster", "Romantic", "Family-friendly"],

  "features": ["All available features", "e.g.", "Free Wi-Fi", "Outdoor Seating", "Vegetarian Menu", "Takeaway", "Reservations", "Wheelchair Accessible", "Live Music", "Alcohol", "Late Night"],

  "best_for": ["3-5 occasions", "e.g.", "Date Night", "Group Dinner", "Casual Lunch", "Family", "Business Lunch", "Quick Bite"],

  "what_to_try": ["3-5 specific must-try items", "e.g.", "Hummus with lamb", "Shakshuka", "Malabi dessert"],

  "insider_tip": "1-2 sentences of insider knowledge. E.g.: timing tip (avoid lunch rush), seating tip (ask for window table), ordering tip (try the daily special), reservation advice.",

  "dietary": ["Dietary options available", "e.g.", "Vegetarian", "Vegan", "Gluten-free", "Halal", "Kosher"],

  "city": "City name in ENGLISH only. E.g.: 'Krakow' (NOT local names), 'Warsaw' (NOT Warszawa), 'Kyiv' (NOT Kiev), 'Rome' (NOT Roma). Always use English/international names.",
  "country": "Country in ENGLISH. E.g.: 'Poland', 'Ukraine', 'Italy'. Always use English names.",

  "opening_hours": "Mon-Thu: 8AM-6PM, Fri: 8AM-8PM, Sat-Sun: 9AM-6PM",
  // Format: abbreviated days + 12h time. Group consecutive days with same hours.
  // Examples: "Daily: 9AM-10PM" or "Mon-Fri: 8AM-5PM, Sat-Sun: 9AM-5PM" or "Tue-Sat: 12PM-11PM"
  // Use 12-hour format (8AM, 12PM, 9:30PM). Use 'Daily' if all 7 days are the same.
  
  "has_wifi": true or false,
  "has_outdoor_seating": true or false,
  "reservations_required": true or false
}

IMPORTANT: Return ONLY valid JSON. No markdown. No explanation. No \`\`\`.`

    const models = [
        'google/gemma-3-27b-it:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'openai/gpt-oss-120b:free',
        'mistralai/mistral-7b-instruct:free',
    ]

    let lastError = null

    for (const model of models) {
        try {
            const res = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://gastromap-five.vercel.app',
                    'X-Title': 'GastroMap Bot',
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 1000,
                    temperature: 0.3,
                }),
                signal: AbortSignal.timeout(15000), // 15s timeout per model
            })

            if (!res.ok) {
                console.warn(`[process] ${model} HTTP ${res.status}`)
                lastError = `HTTP ${res.status}`
                continue
            }

            const data = await res.json()
            const content = data.choices?.[0]?.message?.content?.trim()
            if (!content) {
                lastError = 'Empty response'
                continue
            }

            // Убираем markdown если модель всё равно добавила
            const jsonStr = content
                .replace(/^```json?\s*/i, '')
                .replace(/```\s*$/i, '')
                .trim()

            const parsed = JSON.parse(jsonStr)

            // Validate minimum data quality
            if (!parsed.description && !parsed.cuisine && !parsed.tags) {
                console.warn(`[process] ${model} returned empty data`)
                lastError = 'Insufficient data'
                continue
            }

            console.log(`[process] LLM OK with ${model}`)
            return parsed
        } catch (err) {
            console.warn(`[process] LLM ${model} failed:`, err.message)
            lastError = err.message
        }
    }

    // All models failed — use fallback data from Google/Apify
    console.error('[process] All LLM models failed, using fallback data')

    const fallback = {
        description: placesData?.description || apifyData?.apify_reviews?.[0]?.text?.slice(0, 200) || null,
        cuisine: null,
        tags: (placesData?._raw_types || []).slice(0, 5),
        vibe: ['Local Favorite'],
        features: placesData?.features || apifyData?.apify_about_flat || [],
        best_for: ['Casual Dining'],
        what_to_try: apifyData?.apify_popular_dishes || [],
        insider_tip: null,
        dietary: [],
        city: normalizeCityName(placesData?.address?.split(',').pop()?.trim() || ''),
        country: normalizeCountryName('Poland'),
        opening_hours: placesData?.opening_hours || apifyData?.apify_opening_hours || null,
        has_wifi: (placesData?.features || []).includes('Free Wi-Fi'),
        has_outdoor_seating: (placesData?.features || []).includes('Outdoor Seating'),
        reservations_required: (placesData?.features || []).includes('Reservations'),
    }

    console.warn(`[process] Fallback data used. Last error: ${lastError}`)
    return fallback
}

// ── Step 5: Supabase Insert ───────────────────────────────────────────────────
async function insertLocation(d, apifyHours = null) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL not configured')
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

    if (!serviceKey) throw new Error('No Supabase service key in env')

    const supabase = createClient(supabaseUrl, serviceKey)

    // Check for duplicates (title + address)
    if (d.title && d.address) {
        const { data: existing } = await supabase
            .from('locations')
            .select('id, title, address')
            .ilike('title', d.title)
            .limit(5)
        
        if (existing?.length) {
            const isDuplicate = existing.some(loc => {
                const existingAddr = (loc.address || '').toLowerCase()
                const newAddr = (d.address || '').toLowerCase()
                return existingAddr.includes(newAddr) || newAddr.includes(existingAddr)
            })
            
            if (isDuplicate) {
                throw new Error(`Duplicate location: "${d.title}" at "${d.address}" already exists`)
            }
        }
    }

    // Validate synthesized data before insert
    if (d.title && d.title.length > 200) d.title = d.title.slice(0, 200)
    if (d.description && d.description.length > 2000) d.description = d.description.slice(0, 2000)
    if (d.tags && d.tags.length > 20) d.tags = d.tags.slice(0, 20)
    if (d.photos && d.photos.length > 10) d.photos = d.photos.slice(0, 10)
    if (d.website) {
        try { new URL(d.website) } catch { d.website = null }
    }

    // Normalize opening_hours to standardized string format: "Mon-Fri: 8AM-5PM, Sat-Sun: 9AM-5PM"
    let openingHours = null
    
    if (typeof d.opening_hours === 'string' && d.opening_hours.trim()) {
        // LLM already returns the correct format — use as-is
        openingHours = d.opening_hours.trim()
    } else if (typeof d.opening_hours === 'object' && !Array.isArray(d.opening_hours) && d.opening_hours) {
        // JSON object from LLM — convert to string format using formatOpeningHours
        openingHours = formatOpeningHours(d.opening_hours)
    } else if (Array.isArray(d.opening_hours) && d.opening_hours.length > 0) {
        // Google Places weekday_text array — convert
        openingHours = formatOpeningHours(d.opening_hours)
    }
    
    // Fallback: Apify hours
    if (!openingHours && apifyHours?.length) {
        openingHours = formatOpeningHours(apifyHours)
    }

    const row = {
        // Core
        title:          d.title || 'Untitled',
        category:       (d.category || 'restaurant').toLowerCase(),
        description:    d.description || null,
        address:        d.address || null,
        lat:            d.lat ? Number(d.lat) : null,
        lng:            d.lng ? Number(d.lng) : null,
        // Contact
        phone:          d.phone || null,
        website:        d.website || null,
        // Data (canonical column names)
        google_rating:  d.rating ? Number(d.rating) : null,
        price_range:    d.price_level || '$$',
        opening_hours:  openingHours,
        // Content (canonical column names)
        cuisine_types:  typeof d.cuisine === 'string' ? [d.cuisine] : (Array.isArray(d.cuisine) ? d.cuisine : []),
        tags:           d.tags || [],
        vibe:           d.vibe || [],
        amenities:      d.features || [],
        best_for:       d.best_for || [],
        dietary_options: d.dietary || [],
        what_to_try:    Array.isArray(d.what_to_try) ? d.what_to_try : (d.what_to_try ? [d.what_to_try] : []),
        insider_tip:    d.insider_tip || null,
        // Booleans
        has_wifi:               d.has_wifi || false,
        has_outdoor_seating:    d.has_outdoor_seating || false,
        reservations_required:  d.reservations_required || false,
        // Media (canonical column names) — initially empty, will be filled with R2 URLs after insert
        image_url:      null,
        google_photos:  [],
        // Location (normalize to English/international names)
        city:           d.city ? normalizeCityName(d.city) : null,
        country:        d.country ? normalizeCountryName(d.country) : null,
        // Google
        google_place_id: d.google_place_id || null,
        google_maps_url: d.google_maps_url || null,
        // Meta
        status:         'draft',
    }

    const { data, error } = await supabase
        .from('locations')
        .insert(row)
        .select('id, title, city, country, cuisine_types, tags, vibe, amenities, what_to_try, insider_tip, opening_hours, phone, website, price_range, google_rating, has_wifi, has_outdoor_seating')
        .single()

    if (error) throw new Error(`Supabase: ${error.message}`)

    // ── Upload photos to R2 (non-blocking for Telegram response speed) ──
    // Download from Google/Apify URLs and re-upload to R2 so we never store API keys in DB
    const photoSources = d.photos || []
    if (photoSources.length > 0 && r2Client) {
        // Fire-and-forget: upload photos in background, update DB when done
        void (async () => {
            try {
                const r2Urls = []
                for (let i = 0; i < Math.min(photoSources.length, 10); i++) {
                    const url = await downloadAndUploadToR2(photoSources[i], data.id, i)
                    if (url) r2Urls.push(url)
                    // Small delay to avoid rate limiting
                    if (i < photoSources.length - 1) await new Promise(r => setTimeout(r, 150))
                }
                if (r2Urls.length > 0) {
                    const photoUpdate = { image_url: r2Urls[0] }
                    if (r2Urls.length > 1) photoUpdate.google_photos = r2Urls.slice(1)
                    await supabase.from('locations').update(photoUpdate).eq('id', data.id)
                    console.log(`[process] ${r2Urls.length} photos uploaded to R2 for ${data.id}`)
                }
            } catch (err) {
                console.warn('[process] Background photo upload failed:', err.message)
            }
        })()
    }
    
    // Map to friendly names for Telegram response
    return {
        ...data,
        cuisine: data.cuisine_types?.[0] || null,
        features: data.amenities || [],
        rating: data.google_rating,
        price_level: data.price_range,
    }
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    if (applyRateLimit(req, res, 'telegram-process', { maxRequests: 10, windowMs: 60000 })) return

    const { chatId, query, username: _username } = req.body || {}
    if (!chatId || !query) return res.status(400).json({ error: 'Missing chatId or query' })

    const token = process.env.TELEGRAM_BOT_TOKEN
    const userQuery = query.value

    // H9: LLM input validation
    if (!userQuery || typeof userQuery !== 'string' || userQuery.trim().length < 2 || userQuery.trim().length > 200) {
        return res.status(400).json({ error: 'Invalid query' })
    }

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY
    const userQueryNormalized = await normalizeQueryToEnglish(userQuery, apiKey)
    console.log(`[process] Pipeline for: "${userQuery}" (normalized: "${userQueryNormalized}")`)

    try {
        // Шаги 1–3 параллельно
        const [placesData, apifyData, braveResults] = await Promise.allSettled([
            searchGooglePlaces(userQueryNormalized),
            searchApify(userQueryNormalized),
            searchBrave(userQueryNormalized),
        ]).then(r => r.map(x => x.status === 'fulfilled' ? x.value : null))

        console.log('[process] Sources:', { places: !!placesData, apify: !!apifyData, brave: !!braveResults })

        if (!placesData && !apifyData) {
            await sendMessage(token, chatId,
                `❌ Не нашёл данные о <b>${escapeHtml(userQuery)}</b>.\n\nПопробуй точнее: <code>/add Название, Адрес, Город</code>`
            )
            return res.status(200).json({ ok: true })
        }

        // Шаг 4: LLM
        const llmData = await synthesizeWithLLM(placesData, apifyData, braveResults, userQueryNormalized)

        // Объединяем: Apify > Places > LLM
        const finalData = {
            ...placesData,
            // Apify перекрывает где лучше
            ...(apifyData?.apify_photos?.length && {
                photos: apifyData.apify_photos,
                image: apifyData.apify_photos[0],
            }),
            ...(apifyData?.apify_price_level && { price_level: apifyData.apify_price_level }),
            ...(apifyData?.apify_opening_hours?.length && {
                opening_hours: apifyData.apify_opening_hours.map(h => `${h.day}: ${h.hours}`)
            }),
            // LLM данные (самые богатые)
            ...llmData,
        }

        // Шаг 5: Supabase
        const created = await insertLocation(finalData, apifyData?.apify_opening_hours || null)
        console.log('[process] Created location:', created.id)

        // Fire-and-forget KG enrichment for the new location
        try {
          const kgSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
          const kgServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
          if (kgSupabaseUrl && kgServiceKey && created?.id) {
            fetch(`${kgSupabaseUrl}/functions/v1/kg-enrich`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${kgServiceKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ mode: 'single', id: created.id })
            }).catch(err => console.warn('[telegram/process] kg-enrich fire-and-forget failed:', err.message));
          }
        } catch (kgErr) {
          console.warn('[telegram/process] kg-enrich trigger error:', kgErr.message);
        }

        // Запускаем автоперевод в фоне (non-blocking)
        const translationData = {
            title: finalData.title || created.title,
            description: llmData.description || finalData.description,
            insider_tip: llmData.insider_tip || finalData.insider_tip,
            what_to_try: llmData.what_to_try || finalData.what_to_try,
        }
        triggerAutoTranslation(created.id, translationData, apiKey).catch(err =>
            console.warn('[process] Auto-translation background error:', err.message)
        )

        // Шаг 6: Telegram ответ — полная карточка
        const adminUrl = `https://gastromap-five.vercel.app/admin/locations/${created.id}`

        const lines = [
            `✅ <b>${created.title}</b> добавлена в GastroMap!`,
            '',
        ]

        // Основные данные
        if (created.cuisine) lines.push(`🍽 <b>Кухня:</b> ${created.cuisine}`)
        if (created.rating)  lines.push(`⭐ <b>Рейтинг:</b> ${created.rating} · <b>Цена:</b> ${created.price_level || '?'}`)
        if (finalData.address) lines.push(`📍 <b>Адрес:</b> ${finalData.address}`)
        if (created.phone)   lines.push(`📞 ${created.phone}`)
        if (created.website) lines.push(`🌐 ${created.website}`)

        lines.push('')

        // Расписание
        if (created.opening_hours) {
            const formattedHours = formatOpeningHours(created.opening_hours)
            if (formattedHours) lines.push(`🕐 <b>Часы:</b> ${formattedHours}`)
        }

        // Атмосфера
        if (created.vibe?.length) lines.push(`✨ <b>Атмосфера:</b> ${created.vibe.join(', ')}`)

        // Теги
        if (created.tags?.length) {
            lines.push(`🏷 ${created.tags.slice(0, 8).map(t => `#${t.replace(/\s+/g, '_')}`).join(' ')}`)
        }

        lines.push('')

        // Что попробовать
        if (created.what_to_try?.length) {
            lines.push(`🌟 <b>Хиты меню:</b>`)
            created.what_to_try.forEach(item => lines.push(`  • ${item}`))
            lines.push('')
        }

        // Insider tip
        if (created.insider_tip) {
            lines.push(`💡 <b>Insider tip:</b> ${created.insider_tip}`)
            lines.push('')
        }

        // Удобства
        if (created.features?.length) {
            lines.push(`🛎 <b>Удобства:</b> ${created.features.join(' · ')}`)
        }

        // Wifi / Outdoor
        const extras = []
        if (created.has_wifi) extras.push('📶 Wi-Fi')
        if (created.has_outdoor_seating) extras.push('🌿 Терраса')
        if (extras.length) lines.push(extras.join(' · '))

        lines.push('')
        lines.push(`<b>Статус:</b> Draft — нужна проверка перед публикацией`)
        lines.push(`🔧 <a href="${adminUrl}">Открыть в Admin Panel</a>`)

        const responseText = lines.join('\n').replace(/\n{3,}/g, '\n\n')

        await sendMessage(token, chatId, responseText)
        return res.status(200).json({ ok: true, locationId: created.id })

    } catch (err) {
        console.error('[process] Error:', err.message)
        await sendMessage(token, chatId,
            `⚠️ Ошибка при создании локации. Попробуйте позже.`
        ).catch(() => {})
        return res.status(500).json({ error: 'Processing failed' })
    }
}
