#!/usr/bin/env python3
"""
GastroMap Location Enrichment Script
Sources: Google Places API → Apify (TripAdvisor/Instagram) → Web Search → LLM
"""
import os, sys, json, time, requests
from datetime import datetime, timezone

# ─── CONFIG ─────────────────────────────────────────────────
SUPABASE_URL    = os.environ.get("GASTROMAP_SUPABASE_URL", "https://myyzguendoruefiiufop.supabase.co")
SUPABASE_KEY    = os.environ.get("GASTROMAP_SUPABASE_SERVICE_KEY", "")
GOOGLE_API_KEY  = os.environ.get("GOOGLE_PLACES_API_KEY", "")
APIFY_KEY       = os.environ.get("APIFY_API_KEY", "")

BATCH_SIZE      = int(os.environ.get("BATCH_SIZE", "5"))
MAX_LOCATIONS   = int(os.environ.get("MAX_LOCATIONS", "999"))
DRY_RUN         = os.environ.get("DRY_RUN", "false").lower() == "true"

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# ─── SUPABASE HELPERS ───────────────────────────────────────
def fetch_locations(limit=50, offset=0, only_missing=True):
    """Загружаем локации которые нужно обогатить"""
    url = f"{SUPABASE_URL}/rest/v1/locations"
    
    if only_missing:
        # Берём локации где нет тегов ИЛИ нет opening_hours ИЛИ нет cuisine_types
        params = {
            "select": "id,title,category,country,city,address,description,insider_tip,must_try,tags,image_url,opening_hours,cuisine_types,google_place_id,lat,lng,ai_enrichment_status",
            "or": "(tags.is.null,opening_hours.is.null,cuisine_types.is.null)",
            "status": "eq.approved",
            "limit": limit,
            "offset": offset,
            "order": "created_at.asc"
        }
    else:
        params = {
            "select": "id,title,category,country,city,address,description,insider_tip,must_try,tags,image_url,opening_hours,cuisine_types,google_place_id,lat,lng,ai_enrichment_status",
            "status": "eq.approved",
            "limit": limit,
            "offset": offset,
            "order": "created_at.asc"
        }
    
    r = requests.get(url, headers=SUPABASE_HEADERS, params=params)
    r.raise_for_status()
    return r.json()

def update_location(loc_id, data):
    """Сохраняем обогащённые данные"""
    if DRY_RUN:
        print(f"  [DRY RUN] Would update {loc_id}: {list(data.keys())}")
        return True
    
    url = f"{SUPABASE_URL}/rest/v1/locations?id=eq.{loc_id}"
    r = requests.patch(url, headers=SUPABASE_HEADERS, json=data)
    if r.status_code not in (200, 204):
        print(f"  ❌ Update failed: {r.status_code} {r.text[:200]}")
        return False
    return True

# ─── GOOGLE PLACES ──────────────────────────────────────────
def google_find_place(name, city, country):
    """Находим place_id по названию"""
    url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    query = f"{name} {city} {country}"
    params = {
        "input": query,
        "inputtype": "textquery",
        "fields": "place_id,name,formatted_address,rating,user_ratings_total,geometry",
        "key": GOOGLE_API_KEY
    }
    r = requests.get(url, params=params, timeout=10)
    data = r.json()
    if data.get("status") == "OK" and data.get("candidates"):
        return data["candidates"][0]
    return None

def google_place_details(place_id):
    """Получаем полные детали места"""
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": ",".join([
            "name", "formatted_address", "formatted_phone_number",
            "website", "rating", "user_ratings_total", "price_level",
            "opening_hours", "photos", "types", "editorial_summary",
            "serves_beer", "serves_wine", "serves_vegetarian_food",
            "delivery", "dine_in", "takeout", "reservable",
            "wheelchair_accessible_entrance", "outdoor_seating",
            "business_status", "utc_offset_minutes", "vicinity",
            "url"
        ]),
        "key": GOOGLE_API_KEY,
        "language": "en"
    }
    r = requests.get(url, params=params, timeout=10)
    data = r.json()
    if data.get("status") == "OK":
        return data.get("result", {})
    return {}

