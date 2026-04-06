# GastroMap — Refactor & Architecture Plan
**Версия:** 1.0 | **Дата:** 2026-04-06  
**Для:** AI-агентов (Google Antigravity, Claude Code) и разработчика  
**Цель:** Реструктурировать кодовую базу так, чтобы любой AI-агент мог быстро найти нужный файл, понять его ответственность и внести изменения без чтения всего репозитория.

---

## 🗺️ НАВИГАЦИОННАЯ КАРТА — читать первым

```
НУЖНО ИЗМЕНИТЬ UI/СТРАНИЦУ?
  → Посмотри src/features/<feature>/pages/

НУЖНО ИЗМЕНИТЬ ДАННЫЕ / API ВЫЗОВ?
  → Посмотри src/shared/api/<domain>.api.js

НУЖНО ИЗМЕНИТЬ ЛОГИКУ AI / GASTROGUIDE?
  → src/shared/api/ai/ (несколько файлов, каждый < 200 строк)

НУЖНО ИЗМЕНИТЬ СТЕЙТ (Zustand)?
  → src/shared/store/<domain>.store.js

НУЖНО ИЗМЕНИТЬ СЕРВЕРНУЮ ФУНКЦИЮ (Vercel)?
  → api/<domain>/<action>.js

НУЖНО ИЗМЕНИТЬ КОНФИГ / ENV?
  → src/shared/config/env.js  (ЕДИНСТВЕННОЕ место)

НУЖНО НАЙТИ ТИПЫ / СХЕМУ ДАННЫХ?
  → src/shared/types/<domain>.types.js
```

---

## 📋 ТЕКУЩИЕ ПРОБЛЕМЫ (почему нужен рефактор)

| Файл | Строк | Проблема |
|------|-------|---------|
| `src/shared/api/ai.api.js` | 1098 | Всё в одном: tool-use, промпты, streaming, embeddings, enrichment |
| `src/features/admin/pages/AdminLocationsPage.jsx` | 1522 | Форма + таблица + AI-помощник + импорт + всё вместе |
| `src/shared/api/knowledge-graph.api.js` | 774 | Mock data + реальный API + embeddings + cache перемешаны |
| `src/shared/api/locations.api.js` | 724 | CRUD + трансформации + фильтры + embeddings |
| Дублирование store | — | `src/store/` и `src/shared/store/` — два места для одного |
| Дублирование компонентов | — | `GastroAIChat` есть в `features/shared/` и в `shared/` |

---

## 🏗️ ЦЕЛЕВАЯ АРХИТЕКТУРА

