#!/usr/bin/env python3
"""
GastroMap Outreach Agent
Берёт локации из Supabase, ищет контакты, генерирует персональные письма,
записывает в Google Sheets.
"""

import os, sys, json, time, requests
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build

# === CONFIG ===
SUPABASE_URL = os.environ['GASTROMAP_SUPABASE_URL']
SUPABASE_KEY = os.environ['GASTROMAP_SUPABASE_SERVICE_KEY']
BRAVE_API_KEY = os.environ.get('BRAVE_API_KEY', '')
OPENROUTER_API_KEY = os.environ['OPENROUTER_API_KEY']
SPREADSHEET_ID = '16lj-xNxRUhx-gkwQdVj9vljo1ejyelpNwRlj0ODdVn4'
SERVICE_ACCOUNT_FILE = '/app/.agents/google-service-account.json'
BATCH_SIZE = 20

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def get_sheets_service():
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    return build('sheets', 'v4', credentials=creds)

def get_locations(limit=20, offset=0):
    """Берём локации у которых ещё нет outreach записи (статус пустой)"""
    url = f"{SUPABASE_URL}/rest/v1/locations"
    params = {
        'select': 'id,title,address,city,category,cuisine_types,kg_cuisines,social_instagram,website,phone,what_to_try,insider_tip,description,google_rating',
        'status': 'eq.published',
        'limit': str(limit),
        'offset': str(offset),
        'order': 'created_at.asc'
    }
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f"Bearer {SUPABASE_KEY}"
    }
    r = requests.get(url, params=params, headers=headers)
    return r.json() if r.status_code == 200 else []

def search_contacts(location_title, city="Kraków"):
    """Ищем контакты через Brave Search"""
    if not BRAVE_API_KEY:
        return {}
    
    query = f"{location_title} {city} kontakt email instagram"
    headers = {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY
    }
    params = {'q': query, 'count': 5, 'country': 'PL', 'lang': 'pl'}
    
    try:
        r = requests.get('https://api.search.brave.com/res/v1/web/search',
                        headers=headers, params=params, timeout=10)
        if r.status_code == 200:
            results = r.json().get('web', {}).get('results', [])
            # Ищем email и instagram в результатах
            contacts = {}
            for result in results[:3]:
                desc = result.get('description', '') + result.get('url', '')
                # Поиск instagram
                if 'instagram.com/' in desc and 'instagram' not in contacts:
                    import re
                    ig = re.search(r'instagram\.com/([a-zA-Z0-9._]+)', desc)
                    if ig:
                        contacts['instagram'] = f"@{ig.group(1)}"
                # Поиск email
                if '@' in desc and 'email' not in contacts:
                    email = re.search(r'[\w.-]+@[\w.-]+\.\w+', desc)
                    if email and 'example' not in email.group():
                        contacts['email'] = email.group()
            return contacts
    except Exception as e:
        print(f"Search error: {e}")
    return {}

def generate_message(location, lang='en'):
    """Генерирует персональное письмо от лица владельца GastroMap"""
    
    name = location.get('title', '')
    address = location.get('address', '')
    city = location.get('city', 'Kraków')
    category = location.get('category', 'restaurant')
    what_to_try = location.get('what_to_try', '')
    insider_tip = location.get('insider_tip', '')
    description = location.get('description', '')
    rating = location.get('google_rating', '')
    cuisines = location.get('kg_cuisines') or location.get('cuisine_types') or []
    if isinstance(cuisines, list):
        cuisines_str = ', '.join(cuisines[:3]) if cuisines else ''
    else:
        cuisines_str = str(cuisines)

    context = f"""
Location: {name}
Address: {address}, {city}
Category: {category}
Cuisines: {cuisines_str}
Google Rating: {rating}
Description: {description[:200] if description else 'N/A'}
What to try: {what_to_try[:150] if what_to_try else 'N/A'}
Insider tip: {insider_tip[:150] if insider_tip else 'N/A'}
"""

    if lang == 'en':
        prompt = f"""You are the founder of GastroMap (gastromap.app) — a curated food discovery app for Kraków. 
You personally reach out to local restaurants/cafes/bars to invite them to collaborate and enrich their listing on your platform.

Write a SHORT, warm, personal outreach message (NOT a template, NOT robotic) in English to the owner/manager of this place.

The message should:
- Sound like a real person writing, not a marketing email
- Be friendly but not overly formal
- Mention 1-2 specific things about THEIR place (use the context below)
- Explain briefly what GastroMap is and why it benefits them
- Ask if they'd like to add details like insider tips, photos, menu highlights
- Be 4-6 sentences max
- End with your name: "Alik, GastroMap founder"
- Include the app URL: gastromap.app

Context about the place:
{context}

Write ONLY the message text, nothing else."""

    else:  # Polish
        prompt = f"""Jesteś założycielem GastroMap (gastromap.app) — aplikacji odkrywania restauracji w Krakowie.
Osobiście kontaktujesz się z lokalnymi restauracjami/kawiarniami/barami, aby zaprosić je do współpracy.

Napisz KRÓTKĄ, ciepłą, osobistą wiadomość (NIE szablon, NIE robotyczną) po polsku do właściciela/managera tego miejsca.

Wiadomość powinna:
- Brzmieć jak napisana przez prawdziwą osobę, nie email marketingowy
- Być przyjazna, ale nie zbyt formalna
- Wspomnieć 1-2 konkretne rzeczy o ICH miejscu (użyj kontekstu poniżej)
- Krótko wyjaśnić czym jest GastroMap i dlaczego im się to opłaca
- Zapytać czy chcieliby dodać szczegóły: insider tipy, zdjęcia, menu highlights
- Maksymalnie 4-6 zdań
- Zakończyć: "Alik, założyciel GastroMap"
- Zawierać URL: gastromap.app

Kontekst o miejscu:
{context}

Napisz TYLKO treść wiadomości, nic więcej."""

    headers = {
        'Authorization': f"Bearer {OPENROUTER_API_KEY}",
        'Content-Type': 'application/json'
    }
    payload = {
        'model': 'google/gemma-3-27b-it:free',
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': 400,
        'temperature': 0.85
    }
    
    try:
        r = requests.post('https://openrouter.ai/api/v1/chat/completions',
                         headers=headers, json=payload, timeout=30)
        if r.status_code == 200:
            return r.json()['choices'][0]['message']['content'].strip()
    except Exception as e:
        print(f"LLM error: {e}")
    return ""

