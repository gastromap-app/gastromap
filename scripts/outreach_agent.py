#!/usr/bin/env python3
"""
GastroMap Outreach Agent
Finds locations without contacts, searches Instagram/email via Brave,
generates bilingual (PL + EN) outreach messages, sends to Telegram.
"""

import os
import sys
import json
import time
import requests

# ── Config ─────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("GASTROMAP_SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("GASTROMAP_SUPABASE_SERVICE_KEY", "")
BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY", "")
TELEGRAM_BOT_TOKEN = os.environ.get("GASTROMAP_TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("GASTROMAP_TELEGRAM_CHAT_ID", "")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

BATCH_SIZE = int(os.environ.get("OUTREACH_BATCH_SIZE", "20"))

HEADERS_SB = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# ── Supabase ────────────────────────────────────────────────────────────────
def fetch_locations_without_contacts(limit=BATCH_SIZE):
    """Fetch locations that have no instagram, email, or website yet."""
    url = (
        f"{SUPABASE_URL}/rest/v1/locations"
        f"?select=id,title,address,city,category,description,cuisine_types,tags,kg_profile,what_to_try,insider_tip,social_instagram,website,phone"
        f"&status=eq.approved"
        f"&social_instagram=is.null"
        f"&outreach_sent=is.null"
        f"&order=created_at.asc"
        f"&limit={limit}"
    )
    r = requests.get(url, headers=HEADERS_SB)
    if r.status_code != 200:
        # Fallback without outreach_sent filter (column may not exist)
        url2 = (
            f"{SUPABASE_URL}/rest/v1/locations"
            f"?select=id,title,address,city,category,description,cuisine_types,tags,what_to_try,insider_tip,social_instagram,website,phone"
            f"&status=eq.approved"
            f"&social_instagram=is.null"
            f"&order=created_at.asc"
            f"&limit={limit}"
        )
        r = requests.get(url2, headers=HEADERS_SB)
    r.raise_for_status()
    return r.json()

def mark_outreach_sent(location_id):
    """Mark location as outreach sent (if column exists)."""
    url = f"{SUPABASE_URL}/rest/v1/locations?id=eq.{location_id}"
    requests.patch(url, headers=HEADERS_SB, json={"outreach_sent": True})

def update_location_contacts(location_id, instagram=None, website=None, email=None):
    """Save found contacts back to Supabase."""
    data = {}
    if instagram:
        data["social_instagram"] = instagram
    if website:
        data["website"] = website
    if email:
        # store in moderation_note temporarily if no email column
        pass
    if data:
        url = f"{SUPABASE_URL}/rest/v1/locations?id=eq.{location_id}"
        requests.patch(url, headers=HEADERS_SB, json=data)

# ── Brave Search ────────────────────────────────────────────────────────────
def brave_search(query, count=5):
    """Search via Brave Search API."""
    if not BRAVE_API_KEY:
        return []
    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
    }
    params = {"q": query, "count": count, "country": "PL", "lang": "pl"}
    try:
        r = requests.get(url, headers=headers, params=params, timeout=10)
        if r.status_code == 200:
            data = r.json()
            results = data.get("web", {}).get("results", [])
            return results
    except Exception as e:
        print(f"  Brave search error: {e}")
    return []

def find_contacts(location):
    """Search for Instagram and email for a location."""
    name = location.get("title", "")
    city = location.get("city", "Kraków")
    
    instagram_url = location.get("social_instagram") or ""
    website = location.get("website") or ""
    found_email = ""
    
    if not instagram_url:
        # Search for Instagram
        query = f'site:instagram.com "{name}" {city} restauracja kawiarnia'
        results = brave_search(query, count=5)
        for res in results:
            url_r = res.get("url", "")
            if "instagram.com/" in url_r and "/p/" not in url_r and "/reel/" not in url_r:
                # Clean up to get handle
                parts = url_r.rstrip("/").split("instagram.com/")
                if len(parts) > 1:
                    handle = parts[1].split("/")[0].split("?")[0]
                    if handle and len(handle) > 2 and handle not in ("explore", "p", "reel"):
                        instagram_url = f"https://www.instagram.com/{handle}/"
                        break
    
    if not website:
        # Search for website
        query2 = f'"{name}" {city} restauracja oficjalna strona'
        results2 = brave_search(query2, count=3)
        for res in results2:
            url_r = res.get("url", "")
            if "instagram.com" not in url_r and "facebook.com" not in url_r and "tripadvisor" not in url_r:
                website = url_r
                break
    
    if website and not found_email:
        # Try to find email via website search
        query3 = f'"{name}" {city} kontakt email'
        results3 = brave_search(query3, count=3)
        for res in results3:
            snippet = res.get("description", "") + res.get("title", "")
            import re
            emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", snippet)
            if emails:
                found_email = emails[0]
                break
    
    return instagram_url, website, found_email

