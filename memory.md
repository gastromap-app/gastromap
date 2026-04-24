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

### 7. Daily Research Automation — 23 апреля 2026 / **Date:** 2026-04-23

**Результаты исследования:**
- **Оценка 5/5 (READY_TO_IMPLEMENT):**
  1. Real-Time Bidirectional Streaming Agents (Google ADK) — 40h effort
  2. Gemma 4 Multimodal Vision — 30h effort

- **Оценка 4/5 (PROMISING):**
  3. Hybrid Cloud-Local LLM Routing — 20h effort
  4. AI Voice Ordering for Restaurants B2B — 60-200h effort

- **Оценка 3/5 (CONTEXT):**
  5. Tailwind CSS v4 native animations — 15h effort
  6. Eater App competitive benchmark — positioning

**Telegram уведомления отправлены:**
- Все 4 находки (5/5 + 4/5) с описанием применимости к GastroMap
- Рекомендация: делать streaming + vision параллельно в следующем спринте

**Файл сохранён:**
- DAILY_RESEARCH_2026-04-23.md — полный анализ с tech stack деталями для каждого инсайта

---

### 8. The 'Tokyo-style' brand design consists of a textured cream background, giant top-aligned typography that interacts with/overlaps the image, and a dominant bottom photograph.
**Date:** 2026-04-23

---

### 9. St. Mary's Basilica is a preferred landmark for Kraków-related visual content.
**Date:** 2026-04-23

---

### 10. The agent is responsible for monitoring luma.com/claudecommunity, claude.com/community, cerebralvalley.ai/events, and contra.com/community/topic/anythingremixathon for hackathons and events.
**Date:** 2026-04-23

---

### 11. The user wants the bot to be trained on the OpenAI Academy Prompt Packs library.
**Date:** 2026-04-23

---

### 12. @GasTestBase44_bot runs on a Hetzner server (IP: 46.225.225.243).
**Date:** 2026-04-23

---

### 13. The professional OpenAI Academy prompt library (300+ templates) is stored on the @GasTestBase44_bot server at `knowledge/PROMPT_PACKS.md`.
**Date:** 2026-04-23

---

### 14. @GasTestBase44_bot is instructed to load specific prompt categories from `knowledge/PROMPT_PACKS.md` only when necessary for marketing, sales, product, or strategy tasks.
**Date:** 2026-04-23

---

### 15. The user's name is Alik.
**Date:** 2026-04-23

---

### 16. The bot's name is Gas (derived from GastroMap).
**Date:** 2026-04-23

---

### 17. Gas bot configuration requires SOUL.md, IDENTITY.md, and USER.md to be included in 'extraPaths' to maintain persona consistency.
**Date:** 2026-04-23

---

### 18. The application now uses Supabase `app_settings` table as the single source of truth for configuration to persist settings across deployments.
**Date:** 2026-04-23

---

### 19. The system is configured to perform KG enrichment on locations using Google Places API and Apify as primary data sources.
**Date:** 2026-04-23

---

### 20. The Supabase service role key is required for batch updates to the location database.
**Date:** 2026-04-23

---

### 21. Daily Marketing Post Automation — April 24, 2026 / **Date:** 2026-04-24

**Post Type:** TYPE-B (Location) — alternating from previous TYPE-A
**Format:** FORMAT 4 (SEASONAL/EVENT)
**Content:** Art & Food Bazar at Stary Kleparz, April 26, 2026 (TODAY - 11:00-17:00)

**Trending Findings:**
1. Art & Food Bazar: Stary Kleparz outdoor market with 120+ artisanal food vendors, crafts, wine
2. Trending Dishes: Potato pancakes (modern), pho, truffle pizza, Indian (Gate of India), tiramisu
3. New Openings: Yoshi Kitsune (Bożego Ciała 10, opening March 2026)
4. Content Inspiration: krakowcityguide (130K followers, lifestyle focus), gastromiasto_krakow (festival events)

**Design Direction:**
- Style: Style 4 (Photo-Led Editorial)
- Exposure: Warm golden hour, natural sunlight, shallow depth of field
- Color Palette: Golds (#D4AF37), creams (#F5E6D3), rust earth (#C1440E), sage green (#7A9B6D)
- Typography: "ART & FOOD BAZAR" large, "Stary Kleparz, Kraków" medium, "gastromap.app" tiny
- Atmosphere: Bustling market with blurred crowd, artisanal food displays, St. Mary's Basilica soft background

**Image Generation Status:** Failed on April 24, 10:00 UTC (validation error in generate_image tool)
- Will retry next automation run
- Fallback: Use manual graphic design or prepare high-quality reference photos

**Caption Structure (Per GASTROMAP_BRAND.md):**
HOOK: Intriguing question or statement (no place name)
Format: "What happens when art meets food? 🎨🍴"
Lines: ~3 max + hashtags
Always include: 👉 gastromap.app #GastroMap #Kraków #foodkrakow
Tone: Friend recommending

---
