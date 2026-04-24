#!/usr/bin/env python3
"""
GastroMap — Full 3-Source Enrichment Pipeline
Sources:
  1. Apify Google Maps (photos, hours, rating, reviews, amenities)
  2. DuckDuckGo / web search (extra facts, blog mentions, hashtags)
  3. LLM synthesis via OpenRouter (insider tip, must_try, tags, labels, best_time)

Usage:
  python3 enrich_full.py            # all locations without image_url
  python3 enrich_full.py --test 2   # test on N locations
  python3 enrich_full.py --dry      # dry run (no DB writes)
  python3 enrich_full.py --all      # re-enrich all (even with photos)
"""

import os, sys, json, time, re, requests
from datetime import datetime, timezone

# ─── CONFIG ─────────────────────────────────────────────────
SUPABASE_URL  = os.environ.get("GASTROMAP_SUPABASE_URL", "")
SUPABASE_KEY  = os.environ.get("GASTROMAP_SUPABASE_SERVICE_KEY", "")
APIFY_KEY     = os.environ.get("APIFY_API_KEY", "")
OPENROUTER_KEY= os.environ.get("OPENROUTER_API_KEY", "")
BRAVE_KEY     = os.environ.get("BRAVE_SEARCH_API_KEY", "")

DRY_RUN  = "--dry"  in sys.argv
ALL_MODE = "--all"  in sys.argv
TEST_N   = int(sys.argv[sys.argv.index("--test")+1]) if "--test" in sys.argv else None

SUPA_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# Только реально существующие колонки в таблице
VALID_COLS = {
    "image_url","photos","opening_hours","google_rating","description",
    "cuisine_types","amenities","has_outdoor_seating","has_wifi","updated_at",
    "what_to_try","tags","special_labels","dietary_options","vibe","best_for",
    "insider_tip","price_range","michelin_stars","michelin_bib","kg_enriched_at"
}

# ─── SUPABASE ────────────────────────────────────────────────
def fetch_locations(limit=500):
    params = {
        "select": ",".join(["id","title","city","country","address","description",
                            "insider_tip","what_to_try","tags","image_url","photos",
                            "opening_hours","cuisine_types","amenities","has_outdoor_seating",
                            "has_wifi","vibe","best_for","special_labels","dietary_options"]),
        "status": "eq.approved",
        "limit": limit,
        "order": "created_at.asc"
    }
    if not ALL_MODE:
        params["image_url"] = "is.null"

    r = requests.get(f"{SUPABASE_URL}/rest/v1/locations", headers=SUPA_HEADERS, params=params)
    return r.json() if r.status_code == 200 else []

def save_location(loc_id, data):
    clean = {k: v for k, v in data.items() if k in VALID_COLS}
    if DRY_RUN:
        print(f"    [DRY] Would save: {list(clean.keys())}")
        return True
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/locations?id=eq.{loc_id}",
        headers=SUPA_HEADERS, json=clean
    )
    return r.status_code in (200, 204)

# ─── SOURCE 1: APIFY GOOGLE MAPS ─────────────────────────────
def apify_google_maps(queries, max_reviews=20):
    """
    Один запрос на батч мест.
    Включает: фото, часы, рейтинг, отзывы (для анализа), атрибуты, категории.
    """
    r = requests.post(
        "https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items",
        headers={"Authorization": f"Bearer {APIFY_KEY}", "Content-Type": "application/json"},
        json={
            "searchStringsArray": queries,
            "language": "en",
            "maxCrawledPlacesPerSearch": 1,
            "scrapeImages": True,
            "maxImages": 10,
            "scrapeReviews": True,
            "maxReviews": max_reviews,
            "reviewsSort": "newest",
            "scrapeReviewsPersonalData": False,
        },
        params={"timeout": 300},
        timeout=320
    )
    if r.status_code in (200, 201):
        return r.json()
    print(f"  ❌ Apify error {r.status_code}: {r.text[:200]}")
    return []

def parse_additional_info(ai):
    """additionalInfo = list of {category: [{attr: bool}]}"""
    result = {}
    if not ai: return result
    items = ai if isinstance(ai, list) else [ai]
    for item in items:
        if isinstance(item, dict):
            for cat, attrs in item.items():
                result[cat] = {}
                if isinstance(attrs, list):
                    for a in attrs:
                        if isinstance(a, dict):
                            result[cat].update(a)
    return result