def get_existing_ids(service):
    """Получаем уже обработанные ID из таблицы"""
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range='Лист1!A2:A1000'
    ).execute()
    values = result.get('values', [])
    return set(row[0] for row in values if row)

def append_to_sheet(service, rows):
    """Добавляем строки в таблицу"""
    service.spreadsheets().values().append(
        spreadsheetId=SPREADSHEET_ID,
        range='Лист1!A1',
        valueInputOption='RAW',
        insertDataOption='INSERT_ROWS',
        body={'values': rows}
    ).execute()

def run(batch_size=20, offset=0):
    print(f"🚀 Starting GastroMap Outreach Agent — batch {batch_size}, offset {offset}")
    
    service = get_sheets_service()
    existing_ids = get_existing_ids(service)
    print(f"📊 Already processed: {len(existing_ids)} locations")
    
    locations = get_locations(limit=batch_size + 10, offset=offset)
    print(f"📍 Fetched {len(locations)} locations from Supabase")
    
    processed = 0
    rows_to_add = []
    
    for loc in locations:
        loc_id = str(loc.get('id', ''))
        
        if loc_id in existing_ids:
            print(f"⏭️  Skip {loc.get('title')} — already processed")
            continue
        
        if processed >= batch_size:
            break
            
        title = loc.get('title', 'Unknown')
        print(f"\n🔍 Processing: {title}")
        
        # Контакты из базы
        instagram = loc.get('social_instagram', '') or ''
        website = loc.get('website', '') or ''
        phone = loc.get('phone', '') or ''
        
        # Дополнительный поиск если нет контактов
        if not instagram and not website:
            print(f"   Searching contacts...")
            found = search_contacts(title)
            instagram = found.get('instagram', instagram)
            email_found = found.get('email', '')
        else:
            email_found = ''
        
        # Генерируем письма
        print(f"   Generating EN message...")
        msg_en = generate_message(loc, lang='en')
        time.sleep(1)
        
        print(f"   Generating PL message...")
        msg_pl = generate_message(loc, lang='pl')
        time.sleep(1)
        
        # GastroMap ссылка
        gastromap_url = f"https://gastromap-five.vercel.app/locations/{loc_id}"
        
        row = [
            loc_id,
            title,
            loc.get('address', ''),
            email_found,
            instagram,
            website,
            'New',
            msg_en,
            msg_pl,
            '',  # Дата отправки
            '',  # Ответ
            gastromap_url
        ]
        rows_to_add.append(row)
        processed += 1
        print(f"   ✅ Done ({processed}/{batch_size})")
    
    if rows_to_add:
        print(f"\n📝 Writing {len(rows_to_add)} rows to Google Sheets...")
        append_to_sheet(service, rows_to_add)
        print(f"✅ Successfully saved {len(rows_to_add)} locations!")
    else:
        print("⚠️  No new locations to process")
    
    return len(rows_to_add)

if __name__ == '__main__':
    offset = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    batch = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    count = run(batch_size=batch, offset=offset)
    print(f"\n🎉 Done! Processed {count} locations.")