# ── LLM Message Generation ───────────────────────────────────────────────────
def generate_outreach_message(location):
    """Generate bilingual outreach message via OpenRouter LLM."""
    name = location.get("title", "")
    city = location.get("city", "Kraków")
    category = location.get("category", "restauracja")
    description = location.get("description", "")
    cuisine = ""
    if location.get("cuisine_types"):
        ct = location["cuisine_types"]
        if isinstance(ct, list):
            cuisine = ", ".join(ct[:3])
        else:
            cuisine = str(ct)
    what_to_try = location.get("what_to_try", "")
    insider = location.get("insider_tip", "")

    # Build context for the prompt
    context_parts = []
    if description:
        context_parts.append(f"Opis: {description[:200]}")
    if cuisine:
        context_parts.append(f"Kuchnia: {cuisine}")
    if what_to_try:
        context_parts.append(f"Polecane dania: {what_to_try}")
    context_info = ". ".join(context_parts) if context_parts else ""

    prompt = f"""Jesteś asystentem aplikacji GastroMap (gastromap.app) — przewodnika gastronomicznego po Krakowie.

Napisz krótką, przyjazną wiadomość outreach do lokalu "{name}" w {city}, który jest {category}.
{f"Kontekst: {context_info}" if context_info else ""}

Wiadomość powinna:
1. Przedstawić GastroMap krótko (1 zdanie) — aplikacja odkrywania restauracji w Krakowie
2. Zaproponować dodanie lokalu do aplikacji
3. Poprosić o wypełnienie 4 pól z PRZYKŁADAMI jak to zrobić:
   - **Opis miejsca** (2-3 zdania o atmosferze, specjalności, co wyróżnia)
     Przykład dla {name}: "Przytulna kawiarnia z klimatem lat 20., słynąca z autorskiej kawy i domowych wypieków. Idealne miejsce na spokojne śniadanie lub popołudniową przerwę od miasta."
   - **What to try / Co polecamy** (2-3 dania lub napoje)
     Przykład: "Flat white z lokalnej palarni, tarta cytrynowa, bagel z łososiem"  
   - **Insider tip** (ukryta wskazówka, coś czego nie znajdziesz w Google)
     Przykład: "Poproś o stolik przy oknie — widok na podwórko jest absolutnie ukryty przed turystami"
   - **Social media / kontakt** (Instagram, strona, email)
4. Zakończyć przyjaznym zaproszeniem do odpowiedzi

Napisz wiadomość w dwóch wersjach:
🇵🇱 **Po polsku** (główna)
🇬🇧 **In English** (below)

Styl: ciepły, partnerski, nie korporacyjny. Bez zbędnego formalnego języka. Jak wiadomość od znajomego twórcy aplikacji.
Długość: max 200 słów każda wersja.
Format: zwykły tekst (nie markdown), gotowy do skopiowania i wklejenia w Instagram DM lub email."""

    if not OPENROUTER_API_KEY:
        # Fallback: template-based message
        return generate_template_message(location)

    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://gastromap.app",
                "X-Title": "GastroMap Outreach Agent",
            },
            json={
                "model": "google/gemma-3-27b-it:free",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 800,
                "temperature": 0.7,
            },
            timeout=30,
        )
        if r.status_code == 200:
            data = r.json()
            content = data["choices"][0]["message"]["content"]
            return content.strip()
        else:
            print(f"  LLM error {r.status_code}: {r.text[:200]}")
    except Exception as e:
        print(f"  LLM exception: {e}")

    return generate_template_message(location)

