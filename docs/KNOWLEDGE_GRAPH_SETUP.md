# 🧠 Knowledge Graph Setup Guide

## 📋 Обзор

Knowledge Graph добавляет семантический поиск и онтологию для GastroMap:
- **Семантический поиск** — поиск по смыслу, а не ключевым словам
- **Онтология** — связи между кухнями, блюдами, ингредиентами, настроениями
- **Graph RAG** — AI Guide понимает контекст и связи

---

## 🚀 Шаг 1: Применение миграции в Supabase

### Вариант A: Через Supabase Dashboard (рекомендуется)

1. Открой [Supabase Dashboard](https://supabase.com/dashboard)
2. Выбери проект GastroMap
3. Перейди в **SQL Editor**
4. Скопируй содержимое файла: `supabase/migrations/20260328_knowledge_graph.sql`
5. Вставь в SQL Editor
6. Нажми **Run**
7. ✅ Проверь, что все таблицы созданы

### Вариант B: Через Supabase CLI

```bash
# Установи CLI если нет
npm install -g supabase

# Логин
supabase login

# Примени миграцию
supabase db push
```

---

## 📊 Шаг 2: Проверка таблиц

После применения миграции проверь, что все таблицы созданы:

```sql
-- Проверка таблиц
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'cuisines', 'dishes', 'ingredients', 'vibes', 'tags',
    'location_cuisines', 'location_dishes', 'dish_ingredients',
    'location_vibes', 'location_tags', 'cuisine_ingredients'
  );

-- Проверка миграции данных
SELECT COUNT(*) as cuisines_count FROM cuisines;
SELECT COUNT(*) as location_cuisines_count FROM location_cuisines;
SELECT COUNT(*) as vibes_count FROM vibes;
SELECT COUNT(*) as location_vibes_count FROM location_vibes;
```

**Ожидаемые результаты:**
- `cuisines`: количество уникальных кухонь из твоих ресторанов
- `location_cuisines`: связи ресторанов с кухнями
- `vibes`: настроения из поля `vibe`
- `location_vibes`: связи ресторанов с настроениями

---

## 🔧 Шаг 3: Генерация embeddings

### Запуск скрипта

```bash
# Установи зависимости
npm install @supabase/supabase-js

# Запусти скрипт
node generate-embeddings.js
```

### Что делает скрипт:
1. Загружает все активные рестораны
2. Генерирует текстовое описание для каждого
3. Создаёт embedding через OpenRouter API
4. Сохраняет вектор в поле `embedding`

### ⏱️ Время выполнения:
- ~100 ресторанов: ~10-15 секунд
- ~1000 ресторанов: ~2-3 минуты

---

## 🧪 Шаг 4: Тестирование семантического поиска

### Тест 1: Семантический поиск

```javascript
import { semanticSearch } from '@/shared/api/knowledge-graph.api'

// Поиск по настроению
const romanticPlaces = await semanticSearch(
  'романтическое место для свидания',
  { limit: 10, threshold: 0.7 }
)

console.log(romanticPlaces)
```

### Тест 2: Похожие рестораны

```javascript
import { findSimilarLocations } from '@/shared/api/knowledge-graph.api'

// Найти похожие на ресторан с ID
const similar = await findSimilarLocations('restaurant-id-here', {
  threshold: 0.8,
  limit: 5
})

console.log(similar)
```

### Тест 3: Поиск по блюду

```javascript
import { findRestaurantsByDish } from '@/shared/api/knowledge-graph.api'

// Найти рестораны с пастой и трюфелями
const restaurants = await findRestaurantsByDish('паста с трюфелями')

console.log(restaurants)
```

---

## 📚 Шаг 5: Онтология — добавление данных

### Добавление кухни

```javascript
import { createCuisine } from '@/shared/api/knowledge-graph.api'

await createCuisine({
  name: 'Italian',
  slug: 'italian',
  description: 'Traditional Italian cuisine with pasta, pizza, and wine',
  origin_country: 'Italy',
  characteristics: {
    signature_ingredients: ['olive oil', 'tomato', 'basil'],
    cooking_methods: ['wood-fired', 'slow-cooked']
  }
})
```

### Добавление блюда

```javascript
import { supabase } from '@/shared/api/client'

await supabase.from('dishes').insert({
  name: 'Pasta Carbonara',
  description: 'Classic Roman pasta with eggs, cheese, and guanciale',
  cuisine_id: 'italian-cuisine-id',
  category: 'main',
  price_range: '$$',
  vegetarian: false,
  ingredients: [
    { name: 'Spaghetti', is_main: true },
    { name: 'Eggs', is_main: true },
    { name: 'Pecorino Cheese', is_main: false },
    { name: 'Guanciale', is_main: true }
  ]
})
```

---

## 🤖 Шаг 6: Интеграция с AI Guide

AI Guide теперь использует Knowledge Graph для:

### 1. Понимания интентов

```javascript
// Запрос: "хочу пасту с трюфелями"
AI определяет:
- Тип: ingredient_search
- Ингредиенты: ['truffle']
- Тип блюда: 'pasta'
- Кухня: 'Italian'
```

### 2. Поиска в KG

```javascript
// AI делает запрос к KG:
const results = await findRestaurantsByDish('паста с трюфелями')

// Получает рестораны + блюда + ингредиенты
// Генерирует осмысленный ответ
```

### 3. Контекстных рекомендаций

```javascript
// Запрос: "место для первого свидания"
AI понимает:
- Настроение: 'Romantic'
- Случай: 'date'
- Ищет рестораны с vibe='Romantic'
// Рекомендует с контекстом
```

---

## 📊 Архитектура данных

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  cuisines   │────▶│  locations   │◀────│    vibes    │
│  (кухни)    │     │ (рестораны)  │     │(настроения) │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  dishes     │◀────│location_dishes│───▶│    tags     │
│  (блюда)    │     │   (связи)    │     │   (теги)    │
└─────────────┘     └──────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│ ingredients │
│(ингредиенты)│
└─────────────┘
```

---

## 🔍 Примеры запросов

### Семантический поиск

| Запрос пользователя | Что найдёт |
|-------------------|------------|
| "романтическое место" | Рестораны с vibe='Romantic' |
| "веганская еда" | Vegan-friendly рестораны + блюда |
| "как в Италии" | Italian cuisine + authentic atmosphere |
| "трюфельная паста" | Блюда с truffle + Italian restaurants |

### Graph RAG

| Запрос | AI понимает |
|--------|-------------|
| "хочу что-то с трюфелями" | ingredient_search → truffle → Italian dishes |
| "место для годовщины" | occasion_search → anniversary → Romantic vibe |
| "веганский бургер" | dish_search → vegan + burger → locations |

---

## 🎯 Следующие шаги

1. ✅ Примени миграцию в Supabase
2. ✅ Запусти генерацию embeddings
3. ✅ Протестируй семантический поиск
4. ✅ Добавь онтологию (кухни, блюда, ингредиенты)
5. ✅ Обнови AI Guide для Graph RAG

---

## 🆘 Troubleshooting

**Ошибка: "relation 'cuisines' does not exist"**
- Миграция не применена → запусти SQL в Supabase Dashboard

**Ошибка: "extension 'vector' does not exist"**
- pgvector не включён → `CREATE EXTENSION IF NOT EXISTS vector;`

**Embeddings не генерируются**
- Проверь API ключ OpenRouter в `.env`
- Убедись, что модель `text-embedding-3-small` доступна

**Семантический поиск возвращает пустые результаты**
- Проверь, что embeddings сгенерированы
- Уменьши `threshold` (по умолчанию 0.7)

---

## 📞 Документация

- [Supabase pgvector](https://supabase.com/docs/guides/ai/pgvector)
- [Semantic Search](https://supabase.com/docs/guides/ai/semantic-search)
- [OpenRouter Embeddings](https://openrouter.ai/docs/embeddings)

