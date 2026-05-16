# 🗺️ GastroMap — Карта проекта для AI-навигации

> Обновлено: 2026-05-16 | Используется для быстрой ориентации в кодовой базе

---

## 📦 Что это

**GastroMap** — AI-powered PWA для поиска ресторанов. Пользователь находит место через карту, поиск или AI-чат (GastroGuide), сохраняет в избранное, отмечает посещения, оставляет отзывы. Есть Admin-панель, Knowledge Graph, Dine With Me (social dining), и система подписок.

---

## 🏗️ Архитектура: Feature-Sliced Design (FSD)

```
src/
├── app/              → App.jsx, AppProviders.jsx, AppRouter.jsx
├── features/
│   ├── auth/         → LoginPage, SignUpPage, ForgotPassword, ResetPassword
│   ├── dashboard/    → DashboardPage, ExploreWrapper, SavedPage, VisitedPage, MapPage
│   ├── dinewithme/   → Dine With Me (social dining presence, nearby diners)
│   ├── public/       → LandingPage, LocationDetailsPage, PricingPage, AboutPage
│   ├── admin/        → Все /admin/* страницы, AdminLayout, hooks, components
│   └── shared/       → Общие компоненты между features
├── components/
│   ├── layout/       → MainLayout, PublicLayout, BottomNav, Headers
│   ├── ui/           → Button, Card, Badge, Input, Skeleton, Aurora effects
│   ├── guards/       → MaintenanceGuard, RequireAuth, RequireAdmin
│   └── pwa/          → InstallPrompt, OfflineIndicator
├── shared/
│   ├── api/          → Все API модули + React Query hooks (queries/)
│   ├── auth/         → useSession() — единый auth gate
│   ├── config/       → env.js, queryClient.js
│   ├── filters/      → useLocationFilters(), locationFilterEncoding.js
│   ├── store/        → Zustand stores (UI-only state)
│   ├── ui/           → DataSection (skeleton ceiling + error/retry)
│   ├── lib/          → SyncQueue, validateMessage, normalizeMessage
│   ├── hooks/        → useChatSync, shared hooks
│   ├── constants/    → App-wide constants
│   ├── types/        → TypeScript-like type definitions
│   └── utils/        → Utility functions
├── hooks/            → useTheme, useDebounce, useGeolocation, useI18n...
├── services/         → gastroIntelligence.js (AI fallback scoring)
├── locales/          → EN, PL, UA, RU переводы
├── mocks/            → MOCK_LOCATIONS (offline dev)
├── lib/              → geo.js (Haversine), cache.js
└── __tests__/        → Property-based tests (fast-check)
```

---

## 🛣️ Маршруты

### Public (без авторизации)

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/` | LandingPageV3 | Главная landing |
| `/login` | LoginPage | Вход |
| `/auth/signup` | SignUpPage | Регистрация |
| `/auth/forgot-password` | ForgotPasswordPage | Восстановление пароля |
| `/auth/callback` | AuthCallbackPage | OAuth callback |
| `/features` | FeaturesPage | Описание функций |
| `/pricing` | PricingPage | Тарифы |
| `/about` | AboutPage | О проекте |
| `/contact` | ContactPage | Контакты |
| `/blog` | BlogPage | Блог |
| `/terms` | TermsPage | Условия |
| `/privacy` | PrivacyPage | Политика конфиденциальности |
| `/location/:id` | LocationDetailsPage | Детали локации (public) |

### Private (требуется авторизация)

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/dashboard` | DashboardPage | Главный экран пользователя |
| `/explore` | ExploreWrapper | Обзор стран/городов |
| `/explore/:country/:city` | ExploreWrapper | Локации города |
| `/ai-guide` | AIGuidePage (GastroGuide) | AI-чат |
| `/map` | MapPage | Карта с маркерами |
| `/saved` | SavedPage | Избранное |
| `/visited` | VisitedPage | Посещённые |
| `/profile` | ProfilePage | Профиль |
| `/profile/edit` | ProfileEditPage | Редактирование профиля |
| `/dashboard/add-place` | AddPlacePage | Добавить место |
| `/dashboard/my-submissions` | MySubmissionsPage | Мои предложения |
| `/dashboard/leaderboard` | LeaderboardPage | Таблица лидеров |

