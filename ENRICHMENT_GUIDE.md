# GastroMap — Location Enrichment Guide

> **Версия:** 1.0 · Апрель 2026  
> **Кому:** Администраторы + разработчики

---

## Что такое обогащение данных

Каждая локация в GastroMap хранит два слоя данных:

| Слой | Поля | Назначение |
|------|------|-----------|
| **Базовые** | `title`, `address`, `category`, `description`, `tags` | Карточка, показывается пользователю |
| **AI-слой** | `ai_context`, `ai_keywords`, `kg_*`, `embedding` | Умный поиск, рекомендации, фильтры |

AI-слой не заполняется автоматически при создании локации — его нужно явно обогатить.

---

## Для администратора — инструкция

### Новая локация (рекомендуемый путь)

1. Admin → **Locations** → **+ Новая локация**
2. Заполни: название, адрес, категория, описание, теги, фото
3. Нажми **Сохранить**
4. Открой карточку → раскрой секцию **AI Intelligence** (иконка ⚡)
5. Нажми **✨ Full Enrich**
6. Подожди ~10–20 секунд — кнопка покажет спиннер
7. Готово — локация полностью обогащена и появится в умном поиске

**Всё — одна кнопка. Больше ничего нажимать не нужно.**

---

### Массовые операции (тулбар Admin → Locations)

Используй когда нужно точечно обновить только один из слоёв:

| Кнопка | Что делает |
|--------|-----------|
| **Reindex** | Только AI-контекст + ключевые слова (без embedding) |
| **Embeddings** | Только векторы (только для локаций без вектора) |

> Используй эти кнопки после импорта большого батча или если нужно точечно переиндексировать определённый слой.

---

## Техническое описание — как работает Full Enrich

### Точка входа

```
AdminLocationsPage.jsx
  └─ useAdminLocations.js (hook)
       └─ fullEnrichMutation = useEnrichLocationFullMutation()
            └─ enrichLocationFull(locationId)   ← ai-assistant.service.js
```

**Кнопка в карточке:**
```jsx
// LocationFormSlideOver.jsx
<button onClick={handleFullEnrich} disabled={fullEnrichMutation?.isPending}>
    <Sparkles /> ✨ Full Enrich
</button>
```

---

### Последовательность выполнения (3 шага)

```
enrichLocationFull(locationId)
│
├── [параллельно] Step 1: reindexLocationSemantic(id)
│       ├─ getLocationById(id)
│       ├─ generateLocationSemanticSummary(location)   ← LLM (OpenRouter)
│       │       └─ возвращает { summary, keywords }
│       └─ updateLocation(id, {
│               ai_context,                   ← семантическое описание для поиска
│               ai_keywords,                  ← массив ключевых слов
│               ai_enrichment_status: 'success',
│               ai_enrichment_last_attempt
│           })
│
├── [параллельно] Step 2: syncLocationWithKnowledgeGraph(id)
│       ├─ getLocationById(id)
│       ├─ matchLocationWithKG(location)               ← KG matching
│       │       └─ возвращает { cuisines, dishes, ingredients }
│       ├─ deriveAllergens(ingredients)                ← локальная логика
│       └─ updateLocation(id, {
│               kg_cuisines,                  ← кухни (напр: ['italian', 'pizza'])
│               kg_dishes,                    ← блюда
│               kg_ingredients,               ← ингредиенты
│               kg_allergens,                 ← аллергены (выводятся из ингредиентов)
│               ai_keywords,                  ← merged с KG-данными
│               kg_enriched_at
│           })
│
└── [последовательно] Step 3: updateLocationEmbedding(id)
        ├─ getLocationById(id)        ← читаем ОБНОВЛЁННЫЕ данные (после шагов 1+2)
        ├─ generateEmbeddingForLocation(location)
        │       └─ buildEmbedText(location) — конкатенирует поля:
        │               title | category | cuisine | description
        │               tags | vibe | features | best_for | ai_keywords
        │               ai_context (первые 500 символов)
        │           → generateEmbedding(text) → float[] (768 dims)
        └─ updateLocation(id, { embedding })   ← сохраняем вектор в pgvector
```

> **Почему Step 3 последовательный?**
> Вектор строится на основе `ai_context` и `ai_keywords`, которые обновляются в шагах 1 и 2.
> Если запустить параллельно — embedding будет построен на устаревших данных.

---

### Обработка ошибок

- Шаги 1 и 2 используют `Promise.allSettled` — если один упал, другой продолжает.
- Шаг 3 обёрнут в `try/catch` — ошибка embedding не останавливает всю функцию.
- Ошибки логируются в консоль и возвращаются в результате.

**Структура ответа:**
```js
{
    semantic:  { /* обновлённая локация */ } | { error: "..." },
    kg:        { /* обновлённая локация */ } | { error: "..." },
    embedding: { /* обновлённая локация */ } | { error: "..." },
}
```

---

### React Query — кэш

После успешного Full Enrich `useEnrichLocationFullMutation` инвалидирует:
- `queryKeys.locations.detail(locationId)` — перезапрашивает конкретную локацию
- `queryKeys.locations.all` — обновляет список

Карточка обновляется автоматически без перезагрузки страницы.

---

### Схема полей Supabase

| Поле | Тип | Шаг |
|------|-----|-----|
| `ai_context` | `text` | Step 1 |
| `ai_keywords` | `text[]` | Step 1 + Step 2 merge |
| `ai_enrichment_status` | `text` | Step 1 |
| `ai_enrichment_last_attempt` | `timestamptz` | Step 1 |
| `kg_cuisines` | `text[]` | Step 2 |
| `kg_dishes` | `text[]` | Step 2 |
| `kg_ingredients` | `text[]` | Step 2 |
| `kg_allergens` | `text[]` | Step 2 (derived) |
| `kg_enriched_at` | `timestamptz` | Step 2 |
| `embedding` | `vector(768)` | Step 3 |

> **FTS** (`fts` tsvector) обновляется **автоматически** через Supabase-триггер.

---

## Файловая структура

```
src/shared/api/
├── ai-assistant.service.js          enrichLocationFull() + все sub-функции
├── ai/
│   ├── search.js                    generateEmbeddingForLocation(), buildEmbedText()
│   ├── location.js                  generateLocationSemanticSummary()
│   └── index.js                     реэкспорты
├── knowledge-graph.api.js           matchLocationWithKG()
└── queries.js                       useEnrichLocationFullMutation()

src/features/admin/
├── hooks/useAdminLocations.js       fullEnrichMutation = useEnrichLocationFullMutation()
├── pages/AdminLocationsPage.jsx     передаёт prop, тулбар с bulk-кнопками
└── components/LocationFormSlideOver.jsx   кнопка ✨ Full Enrich
```

---

## Автоматическое обогащение

**Автоматизация:** "GastroMap — Auto KG Enrichment (Weak Locations)" — запускается ежедневно.  
Находит локации с неполными KG-данными и запускает `syncLocationWithKnowledgeGraph()`.  

> Embedding при этом **не** обновляется — только через Full Enrich вручную или кнопку Embeddings в тулбаре.