```
gastromap/
├── src/
│   ├── app/                          # Инициализация приложения
│   │   ├── App.jsx
│   │   ├── providers/AppProviders.jsx
│   │   ├── router/AppRouter.jsx
│   │   └── ErrorBoundary.jsx
│   │
│   ├── shared/                       # Всё переиспользуемое
│   │   ├── api/                      # API слой (по доменам)
│   │   │   ├── client.js             # Supabase клиент (единственный)
│   │   │   ├── locations.api.js      # CRUD локаций (< 300 строк)
│   │   │   ├── auth.api.js           # Auth операции
│   │   │   ├── favorites.api.js
│   │   │   ├── reviews.api.js
│   │   │   ├── visits.api.js
│   │   │   ├── admin.api.js          # Только admin-специфичные операции
│   │   │   └── ai/                   # AI разбит на модули
│   │   │       ├── index.js          # Реэкспорт публичного API
│   │   │       ├── openrouter.js     # Базовый клиент OpenRouter (fetch + cascade)
│   │   │       ├── tools.js          # Tool definitions + executeTool()
│   │   │       ├── prompts.js        # Все системные промпты
│   │   │       ├── gastroguide.js    # GastroGuide chat логика
│   │   │       └── enrichment.js     # AI enrichment для локаций
│   │   │
│   │   ├── store/                    # Zustand stores (ЕДИНСТВЕННОЕ место)
│   │   │   ├── locations.store.js    # Список локаций + фильтры
│   │   │   ├── auth.store.js         # Пользователь + сессия
│   │   │   ├── app-config.store.js   # AI config, app settings
│   │   │   ├── favorites.store.js
│   │   │   └── notifications.store.js
│   │   │
│   │   ├── hooks/                    # Переиспользуемые хуки
│   │   │   ├── useLocationsQuery.js  # TanStack Query для локаций
│   │   │   ├── useDebounce.js
│   │   │   ├── useGeolocation.js
│   │   │   ├── useI18n.js
│   │   │   └── useTheme.js
│   │   │
│   │   ├── components/               # UI-компоненты без бизнес-логики
│   │   │   ├── ui/                   # Базовые: Button, Card, Badge, Input...
│   │   │   ├── layout/               # MainLayout, BottomNav, Headers
│   │   │   └── guards/               # RequireAuth, RequireAdmin
│   │   │
│   │   ├── types/                    # TypeScript-like JSDoc типы
│   │   │   ├── location.types.js     # @typedef Location, LocationCard
│   │   │   ├── ai.types.js           # @typedef ChatMessage, ToolCall
│   │   │   └── kg.types.js           # @typedef Cuisine, Dish, Ingredient
│   │   │
│   │   ├── lib/                      # Утилиты
│   │   │   ├── cache.js              # localStorage cache helpers
│   │   │   └── utils.js              # cn(), formatters...
│   │   │
│   │   └── config/
│   │       ├── env.js                # ВСЕ env variables (единственный файл)
│   │       └── queryClient.js        # TanStack Query client
│   │
│   ├── features/                     # Фичи по доменам
│   │   ├── auth/
│   │   │   ├── pages/                # LoginPage, SignUpPage, etc.
│   │   │   └── components/           # OnboardingFlow, OnboardingGate
│   │   │
│   │   ├── explore/                  # Поиск и карта (переименовать из public/dashboard mix)
│   │   │   ├── pages/
│   │   │   │   ├── ExplorePage.jsx   # Главная страница поиска
│   │   │   │   └── LocationPage.jsx  # Детали локации
│   │   │   └── components/
│   │   │       ├── LocationCard.jsx
│   │   │       ├── FilterPanel.jsx
│   │   │       └── MapView.jsx
│   │   │
│   │   ├── gastroguide/              # AI-чат (отдельная фича!)
│   │   │   ├── pages/
│   │   │   │   └── GastroGuidePage.jsx
│   │   │   └── components/
│   │   │       ├── ChatWindow.jsx
│   │   │       ├── MessageBubble.jsx
│   │   │       └── LocationSuggestion.jsx
│   │   │
│   │   ├── user/                     # Профиль, избранное, посещения
│   │   │   ├── pages/
│   │   │   └── components/
│   │   │
│   │   └── admin/                    # Только для role=admin
│   │       ├── pages/
│   │       │   ├── AdminDashboardPage.jsx
│   │       │   ├── AdminLocationsPage.jsx    # < 400 строк после рефактора
│   │       │   ├── AdminUsersPage.jsx
│   │       │   └── AdminKnowledgeGraphPage.jsx
│   │       └── components/
│   │           ├── LocationForm/             # ПАПКА, не файл
│   │           │   ├── index.jsx             # Форма (поля + валидация)
│   │           │   ├── AIAssistantPanel.jsx  # AI-помощник заполнения
│   │           │   └── useLocationForm.js    # Логика формы
│   │           ├── LocationsTable.jsx
│   │           └── KGAgents/
│   │               ├── KGAIAgent.jsx
│   │               └── KGEnrichmentAgent.jsx
│   │
│   ├── locales/                      # i18n (структура остаётся)
│   ├── mocks/                        # Только для dev/тестов
│   └── main.jsx
│
└── api/                              # Vercel Serverless Functions
    ├── ai/
    │   └── chat.js                   # OpenRouter proxy
    ├── kg/
    │   └── save.js                   # KG сохранение (с service role)
    └── brave-search.js               # Search proxy
```

