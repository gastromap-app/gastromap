# Knowledge Graph — Руководство разработчика

> **Когда читать этот документ:** данные в разделах Knowledge Graph или Локации не загружаются, отображаются нули или mock-данные, либо в консоли браузера появляются ошибки, связанные с Supabase. Также здесь описан полный workflow работы с KG Agent и Spoonacular Enricher.

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
         RLS: Public read (anon), Write — только через service_role (api/kg/save.js)
```

---

## Защита от дублей — 3-слойная архитектура

С апреля 2026 в KG внедрена система предотвращения дублирования на трёх уровнях:

```
Запрос пользователя (KG Agent или Spoonacular)
         │
         ▼
  ┌─────────────────────────────────────────────────┐
  │  Слой 1: AI/UI diff                             │
  │  • KG Agent: AI получает полный контекст БД     │
  │    (кухни + блюда + их ингредиенты) и возвращает│
  │    ТОЛЬКО отсутствующее                         │
  │  • Spoonacular: UI помечает "Already in KG"     │
  │    прямо в списке результатов                   │
  └────────────────────┬────────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────────┐
  │  Слой 2: Client-side dedup (clientDedup())      │
  │  • После ответа AI — JavaScript фильтрует       │
  │    по именам (case-insensitive)                 │
  │  • Предотвращает дубли внутри одного батча      │
  │  • Работает в: kg-ai-agent.api.js               │
  └────────────────────┬────────────────────────────┘
                       │
                       ▼
  ┌─────────────────────────────────────────────────┐
  │  Слой 3: Server + DB (api/kg/save.js)           │
  │  • SELECT по имени перед INSERT (ilike)         │
  │  • Prefer: resolution=ignore-duplicates         │
  │  • UNIQUE constraint на dishes.name,            │
  │    ingredients.name (миграция нужна — см. ниже) │
  └─────────────────────────────────────────────────┘
```

> ⚠️ **Важно:** UNIQUE constraint в БД (`dishes_name_unique`, `ingredients_name_unique`) требует ручного запуска SQL-миграции в Supabase Dashboard. Без неё слои 1–2 всё равно работают, но слой 3 (DB-level) не активен.

**SQL для активации слоя 3:**
```sql
ALTER TABLE dishes ADD CONSTRAINT dishes_name_unique UNIQUE (name);
ALTER TABLE ingredients ADD CONSTRAINT ingredients_name_unique UNIQUE (name);
```
Файл: `supabase/migrations/20260406_unique_constraints.sql`

---

## KG AI Agent — как работает умный diff

### Общий workflow

```
Пользователь: "Добавь все европейские кухни с топ-10 блюдами и ингредиентами"
         │
         ▼
  callKGAgent() в kg-ai-agent.api.js:
  1. buildExistingContext() — строит полный контекст из БД:
     === EXISTING CUISINES ===
     [cuisine] Italian (Mediterranean)
     [cuisine] French (Western European)
     
     === EXISTING DISHES ===
     [dish] Carbonara (Italian) | ingredients: egg, pancetta, pecorino, black pepper
     [dish] Ratatouille (French) | ingredients: eggplant, zucchini, tomato
     
     === EXISTING INGREDIENTS ===
     [ingredient] olive oil (oil)
     [ingredient] garlic (spice)
         │
         ▼
  2. AI (OpenRouter) получает контекст и:
     • Знает что уже есть в БД
     • Возвращает ТОЛЬКО недостающее
     • Возвращает поле "skipped": { cuisines: [...], dishes: [...], ingredients: [...] }
         │
         ▼
  3. clientDedup() — клиентский safety-фильтр:
     • Дополнительная проверка по именам
     • Убирает дубли внутри батча (если AI добавил одно и то же дважды)
         │
         ▼
  4. Возвращает: { items (только новые), skipped (уже были), model }