def generate_template_message(location):
    """Fallback template if LLM unavailable."""
    name = location.get("title", "")
    city = location.get("city", "Kraków")
    return f"""🇵🇱 Cześć! Tworzę GastroMap (gastromap.app) — aplikację odkrywania restauracji w {city}. Chciałbym dodać {name} do naszej mapy!

Czy możesz podzielić się kilkoma informacjami?

📝 Opis miejsca (czym się wyróżniacie, klimat, specjalność):
Przykład: "Przytulna kawiarnia z klimatem retro, słynąca z autorskiej kawy i domowych wypieków..."

🍽 Co polecacie (2-3 dania/napoje):
Przykład: "Flat white z lokalnej palarni, tarta cytrynowa, bagel z łososiem"

💡 Insider tip (coś czego nie znajdziesz w Google):
Przykład: "Poproś o stolik przy oknie — ukryty widok na podwórko"

🔗 Social media / kontakt (Instagram, strona, email)

Dziękuję za czas! 🙏 gastromap.app

---

🇬🇧 Hi! I'm building GastroMap (gastromap.app) — a restaurant discovery app for {city}. I'd love to add {name} to our map!

Could you share some info?

📝 About your place (what makes you unique, atmosphere, specialty):
Example: "A cozy retro-style café known for specialty coffee and homemade pastries..."

🍽 What to try (2-3 dishes/drinks):
Example: "Flat white from local roaster, lemon tart, salmon bagel"

💡 Insider tip (something not on Google):
Example: "Ask for the window seat — hidden courtyard view"

🔗 Social media / contact (Instagram, website, email)

Thank you! 🙏 gastromap.app"""

# ── Telegram ────────────────────────────────────────────────────────────────
def send_telegram(text):
    """Send message to Telegram."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("  [Telegram] No credentials, printing to stdout:")
        print(text)
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    try:
        r = requests.post(url, json=payload, timeout=10)
        if r.status_code != 200:
            print(f"  Telegram error: {r.text[:200]}")
    except Exception as e:
        print(f"  Telegram exception: {e}")

def format_telegram_card(location, instagram, website, email, message):
    """Format the full card to send to Telegram."""
    name = location.get("title", "?")
    city = location.get("city", "")
    address = location.get("address", "")

    lines = [f"<b>📍 {name}</b>"]
    if city or address:
        lines.append(f"<i>{address}, {city}</i>")
    lines.append("")

    # Contacts found
    contacts = []
    if instagram:
        contacts.append(f"📸 Instagram: {instagram}")
    if website:
        contacts.append(f"🌐 Website: {website}")
    if email:
        contacts.append(f"📧 Email: {email}")
    
    if contacts:
        lines.append("<b>Найденные контакты:</b>")
        lines.extend(contacts)
    else:
        lines.append("⚠️ Контакты не найдены — отправь вручную")
    
    lines.append("")
    lines.append("<b>— ГОТОВОЕ СООБЩЕНИЕ —</b>")
    lines.append("")
    
    # Telegram has 4096 char limit — trim message if needed
    msg_trimmed = message[:3000] if len(message) > 3000 else message
    lines.append(msg_trimmed)
    
    return "\n".join(lines)

# ── Main ────────────────────────────────────────────────────────────────────
def main():
    print(f"🚀 GastroMap Outreach Agent — batch of {BATCH_SIZE}")
    
    # Check required env
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Missing GASTROMAP_SUPABASE_URL or GASTROMAP_SUPABASE_SERVICE_KEY")
        sys.exit(1)
    
    # Fetch locations
    print("📥 Fetching locations without Instagram...")
    locations = fetch_locations_without_contacts(BATCH_SIZE)
    print(f"  Found {len(locations)} locations to process")
    
    if not locations:
        send_telegram("✅ GastroMap Outreach: Все локации уже обработаны или нет новых без Instagram.")
        return
    
    # Summary header
    send_telegram(f"🔎 <b>GastroMap Outreach Agent</b>\nНачинаю обработку {len(locations)} локаций...\n\nКаждое сообщение — готово к копированию в Instagram DM или email ✉️")
    time.sleep(1)
    
    processed = 0
    for i, loc in enumerate(locations, 1):
        name = loc.get("title", "?")
        print(f"\n[{i}/{len(locations)}] Processing: {name}")
        
        # 1. Find contacts
        print("  🔍 Searching contacts...")
        instagram, website, email = find_contacts(loc)
        print(f"  Instagram: {instagram or 'not found'}")
        print(f"  Website: {website or 'not found'}")
        print(f"  Email: {email or 'not found'}")
        
        # Save found contacts back to DB
        if instagram or website:
            update_location_contacts(loc["id"], instagram=instagram, website=website, email=email)
        
        # 2. Generate message
        print("  ✍️ Generating outreach message...")
        message = generate_outreach_message(loc)
        
        # 3. Send to Telegram
        card = format_telegram_card(loc, instagram, website, email, message)
        send_telegram(card)
        processed += 1
        
        # Rate limiting
        time.sleep(2)
    
    # Summary
    send_telegram(f"✅ <b>Outreach завершён</b>\nОбработано: {processed}/{len(locations)} локаций\n\nСкопируй сообщения выше и отправь напрямую в Instagram DM или email 🚀")
    print(f"\n✅ Done! Processed {processed} locations.")

if __name__ == "__main__":
    main()