---

## 📦 ПРАВИЛА ДЛЯ ФАЙЛОВ

### Лимиты строк
| Тип файла | Максимум строк |
|-----------|---------------|
| Page (страница) | 300 |
| Component (компонент) | 200 |
| API module | 250 |
| Store (Zustand) | 150 |
| Hook | 100 |
| Serverless function | 200 |

Если файл превышает лимит — **обязательно разбить** на подмодули.

### Принцип одной ответственности
- Каждый файл делает ОДНО: либо UI, либо данные, либо бизнес-логика
- Никаких `useState` + `fetch` + `supabase.insert` в одном компоненте
- Данные → в API модуль, стейт → в store, UI → в компонент

---

## 🔧 КОНКРЕТНЫЕ ЗАДАЧИ РЕФАКТОРА (приоритет)

### ПРИОРИТЕТ 1 — Разбить `ai.api.js` (1098 строк → 5 файлов)

**Создать `src/shared/api/ai/`:**

**`openrouter.js`** (~150 строк)
- Только: `callOpenRouter(messages, options)` с cascade моделей
- Retry логика + rate limit handling
- Экспорт: `callOpenRouter`, `streamOpenRouter`, `MODEL_CASCADE`

**`tools.js`** (~200 строк)  
- `TOOLS` array (определения инструментов для OpenRouter)
- `executeTool(name, args)` — выполняет tool calls против locations store
- Экспорт: `TOOLS`, `executeTool`

**`prompts.js`** (~100 строк)
- `buildSystemPrompt(preferences, message, mode, userData)`
- Все строки системных промптов
- Экспорт: `buildSystemPrompt`, `SYSTEM_PROMPTS`

**`gastroguide.js`** (~200 строк)
- `sendMessage(message, history, context)` — основной agentic loop
- `streamMessage(message, history, context, onChunk)` — streaming вариант
- Импортирует из openrouter.js, tools.js, prompts.js
- Экспорт: `sendMessage`, `streamMessage`

**`enrichment.js`** (~150 строк)
- `enrichLocation(locationData)` — заполнение полей локации через AI
- `generateEmbedding(text)` — векторизация текста
- Экспорт: `enrichLocation`, `generateEmbedding`

**`index.js`** (~30 строк)
- Реэкспорт всего публичного API
- Остальной код импортирует только из `@/shared/api/ai`

---

### ПРИОРИТЕТ 2 — Разбить `AdminLocationsPage.jsx` (1522 строк → 3 файла)

**`AdminLocationsPage.jsx`** (~150 строк)
- Только: layout, routing между list/form views, загрузка данных

**`components/LocationForm/index.jsx`** (~250 строк)
- Форма с полями (title, category, address, cuisine_types, etc.)
- Импортирует `useLocationForm.js` для логики

**`components/LocationForm/useLocationForm.js`** (~200 строк)
- Весь `useState`, `useCallback`, submit логика
- Вызов `enrichLocation()` для AI-помощника

**`components/LocationForm/AIAssistantPanel.jsx`** (~150 строк)
- UI панели AI-помощника
- Кнопки "Fill with AI", прогресс, результаты

**`components/LocationsTable.jsx`** (~200 строк)
- Таблица со списком локаций
- Фильтрация, сортировка, пагинация

---

### ПРИОРИТЕТ 3 — Удалить дублирование

| Удалить | Заменить на |
|---------|------------|
| `src/store/useNotificationStore.js` | `src/shared/store/notifications.store.js` |
| `src/features/shared/components/GastroAIChat.jsx` | `src/features/gastroguide/components/ChatWindow.jsx` |
| `src/features/shared/hooks/useAIChatStore.js` | `src/shared/store/` |
| `src/hooks/` (корневая папка) | `src/shared/hooks/` |
| `src/shared/api/ai-assistant.service.js` | `src/shared/api/ai/gastroguide.js` |
| `src/shared/api/locations.api.backup.js` | Удалить (это backup файл) |