```

### Что видит пользователь в UI

**В чат-пузыре агента:**
- Зелёные счётчики: `3 cuisines | 28 dishes | 45 ingredients` — столько будет добавлено
- Серый блок внизу: `Already in KG (skipped): 2 cuisines: Italian, French | 5 dishes: Carbonara...`

**В preview-карточках:**
- 🟢 Бейдж **"New"** — на каждой карточке нового элемента
- Можно снять галочку с любого элемента перед сохранением

### Примеры правильных запросов

```
# Масштабный запрос (Agent сам определит что уже есть)
"Add all European cuisines, their top 10 dishes and all ingredients"

# Точечное добавление
"Add Italian cuisine with pasta dishes: carbonara, cacio e pepe, amatriciana"

# Обогащение существующего
"Add 15 key ingredients for Japanese cuisine"

# По типу
"Add all vegan dishes from Indian cuisine with their ingredients"
```

### Поле `skipped` — как читать отчёт

После генерации в консоли браузера видно:
```
[KG Agent] Dedup: skipped 7 duplicates {
  cuisines: ['Italian', 'French'],
  dishes: ['Carbonara', 'Ratatouille'],
  ingredients: ['olive oil', 'garlic', 'onion']
}
```

---

## Spoonacular Enricher — как работает ingredient diff

### Общий workflow

```
Пользователь вводит: "carbonara"
         │
         ▼
  Spoonacular API ищет блюда + ингредиенты параллельно
         │
         ▼
  UI проверяет каждый результат против БД:
  
  Случай А — блюдо НЕ найдено в БД:
    → Показывает кнопку Import ⬇
    → Клик → handleSaveDish() → api/kg/save.js → Supabase
  
  Случай Б — блюдо УЖЕ есть в БД:
    → Показывает бейдж "Already in KG" (кнопка Import скрыта)
    → Сравнивает ингредиенты блюда из Spoonacular vs. ингредиенты в БД
    → Если не хватает ингредиентов:
       showToast("Dish exists — adding 3 new ingredient(s)")
       → Добавляет только недостающие ингредиенты
    → Если всё есть:
       showToast('"Carbonara" already complete in KG')
  
  Случай В — ингредиент НЕ найден в БД:
    → Показывает кнопку Import ⬇
  
  Случай Г — ингредиент УЖЕ есть в БД:
    → Показывает бейдж "Already in KG" (кнопка Import скрыта)
```

### Ключевые файлы Spoonacular

| Файл | Назначение |
|------|-----------|
| `src/shared/api/spoonacular.api.js` | HTTP-клиент к Spoonacular API (`searchDishes`, `searchIngredients`) |
| `src/shared/api/queries.js` | `useSpoonacularSearchMutation()` — React Query мутация поиска |
| `src/features/admin/pages/AdminKnowledgeGraphPage.jsx` | `SpoonacularEnricher` компонент + `onImport` handler с ingredient diff |
| `src/shared/config/env.js` | `config.culinary.spoonacularKey` — API ключ (хардкод + env override) |

### API ключ Spoonacular

Ключ захардкожен в `src/shared/config/env.js`:
```js
spoonacularKey: import.meta.env.VITE_SPOONACULAR_API_KEY ?? '1b1558e8934f47daafb5a28ce844f9be'
```

Для замены — добавить `VITE_SPOONACULAR_API_KEY` в `.env` и Vercel. Лимиты бесплатного тарифа: 150 req/day.

---

## Рекомендуемый workflow обогащения базы

```
Шаг 1: Новая кухня
  → KG Agent: "Add Polish cuisine with region, flavor profile"
  → Agent проверит — уже есть? → добавит только если нет

Шаг 2: Блюда кухни
  → KG Agent: "Add top 10 Polish dishes with all ingredients"
  → Agent видит контекст (кухня уже добавлена в БД) и линкует блюда к ней
  ИЛИ
  → Spoonacular: вбить название блюда → импортировать с реальными данными

Шаг 3: Ингредиенты
  → KG Agent: "Add all key ingredients for Polish cuisine"
  → Все ингредиенты что уже есть — будут пропущены

