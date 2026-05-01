# 🗺️ GastroMap — Product & Architecture Map
> Составлено: Product Owner (AI), Апрель 2026
> Цель: Полная карта продукта для совместной работы над развитием функционала

---

## 1. Что такое GastroMap?

GastroMap — это PWA-приложение (Progressive Web App) для гастрономических открытий. Пользователь может найти ресторан, кафе или бар через карту, текстовый поиск или AI-ассистента, сохранить место в избранное, отметить как посещённое и оставить отзыв. Есть полноценная Admin-панель и система подписок.

**Основная ценность:** "Умный гид по ресторанам с AI-рекомендациями, картой и персональным профилем."

---

## 2. Технологический стек

| Слой | Технология |
|---|---|
| Frontend | React 18 + Vite 7 |
| Роутинг | React Router v6 |
| Стейт менеджмент | Zustand 5 (с persist) |
| Серверные запросы | TanStack Query (React Query) v5 |
| Стилизация | Tailwind CSS 3.4 + DaisyUI 5 |
| Анимации | Framer Motion 12 + Lenis (smooth scroll) |
| Карты | Leaflet + React-Leaflet |
| База данных | Supabase (PostgreSQL + RLS + pgvector) |
| Авторизация | Supabase Auth |
| AI | OpenRouter API (каскад free-моделей) |
| Переводы | i18next + react-i18next (EN, PL, UA, RU) |
| Платежи | Stripe (mock/real) |
| PWA | vite-plugin-pwa + Workbox |
| Деплой | Vercel |
| Тесты | Vitest + React Testing Library |

---

## 3. Структура проекта (Feature-Sliced Design)

```
src/
├── app/                    # Точка входа приложения
│   ├── App.jsx             # Корень: initAuth + Providers + Router
│   ├── ErrorBoundary.jsx   # Глобальный обработчик ошибок
│   ├── providers/
│   │   └── AppProviders.jsx # QueryClient + i18n + Router
│   └── router/
│       └── AppRouter.jsx   # Все маршруты + guards
│
├── features/               # Бизнес-фичи (FSD)
│   ├── auth/               # Авторизация
│   ├── dashboard/          # Личный кабинет пользователя
│   ├── public/             # Публичные страницы
│   ├── admin/              # Панель администратора
│   └── shared/             # Общие компоненты фич
│
├── components/             # Переиспользуемые UI-компоненты
│   ├── layout/             # MainLayout, PublicLayout, BottomNav, Headers
│   ├── ui/                 # Badge, Button, Card, Input, LazyImage...
│   ├── auth/               # SubscriptionGate
│   ├── guards/             # MaintenanceGuard
│   └── pwa/                # InstallPrompt, OfflineIndicator, ReloadPrompt
│
├── shared/                 # Shared-инфраструктура
│   ├── api/                # Все API-клиенты (locations, auth, ai, admin...)
│   └── config/             # env.js, queryClient.js
│
├── store/                  # Глобальные Zustand-сторы
│   ├── useAppConfigStore.js # Конфиг приложения + AI настройки
│   └── useNotificationStore.js
│
├── hooks/                  # Глобальные хуки
├── services/               # gastroIntelligence.js (local AI fallback)
├── i18n/                   # Конфиг i18n
├── locales/                # Переводы (EN, PL, UA, RU)
├── lib/                    # utils.js, date.js
└── mocks/                  # Mock данные для offline-разработки
```

---

## 4. Карта маршрутов (Routing Map)

### 4.1 Публичные страницы (PublicLayout — без auth)
```
/                  → LandingPage         # Главная / лендинг
/features          → FeaturesPage        # Возможности продукта
/pricing           → PricingPage         # Тарифы
/about             → AboutPage           # О нас
/contact           → ContactPage         # Контакты
/privacy           → PrivacyPage
/terms             → TermsPage
/security          → SecurityPrivacyPage
/cookies           → CookiePolicyPage
/help              → HelpCenterPage
/api               → PublicPage (stub)
/showcase          → PublicPage (stub)
/careers           → PublicPage (stub)
/blog              → PublicPage (stub)
/community         → PublicPage (stub)
/status            → PublicPage (stub)
```

### 4.2 Auth страницы (Standalone, без layout)
```
/login             → LoginPage
/auth/signup       → SignUpPage
/auth/forgot-password → ForgotPasswordPage
/auth/reset-password  → ResetPasswordPage
```