---

### ПРИОРИТЕТ 4 — Типы и документация

Создать `src/shared/types/location.types.js`:

```js
/**
 * @typedef {Object} Location
 * @property {string} id
 * @property {string} title
 * @property {'restaurant'|'cafe'|'bar'|'bakery'|'other'} category
 * @property {string} city
 * @property {string} address
 * @property {number} lat
 * @property {number} lng
 * @property {string[]} cuisine_types   ← ВАЖНО: не 'cuisine', а 'cuisine_types'
 * @property {string} price_range       ← ВАЖНО: не 'priceLevel', а 'price_range'
 * @property {number} google_rating
 * @property {string} description
 * @property {string} insider_tip
 * @property {string} must_try
 * @property {string[]} tags
 * @property {string[]} dietary_options
 * @property {string[]} amenities
 * @property {string[]} best_for
 * @property {boolean} outdoor_seating
 * @property {boolean} pet_friendly
 * @property {boolean} child_friendly
 * @property {string} ai_context
 * @property {string[]} ai_keywords
 */
```

> ⚠️ **КРИТИЧНО для AI-агентов:** поле кухни в Supabase называется `cuisine_types` (массив строк), цены — `price_range` (строка: `$`, `$$`, `$$$`, `$$$$`). В старом коде встречается `cuisine` и `priceLevel` — это неверные маппинги, исправить везде.

---

## 🤖 AI ENRICHMENT — Починить заполнение карточки локации

### Текущая проблема
`AdminLocationsPage.jsx` имеет AI-помощник, но:
1. Вызывает `ai.api.js` который слишком большой и мешает навигации
2. Не все поля заполняются
3. Нет чёткого маппинга "что AI генерирует → какое поле БД"

### Поля для AI enrichment (без `must_try` и `insider_tip`)
```js
// Что должен заполнять AI по названию + адресу + категории:
const AI_FILLABLE_FIELDS = {
  description: 'string',          // Описание заведения (2-3 предложения)
  cuisine_types: 'string[]',      // ['Italian', 'Mediterranean']
  tags: 'string[]',               // ['cozy', 'romantic', 'wine', 'pasta']
  dietary_options: 'string[]',    // ['vegetarian', 'vegan', 'gluten-free']
  amenities: 'string[]',          // ['wifi', 'outdoor_seating', 'reservations']
  best_for: 'string[]',           // ['date night', 'business lunch', 'groups']
  noise_level: 'quiet|moderate|lively|loud',
  price_range: '$|$$|$$$|$$$$',
  outdoor_seating: 'boolean',
  pet_friendly: 'boolean',
  child_friendly: 'boolean',
  average_visit_duration: 'string', // '1-2 hours'
  ai_context: 'string',           // Полный контекст для GastroGuide
  ai_keywords: 'string[]',        // Семантические ключевые слова
}
// НЕ заполнять: must_try, insider_tip (вручную)
// НЕ заполнять: google_*, lat, lng, phone, website (из Google Places)
```

### Промпт для enrichment (вставить в `enrichment.js`):
```
You are a culinary intelligence system. Given a restaurant/cafe/bar name, address, and category,
fill in the following fields as JSON. Be precise and concise.
Return ONLY valid JSON, no explanation.

Input: name="{name}", address="{address}", city="{city}", category="{category}"

Return JSON with exactly these keys:
description, cuisine_types (array), tags (array, max 8), 
dietary_options (array from: vegetarian/vegan/gluten-free/halal/kosher),
amenities (array from: wifi/parking/outdoor_seating/reservations/live_music/cocktails/takeaway),
best_for (array, max 4 phrases),
noise_level (one of: quiet/moderate/lively/loud),
price_range (one of: $/$$/$$$/$$$$),
outdoor_seating (boolean), pet_friendly (boolean), child_friendly (boolean),
average_visit_duration (string like "1 hour" or "2-3 hours"),
ai_context (2-3 sentences for an AI assistant to describe this place),
ai_keywords (array of 5-8 semantic search keywords)
```

