# GastroMap v2 — Техническая Архитектура

> Дата: 2026-04-20  
> Версия: 2.0  
> База данных: Supabase (`myyzguendoruefiiufop`)  
> Деплой: Vercel (фронтенд + serverless API)

---

## Содержание

1. [Общая концепция](#1-общая-концепция)
2. [Стек технологий](#2-стек-технологий)
3. [Схема базы данных](#3-схема-базы-данных)
4. [User Flow — Онбординг и DNA профиль](#4-user-flow--онбординг-и-dna-профиль)
5. [4 главных экрана пользователя](#5-4-главных-экрана-пользователя)
6. [Система фильтров](#6-система-фильтров)
7. [Алгоритм Trending](#7-алгоритм-trending)
8. [AI-агенты](#8-ai-агенты)
9. [Knowledge Graph](#9-knowledge-graph)
10. [Админ-панель — 8 секций](#10-админ-панель--8-секций)
11. [Система дизайна — Semantic Radius](#11-система-дизайна--semantic-radius)
12. [Типографика — Font Standard](#12-типографика--font-standard)
13. [Что уже реализовано vs что нужно сделать](#13-что-уже-реализовано-vs-что-нужно-сделать)
14. [Приоритеты реализации](#14-приоритеты-реализации)

---

## 1. Общая концепция

GastroMap — это **карта гастрономических открытий** с персонализацией на основе DNA-профиля пользователя.

Ключевые принципы:
- **Не просто справочник** — это живая карта с рейтингами, трендами и сообществом.
- **Персонализация** — каждый пользователь видит рекомендации, основанные на своих вкусах.
- **AI-первый** — GastroGuide (чат) и KG AI Agent обогащают базу знаний автоматически.
- **Геовизуализация** — основной способ взаимодействия — карта.
- **Три уровня глубины** — Страна → Город → Локация.

---

## 2. Стек технологий

### Frontend
| Технология | Использование |
|-----------|---------------|
| React 18 + Vite | SPA-приложение |
| React Router v6 | Маршрутизация |
| Zustand | Глобальный стейт (locations, filters, user prefs) |
| React Query (TanStack) | Серверный кэш, мутации |
| Framer Motion | Анимации, page transitions |
| Tailwind CSS | Стилизация |
| Leaflet + React-Leaflet | Карта |
| i18next | EN/PL/UK/RU локализация |

### Backend
| Технология | Использование |
|-----------|---------------|
| Supabase (PostgreSQL) | Основная БД + Auth + Storage |
| Supabase Row Level Security | Защита данных по ролям |
| Supabase Storage | Фото локаций, geo_covers |
| Vercel Serverless Functions | AI proxy, KG save (service_role) |
| Supabase Edge Functions | AI chat proxy (низкая задержка) |

### AI / LLM
| Технология | Использование |
|-----------|---------------|
| OpenRouter | Доступ к LLM моделям |
| GPT-class + Llama fallback | Генерация, обогащение KG |
| Supabase pgvector | Векторный поиск для семантики |

---

## 3. Схема базы данных

### 3.1 Таблица `locations` (основная — уже существует)

```sql
CREATE TABLE locations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    description     text,
    address         text,
    city            text,
    country         text,
    lat             float8,
    lng             float8,
    category        text,               -- Cafe, Restaurant, Bar, etc.
    cuisine         text,               -- legacy single string
    rating          float4 DEFAULT 0,
    price_level     text DEFAULT '$$',  -- $, $$, $$$, $$$$
    image           text,               -- cover photo URL
    photos          text[],             -- gallery
    special_labels  text[],             -- фильтруемые метки
    best_for        text[],             -- morning, day, evening, late_night
    kg_cuisines     text[],             -- cuisines from KG enrichment
    status          text DEFAULT 'pending',  -- pending, approved, rejected
    is_featured     boolean DEFAULT false,
    opening_hours   jsonb,
    social_links    jsonb,
    phone           text,
    website         text,
    slug            text UNIQUE,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    created_by      uuid REFERENCES auth.users,

    -- НОВЫЕ ПОЛЯ (нужно добавить через Supabase Dashboard)
    views_count     integer DEFAULT 0,      -- просмотры
    saves_count     integer DEFAULT 0,      -- добавления в избранное
    visits_count    integer DEFAULT 0,      -- отметки "был здесь"
    comments_count  integer DEFAULT 0,      -- количество комментариев
    trending_score  float4  DEFAULT 0,      -- вычисляемый балл тренда
    trending_at     timestamptz,            -- когда последний раз пересчитывался
    city_slug       text,                   -- для drill-down навигации
    country_slug    text                    -- для drill-down навигации
);
```

> **Важно**: `special_labels` хранит все метки одним массивом:
> Cuisine / Bar / Atmosphere / Amenities / Awards — все в одном поле.
> На первом этапе разбивки по отдельным полям не нужно.

### 3.2 Таблица `user_profiles` (нужно создать)

```sql
CREATE TABLE user_profiles (
    id              uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    display_name    text,
    avatar_url      text,
    role            text DEFAULT 'user',    -- user, moderator, admin

    -- DNA-профиль (заполняется на онбординге)
    dna_cuisines    text[] DEFAULT '{}',    -- ['Italian', 'Japanese', ...]
    dna_vibes       text[] DEFAULT '{}',    -- ['Cozy', 'Romantic', ...]
    dna_allergens   text[] DEFAULT '{}',    -- ['gluten-free', 'vegan', ...]
    dna_price       text[] DEFAULT '{}',    -- ['$$', '$$$']

    -- География
    home_city       text,
    home_country    text,

    -- Gamification
    points          integer DEFAULT 0,
    level           integer DEFAULT 1,
    badges          text[] DEFAULT '{}',

    -- Настройки
    language        text DEFAULT 'en',
    theme           text DEFAULT 'dark',
    notifications_enabled boolean DEFAULT true,

    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile"   ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON user_profiles FOR SELECT
    USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
```

### 3.3 Таблицы Knowledge Graph (уже существуют)

```
cuisines      — кухни мира
dishes        — блюда
ingredients   — ингредиенты
```

Связаны с `locations` мягко: `locations.kg_cuisines[]` содержит имена из `cuisines.name`.

### 3.4 Таблица `geo_covers` (уже создана)

```sql
-- slug='poland', geo_type='country' → image_url для обложки страны
-- slug='krakow', geo_type='city'    → image_url для обложки города
CREATE TABLE geo_covers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        text NOT NULL,
    geo_type    text NOT NULL,       -- 'country', 'city'
    name        text,
    image_url   text,
    created_at  timestamptz DEFAULT now(),
    UNIQUE(slug, geo_type)
);
```

### 3.5 Таблица `reviews` (уже существует)

```sql
CREATE TABLE reviews (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid REFERENCES locations ON DELETE CASCADE,
    user_id     uuid REFERENCES auth.users,
    rating      float4,
    text        text,
    photos      text[],
    status      text DEFAULT 'pending',    -- pending, approved, rejected
    created_at  timestamptz DEFAULT now()
);
```

### 3.6 Триггеры для счётчиков (нужно создать)

```sql
-- Триггер: обновление saves_count при добавлении/удалении из избранного
CREATE OR REPLACE FUNCTION update_saves_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE locations SET saves_count = saves_count + 1 WHERE id = NEW.location_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE locations SET saves_count = GREATEST(0, saves_count - 1) WHERE id = OLD.location_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_saves_count ON favorites;
CREATE TRIGGER trg_saves_count
    AFTER INSERT OR DELETE ON favorites
    FOR EACH ROW EXECUTE FUNCTION update_saves_count();

-- Аналогичный триггер для visits_count
CREATE OR REPLACE FUNCTION update_visits_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE locations SET visits_count = visits_count + 1 WHERE id = NEW.location_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_visits_count ON visits;
CREATE TRIGGER trg_visits_count
    AFTER INSERT ON visits
    FOR EACH ROW EXECUTE FUNCTION update_visits_count();
```

---

## 4. User Flow — Онбординг и DNA профиль

### 4.1 Поток регистрации

```
[Landing Page]
    → "Get Started"
    → [Sign Up / Google OAuth]
    → [Email verification]
    → [Onboarding Flow: 3 шага]       ← OnboardingGate.jsx
    → [Главный экран с персонализацией]
```

### 4.2 Онбординг — 3 шага (`OnboardingFlow.jsx` — уже реализован)

**Шаг 1: Любимые кухни**
- Динамический список из KG (`useCuisineOptions`)
- Сохраняется в `user_profiles.dna_cuisines`

**Шаг 2: Атмосфера / Вайбы**
- Romantic / Casual / Fine Dining / Lively / Cozy / Trendy
- Сохраняется в `user_profiles.dna_vibes`

**Шаг 3: Бюджет + диета**
- Price: $ / $$ / $$$
- Dietary: Vegetarian / Vegan / Gluten-Free / Halal
- Сохраняется в `user_profiles.dna_price` + `dna_allergens`

### 4.3 DNA-профиль → Персонализированные рекомендации

```sql
-- Запрос рекомендаций на основе DNA
SELECT * FROM locations
WHERE status = 'approved'
  AND (
    kg_cuisines && ARRAY['Italian','Japanese']::text[]   -- совпадение кухонь
    OR special_labels && ARRAY['Cozy','Romantic']::text[] -- совпадение атмосферы
  )
  AND price_level = ANY(ARRAY['$$','$$$']::text[])
ORDER BY 
    (CASE WHEN kg_cuisines && ARRAY['Italian','Japanese']::text[] THEN 2 ELSE 0 END
     + CASE WHEN special_labels && ARRAY['Cozy','Romantic']::text[] THEN 1 ELSE 0 END
    ) DESC,
    rating DESC
LIMIT 20;
```

### 4.4 Синхронизация DNA (нужно реализовать)

**Сейчас**: `useUserPrefsStore` (Zustand, localStorage — не персистится на сервере)  
**Нужно**: При завершении онбординга и при каждом изменении → upsert в `user_profiles`

```js
// src/shared/api/preferences.api.js
export async function saveDNAProfile(dna) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    return supabase.from('user_profiles').upsert({
        id: user.id,
        dna_cuisines:  dna.cuisines  || [],
        dna_vibes:     dna.vibes     || [],
        dna_allergens: dna.allergens || [],
        dna_price:     dna.price     || [],
        updated_at:    new Date().toISOString(),
    })
}
```

---

## 5. 4 главных экрана пользователя

### 5.1 Главный экран (Main / Explore)

**URL**: `/app`  
**Файл**: `DashboardPage.jsx` → `ExploreWrapper.jsx`

**Структура**:
```
┌─────────────────────────────────────────┐
│  🍴 GastroMap        [🔔][👤 профиль]   │
├─────────────────────────────────────────┤
│  Explore ─ [фильтр ⚙️]                  │
├─────────────────────────────────────────┤
│  🌍 СТРАНЫ (горизонтальный скролл)      │
│  [Poland] [France] [Italy] [Spain] ...  │
│       → клик → список городов           │
│              → клик → список локаций    │
├─────────────────────────────────────────┤
│  ⭐ Рекомендовано для тебя              │
│  (DNA-персонализация, 2×горизонтально)  │
├─────────────────────────────────────────┤
│  🔥 Trending сейчас                     │
│  (топ по trending_score за 7 дней)      │
├─────────────────────────────────────────┤
│  🍽️ Все заведения                       │
│  [сетка/список + фильтр]                │
└─────────────────────────────────────────┘
```

**Bottom Tab Bar (мобиль)**:
```
[🏠 Главная] [🗺️ Карта] [❤️ Избранное] [✅ Посещённые] [👤 Профиль]
```

### 5.2 Карта

**URL**: `/app/map`  
**Файл**: `MapPage.jsx`

- Leaflet карта, маркеры с кластеризацией
- Клик по маркеру → popup с карточкой
- Кнопка "Рядом со мной" — геолокация + радиус
- Фильтры работают в реальном времени
- Цвет маркера по типу заведения

### 5.3 Избранное

**URL**: `/app/saved`  
**Файл**: `SavedPage.jsx`

- Список + возможность удалить
- Группировка по странам
- Сортировка: по дате / рейтингу

### 5.4 Посещённые

**URL**: `/app/visited`  
**Файл**: `VisitedPage.jsx`

- Список с датами посещений
- Статистика: стран посещено / кухонь попробовано
- Кнопка "Написать отзыв"

---

## 6. Система фильтров

### 6.1 Единый источник истины

Файл: **`src/shared/config/filterOptions.js`**

Все изменения фильтров делаются только здесь — автоматически отражаются в FilterModal и в форме админа.

### 6.2 Группы фильтров

| Группа | Ключ в БД | Примеры значений |
|--------|-----------|-----------------|
| **Cuisine & Menu** | `special_labels[]` или `kg_cuisines[]` | Italian, Japanese, Vegan Menu, Fusion, All Day Breakfast |
| **Bar & Drinks** | `special_labels[]` | Craft Beer, Cupping, Mixology, Specialty Coffee, Wine List, Signature Cocktails, DJ Sets, Guest Shifts, Wide Gin Selection, Wine Tasting |
| **Atmosphere** | `special_labels[]` | Cozy, Romantic, Live Music, Coworking, Board Games, Speakeasy, Scenic View, Themed Interior, Quiet, Happy Hours, Lively |
| **Amenities & Service** | `special_labels[]` | WiFi, Pet Friendly, Parking, Takeaway, Delivery, Rooftop Terrace, Courtyard Terrace, Kids Area, High Chairs, Inclusive, Local Favorite |
| **Awards & Special** | `special_labels[]` | Michelin Star, Michelin Guide, Hookah, Late Dinner |

### 6.3 Как добавить новую метку

```js
// src/shared/config/filterOptions.js
// Найти нужную группу и добавить в items[] и itemsRu[]

// Пример: добавить "Outdoor Seating" в Amenities
// LABEL_GROUPS[3].items.push('Outdoor Seating')
// LABEL_GROUPS[3].itemsRu.push('Терраса на улице')
// → Автоматически появится в FilterModal и в Admin форме
```

### 6.4 Логика фильтрации (Zustand store)

```js
// src/shared/store/useLocationsStore.js
const filtered = locations.filter(loc => {
    if (filters.activeCategory !== 'All' && loc.category !== filters.activeCategory) return false
    if (filters.minRating && loc.rating < filters.minRating) return false
    if (filters.activePriceLevels.length && !filters.activePriceLevels.includes(loc.price_level)) return false
    if (filters.activeVibes.length) {
        const allLabels = [...(loc.special_labels || []), ...(loc.kg_cuisines || [])]
        if (!filters.activeVibes.some(v => allLabels.includes(v))) return false
    }
    return true
})
```

### 6.5 Мультиязычный поиск и логика (Tip)

> [!TIP]
> **Мультиязычный поиск**: При реализации поиска (в Store или UI) всегда используйте утилиту `translate()` из `src/utils/translation.js`. Это позволяет пользователям искать на русском (например, "кафе"), находя при этом записи, хранящиеся в БД на английском ("Cafe").
> 
> Логика фильтрации в `useLocationsStore.js` (`applyAllFilters`) работает следующим образом:
> 1. Поисковый запрос нормализуется (lowercase).
> 2. Запрос переводится на английский через `translate(query, 'en')`.
> 3. Поиск ведется по обоим вариантам (RU и EN) во всех ключевых полях: `title`, `description`, `city`, `address`, `category`, `tags`, `ai_keywords`.
> 
> Это обеспечивает бесшовный опыт для русскоязычных пользователей при англоязычной базе данных.

---

## 7. Алгоритм Trending

### 7.1 Формула

```
trending_score =
    (saves_за_7_дней  × 3.0)
  + (visits_за_7_дней × 2.0)
  + (reviews_за_7_дней × 4.0)
  + (views_за_7_дней  × 0.5)
  × rating_multiplier  (1.2 если rating ≥ 4.5, иначе 1.0)
```

### 7.2 SQL функция (запустить в Supabase Dashboard)

```sql
CREATE OR REPLACE FUNCTION recalculate_trending()
RETURNS void AS $$
DECLARE
    loc RECORD;
    s integer; v integer; r integer;
    score float4;
BEGIN
    FOR loc IN SELECT id, rating FROM locations WHERE status = 'approved' LOOP
        SELECT COUNT(*) INTO s FROM favorites
            WHERE location_id = loc.id AND created_at > now() - interval '7 days';
        SELECT COUNT(*) INTO v FROM visits
            WHERE location_id = loc.id AND visited_at > now() - interval '7 days';
        SELECT COUNT(*) INTO r FROM reviews
            WHERE location_id = loc.id AND created_at > now() - interval '7 days' AND status = 'approved';

        score := s * 3.0 + v * 2.0 + r * 4.0;
        IF loc.rating >= 4.5 THEN score := score * 1.2; END IF;

        UPDATE locations SET trending_score = score, trending_at = now() WHERE id = loc.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Запустить каждые 6 часов через pg_cron (если подключён):
-- SELECT cron.schedule('trending', '0 */6 * * *', 'SELECT recalculate_trending();');
```

### 7.3 Запрос для секции Trending

```js
const { data: trending } = await supabase
    .from('locations')
    .select('*')
    .eq('status', 'approved')
    .gt('trending_score', 0)
    .order('trending_score', { ascending: false })
    .limit(10)
```

---

## 8. AI-агенты

### 8.1 GastroGuide (чат-помощник для пользователей)

**Компонент**: `GastroGuideChat.jsx` / `GastroAIChat.jsx`  
**Endpoint**: `Supabase Edge Function /functions/v1/ai-chat` → fallback `Vercel /api/ai/chat`  
**Модель**: OpenRouter (GPT-class primary, Llama fallback)

**Контекст, который передаётся в AI**:
1. История диалога (последние 50 сообщений)
2. Текущие фильтры / город
3. DNA-профиль пользователя (если авторизован)
4. Результаты semantic search по базе локаций

**Системный промпт** (упрощённо):
```
Ты — GastroGuide, эксперт по гастрономии.
База данных: [N] заведений в [M] городах.
Язык ответа: определи из сообщения пользователя.
При рекомендациях: название + адрес + почему подходит.
Предпочтения пользователя: {dna_cuisines}, бюджет {dna_price}.
```

### 8.2 KG AI Agent (обогащение Knowledge Graph)

**Компоненты**: `KGAIAgent.jsx`, `KGEnrichmentAgent.jsx`  
**Save endpoint**: `POST /api/kg/save` (Vercel serverless, service_role)

**Поток**:
```
Admin вводит название (или список)
    → POST /api/ai/chat с промптом для генерации данных кухни/блюда/ингредиента
    → AI возвращает структурированный JSON
    → POST /api/kg/save → dedup check → INSERT в БД
    → UI обновляется
```

**Промпт для кухни** (пример):
```
Generate a comprehensive JSON object for the cuisine: "Georgian cuisine"
Include: name, description, region, origin_country, flavor_profile,
aliases[], typical_dishes[], key_ingredients[], spice_level, cooking_methods[], dietary_notes.
Return ONLY valid JSON, no markdown.
```

---

## 9. Knowledge Graph

### 9.1 Три сущности

| Таблица | Назначение |
|---------|-----------|
| `cuisines` | Кухни мира с описаниями, регионами, типичными блюдами |
| `dishes` | Блюда с ингредиентами, способами подачи, тегами |
| `ingredients` | Ингредиенты с категориями, сезонностью, хранением |

### 9.2 Использование в приложении

| Место | Как используется |
|-------|-----------------|
| FilterModal | Динамический список кухонь (`useCuisineOptions` → `kg_cuisines`) |
| LocationCard | Отображение кухонь локации |
| LocationDetailsPage | Подробности о кухне из KG |
| GastroGuide | Контекст для AI-ответов |
| Onboarding | Список кухонь для DNA-профиля |

### 9.3 Save API (`/api/kg/save`)

```
POST /api/kg/save
Headers: Authorization: Bearer {jwt}
Body: { type: 'cuisine'|'dish'|'ingredient', data: {...} }

Поток:
1. Verify JWT (Supabase auth)
2. sanitize() — нормализация типов
3. Dedup check по name ILIKE
4. Alias check (aliases[], alternative_names[], substitutes[])
5. INSERT + return saved record
```

---

## 10. Админ-панель — 8 секций

### 10.1 Dashboard (Аналитика)

**URL**: `/admin/dashboard`  
**Метрики в реальном времени**:
- Всего локаций / ожидающих / одобренных
- Новые пользователи за 7/30 дней
- Топ-10 трендовых локаций
- Активность: saves / visits / reviews за период
- График роста базы (recharts)

### 10.2 Locations (Управление локациями)

**URL**: `/admin/locations`

| Функция | Статус |
|---------|--------|
| Таблица всех локаций + пагинация | ✅ Готово |
| Фильтры: статус / город / поиск | ✅ Готово |
| Форма создания/редактирования | ✅ Готово |
| Все группы меток (checkboxes) | ✅ Готово |
| Загрузка фото в Supabase Storage | ✅ Готово |
| Импорт из CSV | ✅ Готово (ImportWizard) |
| Быстрые действия approve/reject | ✅ Готово |
| Выбор координат на карте | ⚙️ Планируется |

**Полный набор полей в форме**:
```
Основное:    название, описание, адрес, город, страна, координаты
Категория:   Cafe / Restaurant / Bar / Market / Bakery / Winery / Coffee / Pastry
Кухня:       текст + KG-теги
Цена:        $ / $$ / $$$ / $$$$
Рейтинг:     0–5
Статус:      pending / approved / rejected / featured
Метки:       чекбоксы по 5 группам (Cuisine/Bar/Atmosphere/Amenities/Awards)
Время:       morning / day / evening / night
Контакты:    телефон, сайт, соцсети
Часы работы: по дням недели (jsonb)
Фото:        обложка + галерея (Supabase Storage)
```

### 10.3 Users (Управление пользователями)

**URL**: `/admin/users`

| Функция | Статус |
|---------|--------|
| Таблица пользователей | ✅ Готово |
| Поиск по email / имени | ✅ Готово |
| Смена роли | ✅ Готово |
| Просмотр DNA-профиля | ⚙️ Требует `user_profiles` таблицу |
| Имперсонация (Login as user) | ⚙️ Нужно реализовать |
| Блокировка аккаунта | ⚙️ Нужно реализовать |

**Имперсонация**:
```js
// Генерация magic link для входа от имени пользователя
const { data } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: selectedUser.email
})
window.open(data.properties.action_link, '_blank')
```

### 10.4 Payments / Donations

**URL**: `/admin/payments`  
**Статус**: Заглушка (`PaymentStub.jsx`)  

Будущее: Stripe интеграция (подписки / разовые пожертвования / premium features).

### 10.5 AI Agents

**URL**: `/admin/ai`

**Секции**:

**GastroGuide Settings**:
- Выбор модели (dropdown)
- Редактор системного промпта
- Температура / max tokens
- Тест-чат прямо в интерфейсе

**KG AI Agent**:
- Ручное добавление: кухня / блюдо / ингредиент
- Bulk: загрузить список имён → AI обработает все
- Статистика KG: записей в каждой таблице
- Лог последних добавлений

**AI Config** (таблица `ai_config` в Supabase):
- Горячая перезагрузка настроек без деплоя
- Флаги включения/отключения функций

### 10.6 Knowledge Graph

**URL**: `/admin/knowledge-graph`

| Функция | Статус |
|---------|--------|
| Browse: cuisines / dishes / ingredients | ✅ Готово |
| Поиск по имени | ✅ Готово |
| Просмотр записи | ✅ Готово |
| Ручное добавление | ⚙️ Частично |
| Редактирование | ⚙️ Планируется |
| Связи с локациями | ⚙️ Планируется |

### 10.7 Moderation

**URL**: `/admin/moderation`

**Очереди**:
- Отзывы пользователей (approve / reject)
- Новые локации от пользователей
- Жалобы на контент

**Статус**: `ModerationQueueView.jsx` — базово реализован.

### 10.8 App Settings / SEO

**URL**: `/admin/settings`

| Подсекция | Статус |
|-----------|--------|
| Geo Covers (фото стран/городов) | ✅ `/admin/geo-covers` |
| Maintenance mode | ⚙️ `MaintenanceGuard.jsx` — есть |
| SEO meta tags | ⚙️ Планируется |
| Feature flags | ⚙️ Планируется |
| Email templates | ⚙️ Планируется |

---
 
## 11. Система дизайна — Semantic Radius
 
 Для достижения премиального и единого вида приложения на всех устройствах (Mobile & Desktop), используется строгая система семантических закруглений (Semantic Radius). 
 
 Все значения описаны в `tailwind.config.js` и должны использоваться вместо произвольных `rounded-[Npx]`.
 
 ### 11.1 Шкала закруглений (Standard 2026)
 
 | Токен | Значение | Применение | Класс Tailwind |
 |-------|----------|------------|----------------|
 | **Input** | `12px` | Поля ввода, кнопки в формах, мелкие контролы | `rounded-input` (custom) |
 | **Image** | `16px` | Фотографии в галереях, миниатюры, превью | `rounded-image` / `rounded-2xl` |
 | **Card**  | `24px` | Карточки отзывов, блоки "Must Try", Curator Tip | `rounded-card` / `rounded-3xl` |
 | **Sheet** | `28px` | Модальные окна, крупные секции, футеры | `rounded-sheet` |
 | **Pill**  | `9999px` | Чипсы, теги, полностью круглые кнопки | `rounded-pill` / `rounded-full` |
 
 ### 11.2 Принципы использования
 - **Единство**: Фотографии внутри карточек всегда имеют меньшее закругление (`16px`), чем сама карточка (`24px`).
 - **Масштабируемость**: Радиусы фиксированы для всех разрешений. Мы не используем огромные значения (`48px+`), так как это упрощает визуальный ряд и делает его более "взрослым".
 - **Наследование**: Все новые компоненты должны выбирать радиус из этой таблицы.
 
 ---
 
## 12. Что уже реализовано vs что нужно сделать

### ✅ Уже работает

- Auth (email + Google OAuth)
- Onboarding Flow (3 шага)
- DrillDown: Страны → Города → Локации (исправлено через createPortal)
- Карта с маркерами (Leaflet)
- FilterModal с 5 группами фильтров
- Saved / Visited страницы
- Admin Locations CRUD + форма + Import
- Admin Users (базово)
- Admin AI (KG Agent)
- Knowledge Graph (3 сущности, save via Vercel)
- Geo Covers (upload в Storage, отображение)
- PWA (installable, offline fallback)
- i18n (EN / PL / UK / RU)
- Dark / Light theme
- LocationDetailsPage с загрузкой скелетона

### ⚙️ Нужно реализовать

| Задача | Приоритет | Сложность |
|--------|-----------|-----------|
| `user_profiles` таблица + RLS | 🔴 Критично | Средняя |
| Sync DNA → `user_profiles` | 🔴 Критично | Низкая |
| Секция "Рекомендовано для тебя" | 🔴 Критично | Средняя |
| `trending_score` поле + SQL функция | 🔴 Критично | Средняя |
| Секция "Trending" на главной | 🔴 Критично | Низкая |
| Триггеры для saves_count / visits_count | 🟡 Важно | Низкая |
| ProfilePage — полный профиль | 🟡 Важно | Средняя |
| Reviews — форма + отображение | 🟡 Важно | Высокая |
| Имперсонация пользователей | 🟡 Важно | Низкая |
| Admin Dashboard аналитика (charts) | 🟡 Важно | Средняя |
| pg_cron для trending (каждые 6ч) | 🟠 Позже | Низкая |
| Stripe Payments | 🟠 Позже | Высокая |
| OG images + SEO | 🟠 Позже | Средняя |
| Push-уведомления (PWA) | 🟠 Позже | Средняя |
| **Форма отзывов/предложений** | 🔴 Критично | Средняя |
| **Сортировка локаций (AZ, dist, new)** | 🔴 Критично | Высокая |
| **Новый дизайн ответов в чате** | 🟡 Важно | Средняя |
| **Адаптация карточек (Saved Locations)** | 🟡 Важно | Средняя |
| **Аудит модерации локаций** | 🟡 Важно | Низкая |
| **Валидация импорта/экспорта** | 🟡 Важно | Низкая |
| **Страница аналитики и настройки** | 🟠 Позже | Высокая |

---

## 13. Текущий Roadmap (май 2026)

Для реализации в ближайшее время (согласно запросу пользователя):
1. **Feedback Module**: Форма для сбора отзывов и баг-репортов.
2. **Advanced Sorting**: Сортировка по алфавиту, расстоянию (GPS) и дате добавления.
3. **Chat UX Refresh**: Улучшенный дизайн сообщений от GastroGuide.
4. **Saved Cards UI**: Оптимизация отображения в разделе "Избранное".
5. **Moderation Audit**: Проверка сквозного процесса одобрения локаций.
6. **Data Integrity**: Тестирование инструментов импорта/экспорта.
7. **Analytics Dashboard**: Настройка графиков и метрик активности.

---

## 12. Приоритеты реализации

### Этап 1 — База данных (запустить SQL в Supabase Dashboard)

```sql
-- 1. user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id              uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    display_name    text,
    avatar_url      text,
    role            text DEFAULT 'user',
    dna_cuisines    text[] DEFAULT '{}',
    dna_vibes       text[] DEFAULT '{}',
    dna_allergens   text[] DEFAULT '{}',
    dna_price       text[] DEFAULT '{}',
    home_city       text,
    home_country    text,
    points          integer DEFAULT 0,
    language        text DEFAULT 'en',
    theme           text DEFAULT 'dark',
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own_insert" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own_update" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Новые поля в locations
ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS saves_count    integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS visits_count   integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trending_score float4 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trending_at    timestamptz,
    ADD COLUMN IF NOT EXISTS city_slug      text,
    ADD COLUMN IF NOT EXISTS country_slug   text;

-- 3. Индекс для trending
CREATE INDEX IF NOT EXISTS idx_locations_trending
    ON locations(trending_score DESC) WHERE status = 'approved';

-- 4. Триггер saves_count
CREATE OR REPLACE FUNCTION _update_saves_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE locations SET saves_count = saves_count + 1 WHERE id = NEW.location_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE locations SET saves_count = GREATEST(0, saves_count - 1) WHERE id = OLD.location_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_saves ON favorites;
CREATE TRIGGER trg_saves AFTER INSERT OR DELETE ON favorites
    FOR EACH ROW EXECUTE FUNCTION _update_saves_count();

-- 5. Функция trending
CREATE OR REPLACE FUNCTION recalculate_trending() RETURNS void AS $$
DECLARE loc RECORD; s int; v int; r int; score float4;
BEGIN
    FOR loc IN SELECT id, rating FROM locations WHERE status = 'approved' LOOP
        SELECT COUNT(*) INTO s FROM favorites
            WHERE location_id = loc.id AND created_at > now() - interval '7 days';
        SELECT COUNT(*) INTO v FROM visits
            WHERE location_id = loc.id AND visited_at > now() - interval '7 days';
        SELECT COUNT(*) INTO r FROM reviews
            WHERE location_id = loc.id AND created_at > now() - interval '7 days' AND status = 'approved';
        score := s * 3.0 + v * 2.0 + r * 4.0;
        IF loc.rating >= 4.5 THEN score := score * 1.2; END IF;
        UPDATE locations SET trending_score = score, trending_at = now() WHERE id = loc.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### Этап 2 — Персонализация (фронтенд)

1. `saveDNAProfile()` в `preferences.api.js` → upsert в `user_profiles`
2. Вызвать после завершения OnboardingFlow
3. Добавить `useRecommendedLocations(dna)` hook в `queries.js`
4. Добавить секцию "⭐ Рекомендовано для тебя" в `DashboardPage.jsx`
5. Добавить секцию "🔥 Trending" в `DashboardPage.jsx`

### Этап 3 — Профиль

1. Расширить `ProfilePage.jsx`: статистика + редактирование DNA
2. Загрузка аватара в Supabase Storage
3. Gamification: очки / бейджи за активность

### Этап 4 — Reviews

1. Форма на `LocationDetailsPage.jsx`
2. Список отзывов на странице локации
3. Пересчёт `rating` при approve отзыва (триггер)
4. Очередь в `AdminModerationPage.jsx`

### Этап 5 — Масштабирование и Производительность (High-Scale)

Для поддержки 10,000+ локаций и высокой нагрузки:

1.  **Server-Side Pagination**:
    - Использование `useInfiniteLocations` (TanStack Query) для подгрузки данных порциями (pageSize = 24).
    - Фильтрация (город, категория, поиск) и сортировка перенесены на уровень БД (Supabase).
2.  **Virtualization**:
    - На Desktop используется `@tanstack/react-virtual` для рендеринга только видимых карточек в сетке.
    - Это позволяет избежать перегрузки DOM при просмотре тысяч заведений.
3.  **Infinite Scroll**:
    - На мобильных устройствах используется `IntersectionObserver` для автоматической подгрузки следующей страницы.
4.  **Hybrid Filtering**:
    - Базовые фильтры (БД) + Клиентские фильтры (дистанция, "Открыто сейчас") для максимальной точности.

---

*Этот документ — единый источник истины для архитектуры GastroMap v2.*  
*Обновлять при каждом значимом изменении структуры данных или бизнес-логики.*
