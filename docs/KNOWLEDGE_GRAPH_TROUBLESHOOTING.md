# Knowledge Graph — Руководство разработчика

> **Когда читать этот документ:** данные в разделах Knowledge Graph или Локации не загружаются, отображаются нули или mock-данные, либо в консоли браузера появляются ошибки, связанные с Supabase.

---

## Архитектура потока данных

```
Браузер (React)
  └─ AdminKnowledgeGraphPage.jsx
       ├─ useCuisines()       ─┐
       ├─ useDishes()          ├─ src/shared/api/queries.js
       └─ useIngredients()    ─┘
                │
                ▼
       src/shared/api/knowledge-graph.api.js
         getCuisines() / getDishes() / getIngredients()
                │
                ▼
       src/shared/api/client.js
         supabase = createClient(URL, ANON_KEY, { auth: { lock: ... } })
                │
                ▼
       Supabase PostgreSQL
         tables: cuisines / dishes / ingredients
         RLS: Public read (anon), Write — только admin JWT
```

---

## База данных — схема таблиц

Таблицы созданы миграцией: `supabase/migrations/20260328_knowledge_graph.sql`

| Таблица | Назначение |
|---------|-----------|
| `cuisines` | Кухни мира (польская, итальянская…). Иерархия через `parent_id`. |
| `dishes` | Блюда, привязаны к `cuisine_id`. |
| `ingredients` | Ингредиенты с категориями. |
| `vibes` | Настроения/атмосфера (romantic, casual…). |
| `tags` | Произвольные теги. |
| `location_cuisines` | M2M: локация ↔ кухня. |
| `location_dishes` | M2M: локация ↔ блюдо. |
| `dish_ingredients` | M2M: блюдо ↔ ингредиент. |

**RLS-политики** (Row Level Security):
- **SELECT** — открыт для всех, включая `anon`-ключ (`USING (true)`)
- **INSERT / UPDATE / DELETE** — закрыт (раскомментировать `Admin write access` политику в миграции, если нужно)

Текущая запись CRUD идёт через `service_role` ключ напрямую, поэтому в продакшне у `anon`-ключа нет прав на запись — это нормально.

---

## Переменные окружения

### Локальная разработка (`.env`)

```env
VITE_SUPABASE_URL=https://fglvibyyiqbfkqrdomyv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ `.env` стоит в `.gitignore` — файл не коммитится в git.

### Vercel (production / preview)

Переменные **обязательно** нужно добавить вручную в панели Vercel:

```
vercel.com → Project: gastromap → Settings → Environment Variables
```

Добавить для окружений **Production + Preview + Development**:

| Key | Значение |
|-----|---------|
| `VITE_SUPABASE_URL` | `https://fglvibyyiqbfkqrdomyv.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (полный JWT) |

После добавления переменных — **Redeploy** проекта.

---

## Инициализация клиента (`src/shared/api/client.js`)

```js
export const supabase = config.supabase.isConfigured
    ? createClient(url, anonKey, {
        auth: {
            storageKey: 'sb-gastromap-auth',   // уникальный ключ хранилища
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
            // ⬇️ Переопределение Web Locks API — см. раздел "Известные проблемы"
            lock: async (_name, _acquireTimeout, fn) => fn(),
        },
    })
    : null   // ← если env vars отсутствуют, supabase === null
```

**Что означает `null`:** все функции в `knowledge-graph.api.js` проверяют `if (!supabase)` в начале и возвращают mock-данные / пустые массивы. Ни одного сетевого запроса к Supabase не будет.

### Как убедиться, что клиент проинициализирован

Открой консоль браузера:
- ✅ `[Supabase] ✅ Client initialised: https://fglvibyyiqbfkqrdomyv.supabase.co` — всё хорошо
- ⚠️ `[Supabase] ⚠️ NOT configured — VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing` — переменные окружения не добавлены

---

## Известные проблемы и их решение

### 1. Данные показывают 0 / загружаются mock-данные

**Симптом:** В разделах KG или Локации 0 записей. В консоли нет запросов к `fglvibyyiqbfkqrdomyv.supabase.co`. Видно предупреждение `[Supabase] ⚠️ NOT configured`.

