# 🗺️ GastroMap — Карта проекта для AI-навигации

> Создано: 2026-04-04 | Используется для быстрой ориентации в кодовой базе

---

## 📦 Что это

**GastroMap** — AI-powered PWA для поиска ресторанов. Пользователь находит место через карту, поиск или AI-чат, сохраняет в избранное, отмечает посещения, оставляет отзывы. Есть Admin-панель и система подписок.

---

## 🏗️ Архитектура: Feature-Sliced Design (FSD)

```
src/
├── app/              → App.jsx (initAuth+Providers+Router), AppRouter.jsx
├── features/
│   ├── auth/         → LoginPage, SignUpPage, useAuthStore (Zustand persist)
│   ├── dashboard/    → DashboardPage, ExploreWrapper, SavedPage, VisitedPage, AIGuidePage
│   ├── public/       → LandingPage, LocationDetailsPage, PricingPage
│   └── admin/        → Все /admin/* страницы, AdminLayout
├── components/
│   ├── layout/       → MainLayout, PublicLayout, BottomNav, Headers
│   ├── ui/           → Button, Card, Badge, Input, Skeleton, Aurora effects
│   ├── auth/         → SubscriptionGate (MOCK!)
│   └── pwa/          → InstallPrompt, OfflineIndicator
├── shared/
│   ├── api/          → Все API модули (locations, auth, ai, admin...)
│   └── config/       → env.js (единая точка env vars), queryClient.js
├── store/            → useAppConfigStore, useNotificationStore
├── hooks/            → useTheme, useDebounce, useGeolocation, useI18n...
├── services/         → gastroIntelligence.js (AI fallback)
├── locales/          → EN, PL, UA, RU переводы
└── mocks/            → MOCK_LOCATIONS, userPersona
```

---

## 🛣️ Маршруты

| Путь | Компонент | Auth |
|------|-----------|------|
| `/` | LandingPage | ❌ |
| `/explore` | ExploreWrapper | ❌ |
| `/location/:id` | LocationDetailsPage | ❌ |
| `/login` | LoginPage | ❌ |
| `/dashboard` | DashboardPage | ✅ |
| `/ai-guide` | AIGuidePage | ✅ |
| `/saved` | SavedPage | ✅ |
| `/visited` | VisitedPage | ✅ |
| `/profile` | ProfilePage | ✅ |
| `/dashboard/add-place` | AddPlacePage | ✅ |
| `/admin` | AdminDashboardPage | 🔐 admin |
| `/admin/locations` | AdminLocationsPage | 🔐 admin |
| `/admin/users` | AdminUsersPage | 🔐 admin |
| `/admin/ai` | AdminAIPage | 🔐 admin |

---

## 🗄️ База данных (Supabase)

| Таблица | Назначение |
|---------|-----------|
| `locations` | Рестораны/кафе/бары с координатами, фильтрами, AI-полями |
| `profiles` | Пользователи (extends auth.users), роль user/admin/moderator |
| `user_favorites` | Избранные локации пользователя |
| `user_visits` | История посещений |
| `reviews` | Отзывы (pending/published/rejected) |

**Admin:** alik2191@gmail.com → role = 'admin'

---

## 🤖 AI Система

**Client**: `src/shared/api/ai.api.js`
- Каскад 8 free OpenRouter моделей (при 429 → следующая)
- Tool-use: `search_locations()`, `get_location_details()`
- Инструменты выполняются клиентски против Zustand store

**Server proxy**: `api/ai/chat.js` (Vercel serverless)
- Использует `OPENROUTER_API_KEY` (server-side, без VITE_)
- Свой каскад моделей (порядок отличается от client)

**Fallback**: `src/services/gastroIntelligence.js`
- Локальный scoring когда нет API ключа

---

## ⚡ Zustand Stores

| Store | Persist | Данные |
|-------|---------|--------|
| `useAuthStore` | ✅ | user, token, isAuthenticated |
| `useLocationsStore` | ❌ | Локации, фильтры |
| `useFavoritesStore` | ❌ | Избранные |
| `useAppConfigStore` | ✅ | AI конфиг, runtime overrides |
| `useNotificationStore` | ❌ | Уведомления |

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

---

## ❗ Критические проблемы

1. **Payments — MOCK** (`SubscriptionGate.jsx` — `setHasSubscription(true)` без Stripe)
2. **E2E тесты отсутствуют** (есть только 13 unit tests)
3. Дублирование: `src/features/shared/` ≈ `src/shared/` (оба существуют)

---

## 🔧 ENV переменные

```env
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_OPENROUTER_API_KEY    # если пусто → proxy через /api/ai/chat
VITE_AI_MODEL
VITE_AI_MODEL_FALLBACK
VITE_APP_VERSION
# Сервер (Vercel):
OPENROUTER_API_KEY         # без VITE_ prefix!
```

---

## 🚀 Деплой

- **Platform**: Vercel (gastromap-apps-projects, hobby plan)
- **Build**: `vite build` → `dist/`
- **Serverless**: `api/ai/chat.js`
- **PWA**: vite-plugin-pwa + Workbox (service worker, manifest)