def get_google_photo_url(photo_reference, max_width=800):
    """Формируем URL фото из Google Places"""
    return (f"https://maps.googleapis.com/maps/api/place/photo"
            f"?maxwidth={max_width}&photo_reference={photo_reference}&key={GOOGLE_API_KEY}")

# ─── APIFY (TripAdvisor scraper) ────────────────────────────
def apify_search_tripadvisor(name, city):
    """Ищем отзывы и данные на TripAdvisor через Apify"""
    url = f"https://api.apify.com/v2/acts/maxcopell~tripadvisor-scraper/run-sync-get-dataset-items"
    headers = {"Authorization": f"Bearer {APIFY_KEY}", "Content-Type": "application/json"}
    payload = {
        "query": f"{name} {city}",
        "maxItemsPerQuery": 1,
        "language": "en",
        "currency": "USD"
    }
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        if r.status_code == 200:
            items = r.json()
            if items:
                return items[0]
    except Exception as e:
        print(f"  ⚠️ Apify error: {e}")
    return {}

# ─── WEB SEARCH ─────────────────────────────────────────────
def web_search_location(name, city, country):
    """Поиск через Brave Search API"""
    brave_key = os.environ.get("BRAVE_SEARCH_API_KEY", "")
    if not brave_key:
        return ""
    
    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {"Accept": "application/json", "X-Subscription-Token": brave_key}
    query = f"{name} restaurant cafe {city} {country} insider tips must try dishes review"
    params = {"q": query, "count": 3, "language": "en"}
    
    try:
        r = requests.get(url, headers=headers, params=params, timeout=10)
        if r.status_code == 200:
            results = r.json().get("web", {}).get("results", [])
            snippets = [f"• {res.get('title','')}: {res.get('description','')}" for res in results[:3]]
            return "\n".join(snippets)
    except Exception as e:
        print(f"  ⚠️ Web search error: {e}")
    return ""

# ─── LLM ENRICHMENT ─────────────────────────────────────────
def llm_enrich(location, google_data, tripadvisor_data, web_snippets):
    """Генерируем обогащённые поля через встроенный LLM"""
    
    # Собираем все данные в контекст
    context_parts = []
    
    if google_data:
        editorial = google_data.get("editorial_summary", {}).get("overview", "")
        if editorial:
            context_parts.append(f"Google description: {editorial}")
        opening = google_data.get("opening_hours", {}).get("weekday_text", [])
        if opening:
            context_parts.append(f"Opening hours: {'; '.join(opening[:3])}")
        types = google_data.get("types", [])
        if types:
            context_parts.append(f"Place types: {', '.join(types[:5])}")
        rating = google_data.get("rating")
        reviews = google_data.get("user_ratings_total")
        if rating:
            context_parts.append(f"Google rating: {rating}/5 ({reviews} reviews)")
    
    if tripadvisor_data:
        ta_desc = tripadvisor_data.get("description", "")
        if ta_desc:
            context_parts.append(f"TripAdvisor: {ta_desc[:300]}")
        ta_cuisine = tripadvisor_data.get("cuisines", [])
        if ta_cuisine:
            cuisines_str = ", ".join([c.get("name","") for c in ta_cuisine[:4]])
            context_parts.append(f"Cuisines: {cuisines_str}")
    
    if web_snippets:
        context_parts.append(f"Web search results:\n{web_snippets}")
    
    context = "\n".join(context_parts) if context_parts else "No additional data found"
    
    prompt = f"""You are enriching a food & travel app (GastroMap) database entry for a location.

LOCATION: {location['title']}
CATEGORY: {location.get('category','cafe')}
CITY: {location.get('city','')}, {location.get('country','')}
ADDRESS: {location.get('address','')}
CURRENT DESCRIPTION: {location.get('description') or 'none'}
CURRENT INSIDER TIP: {location.get('insider_tip') or 'none'}
CURRENT MUST TRY: {location.get('must_try') or 'none'}

ADDITIONAL DATA GATHERED:
{context}

Generate a JSON object with these fields (keep existing values if they are good, improve or fill if empty/weak):
{{
  "description": "2-3 sentences. Atmospheric, specific, no generic phrases. What makes this place unique.",
  "insider_tip": "1 sentence. Specific actionable tip locals know. E.g. best seat, secret item, time to visit.",
  "must_try": "1-2 specific dishes/drinks this place is known for.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "special_labels": ["label1"],
  "cuisine_types": ["cuisine1", "cuisine2"],
  "dietary_options": ["vegetarian", "vegan"],
  "best_for": ["date night", "solo", "groups"],
  "noise_level": "quiet|moderate|loud",
  "best_time_to_visit": "morning|lunch|evening|weekend",
  "average_visit_duration": "30 min|1 hour|2+ hours"
}}

Tags should be specific: atmosphere, food type, occasion, neighborhood vibe.
Special labels examples: "hidden gem", "local favorite", "Instagram spot", "historic", "rooftop", "live music".
Return ONLY valid JSON, no markdown, no explanation."""

    # Используем OpenRouter с бесплатными моделями
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not openrouter_key:
        # fallback: возвращаем пустой результат
        print("  ⚠️ No OpenRouter key, skipping LLM step")
        return {}
    
    models = [
        "google/gemma-3-27b-it:free",
        "arcee-ai/trinity-large-preview:free",
        "meta-llama/llama-3.3-70b-instruct:free"
    ]
    
    for model in models:
        try:
            r = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openrouter_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 800,
                    "temperature": 0.7
                },
                timeout=30
            )
            if r.status_code == 200:
                content = r.json()["choices"][0]["message"]["content"].strip()
                # Парсим JSON
                if "```" in content:
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                result = json.loads(content.strip())
                return result
        except Exception as e:
            print(f"  ⚠️ LLM {model} error: {e}")
            continue
    
    return {}