### Admin (требуется role = 'admin')

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/admin` | AdminDashboardPage | Дашборд аналитики |
| `/admin/locations` | AdminLocationsPage | Управление локациями |
| `/admin/users` | AdminUsersPage | Управление пользователями |
| `/admin/moderation` | AdminModerationPage | Модерация отзывов/локаций |
| `/admin/ai` | AdminAIPage | AI Agents настройки + тест |
| `/admin/knowledge` | AdminKnowledgeGraphPage | Knowledge Graph |
| `/admin/dine-with-me` | AdminDineWithMePage | Dine With Me управление |
| `/admin/stats` | AdminStatsPage | Расширенная аналитика |
| `/admin/settings` | AdminSettingsPage | Настройки приложения |
| `/admin/geo-covers` | AdminGeoCoversPage | Обложки стран/городов |
| `/admin/menu-scanner` | AdminMenuScannerPage | OCR сканер меню |
| `/admin/subscriptions` | AdminSubscriptionsPage | Подписки |
| `/admin/notifications` | AdminNotificationsPage | Уведомления |

---

## 🗄️ База данных (Supabase PostgreSQL + pgvector)

### Core Tables

| Таблица | Назначение |
|---------|-----------|
| `locations` | Рестораны/кафе/бары (координаты, фильтры, AI-поля, embedding vector(768)) |
| `profiles` | Пользователи (extends auth.users), роль user/admin/moderator |
| `user_favorites` | Избранные локации |
| `user_visits` | История посещений |
| `reviews` | Отзывы (pending/published/rejected) |
| `location_translations` | Мультиязычные переводы (JSONB: en/pl/uk/ru) |
| `geo_covers` | Обложки стран и городов |

### Knowledge Graph

| Таблица | Назначение |
|---------|-----------|
| `cuisines` | Кухни мира (иерархия, embedding) |
| `dishes` | Блюда (ингредиенты, категории) |
| `ingredients` | Ингредиенты (аллергены, сезонность) |
| `vibes` | Атмосфера/настроение |
| `tags` | Теги (occasion, feature, label) |
| `location_cuisines` | M2M: локации ↔ кухни |
| `location_dishes` | M2M: локации ↔ блюда |
| `location_vibes` | M2M: локации ↔ vibes |

### Social & Engagement

| Таблица | Назначение |
|---------|-----------|
| `dining_presence` | Dine With Me — текущее присутствие пользователей |
| `dine_with_me_waitlist` | Waitlist для Dine With Me |
| `contributors` | Таблица лидеров (submissions, score) |
| `user_submissions` | Предложения пользователей (модерация) |
| `notifications` | История уведомлений |

### AI & Chat

| Таблица | Назначение |
|---------|-----------|
| `chat_sessions` | Сессии AI-чата |
| `chat_messages` | Сообщения (role, content, model_used) |
| `user_preferences` | Профиль предпочтений для AI персонализации |
| `app_settings` | Конфигурация AI (модели, промпты, температура) |

### Payments

| Таблица | Назначение |
|---------|-----------|
| `payments` | Stripe платежи |
| `subscriptions` | Подписки |
| `user_roles` | Роли и permissions |

### RPC Functions (pgvector)

| Функция | Назначение |
|---------|-----------|
| `search_locations_hybrid` | Гибридный поиск: pgvector cosine + FTS через RRF |
| `search_locations_fulltext` | Полнотекстовый поиск (fallback) |
| `search_locations_nearby` | PostGIS поиск по радиусу |
| `get_leaderboard` | Таблица лидеров с очками |
| `get_location_stats` | Статистика локаций для админки |

---

## 🤖 AI Система

### GastroGuide (пользовательский чат)

**Файлы:**
- `src/shared/api/ai/agents.js` — Agentic loop (tool calling)
- `src/shared/api/ai/tools.js` — Tool executor (search_locations, search_nearby, get_location_details, compare_locations)
- `src/shared/api/ai/search.js` — Semantic search (pgvector hybrid + FTS)
- `src/shared/api/ai/prompts.js` — System prompt builder (персонализация + KG context)
- `src/shared/api/ai/constants.js` — MODEL_CASCADE, TOOLS definitions
- `src/shared/api/ai/openrouter.js` — Proxy client (→ /api/ai/chat)

**Архитектура:**
```
User message
  → buildSystemPrompt() (персонализация + KG context)
  → runAgentPass() (agents.js)
    → fetchOpenRouter() → /api/ai/chat (Vercel) → OpenRouter API
    → If tool_calls detected (native or XML):
      → executeTool() (tools.js) → Supabase queries + semantic search
      → Send results back → Final text generation
  → Return { text, usedLocations, modelUsed }