### 4.3 Приложение без авторизации (MainLayout + MaintenanceGuard)
```
/explore           → ExploreWrapper      # Поиск локаций
/explore/:country  → ExploreWrapper
/explore/:country/:city → ExploreWrapper
/location/:id      → LocationDetailsPage # Детали локации
```

### 4.4 Приложение с авторизацией (RequireAuth guard)
```
/dashboard         → DashboardPage       # Главная личного кабинета
/dashboard/add-place → AddPlacePage      # Добавить заведение
/dashboard/leaderboard → LeaderboardPage # Рейтинг пользователей
/profile           → ProfilePage         # Профиль пользователя
/profile/edit      → ProfileEditPage
/profile/language  → LanguageSettingsPage
/profile/security  → SecurityPrivacyPage
/privacy/delete-request → DeleteDataPage
/ai-guide          → AIGuidePage         # AI чат-ассистент
/saved             → SavedPage           # Избранные заведения
/visited           → VisitedPage         # Посещённые заведения
```

### 4.5 Admin панель (RequireAdmin guard — role === 'admin')
```
/admin             → AdminDashboardPage  # Общая статистика
/admin/locations   → AdminLocationsPage  # Управление локациями
/admin/users       → AdminUsersPage      # Управление пользователями
/admin/subscriptions → AdminSubscriptionsPage
/admin/moderation  → AdminModerationPage # Модерация отзывов
/admin/ai          → AdminAIPage         # Настройка AI моделей
/admin/knowledge   → AdminKnowledgeGraphPage # Knowledge Graph
/admin/notifications → AdminNotificationsPage
/admin/stats       → AdminStatsPage      # Статистика
/admin/settings    → AdminSettingsPage   # Настройки приложения
```

---

## 5. Схема базы данных (Supabase / PostgreSQL)

### Ядро данных
```
locations          # Заведения (рестораны, кафе, бары)
  ├── id, title, description, address, city, country
  ├── lat, lng (координаты)
  ├── category, cuisine, image, photos[]
  ├── rating, price_level, opening_hours
  ├── tags[], special_labels[], vibe[], features[], best_for[], dietary[]
  ├── has_wifi, has_outdoor_seating, reservations_required
  ├── michelin_stars, michelin_bib
  ├── insider_tip, what_to_try[], ai_keywords[], ai_context  ← AI-поля
  ├── embedding vector(768)  ← для семантического поиска
  ├── fts tsvector  ← для полнотекстового поиска
  └── status (active | hidden | coming_soon)

profiles           # Профили пользователей
  ├── id → auth.users(id)
  ├── email, name, role (user | admin | moderator)
  ├── avatar_url, preferences (JSONB)
  └── created_at, updated_at
```

### Активность пользователей
```
user_favorites     # Избранные заведения
  ├── user_id → profiles(id)
  └── location_id → locations(id)

user_visits        # Посещения
  ├── user_id, location_id  (UNIQUE пара)
  ├── visited_at, rating (1-5)
  └── review_text

reviews            # Отзывы
  ├── user_id, location_id
  ├── rating (1-5), review_text
  └── status (pending | published | rejected)
```

### Платежи
```
payments           # История платежей (Stripe)
  ├── user_id, stripe_payment_intent_id
  ├── product_id, amount, currency, status
  └── payment_method (card | blik | p24)

subscriptions      # Подписки
  ├── user_id, stripe_subscription_id, product_id
  ├── status (inactive | active | paused | cancelled | expired)
  └── current_period_start/end

user_roles         # Роли пользователей
  ├── user_id, role (user | admin | moderator | contributor)
  ├── permissions (JSONB), granted_by
  └── expires_at
```

### Knowledge Graph (pgvector)
```
cuisines           # Кухни мира (иерархия + embedding)
dishes             # Блюда (категория, диета, spicy_level + embedding)
ingredients        # Ингредиенты (аллергены, сезонность + embedding)
vibes              # Атмосферы/Настроения + embedding
tags               # Теги классификации + embedding

# Junction tables:
location_cuisines  # Локация ↔ Кухни (is_primary, confidence_score)
location_dishes    # Локация ↔ Блюда (is_signature, price)
location_vibes     # Локация ↔ Атмосферы (strength)
location_tags      # Локация ↔ Теги
dish_ingredients   # Блюдо ↔ Ингредиенты (is_main, quantity)
cuisine_ingredients # Кухня ↔ Ингредиенты
vibe_occasions     # Вайб ↔ Случаи (date, family, business...)
```

