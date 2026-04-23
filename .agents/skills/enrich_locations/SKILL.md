# enrich_locations

Обогащает локации GastroMap данными из Google Places, Apify (TripAdvisor), Web Search и LLM.

## Что заполняет
- description, insider_tip, must_try
- tags, cuisine_types, dietary_options, best_for, special_labels
- opening_hours, google_rating, google_photos, image_url
- amenities, outdoor_seating, noise_level, best_time_to_visit
- Все google_* поля

## Запуск
```
python3 enrich_locations.py
```

## Env variables
- GASTROMAP_SUPABASE_URL
- GASTROMAP_SUPABASE_SERVICE_KEY
- GOOGLE_PLACES_API_KEY
- APIFY_API_KEY
- OPENROUTER_API_KEY (опционально)
- BRAVE_SEARCH_API_KEY (опционально)
- BATCH_SIZE (default: 5)
- MAX_LOCATIONS (default: 999)
- DRY_RUN (default: false)
