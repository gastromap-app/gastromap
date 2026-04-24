#!/usr/bin/env python3
"""
GastroMap — Sequential Enrichment (1 Apify call per location)
Решает проблему memory limit на Free плане.
"""

import os, sys, json, time, re, requests
from datetime import datetime, timezone

SUPABASE_URL  = os.environ.get("GASTROMAP_SUPABASE_URL", "")
SUPABASE_KEY  = os.environ.get("GASTROMAP_SUPABASE_SERVICE_KEY", "")
APIFY_KEY     = os.environ.get("APIFY_API_KEY", "")

DRY_RUN = "--dry" in sys.argv
SKIP    = int(sys.argv[sys.argv.index("--skip")+1]) if "--skip" in sys.argv else 0
LIMIT   = int(sys.argv[sys.argv.index("--limit")+1]) if "--limit" in sys.argv else 500

SUPA_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

VALID_COLS = {
    "image_url","photos","opening_hours","google_rating","description",
    "cuisine_types","amenities","has_outdoor_seating","has_wifi","updated_at",
    "what_to_try","tags","special_labels","dietary_options","vibe","best_for",
    "insider_tip","kg_enriched_at"
}

def fetch_locations():
    r = requests.get(f"{SUPABASE_URL}/rest/v1/locations", headers=SUPA_HEADERS, params={
        "select": "id,title,city,country,address,description,insider_tip,what_to_try,tags,image_url,opening_hours,cuisine_types,amenities,has_outdoor_seating,has_wifi,vibe,best_for,special_labels,dietary_options",
        "image_url": "is.null",
        "status": "eq.approved",
        "limit": LIMIT,
        "order": "created_at.asc",
        "offset": SKIP
    })
    return r.json() if r.status_code == 200 else []