### DB-функции
```sql
get_leaderboard()              -- Рейтинг пользователей с очками
search_locations_by_embedding()  -- Семантический поиск по вектору
find_similar_locations()         -- Похожие заведения
search_cuisines_by_embedding()   -- Поиск кухонь по вектору
get_my_role()                    -- Роль текущего юзера (SECURITY DEFINER)
handle_new_user()                -- Автосоздание профиля при регистрации
```

---

## 6. Слой управления состоянием (Zustand Stores)

| Store | Persistence | Назначение |
|---|---|---|
| `useAuthStore` | localStorage | Сессия, пользователь, токен |
| `useAppConfigStore` | localStorage | Конфиг приложения, AI-модели, статус (maintenance/active) |
| `useFavoritesStore` | localStorage | IDs избранных заведений |
| `useNotificationStore` | - | Уведомления в реальном времени |
| `useAIChatStore` | localStorage | История диалога с AI |
| `useLocationsStore` | - | Кэш локаций для AI-инструментов |
| `useReviewsStore` | - | Отзывы |
| `useUserPrefsStore` | - | Предпочтения пользователя (Foodie DNA) |

**TanStack Query** используется для server-state: запросы к Supabase, кэширование, инвалидация.

---

## 7. AI-система (GastroIntelligence)

### Архитектура AI
```
Пользователь вводит запрос
        ↓
detectIntent() → 'recommendation' | 'info' | 'general'
        ↓
buildSystemPrompt() — персонализирует промпт с учётом:
  - Предпочтений пользователя (cuisine, vibe, price, dietary)
  - Knowledge Graph контекста
  - Кастомного системного промпта (из AdminAIPage)
        ↓
runAgentPass() — двухшаговый агентский цикл:
  1. Запрос к OpenRouter (без стриминга, с tools)
  2. Если модель вызвала tool → executeTool() локально
     - search_locations (фильтрация по Zustand-стору)
     - get_location_details (получение деталей локации)
  3. Отправка результатов инструментов обратно в модель
  4. Получение финального ответа
        ↓
Ответ + Location Cards (UI) пользователю
```

### AI-модели (OpenRouter, каскадный fallback)
```
1. nvidia/nemotron-nano-9b-v2:free   ← Primary (быстрый)
2. z-ai/glm-4.5-air:free
3. mistralai/mistral-small-3.1:free  ← Multilingual
4. openai/gpt-oss-20b:free
5. minimax/minimax-m2.5:free
6. mistralai/devstral-2512:free
7. meta-llama/llama-3.3-70b-instruct:free
8. qwen/qwen3-coder:free             ← Last resort
```

При отсутствии API-ключа: **gastroIntelligence.js** — локальный scoring-движок.

---

## 8. API-слой (src/shared/api/)

| Файл | Назначение |
|---|---|
| `client.js` | Supabase клиент + ApiError класс |
| `locations.api.js` | CRUD локаций + геопоиск + авто-перевод |
| `auth.api.js` | Авторизация (signIn/signUp/signOut/reset/avatar) |
| `favorites.api.js` | Избранные (добавить/удалить/список) |
| `visits.api.js` | Посещения |
| `reviews.api.js` | Отзывы |
| `ai.api.js` | GastroAI: analyzeQuery / analyzeQueryStream / testAIConnection |
| `admin.api.js` | Admin CRUD: locations, users, stats, subscriptions |
| `leaderboard.api.js` | Рейтинг пользователей |
| `knowledge-graph.api.js` | KG-запросы + семантический поиск |
| `notifications.api.js` | Уведомления |
| `stripe.api.js` | Платёжные операции |
| `translation.api.js` | Авто-перевод через AI |
| `preferences.api.js` | Предпочтения пользователя |
| `queries.js` | TanStack Query ключи и fetchers |

---

## 9. Система безопасности (RLS)

Supabase Row Level Security обеспечивает изоляцию данных:

- **locations**: Публичное чтение активных, запись только admin/service_role
- **profiles**: Юзер видит только свой профиль; admin видит все; обновление — только своё
- **user_favorites / user_visits**: Только свои записи
- **reviews**: Опубликованные — всем; свои — авторизованным; модерация — admin
- **payments / subscriptions**: Только свои; admin видит все
- **Knowledge Graph таблицы**: Публичное чтение; запись — только admin