---

## 🗄️ МАППИНГ ПОЛЕЙ: КОД ↔ SUPABASE

Критически важно для GastroGuide tool-use. Везде в коде использовать правые колонки:

| Старое (неверно) | Правильное (Supabase) |
|-----------------|----------------------|
| `l.cuisine` | `l.cuisine_types` |
| `l.priceLevel` | `l.price_range` |
| `l.openingHours` | `l.opening_hours` (или `l.google_opening_hours`) |
| `l.rating` | `l.google_rating` |
| `l.vibe` | `l.tags` (нет отдельного vibe поля) |
| `l.features` | `l.amenities` |
| `l.dietary` | `l.dietary_options` |
| `l.title` | `l.title` ✓ |

Исправить в: `src/shared/api/ai.api.js` → `executeTool()` функция (строки ~207-340)

---

## 📋 ПОРЯДОК ВЫПОЛНЕНИЯ

Рекомендуемая последовательность для AI-агентов:

### Этап 1 — Типы и маппинг (начать здесь, остальное зависит от этого)
1. Создать `src/shared/types/location.types.js` с JSDoc типами
2. Исправить маппинг полей в `ai.api.js` → `executeTool()` (cuisine_types, price_range, etc.)
3. Исправить маппинг в `locations.api.js` → трансформация данных из Supabase

### Этап 2 — Разбить ai.api.js
4. Создать папку `src/shared/api/ai/`
5. Создать `openrouter.js`, `tools.js`, `prompts.js`, `gastroguide.js`, `enrichment.js`
6. Создать `index.js` с реэкспортом
7. Обновить все импорты `from '@/shared/api/ai.api'` → `from '@/shared/api/ai'`
8. Удалить старый `ai.api.js`

### Этап 3 — Починить AI enrichment для локаций
9. Создать `src/features/admin/components/LocationForm/enrichment.js`
10. Добавить промпт выше в `enrichLocation()` функцию
11. Подключить к форме добавления локации

### Этап 4 — Разбить AdminLocationsPage
12. Создать `LocationForm/` папку с компонентами
13. Вынести логику в `useLocationForm.js`
14. Вынести таблицу в `LocationsTable.jsx`
15. Оставить в `AdminLocationsPage.jsx` только оркестрацию

### Этап 5 — Удалить дублирование
16. Удалить все дублирующиеся файлы (список выше)
17. Обновить импорты

---

## ✅ ПРАВИЛА ДЛЯ AI-АГЕНТОВ

1. **Перед редактированием файла** — прочитай заголовок (первые 10 строк) чтобы понять его ответственность
2. **Один PR = одна задача** — не смешивай рефактор и новый функционал
3. **Не трогай дизайн/UI** если задача про логику/данные
4. **Не изменяй схему Supabase** без явного разрешения разработчика
5. **Проверяй маппинг полей** по таблице выше перед любым кодом работающим с локациями
6. **Максимум строк** соблюдать строго — если при выполнении задачи файл превысит лимит, сразу разбить
7. **Импорты** — использовать алиас `@/` для `src/`, никаких относительных путей типа `../../../`

---

## 🚀 MVP ЧЕКЛИСТ (что должно работать для запуска)

- [ ] GastroGuide читает реальные локации из Supabase
- [ ] Фильтрация по `cuisine_types` и `price_range` работает корректно
- [ ] AI-помощник в форме локации заполняет все поля кроме must_try/insider_tip
- [ ] Страница `/explore` показывает реальные данные (не моки)
- [ ] Карточка локации отображает все заполненные поля
- [ ] Авторизация работает (login/signup/logout)
- [ ] Мобильная версия: BottomNav работает на всех страницах

---

*Документ создан: 2026-04-06. Обновлять при значительных изменениях архитектуры.*