def wait_for_apify_free(max_wait=120):
    """Ждём пока Apify освободится"""
    for _ in range(max_wait // 5):
        r = requests.get("https://api.apify.com/v2/actor-runs",
            headers={"Authorization": f"Bearer {APIFY_KEY}"},
            params={"status": "RUNNING", "limit": 5})
        items = r.json().get("data",{}).get("items",[])
        if not items:
            return True
        # Пытаемся abort
        for it in items:
            requests.post(f"https://api.apify.com/v2/actor-runs/{it['id']}/abort",
                headers={"Authorization": f"Bearer {APIFY_KEY}"})
        time.sleep(5)
    return False

def apify_single(query):
    """Один запрос — одно место, с отзывами"""
    # Ждём свободного слота
    if not wait_for_apify_free(60):
        print("    ⚠️ Apify занят, пропускаем")
        return None

    try:
        r = requests.post(
            "https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items",
            headers={"Authorization": f"Bearer {APIFY_KEY}", "Content-Type": "application/json"},
            json={
                "searchStringsArray": [query],
                "language": "en",
                "maxCrawledPlacesPerSearch": 1,
                "scrapeImages": True,
                "maxImages": 10,
                "scrapeReviews": True,
                "maxReviews": 15,
                "reviewsSort": "newest",
                "scrapeReviewsPersonalData": False,
            },
            params={"timeout": 120},
            timeout=130
        )
        if r.status_code in (200, 201):
            items = r.json()
            return items[0] if items else None
        print(f"    ❌ Apify {r.status_code}: {r.text[:150]}")
        return None
    except Exception as e:
        print(f"    ❌ Apify exception: {e}")
        return None

def parse_additional_info(ai):
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

def build_update(loc, res):
    upd = {}
    imgs = res.get("imageUrls", []) or []
    if imgs:
        upd["image_url"] = imgs[0]
        upd["photos"]    = imgs[:10]

    if res.get("totalScore"): upd["google_rating"] = res["totalScore"]

    oh = res.get("openingHours", []) or []
    if oh and not loc.get("opening_hours"):
        upd["opening_hours"] = "; ".join(f"{h['day']}: {h['hours']}" for h in oh if h.get("day"))

    cats = res.get("categories", []) or []
    if cats and not loc.get("cuisine_types"):
        upd["cuisine_types"] = cats[:5]

    if res.get("description") and not loc.get("description"):
        upd["description"] = res["description"]

    ai = parse_additional_info(res.get("additionalInfo"))
    svc = ai.get("Service options", {})
    amenities = [k for k, v in svc.items() if v][:6]
    if amenities and not loc.get("amenities"):
        upd["amenities"] = amenities

    atm = ai.get("Atmosphere", {})
    if atm.get("Outdoor seating") and not loc.get("has_outdoor_seating"):
        upd["has_outdoor_seating"] = True
    if atm.get("Wi-Fi") and not loc.get("has_wifi"):
        upd["has_wifi"] = True

    off = ai.get("Offerings", {})
    dietary = []
    if off.get("Vegan options"):        dietary.append("vegan")
    if off.get("Vegetarian options"):   dietary.append("vegetarian")
    if off.get("Gluten-free options"):  dietary.append("gluten-free")
    if dietary and not loc.get("dietary_options"):
        upd["dietary_options"] = dietary

    # Анализ отзывов — простой паттерн-матчинг для insider tip и must try
    reviews = res.get("reviews", []) or []
    review_texts = [rv.get("text") or rv.get("textTranslated","") for rv in reviews[:15]]
    review_texts = [t for t in review_texts if t and len(t) > 30]

    if review_texts and not loc.get("what_to_try"):
        # Ищем упоминания блюд в отзывах
        dish_patterns = r'\b([A-Z][a-z]+(?: [a-z]+){0,2})\b'
        dishes = []
        food_keywords = {"pie","cake","coffee","soup","steak","fish","pasta","pizza",
                        "dumplings","pierogi","żurek","bigos","kotlet","duck","pork",
                        "cheesecake","bread","cocktail","wine","beer","tea","hot chocolate"}
        for text in review_texts[:5]:
            for word in text.lower().split():
                clean = word.strip(".,!?;:'\"")
                if clean in food_keywords and clean not in [d.lower() for d in dishes]:
                    dishes.append(clean.title())
        if dishes:
            upd["what_to_try"] = dishes[:4]

    upd["kg_enriched_at"] = datetime.now(timezone.utc).isoformat()
    upd["updated_at"]     = datetime.now(timezone.utc).isoformat()
    return {k: v for k, v in upd.items() if k in VALID_COLS}

def save(loc_id, data):
    if DRY_RUN:
        print(f"    [DRY] {list(data.keys())}")
        return True
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/locations?id=eq.{loc_id}",
        headers=SUPA_HEADERS, json=data
    )
    return r.status_code in (200, 204)

def main():
    print(f"{'='*55}")
    print(f"🍽️  GastroMap Sequential Enrichment  skip={SKIP}")
    print(f"{'='*55}")

    locs = fetch_locations()
    print(f"📊 Локаций: {len(locs)}\n")
    if not locs: print("Ничего нет!"); return

    ok = fail = skip = 0

    for i, loc in enumerate(locs, 1):
        name = loc["title"]
        city = loc.get("city","")
        query = f"{name} {city} {loc.get('country','')}"

        print(f"[{i}/{len(locs)}] {name}")

        res = apify_single(query)
        if not res:
            print(f"  ⚠️ Нет данных"); skip += 1; continue

        print(f"  → '{res.get('title')}' ⭐{res.get('totalScore','?')} ({res.get('reviewsCount','?')} отз.)")

        upd = build_update(loc, res)
        saved_fields = [k for k in upd if k not in ("updated_at","kg_enriched_at")]

        if len(saved_fields) == 0:
            print(f"  ⚠️ Нечего сохранять"); skip += 1; continue

        if save(loc["id"], upd):
            print(f"  ✅ {saved_fields}")
            ok += 1
        else:
            print(f"  ❌ Ошибка сохранения"); fail += 1

        # Пауза между запросами — не перегружаем Apify
        time.sleep(3)

    print(f"\n{'='*55}")
    print(f"ИТОГ: ✅{ok} сохранено | ❌{fail} ошибок | ⚠️{skip} без данных")
    print(f"{'='*55}")

if __name__ == "__main__":
    main()