def extract_google_data(res, loc):
    """Извлекает все полезные данные из Apify Google Maps ответа"""
    data = {}

    # Фото
    img_urls = res.get("imageUrls", []) or []
    if img_urls:
        data["image_url"] = img_urls[0]
        data["photos"]    = img_urls[:10]

    # Рейтинг
    if res.get("totalScore"):   data["google_rating"]  = res["totalScore"]

    # Часы
    oh = res.get("openingHours", []) or []
    if oh and not loc.get("opening_hours"):
        data["opening_hours"] = "; ".join([f"{h['day']}: {h['hours']}" for h in oh if h.get("day")])

    # Категории → cuisine
    cats = res.get("categories", []) or []
    if cats and not loc.get("cuisine_types"):
        data["cuisine_types"] = cats[:5]

    # Описание
    if res.get("description") and not loc.get("description"):
        data["description"] = res["description"]

    # additionalInfo
    ai = parse_additional_info(res.get("additionalInfo"))
    svc = ai.get("Service options", {})
    amenities = [k for k, v in svc.items() if v][:6]
    if amenities and not loc.get("amenities"):
        data["amenities"] = amenities

    atm = ai.get("Atmosphere", {})
    if atm.get("Outdoor seating") and not loc.get("has_outdoor_seating"):
        data["has_outdoor_seating"] = True
    if atm.get("Wi-Fi") and not loc.get("has_wifi"):
        data["has_wifi"] = True

    # Dietary из Google
    offerings = ai.get("Offerings", {})
    dietary = []
    if offerings.get("Vegan options"):      dietary.append("vegan")
    if offerings.get("Vegetarian options"): dietary.append("vegetarian")
    if offerings.get("Gluten-free options"):dietary.append("gluten-free")
    if dietary and not loc.get("dietary_options"):
        data["dietary_options"] = dietary

    # Извлекаем текст отзывов для LLM анализа
    reviews = res.get("reviews", []) or []
    review_texts = []
    for rv in reviews[:20]:
        txt = rv.get("text", "") or rv.get("textTranslated", "")
        if txt and len(txt) > 30:
            review_texts.append(txt[:300])

    return data, review_texts

def match_apify(loc_title, city, results):
    """Сопоставляем локацию с результатом Apify"""
    def norm(s):
        return re.sub(r'[^\w\s]', ' ',
               (s or "").lower()
               .replace("restauracja","").replace("kawiarnia","")
               .replace("café","cafe").replace("bistro","")).strip()

    t = norm(loc_title)
    words = set(t.split()) - {""}
    best, best_score = None, 0

    for res in results:
        rt = norm(res.get("title",""))
        rc = (res.get("city","") or "").lower()
        rwords = set(rt.split()) - {""}

        if not words: continue
        overlap = len(words & rwords) / len(words)
        city_bonus = 0.25 if city.lower() in rc else 0
        score = overlap + city_bonus

        if score > best_score:
            best_score, best = score, res

    return best if best_score > 0.15 else None

# ─── SOURCE 2: WEB SEARCH ────────────────────────────────────
def web_search(query, max_results=5):
    """DuckDuckGo instant answers + web results"""
    results_text = []

    # DuckDuckGo Instant Answer
    try:
        r = requests.get("https://api.duckduckgo.com/", params={
            "q": query, "format": "json", "no_html": 1, "skip_disambig": 1
        }, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        data = r.json()
        if data.get("AbstractText"):
            results_text.append(f"DDG: {data['AbstractText'][:400]}")
        for rel in data.get("RelatedTopics", [])[:3]:
            if isinstance(rel, dict) and rel.get("Text"):
                results_text.append(rel["Text"][:200])
    except Exception as e:
        pass

    # Brave Search (если есть ключ)
    if BRAVE_KEY:
        try:
            r = requests.get("https://api.search.brave.com/res/v1/web/search",
                headers={"Accept": "application/json", "X-Subscription-Token": BRAVE_KEY},
                params={"q": query, "count": max_results, "language": "en"},
                timeout=10)
            if r.status_code == 200:
                for res in r.json().get("web", {}).get("results", [])[:max_results]:
                    snippet = f"{res.get('title','')}: {res.get('description','')}"
                    results_text.append(snippet[:300])
        except Exception as e:
            pass
    else:
        # Fallback: DuckDuckGo HTML search
        try:
            r = requests.get("https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (compatible; GastroBot/1.0)"},
                timeout=10)
            # Простой парсинг сниппетов
            matches = re.findall(r'<a class="result__snippet"[^>]*>(.*?)</a>', r.text, re.DOTALL)
            for m in matches[:5]:
                clean = re.sub(r'<[^>]+>', '', m).strip()
                if len(clean) > 30:
                    results_text.append(clean[:300])
        except Exception as e:
            pass

    return "\n".join(results_text)