```

**Server proxy**: `api/ai/chat.js` (Vercel serverless)
- `OPENROUTER_API_KEY` (server-side only)
- Cascade mode: перебирает модели при 429
- Direct mode: `_direct_model=true` для платных моделей (skip cascade)
- Admin cascade: `_cascade` array из admin config
- RAG enrichment: semantic search injection при food-related queries

### KG AI Agent (админский инструмент)

**Файлы:** `src/shared/api/kg-ai-agent.api.js`
- Обогащение Knowledge Graph через AI
- Brave Search (опционально, через `/api/locations/enrich`)
- Save endpoint: `POST /api/kg/save`

### Telegram Bot

**Файлы:** `api/telegram/process.js`, `api/telegram/webhook.js`
- Webhook-based бот для Telegram
- Использует тот же AI pipeline

---

## ⚡ State Management

> **Принцип (2026-05-16):** Server data → React Query ONLY. Zustand → UI state ONLY.

### React Query (серверные данные)

| Hook | Источник | Назначение |
|------|----------|-----------|
| `useLocations(filters)` | `locations.api.js` | Список локаций с фильтрами |
| `useInfiniteLocations(filters)` | `locations.api.js` | Пагинация (infinite scroll) |
| `useLocation(id)` | `locations.api.js` | Детали одной локации |
| `useLocationsInBounds(bounds, filters)` | `locations.api.js` | Маркеры карты по viewport |
| `useAdminLocationsQuery(filters)` | `locations.api.js` | Админ: все локации |
| `useCategories()` | `locations.api.js` | Категории для фильтров |

### Zustand Stores (UI state only)

| Store | Persist | Данные |
|-------|---------|--------|
| `useAuthStore` | ✅ | user, token, isAuthenticated, logout |
| `useAppConfigStore` | ✅ | AI модели, температура, промпты, cascade |
| `useUIStore` | ❌ | isFilterOpen, lastMapPose, lastScrollPositions |
| `useGeoStore` | ❌ | lat, lng, userLocation |
| `useNotificationStore` | partial | notifications, unreadCount, preferences |
| `useUserPrefsStore` | ✅ | Foodie DNA (cuisines, vibes, price, dietary) |
| `useAIChatStore` | ✅ | Chat messages (localStorage, 512KB budget) |
| `useFavoritesStore` | ❌ | Favorites IDs (legacy, migrating to RQ) |
| `useReviewsStore` | ❌ | Reviews state |

### Key Hooks

| Hook | Файл | Назначение |
|------|------|-----------|
| `useSession()` | `shared/auth/useSession.js` | Единый auth gate (pending/anon/authed) |
| `useLocationFilters()` | `shared/filters/useLocationFilters.js` | URL-driven фильтры |
| `useAdminNotifications()` | `features/admin/hooks/` | Realtime уведомления для админа |
| `useDiningPresence()` | `features/dinewithme/hooks/` | Dine With Me presence |

---

## 🌍 i18n

Языки: **EN, PL, UA, RU**
- Конфиг: `src/i18n/config.js`
- Переводы: `src/locales/{en,pl,ua,ru}/`
  - `translation.json` — основной
  - `common/{buttons,navigation,status}.json`
  - `features/{explore,location_card,reviews}.json`
- Hook: `useTranslation()` (react-i18next)
- Авто-переключение языка через browser detector
- Auto-translation: AI переводит локации при создании/обновлении

---

## 🔌 Serverless Functions (Vercel)

| Endpoint | Файл | Назначение |
|----------|------|-----------|
| `POST /api/ai/chat` | `api/ai/chat.js` | AI proxy (OpenRouter, cascade, RAG) |
| `POST /api/ai/semantic-search` | `api/ai/semantic-search.js` | Semantic search endpoint |
| `POST /api/ai/menu-ocr` | `api/ai/menu-ocr.js` | OCR сканер меню |
| `POST /api/kg/save` | `api/kg/save.js` | KG save (service_role) |
| `POST /api/locations/enrich` | `api/locations/enrich.js` | Google Places enrichment, Brave Search, R2 upload |
| `GET /api/locations/[id]` | `api/locations/[id].js` | Public location fallback (anon RLS bypass) |
| `POST /api/places/autocomplete` | `api/places/autocomplete.js` | Google Places autocomplete |
| `POST /api/auth/check-email` | `api/auth/check-email.js` | Email existence check |
| `POST /api/telegram/webhook` | `api/telegram/webhook.js` | Telegram bot webhook |
| `POST /api/telegram/process` | `api/telegram/process.js` | Telegram message processing |
| `POST /api/webhook/stripe` | `api/webhook/stripe.js` | Stripe webhook handler |
| `POST /api/upload-to-r2` | `api/upload-to-r2.js` | R2 image upload |

**Всего: 12 serverless functions** (лимит Vercel Hobby)

---

## 🔧 ENV переменные

```env
# Client (VITE_ prefix — попадают в bundle)
VITE_SUPABASE_URL=https://myyzguendoruefiiufop.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_AI_MODEL=nvidia/nemotron-3-super-120b-a12b:free
VITE_AI_MODEL_FALLBACK=meta-llama/llama-3.3-70b-instruct:free
VITE_APP_VERSION=2.0.0