# ─── MAIN ENRICHMENT FLOW ───────────────────────────────────
def enrich_location(loc):
    """Полный цикл обогащения одной локации"""
    name    = loc["title"]
    city    = loc.get("city", "")
    country = loc.get("country", "")
    
    print(f"\n📍 {name} ({city}, {country})")
    
    result_data = {}
    google_details = {}
    tripadvisor_data = {}
    
    # ── STEP 1: Google Places ──
    print("  🔍 Google Places...")
    place_id = loc.get("google_place_id")
    
    if not place_id:
        candidate = google_find_place(name, city, country)
        if candidate:
            place_id = candidate.get("place_id")
            print(f"  ✅ Found place_id: {place_id}")
        else:
            print("  ⚠️ Not found in Google Places")
    
    if place_id:
        google_details = google_place_details(place_id)
        
        # Сохраняем Google данные
        result_data["google_place_id"] = place_id
        result_data["google_rating"] = google_details.get("rating")
        result_data["google_user_ratings_total"] = google_details.get("user_ratings_total")
        result_data["google_price_level"] = google_details.get("price_level")
        result_data["google_business_status"] = google_details.get("business_status")
        result_data["google_website"] = google_details.get("website")
        result_data["google_phone"] = google_details.get("formatted_phone_number")
        result_data["google_formatted_address"] = google_details.get("formatted_address")
        result_data["google_maps_url"] = google_details.get("url")
        
        # Opening hours
        oh = google_details.get("opening_hours", {})
        if oh.get("weekday_text"):
            result_data["opening_hours"] = oh["weekday_text"]
            result_data["google_opening_hours"] = oh.get("weekday_text")
        
        # Amenities из Google
        amenities = []
        if google_details.get("delivery"):
            amenities.append("delivery")
        if google_details.get("dine_in"):
            amenities.append("dine_in")
        if google_details.get("takeout"):
            amenities.append("takeout")
        if google_details.get("outdoor_seating"):
            amenities.append("outdoor_seating")
            result_data["outdoor_seating"] = True
        if google_details.get("wheelchair_accessible_entrance"):
            amenities.append("wheelchair_accessible")
        if amenities:
            result_data["amenities"] = amenities
        
        if google_details.get("reservable") is not None:
            result_data["reservation_required"] = google_details.get("reservable")
        
        # Фото из Google (если нет image_url)
        photos = google_details.get("photos", [])
        if photos and not loc.get("image_url"):
            ref = photos[0].get("photo_reference", "")
            if ref:
                result_data["image_url"] = get_google_photo_url(ref)
                result_data["google_photos"] = [get_google_photo_url(p.get("photo_reference","")) for p in photos[:5] if p.get("photo_reference")]
                print(f"  📸 Got {len(result_data.get('google_photos',[]))} photos")
        elif photos and loc.get("image_url"):
            # Сохраняем дополнительные фото даже если основное есть
            result_data["google_photos"] = [get_google_photo_url(p.get("photo_reference","")) for p in photos[:5] if p.get("photo_reference")]
        
        result_data["google_types"] = google_details.get("types", [])
        
        if google_details.get("serves_vegetarian_food"):
            result_data["dietary_options"] = ["vegetarian"]
    
    # ── STEP 2: Apify TripAdvisor ──
    print("  🕷️ TripAdvisor via Apify...")
    try:
        tripadvisor_data = apify_search_tripadvisor(name, city)
        if tripadvisor_data:
            print(f"  ✅ TripAdvisor data found")
    except Exception as e:
        print(f"  ⚠️ Apify failed: {e}")
    
    # ── STEP 3: Web search ──
    print("  🌐 Web search...")
    web_snippets = web_search_location(name, city, country)
    if web_snippets:
        print("  ✅ Web snippets found")
    
    # ── STEP 4: LLM enrichment ──
    print("  🤖 LLM enrichment...")
    llm_data = llm_enrich(loc, google_details, tripadvisor_data, web_snippets)
    
    if llm_data:
        print(f"  ✅ LLM generated: {list(llm_data.keys())}")
        
        # Применяем LLM данные (не перезаписываем хорошие существующие данные)
        for field in ["description", "insider_tip", "must_try"]:
            existing = loc.get(field, "")
            new_val = llm_data.get(field, "")
            # Берём новое если старое отсутствует или слишком короткое
            if new_val and (not existing or len(existing) < 20):
                result_data[field] = new_val
            elif new_val and len(new_val) > len(existing or ""):
                result_data[field] = new_val
        
        # Массивы — берём от LLM если не заполнены
        for field in ["tags", "cuisine_types", "dietary_options", "best_for", "special_labels"]:
            if not loc.get(field) and llm_data.get(field):
                result_data[field] = llm_data[field]
        
        # Скалярные поля
        for field in ["noise_level", "best_time_to_visit", "average_visit_duration"]:
            if not loc.get(field) and llm_data.get(field):
                result_data[field] = llm_data[field]
    
    # ── STEP 5: Metadata ──
    result_data["ai_enriched"] = True
    result_data["ai_enriched_at"] = datetime.now(timezone.utc).isoformat()
    result_data["ai_enrichment_status"] = "success"
    result_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    return result_data