# ─── SOURCE 3: LLM SYNTHESIS ─────────────────────────────────
def llm_synthesize(loc, google_data, review_texts, web_info):
    """
    LLM анализирует все 3 источника и генерирует полную карточку.
    Использует OpenRouter если есть ключ, иначе возвращает None (данные из Google+Web).
    """
    if not OPENROUTER_KEY:
        return None

    # Формируем контекст
    ctx_parts = []

    if google_data.get("description"):
        ctx_parts.append(f"Google description: {google_data['description']}")
    if google_data.get("google_rating"):
        ctx_parts.append(f"Google rating: {google_data['google_rating']}/5")
    if google_data.get("cuisine_types"):
        ctx_parts.append(f"Categories: {', '.join(google_data['cuisine_types'])}")
    if google_data.get("opening_hours"):
        ctx_parts.append(f"Hours: {google_data['opening_hours'][:150]}")
    if google_data.get("amenities"):
        ctx_parts.append(f"Amenities: {', '.join(google_data['amenities'])}")
    if google_data.get("dietary_options"):
        ctx_parts.append(f"Dietary: {', '.join(google_data['dietary_options'])}")

    if review_texts:
        ctx_parts.append(f"\n--- GOOGLE REVIEWS ({len(review_texts)}) ---")
        for i, rv in enumerate(review_texts[:15], 1):
            ctx_parts.append(f"{i}. {rv}")

    if web_info and len(web_info) > 50:
        ctx_parts.append(f"\n--- WEB/SOCIAL INFO ---\n{web_info[:1500]}")

    context = "\n".join(ctx_parts)

    prompt = f"""You are a food & travel expert enriching a restaurant database for GastroMap app (Poland).

LOCATION: {loc['title']}
CITY: {loc.get('city','')}, {loc.get('country','')}
ADDRESS: {loc.get('address','')}
EXISTING description: {loc.get('description') or 'empty'}
EXISTING insider_tip: {loc.get('insider_tip') or 'empty'}
EXISTING what_to_try: {loc.get('what_to_try') or 'empty'}

DATA FROM 3 SOURCES:
{context}

Based on all data above, generate a rich JSON card. Be SPECIFIC — use actual dish names, real details from reviews, concrete insider knowledge. Avoid generic phrases.

Return ONLY valid JSON:
{{
  "description": "2-3 sentences. Atmospheric, specific, unique selling point. No generic 'cozy atmosphere'.",
  "insider_tip": "1 concrete tip locals know: best seat/table, secret menu item, time to avoid crowds, local hack.",
  "what_to_try": ["Dish 1 with brief note", "Dish 2", "Drink recommendation"],
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6"],
  "special_labels": ["hidden gem OR local favorite OR Instagram spot OR historic OR rooftop OR live music etc"],
  "vibe": "one of: romantic | cozy | lively | hipster | classic | family | business | trendy | bohemian | zen",
  "best_for": ["date night","solo","groups","brunch","business","families","locals"],
  "best_time_to_visit": "morning|lunch|afternoon|evening|late night|weekend morning",
  "noise_level": "quiet|moderate|loud",
  "price_impression": "$|$$|$$$|$$$$",
  "dietary_highlights": ["vegetarian","vegan","gluten-free"] or [],
  "standout_features": ["What makes it genuinely special — max 3 items"]
}}

Rules:
- insider_tip must be ACTIONABLE and SPECIFIC (not "great atmosphere")
- what_to_try must list REAL dishes mentioned in reviews/description
- tags: mix of atmosphere, food type, occasion, neighborhood vibe
- special_labels: only apply if clearly warranted by the data
- If data is insufficient for a field, use null"""

    models = [
        "google/gemma-3-27b-it:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "arcee-ai/trinity-large-preview:free",
    ]

    for model in models:
        try:
            r = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENROUTER_KEY}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 1000,
                    "temperature": 0.6
                },
                timeout=30
            )
            if r.status_code == 200:
                content = r.json()["choices"][0]["message"]["content"].strip()
                # Вырезаем JSON из markdown блока если есть
                if "```" in content:
                    m = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
                    if m: content = m.group(1).strip()
                return json.loads(content)
        except Exception as e:
            print(f"    ⚠️ LLM {model.split('/')[1]}: {e}")
            continue
    return None

# ─── BUILD FINAL UPDATE ──────────────────────────────────────
def build_final_update(loc, google_data, llm_data):
    """Мержим данные: LLM побеждает если качественнее"""
    upd = {**google_data}  # базовые данные из Google

    if llm_data:
        # Описание — берём LLM если существующее слабое
        existing_desc = loc.get("description","") or ""
        llm_desc = llm_data.get("description","") or ""
        if llm_desc and (not existing_desc or len(llm_desc) > len(existing_desc)):
            upd["description"] = llm_desc

        # insider_tip — почти всегда берём LLM
        if llm_data.get("insider_tip") and not loc.get("insider_tip"):
            upd["insider_tip"] = llm_data["insider_tip"]

        # what_to_try
        if llm_data.get("what_to_try") and not loc.get("what_to_try"):
            wtt = llm_data["what_to_try"]
            upd["what_to_try"] = wtt if isinstance(wtt, list) else [wtt]

        # tags
        if llm_data.get("tags") and not loc.get("tags"):
            upd["tags"] = llm_data["tags"][:8]

        # special_labels
        if llm_data.get("special_labels"):
            upd["special_labels"] = llm_data["special_labels"][:3]

        # vibe
        if llm_data.get("vibe") and not loc.get("vibe"):
            upd["vibe"] = llm_data["vibe"]

        # best_for
        if llm_data.get("best_for") and not loc.get("best_for"):
            upd["best_for"] = llm_data["best_for"][:5]

        # dietary
        if llm_data.get("dietary_highlights") and not loc.get("dietary_options"):
            upd["dietary_options"] = llm_data["dietary_highlights"]

    upd["kg_enriched_at"] = datetime.now(timezone.utc).isoformat()
    upd["updated_at"]     = datetime.now(timezone.utc).isoformat()

    return {k: v for k, v in upd.items() if k in VALID_COLS and v is not None}