# Server (Vercel env vars — НЕ попадают в bundle)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_API_KEY_2=...              # fallback key
SUPABASE_SERVICE_ROLE_KEY=...         # для KG save, enrichment
GOOGLE_PLACES_API_KEY=...             # enrichment, autocomplete
BRAVE_SEARCH_API_KEY=...              # KG enrichment (optional)
R2_ACCESS_KEY_ID=...                  # Cloudflare R2 images
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=...
TELEGRAM_BOT_TOKEN=...                # Telegram bot
STRIPE_SECRET_KEY=...                 # Payments
STRIPE_WEBHOOK_SECRET=...
```

---

## 🚀 Деплой

- **Platform**: Vercel (gastromap-apps-projects, hobby plan)
- **Prod URL**: https://gastromap-five.vercel.app
- **Repo**: https://github.com/gastromap-app/gastromap
- **Build**: `vite build` → `dist/` (~3.2 MB precache)
- **Serverless**: 12 functions в `api/`
- **PWA**: vite-plugin-pwa + Workbox (service worker, manifest)
- **Database**: Supabase (myyzguendoruefiiufop)
- **Images**: Cloudflare R2 (locations photos, geo covers)

---

## ❗ Известные ограничения

1. **Payments — частично MOCK** (Stripe интегрирован, но SubscriptionGate упрощён)
2. **E2E тесты минимальны** (есть unit + property-based, нет Playwright)
3. **useLocationsStore** — файл существует как shim для обратной совместимости AI tools.js (hydration fallback), но НЕ является источником данных для UI
4. **Supabase Edge Functions** — `ai-chat` НЕ задеплоена, используется только Vercel proxy
5. **Dine With Me** — Phase 1 (presence + nearby). Waves/matching ещё не реализованы.
