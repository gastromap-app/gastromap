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
        const aboutFlat = Object.entries(about).flatMap(([section, items]) =>
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
    if (!apiKey) { console.warn('[process] No OPENROUTER_API_KEY'); return {} }

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

  "city": "City name only. E.g.: 'Kraków'",
  "country": "Country. E.g.: 'Poland'",

  "opening_hours_summary": "Human-readable hours summary. E.g.: 'Mon–Sat 12:00–22:00, Sun 13:00–21:00' or 'Daily 11:00–23:00'",

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
            })

            if (!res.ok) { console.warn(`[process] ${model} HTTP ${res.status}`); continue }

            const data = await res.json()
            const content = data.choices?.[0]?.message?.content?.trim()
            if (!content) continue

            // Убираем markdown если модель всё равно добавила
            const jsonStr = content
                .replace(/^```json?\s*/i, '')
                .replace(/```\s*$/i, '')
                .trim()

            const parsed = JSON.parse(jsonStr)
            console.log(`[process] LLM OK with ${model}`)
            return parsed
        } catch (err) {
            console.warn(`[process] LLM ${model} failed:`, err.message)
        }
    }

    console.error('[process] All LLM models failed')
    return {}
}

// ── Step 5: Supabase Insert ───────────────────────────────────────────────────
async function insertLocation(d) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://myyzguendoruefiiufop.supabase.co'
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

    if (!serviceKey) throw new Error('No Supabase service key in env')

    const supabase = createClient(supabaseUrl, serviceKey)

    // Нормализуем opening_hours в строку
    let openingHours = null
    if (d.opening_hours_summary) {
        openingHours = d.opening_hours_summary
    } else if (Array.isArray(d.opening_hours)) {
        openingHours = d.opening_hours.join(' | ')
    } else if (typeof d.opening_hours === 'string') {
        openingHours = d.opening_hours
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
        // Data
        rating:         d.rating ? Number(d.rating) : null,
        price_level:    d.price_level || '$$',
        opening_hours:  openingHours,
        // Content
        cuisine:        typeof d.cuisine === 'string' ? d.cuisine : (Array.isArray(d.cuisine) ? d.cuisine[0] : null),
        tags:           d.tags || [],
        vibe:           d.vibe || [],
        features:       d.features || [],
        best_for:       d.best_for || [],
        dietary:        d.dietary || [],
        what_to_try:    Array.isArray(d.what_to_try) ? d.what_to_try : (d.what_to_try ? [d.what_to_try] : []),
        insider_tip:    d.insider_tip || null,
        // Booleans
        has_wifi:               d.has_wifi || false,
        has_outdoor_seating:    d.has_outdoor_seating || false,
        reservations_required:  d.reservations_required || false,
        // Media
        image:          d.image || (d.photos?.[0]) || null,
        photos:         d.photos || [],
        // Location
        city:           d.city || null,
        country:        d.country || null,
        // Meta
        status:         'draft',
        source:         'telegram_bot',
    }

    const { data, error } = await supabase
        .from('locations')
        .insert(row)
        .select('id, title, city, country, cuisine, tags, vibe, features, what_to_try, insider_tip, opening_hours, phone, website, price_level, rating, has_wifi, has_outdoor_seating')
        .single()

    if (error) throw new Error(`Supabase: ${error.message}`)
    return data
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const { chatId, query, username } = req.body || {}
    if (!chatId || !query) return res.status(400).json({ error: 'Missing chatId or query' })

    const token = process.env.TELEGRAM_BOT_TOKEN
    const userQuery = query.value

    console.log(`[process] Pipeline for: "${userQuery}"`)

    try {
        // Шаги 1–3 параллельно
        const [placesData, apifyData, braveResults] = await Promise.allSettled([
            searchGooglePlaces(userQuery),
            searchApify(userQuery),
            searchBrave(userQuery),
        ]).then(r => r.map(x => x.status === 'fulfilled' ? x.value : null))

        console.log('[process] Sources:', { places: !!placesData, apify: !!apifyData, brave: !!braveResults })

        if (!placesData && !apifyData) {
            await sendMessage(token, chatId,
                `❌ Не нашёл данные о <b>${userQuery}</b>.\n\nПопробуй точнее: <code>/add Название, Адрес, Город</code>`
            )
            return res.status(200).json({ ok: true })
        }

        // Шаг 4: LLM
        const llmData = await synthesizeWithLLM(placesData, apifyData, braveResults, userQuery)

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
        const created = await insertLocation(finalData)
        console.log('[process] Created location:', created.id)

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
        if (created.opening_hours) lines.push(`🕐 <b>Часы:</b> ${created.opening_hours}`)

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
            `⚠️ Ошибка при создании локации:\n<code>${err.message}</code>`
        ).catch(() => {})
        return res.status(500).json({ error: err.message })
    }
}
