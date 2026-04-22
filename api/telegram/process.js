/**
 * Vercel Serverless — Location Research & Create Pipeline
 * 
 * Запускается асинхронно из webhook.js
 * 
 * Pipeline:
 *  1. Google Places API  → базовые данные (адрес, телефон, часы, фото, рейтинг)
 *  2. Apify Google Maps  → расширенные данные (отзывы, популярные блюда, все фото)
 *  3. Brave Search       → отзывы, статьи, атмосфера (параллельно с Apify)
 *  4. LLM Synthesis      → description, tags, vibe, features (OpenRouter)
 *  5. Supabase insert    → createLocation с service_role (bypass RLS)
 *  6. Telegram response  → карточка с ссылкой на admin
 * 
 * Timeout: Vercel Pro = 60s, Free = 10s
 * Поэтому шаги 1-3 параллельны, LLM быстрый (free model)
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
    if (!apiKey) return null

    try {
        const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place'

        // Text Search
        const searchUrl = new URL(`${PLACES_BASE}/textsearch/json`)
        searchUrl.searchParams.set('query', query)
        searchUrl.searchParams.set('type', 'restaurant|cafe|bar|food')
        searchUrl.searchParams.set('language', 'en')
        searchUrl.searchParams.set('key', apiKey)

        const searchRes = await fetch(searchUrl.toString())
        const searchData = await searchRes.json()

        if (!searchData.results?.length) return null

        const placeId = searchData.results[0].place_id

        // Details
        const fieldsNeeded = [
            'place_id', 'name', 'formatted_address', 'vicinity',
            'geometry', 'types', 'price_level', 'rating',
            'user_ratings_total', 'formatted_phone_number', 'website',
            'opening_hours', 'photos', 'editorial_summary',
            'delivery', 'dine_in', 'takeout', 'serves_beer',
            'serves_wine', 'wheelchair_accessible_entrance', 'url'
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

        // Нормализуем
        const CATEGORY_MAP = {
            restaurant: 'Restaurant', cafe: 'Cafe', bar: 'Bar',
            bakery: 'Bakery', night_club: 'Bar', food: 'Restaurant',
            meal_takeaway: 'Fast Food', meal_delivery: 'Fast Food',
        }
        const PRICE_MAP = { 0: '$', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }
        const googleTypes = p.types || []
        const category = googleTypes.reduce((f, t) => f || CATEGORY_MAP[t], null) || 'Restaurant'

        // Photo URLs через Places Photo API
        const photoUrls = (p.photos || []).slice(0, 5).map(ph =>
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ph.photo_reference}&key=${apiKey}`
        )

        const amenities = []
        if (p.wheelchair_accessible_entrance) amenities.push('wheelchair accessible')
        if (p.delivery) amenities.push('delivery')
        if (p.takeout) amenities.push('takeout')
        if (p.dine_in) amenities.push('dine-in')
        if (p.serves_beer || p.serves_wine) amenities.push('alcohol')

        return {
            title: p.name,
            category,
            address: p.formatted_address || p.vicinity,
            lat: p.geometry?.location?.lat,
            lng: p.geometry?.location?.lng,
            phone: p.formatted_phone_number,
            website: p.website,
            rating: p.rating,
            price_level: PRICE_MAP[p.price_level] || '$$',
            opening_hours: p.opening_hours?.weekday_text?.join(' | '),
            description: p.editorial_summary?.overview || null,
            photos: photoUrls,
            image: photoUrls[0] || null,
            amenities,
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
    if (!token) return null

    try {
        console.log('[process] Running Apify actor for:', query)

        // Синхронный запуск — ждём результат (до 5 минут, нам хватит ~30с)
        const runUrl = `${APIFY_API}/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${token}&timeout=55`

        const res = await fetch(runUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                searchStringsArray: [query],
                maxCrawledPlacesPerSearch: 1,
                maxReviews: 5,
                language: 'en',
                includeHistogram: false,
                exportPlaceUrls: true,
                scrapeDirectories: false,
                scrapeTableReservationProvider: false,
            }),
        })

        if (!res.ok) {
            console.warn('[process] Apify response:', res.status, await res.text())
            return null
        }

        const items = await res.json()
        if (!items?.length) return null

        const place = items[0]
        console.log('[process] Apify got place:', place.title)

        return {
            // Apify даёт более богатые данные
            apify_title: place.title,
            apify_address: place.address,
            apify_phone: place.phone,
            apify_website: place.website,
            apify_rating: place.totalScore,
            apify_reviews_count: place.reviewsCount,
            apify_price_level: place.priceLevel, // $, $$, $$$
            apify_categories: place.categories || [],
            apify_popular_times: place.popularTimesHistogram,
            apify_menu: place.menu, // если есть
            apify_photos: (place.imageUrls || []).slice(0, 8),
            apify_reviews: (place.reviews || []).slice(0, 5).map(r => ({
                text: r.text,
                rating: r.stars,
                author: r.name,
            })),
            apify_about: place.additionalInfo, // wifi, parking, etc.
            apify_popular_dishes: place.popularDishes || [],
            apify_opening_hours: place.openingHours?.map(h => `${h.day}: ${h.hours}`).join(' | '),
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
    if (!apiKey) return null

    try {
        const searchQuery = `${query} ресторан отзывы атмосфера меню что попробовать`
        const url = new URL('https://api.search.brave.com/res/v1/web/search')
        url.searchParams.set('q', searchQuery)
        url.searchParams.set('count', '5')
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
        const results = data?.web?.results || []

        return results.slice(0, 5).map(r => ({
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
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return {}

    // Собираем контекст
    const context = []

    if (placesData) {
        context.push(`=== Google Places Data ===`)
        context.push(`Name: ${placesData.title}`)
        context.push(`Address: ${placesData.address}`)
        context.push(`Category: ${placesData.category}`)
        context.push(`Types: ${(placesData._raw_types || []).join(', ')}`)
        context.push(`Rating: ${placesData.rating}`)
        context.push(`Price: ${placesData.price_level}`)
        context.push(`Hours: ${placesData.opening_hours || 'unknown'}`)
        context.push(`Description: ${placesData.description || 'none'}`)
        context.push(`Phone: ${placesData.phone || 'none'}`)
        context.push(`Website: ${placesData.website || 'none'}`)
    }

    if (apifyData) {
        context.push(`\n=== Apify Enhanced Data ===`)
        context.push(`Categories: ${(apifyData.apify_categories || []).join(', ')}`)
        context.push(`Reviews count: ${apifyData.apify_reviews_count}`)
        if (apifyData.apify_popular_dishes?.length) {
            context.push(`Popular dishes: ${apifyData.apify_popular_dishes.join(', ')}`)
        }
        if (apifyData.apify_reviews?.length) {
            context.push(`Sample reviews:`)
            apifyData.apify_reviews.forEach(r => {
                if (r.text) context.push(`  - [${r.rating}★] ${r.text.slice(0, 200)}`)
            })
        }
        if (apifyData.apify_about) {
            context.push(`Additional info: ${JSON.stringify(apifyData.apify_about).slice(0, 500)}`)
        }
    }

    if (braveResults?.length) {
        context.push(`\n=== Web Search Results ===`)
        braveResults.forEach(r => {
            context.push(`- ${r.title}: ${r.snippet}`)
        })
    }

    const prompt = `You are a GastroMap content expert. Based on the research data below, generate structured metadata for a restaurant/cafe location card.

Research data:
${context.join('\n')}

Original search query: "${userQuery}"

Generate a JSON object with EXACTLY these fields (no extra fields):
{
  "description": "2-3 sentence engaging description in English. Focus on atmosphere, speciality, and why someone should visit. Be specific and vivid.",
  "tags": ["array", "of", "5-8", "relevant", "tags", "like", "Cozy", "Italian", "Wine", "Terrace"],
  "vibe": ["2-4", "vibe", "descriptors", "like", "Romantic", "Casual", "Hipster"],
  "features": ["3-6", "features", "like", "Free WiFi", "Outdoor Seating", "Live Music"],
  "cuisine": "primary cuisine type as single string, e.g. 'Italian', 'Polish', 'Japanese'",
  "best_for": ["2-4", "occasions", "like", "Date Night", "Business Lunch", "Family"],
  "what_to_try": "1-2 sentence about must-try dishes or drinks. If unknown, make educated guess from cuisine type.",
  "city": "city name only, e.g. 'Kraków'",
  "country": "country name, e.g. 'Poland'"
}

Important: Return ONLY valid JSON. No markdown. No explanation.`

    // Каскад моделей
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
                    max_tokens: 600,
                    temperature: 0.3,
                }),
            })

            if (!res.ok) continue

            const data = await res.json()
            const content = data.choices?.[0]?.message?.content?.trim()
            if (!content) continue

            // Парсим JSON — убираем markdown если есть
            const jsonStr = content.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
            const parsed = JSON.parse(jsonStr)
            console.log(`[process] LLM synthesis done with ${model}`)
            return parsed

        } catch (err) {
            console.warn(`[process] LLM ${model} failed:`, err.message)
            continue
        }
    }

    console.error('[process] All LLM models failed')
    return {}
}

// ── Step 5: Supabase Insert ───────────────────────────────────────────────────
async function insertLocation(locationData) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://myyzguendoruefiiufop.supabase.co'
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')

    const supabase = createClient(supabaseUrl, serviceKey)

    // Маппинг в схему БД (по аналогии с _toRow)
    const row = {
        title: locationData.title || 'Untitled',
        category: (locationData.category || 'restaurant').toLowerCase(),
        description: locationData.description || null,
        address: locationData.address || null,
        lat: locationData.lat ? Number(locationData.lat) : null,
        lng: locationData.lng ? Number(locationData.lng) : null,
        phone: locationData.phone || null,
        website: locationData.website || null,
        rating: locationData.rating ? Number(locationData.rating) : null,
        price_level: locationData.price_level || '$$',
        opening_hours: locationData.opening_hours || null,
        cuisine: Array.isArray(locationData.cuisine) ? locationData.cuisine[0] : (locationData.cuisine || null),
        tags: locationData.tags || [],
        amenities: locationData.features || locationData.amenities || [],
        best_for: locationData.best_for || [],
        dietary_options: locationData.dietary_options || [],
        image: locationData.image || (locationData.photos?.[0]) || null,
        photos: locationData.photos || [],
        city: locationData.city || null,
        country: locationData.country || null,
        // Метаданные бота
        status: 'draft',  // На ревью перед публикацией
        source: 'telegram_bot',
        what_to_try: locationData.what_to_try || null,
    }

    const { data, error } = await supabase
        .from('locations')
        .insert(row)
        .select('id, title, city, country')
        .single()

    if (error) throw new Error(`Supabase insert failed: ${error.message}`)
    return data
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const { chatId, query, username } = req.body || {}
    if (!chatId || !query) return res.status(400).json({ error: 'Missing chatId or query' })

    const token = process.env.TELEGRAM_BOT_TOKEN
    const userQuery = query.value

    console.log(`[process] Starting pipeline for: "${userQuery}"`)

    try {
        // ── Шаги 1, 2, 3 — параллельно ───────────────────────────────────────
        const [placesData, apifyData, braveResults] = await Promise.allSettled([
            searchGooglePlaces(userQuery),
            searchApify(userQuery),
            searchBrave(userQuery),
        ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : null))

        console.log('[process] Data collected:', {
            places: !!placesData,
            apify: !!apifyData,
            brave: !!braveResults,
        })

        // Если ничего не нашли
        if (!placesData && !apifyData) {
            await sendMessage(token, chatId,
                `❌ Не удалось найти данные о <b>${userQuery}</b>.\n\nПопробуй указать точнее: название + адрес + город.`
            )
            return res.status(200).json({ ok: true })
        }

        // ── Шаг 4: LLM синтез ────────────────────────────────────────────────
        const llmData = await synthesizeWithLLM(placesData, apifyData, braveResults, userQuery)

        // ── Объединяем данные ─────────────────────────────────────────────────
        // Приоритет: Apify > Google Places > LLM
        const finalData = {
            // Базовые данные из Places
            ...placesData,

            // Обогащение из Apify
            ...(apifyData?.apify_photos?.length && { photos: apifyData.apify_photos }),
            ...(apifyData?.apify_photos?.[0] && { image: apifyData.apify_photos[0] }),
            ...(apifyData?.apify_price_level && { price_level: apifyData.apify_price_level }),
            ...(apifyData?.apify_opening_hours && { opening_hours: apifyData.apify_opening_hours }),

            // LLM синтез
            ...llmData,

            // Мета
            _source: 'telegram_bot',
            _apify_reviews: apifyData?.apify_reviews || [],
            _popular_dishes: apifyData?.apify_popular_dishes || [],
        }

        // ── Шаг 5: Создаём в Supabase ────────────────────────────────────────
        const created = await insertLocation(finalData)
        console.log('[process] Location created:', created.id)

        // ── Шаг 6: Отвечаем в Telegram ───────────────────────────────────────
        const adminUrl = `https://gastromap-five.vercel.app/admin/locations/${created.id}`
        const previewUrl = `https://gastromap-five.vercel.app/location/${created.id}`

        // Формируем красивое сообщение
        const priceStr = finalData.price_level || '??'
        const ratingStr = finalData.rating ? `⭐ ${finalData.rating}` : ''
        const cuisineStr = finalData.cuisine ? `🍽 ${finalData.cuisine}` : ''
        const tagsStr = (finalData.tags || []).slice(0, 4).map(t => `#${t.replace(/\s/g, '_')}`).join(' ')

        const responseText = [
            `✅ <b>${created.title}</b> добавлена!`,
            '',
            finalData.description ? `📝 ${finalData.description}` : '',
            '',
            [ratingStr, priceStr, cuisineStr].filter(Boolean).join(' · '),
            finalData.address ? `📍 ${finalData.address}` : '',
            finalData.phone ? `📞 ${finalData.phone}` : '',
            finalData.website ? `🌐 ${finalData.website}` : '',
            '',
            tagsStr,
            '',
            `<b>Статус:</b> Draft (нужна проверка перед публикацией)`,
            '',
            `🔧 <a href="${adminUrl}">Открыть в Admin</a>`,
        ].filter(line => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n')

        await sendMessage(token, chatId, responseText)

        return res.status(200).json({ ok: true, locationId: created.id })

    } catch (err) {
        console.error('[process] Pipeline error:', err.message)

        await sendMessage(token, chatId,
            `⚠️ Произошла ошибка при создании локации:\n<code>${err.message}</code>\n\nПопробуй ещё раз или обратись к администратору.`
        ).catch(() => {})

        return res.status(500).json({ error: err.message })
    }
}