**Auth guards в роутере:**
- `RequireAuth` — проверяет `isAuthenticated`
- `RequireAdmin` — проверяет `user.role === 'admin'`
- `MaintenanceGuard` — проверяет `appStatus` из `useAppConfigStore`

---

## 10. Интернационализация (i18n)

Поддерживаемые языки: **EN, PL, UA, RU**

Структура переводов:
```
src/locales/
  {lang}/
    common/
      buttons.json
      navigation.json
      status.json
    features/
      explore.json
      location_card.json
      reviews.json
    admin/ (ru only)
      dashboard.json, locations.json, users.json
    translation.json  ← главный файл
```

**Авто-перевод при создании/обновлении локации:**
`translation.api.js` → OpenRouter → переводит поля (title, description, address, insider_tip, what_to_try, ai_context) на все 4 языка и сохраняет в БД.

---

## 11. Система очков / Leaderboard

Формула очков (функция `get_leaderboard()` в БД):
```
total_points = places_visited × 10
             + reviews_written × 25
             + places_saved × 5
```

---

## 12. PWA-возможности

- Service Worker (Workbox) — offline-кэширование
- `InstallPrompt` — предложение установить на устройство
- `OfflineIndicator` — индикатор отсутствия сети
- `ReloadPrompt` — уведомление о новой версии
- `manifest.webmanifest` — конфиг PWA (иконки 192/512px)

---

## 13. External сервисы

| Сервис | Назначение | Конфигурация |
|---|---|---|
| **Supabase** | DB, Auth, Storage | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| **OpenRouter** | AI (LLM cascade) | `VITE_OPENROUTER_API_KEY` |
| **Stripe** | Платежи | `VITE_STRIPE_PUBLIC_KEY` |
| **Vercel** | Деплой | `.vercel/project.json` |
| **Nominatim** | Геокодирование адресов | `nominatimApi.js` |
| **Overpass API** | OpenStreetMap данные | `overpassApi.js` |

---

## 14. Текущие пробелы и технический долг

| Область | Статус | Приоритет |
|---|---|---|
| Stripe интеграция | Mock (реальный не подключён) | 🔴 Высокий |
| Подписки / SubscriptionGate | Заглушка | 🔴 Высокий |
| SEO (SSR/prerender) | Не реализован | 🟡 Средний |
| Offline-режим карт | Частичный | 🟡 Средний |
| B2B кабинет ресторатора | Не реализован | 🟢 Низкий |
| AR "Dish-o-Vision" | Концепция | 🟢 Будущее |
| "Dine With Me" (социальный) | Концепция | 🟢 Будущее |
| Мобильное приложение (RN) | Не начато | 🟢 Будущее |
| AI прокси (server-side) | Ключ в клиенте | 🔴 Безопасность |

---

## 15. User Journey (основные сценарии)

### 🔍 Анонимный пользователь
```
/ (Landing) → /explore → /location/:id → /auth/signup
```

### 🍽️ Залогиненный пользователь (поиск через AI)
```
/dashboard → /ai-guide → Диалог с GastroGuide → Location Cards → /location/:id → Save/Visit
```

### 📍 Исследование по карте
```
/explore/:country/:city → Фильтры (категория, цена, вайб) → MapTab (Leaflet) → /location/:id
```

### ⭐ Управление коллекцией
```
/saved (Избранные) | /visited (Посещённые) → /dashboard/leaderboard
```

### 🛡️ Администратор
```
/admin → Dashboard (статистика) → /admin/locations (CRUD) → /admin/ai (настройка моделей) → /admin/moderation (отзывы)
```

---

## 16. Ключевые файлы для быстрого ориентирования

| Файл | Зачем читать |
|---|---|
| `src/app/router/AppRouter.jsx` | Все маршруты и guards |
| `src/features/auth/hooks/useAuthStore.js` | Логика авторизации |
| `src/shared/api/ai.api.js` | AI-логика: агент, инструменты, модели |
| `src/shared/api/locations.api.js` | CRUD локаций + auto-translate |
| `src/store/useAppConfigStore.js` | Глобальный конфиг + AI настройки |
| `supabase/migrations/` | Вся схема БД |
| `src/features/admin/pages/AdminAIPage.jsx` | Управление AI в runtime |
| `src/i18n/config.js` | Конфигурация переводов |
| `vite.config.js` | Сборка + PWA + алиасы |

---

*Документ актуален на Апрель 2026. Обновлять при добавлении новых фич.*
