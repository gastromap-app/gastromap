### 1. GastroMap Project — Single Source of Truth / **Date:** 2026-04-22

**Репозиторий:** https://github.com/gastromap-app/gastromap  
**Локальная копия:** /app/gastromap_correct  
**Supabase:** https://supabase.com/dashboard/project/myyzguendoruefiiufop  
**Vercel:** https://vercel.com/gastromap-apps-projects/gastromap  
**Prod URL:** https://gastromap-five.vercel.app/  

Никаких связей с base44 по обогащению данных нет. KG enrichment — только через код в репо + Supabase напрямую.

---

### 2. Tech Stack / **Date:** 2026-04-22

React 18→19 + Vite, Supabase + pgvector, OpenRouter API, Tailwind, Framer Motion, Zustand. Deploy на Vercel. PWA-ready.

---

### 3. OpenRouter Free Models (April 2026) / **Date:** 2026-04-22

- `openai/gpt-oss-120b:free` — best JSON quality
- `nvidia/nemotron-3-super-120b-a12b:free` — 262K ctx, best RAG
- `arcee-ai/trinity-large-preview:free` — stable
- `nvidia/nemotron-nano-2-vl:free` — 12B multimodal, OCR/vision
- `google/gemma-4-31b-it:free` — multimodal, 256K ctx
- `google/gemma-3-27b-it:free`

---

### 4. VoiceBox (Open-Source TTS) / **Date:** 2026-04-19

Локальный десктоп: voice cloning + TTS, REST API на localhost:17453. Движки: Qwen3-TTS, Chatterbox, LuxTTS. Потенциал для GastroGuide голосовых ответов.

---

### 5. Migrations — статус / **Date:** 2026-04-22

Файл `supabase/migrations/20260422_hybrid_search_rrf.sql` создан и запушен.  
GitHub Actions (`apply-migration.yml`) должен применить автоматически при пуше.  
Нужно проверить статус в Actions — секреты `SUPABASE_DB_URL` и `SUPABASE_ACCESS_TOKEN` могут быть не настроены.  
Если не применилась — запустить вручную через Supabase Dashboard → SQL Editor.

RPC функции которые создаёт миграция:
- `search_locations_hybrid(query_embedding, query_text, ...)` — RRF hybrid
- `search_locations_fulltext(query_text, ...)` — FTS fallback

---

### 6. Правило разработки / **Date:** 2026-04-22

Перед новым функционалом — ВСЕГДА сначала обсудить логику с пользователем, получить явное "да, делай". Без этого — только багфиксы и рефакторинг.

---