Шаг 4: Синхронизация с Локациями
  → Кнопка "Sync KG → Locations" в AdminKnowledgeGraphPage
  → KG данные начнут влиять на рекомендации GastroGuide
```

**Для масштабного заполнения (один запрос):**
```
"Add all European cuisines, their top 10 dishes and all ingredients"
```
Agent сам определит что уже есть в БД и добавит только недостающее.

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
- **INSERT / UPDATE / DELETE** — идёт через `service_role` в `api/kg/save.js` (bypasses RLS)

**Уникальные ограничения** (нужно применить вручную — см. выше):
```sql
-- dishes_name_unique, ingredients_name_unique
-- файл: supabase/migrations/20260406_unique_constraints.sql
```

---

## Переменные окружения

### Локальная разработка (`.env`)

```env
VITE_SUPABASE_URL=https://fglvibyyiqbfkqrdomyv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # только server-side (api/kg/save.js)
VITE_SPOONACULAR_API_KEY=         # опционально, есть дефолтный ключ
```

> ⚠️ `.env` стоит в `.gitignore` — файл не коммитится в git.

### Vercel (production / preview)

```
vercel.com → Project: gastromap → Settings → Environment Variables
```

| Key | Окружение | Назначение |
|-----|-----------|-----------|
| `VITE_SUPABASE_URL` | Production + Preview + Dev | Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Production + Preview + Dev | Anon ключ (публичный) |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview | Для `api/kg/save.js` (без VITE_!) |
| `SUPABASE_URL` | Production + Preview | Дублирует без префикса для serverless |

После добавления переменных — **Redeploy** проекта.

---

## Инициализация клиента (`src/shared/api/client.js`)

```js
export const supabase = config.supabase.isConfigured
    ? createClient(url, anonKey, {
        auth: {
            storageKey: 'sb-gastromap-auth',
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
            lock: async (_name, _acquireTimeout, fn) => fn(),
        },
    })
    : null   // ← если env vars отсутствуют, supabase === null
```

---

## Известные проблемы и их решение

### 1. Данные показывают 0 / загружаются mock-данные

**Симптом:** В разделах KG или Локации 0 записей. В консоли нет запросов к `fglvibyyiqbfkqrdomyv.supabase.co`.

**Причина:** Отсутствуют `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

**Решение:**
1. Локально — проверить `.env`
2. Продакшн — добавить в Vercel → Redeploy

---

### 2. Ошибка `Lock "lock:sb-..." was released`

**Симптом:** 3 ошибки в консоли при загрузке KG-страницы.

**Причина:** Три React Query запроса стартуют одновременно и конкурируют за Web Lock.

**Решение (уже применено):**
```js
lock: async (_name, _acquireTimeout, fn) => fn()
```
Если вернулась — проверить `client.js` на наличие этой опции.

---

### 3. Данные есть в БД, но в браузере пусто

**Диагностика:**
```bash
curl "https://fglvibyyiqbfkqrdomyv.supabase.co/rest/v1/cuisines?select=id,name" \
  -H "apikey: ВСТАВЬ_ANON_KEY" \
  -H "Authorization: Bearer ВСТАВЬ_ANON_KEY"
```

| Ответ | Причина | Решение |
|-------|---------|---------|
| `401` | Истёк/неверный ANON_KEY | Обновить ключ |
| `403` | RLS заблокировала SELECT | Добавить `USING (true)` политику |
| `[]` | Таблица пустая | Добавить данные через KG Agent |
| Данные есть, браузер пустой | `supabase = null` | Проверить п.1 |

---

### 4. KG Agent создаёт дубли

**Симптом:** После запроса "Add Italian cuisine" — появилась вторая запись Italian.

**Причина:** Либо AI проигнорировал контекст, либо не применена UNIQUE constraint.

**Диагностика:**
```bash
# Проверить в консоли браузера:
[KG Agent] Dedup: skipped N duplicates  # ← должно быть, если дубль был пойман
```