**Причина:** Отсутствуют переменные окружения `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

**Решение:**
1. Для локальной разработки — проверить файл `.env` в корне проекта.
2. Для продакшна — добавить переменные в Vercel (см. выше), затем сделать Redeploy.

---

### 2. Ошибка `Lock "lock:sb-...-auth-token" was released because another request stole it`

**Симптом:** В консоли браузера сразу 3 ошибки при загрузке KG-страницы:
```
[KnowledgeGraph] getCuisines error: Lock "lock:sb-fglvibyyiqbfkqrdomyv-auth-token" was released...
[KnowledgeGraph] getDishes error: Lock "lock:sb-fglvibyyiqbfkqrdomyv-auth-token" was released...
[KnowledgeGraph] getIngredients error: Lock "lock:sb-fglvibyyiqbfkqrdomyv-auth-token" was released...
Uncaught (in promise) va: Lock "lock:sb-..." was released...
```

**Причина:** `AdminKnowledgeGraphPage` запускает три React Query запроса (`useCuisines`, `useDishes`, `useIngredients`) **одновременно**. Каждый из них при первом вызове пытается проверить/обновить auth-токен через браузерный [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API). Браузер выдаёт lock только одному — остальные получают ошибку «lock stolen».

**Решение (уже применено):** В `client.js` переопределён механизм lock:
```js
lock: async (_name, _acquireTimeout, fn) => fn(),
```
Это заменяет Web Locks API на простой вызов функции без конкуренции. Безопасно для SPA, где нет нескольких вкладок с разными сессиями одного пользователя.

**Если ошибка вернулась:**
1. Проверить, что в `client.js` присутствует опция `lock: async (_, __, fn) => fn()` в блоке `auth`.
2. Проверить версию `@supabase/supabase-js` в `package.json`. В версиях `< 2.39` этой опции нет — нужно обновить: `npm install @supabase/supabase-js@latest`.

---

### 3. Данные есть в БД (проверено через терминал), но в браузере пусто

**Диагностика:**
```bash
# Проверить данные напрямую через REST API (curl с anon-ключом)
curl "https://fglvibyyiqbfkqrdomyv.supabase.co/rest/v1/cuisines?select=id,name" \
  -H "apikey: ВСТАВЬ_ANON_KEY_СЮДА" \
  -H "Authorization: Bearer ВСТАВЬ_ANON_KEY_СЮДА"
```

Если curl возвращает данные, а браузер — нет:
- Открой DevTools → Network → отфильтруй по `supabase`
- Если нет ни одного запроса → `supabase = null` (п. 1 выше)
- Если запрос есть, но возвращает `[]` или ошибку:
  - `401` — истёк или неверный `ANON_KEY`
  - `403` — нарушена RLS-политика. Проверить в Supabase Dashboard → Authentication → Policies, что для таблицы есть `FOR SELECT USING (true)`.
  - `400` — ошибка в запросе, смотреть тело ответа

---

### 4. Синхронизация KG → Локации не работает (`syncKGToLocations`)

**Что делает функция:** Для каждой локации из таблицы `locations` строит массив `cuisine_types` на основе данных из таблицы `cuisines` и связующей таблицы `location_cuisines`. Обновляет поле `locations.cuisine_types[]`.

**Где вызывается:** Кнопка «Sync KG → Locations» в `AdminKnowledgeGraphPage`.

**Типичные причины сбоя:**
- `anon`-ключ не имеет права на `UPDATE locations` — нужен `service_role` ключ или отдельная RLS-политика для аутентифицированных пользователей-администраторов.
- Таблица `location_cuisines` пустая — связи между локациями и кухнями не установлены.

**Логи:** В консоли браузера ищи `[KnowledgeGraph] syncKGToLocations`.

---

## Файловая карта Knowledge Graph

```
src/
├── shared/
│   ├── api/
│   │   ├── client.js                    ← Supabase клиент (env vars, lock config)
│   │   ├── knowledge-graph.api.js       ← CRUD для cuisines/dishes/ingredients
│   │   └── queries.js                   ← React Query хуки: useCuisines, useDishes, useIngredients
│   └── config/
│       └── env.js                       ← config.supabase.isConfigured
│
├── features/admin/pages/
│   └── AdminKnowledgeGraphPage.jsx      ← UI страницы, использует хуки выше
│
supabase/
└── migrations/
    └── 20260328_knowledge_graph.sql     ← DDL: CREATE TABLE cuisines/dishes/ingredients + RLS
```

---

## Быстрая диагностика (чек-лист)

```
[ ] Открыта консоль браузера?
[ ] Есть ли "[Supabase] ✅ Client initialised"?
      Нет → переменные окружения не добавлены (п. 1)
[ ] Есть ли ошибки "Lock ... was released"?
      Да → проверить опцию lock в client.js (п. 2)
[ ] Есть ли запросы к supabase.co в DevTools → Network?
      Нет, но клиент инициализирован → смотреть ошибки в консоли
      Да, но возвращает [] → проверить RLS политики в Supabase Dashboard (п. 3)
[ ] Данные есть в БД, но не синхронизированы с Локациями?
      Нажать "Sync KG → Locations" в AdminKnowledgeGraphPage (п. 4)
```