# ─── ENTRY POINT ────────────────────────────────────────────
def main():
    print("=" * 60)
    print("🍽️  GastroMap Location Enrichment")
    print(f"   Supabase: {SUPABASE_URL}")
    print(f"   Batch size: {BATCH_SIZE}")
    print(f"   Dry run: {DRY_RUN}")
    print("=" * 60)
    
    if not SUPABASE_KEY:
        print("❌ GASTROMAP_SUPABASE_SERVICE_KEY is missing!")
        sys.exit(1)
    
    # Загружаем локации
    print(f"\n📊 Loading locations...")
    locations = fetch_locations(limit=MAX_LOCATIONS, only_missing=True)
    print(f"   Found {len(locations)} locations to enrich")
    
    if not locations:
        print("✅ All locations are already enriched!")
        return
    
    success = 0
    failed = 0
    
    for i, loc in enumerate(locations[:MAX_LOCATIONS]):
        print(f"\n[{i+1}/{len(locations)}] Processing: {loc['title']}")
        
        try:
            enriched = enrich_location(loc)
            
            if enriched and not DRY_RUN:
                ok = update_location(loc["id"], enriched)
                if ok:
                    print(f"  💾 Saved {len(enriched)} fields to DB")
                    success += 1
                else:
                    failed += 1
            elif DRY_RUN:
                print(f"  [DRY RUN] Would save: {json.dumps({k:v for k,v in enriched.items() if k not in ['embedding']}, ensure_ascii=False, indent=2)[:300]}")
                success += 1
            
        except Exception as e:
            print(f"  ❌ Error: {e}")
            import traceback; traceback.print_exc()
            failed += 1
        
        # Небольшая пауза между запросами
        if i < len(locations) - 1:
            time.sleep(1)
    
    print(f"\n{'='*60}")
    print(f"✅ Done! Success: {success}, Failed: {failed}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