**Решение:**
1. Убедиться, что `callKGAgent` передаёт `{ cuisines, dishes, ingredients }` в context
2. Применить UNIQUE constraints (если ещё не сделано):
   ```sql
   ALTER TABLE dishes ADD CONSTRAINT dishes_name_unique UNIQUE (name);
   ALTER TABLE ingredients ADD CONSTRAINT ingredients_name_unique UNIQUE (name);
   ```
3. Проверить `api/kg/save.js` — должен содержать `SELECT` перед `INSERT`

---

### 5. Spoonacular не находит блюда / ошибка 402

**Симптом:** Поиск в Spoonacular возвращает ошибку или пустой результат.

**Причина А — исчерпан лимит бесплатного ключа** (150 req/day):
```
# Консоль: Spoonacular API error: 402
```
**Решение:** Зарегистрировать новый ключ на [spoonacular.com/food-api](https://spoonacular.com/food-api) и добавить `VITE_SPOONACULAR_API_KEY` в `.env` и Vercel.

**Причина Б — запрос на не-английском языке:**
Spoonacular работает только с английскими запросами.
**Решение:** Использовать английские названия: "carbonara", не "карбонара".

---

### 6. Spoonacular: кнопка Import не появляется

**Симптом:** Нашёл блюдо в Spoonacular, но кнопки Import нет — только бейдж "Already in KG".

**Это нормальное поведение** — блюдо уже есть в базе.

Если хочешь добавить ингредиенты которых не хватает — нажми Import всё равно через инспектор, или добавь их вручную через форму. Логика ingredient diff сработает автоматически и добавит только недостающие.

---

### 7. Синхронизация KG → Локации не работает

**Что делает:** Строит `cuisine_types[]` для каждой локации на основе `location_cuisines`.

**Типичные причины:**
- `anon`-ключ нет прав на `UPDATE locations` → нужен `service_role` или RLS-политика для admin
- Таблица `location_cuisines` пустая — связи не установлены

**Логи:** `[KnowledgeGraph] syncKGToLocations` в консоли

---

## Файловая карта Knowledge Graph

```
src/
├── shared/
│   ├── api/
│   │   ├── client.js                    ← Supabase клиент (env vars, lock config)
│   │   ├── knowledge-graph.api.js       ← CRUD: getCuisines/getDishes/getIngredients
│   │   ├── kg-ai-agent.api.js           ← KG Agent: callKGAgent, buildExistingContext,
│   │   │                                   clientDedup, resolveDishCuisineIds
│   │   ├── spoonacular.api.js           ← Spoonacular: searchDishes, searchIngredients
│   │   └── queries.js                   ← React Query хуки + useSpoonacularSearchMutation
│   └── config/
│       └── env.js                       ← config.supabase + config.culinary.spoonacularKey
│
├── features/admin/
│   ├── pages/
│   │   └── AdminKnowledgeGraphPage.jsx  ← UI: SpoonacularEnricher (ingredient diff),
│   │                                        KGAIAgent (preview с New-бейджем)
│   └── components/
│       └── KGAIAgent.jsx                ← Агент-чат: фазы idle/thinking/preview/saving/done
│
api/
└── kg/
    └── save.js                          ← Vercel serverless: SELECT→INSERT + dedup
│
supabase/
└── migrations/
    ├── 20260328_knowledge_graph.sql     ← DDL таблиц + RLS
    └── 20260406_unique_constraints.sql  ← UNIQUE на dishes.name, ingredients.name (⚠ применить!)
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
      Да, но возвращает [] → проверить RLS (п. 3)
[ ] KG Agent создаёт дубли?
      → Проверить консоль на "[KG Agent] Dedup: skipped N" (п. 4)
      → Применить UNIQUE constraints в Supabase (п. 4)
[ ] Spoonacular не работает?
      → Проверить лимит ключа (п. 5), использовать английский запрос
[ ] Кнопка Import не появляется в Spoonacular?
      → Блюдо уже в KG — это норма (п. 6)
[ ] Данные есть в БД, но не синхронизированы с Локациями?
      → "Sync KG → Locations" в AdminKnowledgeGraphPage (п. 7)
```