# ─── MAIN ────────────────────────────────────────────────────
def main():
    print("="*60)
    print("🍽️  GastroMap — Full 3-Source Enrichment")
    print(f"   Dry run: {DRY_RUN} | All mode: {ALL_MODE}")
    print(f"   OpenRouter: {'✅' if OPENROUTER_KEY else '❌ (no LLM synthesis)'}")
    print(f"   Brave Search: {'✅' if BRAVE_KEY else '⚠️ (DuckDuckGo fallback)'}")
    print("="*60)

    if not SUPABASE_KEY:
        print("❌ GASTROMAP_SUPABASE_SERVICE_KEY missing"); return
    if not APIFY_KEY:
        print("❌ APIFY_API_KEY missing"); return

    # Загружаем локации
    locs = fetch_locations(limit=TEST_N or 500)
    if TEST_N:
        locs = locs[:TEST_N]
    print(f"\n📊 Локаций для обработки: {len(locs)}\n")

    if not locs:
        print("✅ Нечего обрабатывать!"); return

    success = failed = no_match = 0
    BATCH = 8

    for batch_start in range(0, len(locs), BATCH):
        batch = locs[batch_start:batch_start+BATCH]
        batch_num = batch_start//BATCH + 1
        total_batches = (len(locs)+BATCH-1)//BATCH

        queries = [f"{l['title']} {l.get('city','')} {l.get('country','')}" for l in batch]
        print(f"[Батч {batch_num}/{total_batches}] {[l['title'] for l in batch]}")

        # SOURCE 1: Apify Google Maps (с отзывами)
        print(f"  🗺️  Apify Google Maps...", end=" ", flush=True)
        apify_results = apify_google_maps(queries, max_reviews=20)
        print(f"{len(apify_results)} результатов")

        for loc in batch:
            name = loc["title"]
            city = loc.get("city","")
            print(f"\n  📍 {name}")

            # Сопоставляем с Apify
            res = match_apify(name, city, apify_results)
            if not res:
                print(f"     ⚠️ Не найдено в Google Maps"); no_match += 1; continue

            print(f"     → '{res.get('title')}' ⭐{res.get('totalScore','?')} ({res.get('reviewsCount','?')} отзывов)")

            # Извлекаем Google данные + тексты отзывов
            google_data, review_texts = extract_google_data(res, loc)
            print(f"     📸 {len(google_data.get('photos',[]))} фото | 💬 {len(review_texts)} отзывов")

            # SOURCE 2: Web search
            web_query = f"{name} {city} restaurant review insider tips must try"
            print(f"     🌐 Web search...", end=" ", flush=True)
            web_info = web_search(web_query)
            print(f"{'✅' if web_info else '⚠️ пусто'}")

            # SOURCE 3: LLM синтез
            llm_data = None
            if OPENROUTER_KEY and (review_texts or web_info):
                print(f"     🤖 LLM synthesis...", end=" ", flush=True)
                llm_data = llm_synthesize(loc, google_data, review_texts, web_info)
                print(f"{'✅ ' + str(list(llm_data.keys())[:4]) if llm_data else '⚠️ failed'}")

            # Финальный апдейт
            final_upd = build_final_update(loc, google_data, llm_data)

            if len(final_upd) <= 2:  # только timestamps
                print(f"     ⚠️ Мало данных"); no_match += 1; continue

            ok = save_location(loc["id"], final_upd)
            saved_fields = [k for k in final_upd if k not in ("updated_at","kg_enriched_at")]
            print(f"     {'💾 СОХРАНЕНО' if ok else '❌ ОШИБКА'}: {saved_fields}")

            if ok: success += 1
            else:  failed += 1

        print(f"\n  Прогресс: ✅{success} | ❌{failed} | ⚠️{no_match}")
        time.sleep(1)

    print(f"\n{'='*60}")
    print(f"ФИНАЛ: ✅ {success} | ❌ {failed} | ⚠️ без данных: {no_match}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
