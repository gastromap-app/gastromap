-- ═══════════════════════════════════════════════════════════════════════════
-- GASTROMAP V2 - KNOWLEDGE GRAPH MIGRATION
-- Дата: 2026-03-28
-- Описание: Добавляет pgvector, Knowledge Graph таблицы и сохраняет все данные
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. PGVECTOR EXTENSION
-- ───────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. ОНТОЛОГИЯ: ТАБЛИЦЫ ЗНАНИЙ
-- ───────────────────────────────────────────────────────────────────────────

-- 2.1. Кухни (Cuisines)
CREATE TABLE IF NOT EXISTS cuisines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    parent_id UUID REFERENCES cuisines(id) ON DELETE SET NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    origin_country TEXT,
    characteristics JSONB DEFAULT '{}',
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cuisines_parent_id_idx ON cuisines(parent_id);
CREATE INDEX IF NOT EXISTS cuisines_slug_idx ON cuisines(slug);
CREATE INDEX IF NOT EXISTS cuisines_embedding_idx ON cuisines USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- 2.2. Блюда (Dishes)
CREATE TABLE IF NOT EXISTS dishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    cuisine_id UUID REFERENCES cuisines(id) ON DELETE SET NULL,
    category TEXT CHECK (category IN ('appetizer', 'main', 'dessert', 'drink', 'snack')),
    price_range TEXT CHECK (price_range IN ('$', '$$', '$$$')),
    is_signature BOOLEAN DEFAULT false,
    vegetarian BOOLEAN DEFAULT false,
    vegan BOOLEAN DEFAULT false,
    gluten_free BOOLEAN DEFAULT false,
    spicy_level INTEGER DEFAULT 0 CHECK (spicy_level >= 0 AND spicy_level <= 5),
    ingredients JSONB DEFAULT '[]',
    allergens TEXT[] DEFAULT '{}',
    image_url TEXT,
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dishes_cuisine_id_idx ON dishes(cuisine_id);
CREATE INDEX IF NOT EXISTS dishes_category_idx ON dishes(category);
CREATE INDEX IF NOT EXISTS dishes_embedding_idx ON dishes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- 2.3. Ингредиенты (Ingredients)
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT CHECK (category IN ('vegetable', 'fruit', 'meat', 'fish', 'seafood', 'dairy', 'grain', 'spice', 'herb', 'nut', 'legume', 'other')),
    is_allergen BOOLEAN DEFAULT false,
    is_vegetarian BOOLEAN DEFAULT true,
    is_vegan BOOLEAN DEFAULT true,
    origin TEXT,
    season TEXT[] DEFAULT '{}',
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ingredients_category_idx ON ingredients(category);
CREATE INDEX IF NOT EXISTS ingredients_embedding_idx ON ingredients USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- 2.4. Настроения (Vibes)
CREATE TABLE IF NOT EXISTS vibes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT CHECK (category IN ('atmosphere', 'occasion', 'crowd')),
    description TEXT,
    synonyms TEXT[] DEFAULT '{}',
    opposite_ids UUID[] DEFAULT '{}',
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vibes_category_idx ON vibes(category);
CREATE INDEX IF NOT EXISTS vibes_embedding_idx ON vibes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- 2.5. Теги (Tags)
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT CHECK (category IN ('occasion', 'feature', 'label', 'dietary', 'activity')),
    description TEXT,
    parent_id UUID REFERENCES tags(id) ON DELETE SET NULL,
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tags_category_idx ON tags(category);
CREATE INDEX IF NOT EXISTS tags_parent_id_idx ON tags(parent_id);
CREATE INDEX IF NOT EXISTS tags_embedding_idx ON tags USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. СВЯЗИ (JUNCTION TABLES)
-- ───────────────────────────────────────────────────────────────────────────

-- 3.1. Ресторан ↔ Кухня
CREATE TABLE IF NOT EXISTS location_cuisines (
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    cuisine_id UUID REFERENCES cuisines(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    confidence_score FLOAT DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (location_id, cuisine_id)
);

CREATE INDEX IF NOT EXISTS location_cuisines_location_id_idx ON location_cuisines(location_id);
CREATE INDEX IF NOT EXISTS location_cuisines_cuisine_id_idx ON location_cuisines(cuisine_id);

-- 3.2. Ресторан ↔ Блюда
CREATE TABLE IF NOT EXISTS location_dishes (
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE,
    is_signature BOOLEAN DEFAULT false,
    price FLOAT,
    available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (location_id, dish_id)
);

CREATE INDEX IF NOT EXISTS location_dishes_location_id_idx ON location_dishes(location_id);
CREATE INDEX IF NOT EXISTS location_dishes_dish_id_idx ON location_dishes(dish_id);

-- 3.3. Блюдо ↔ Ингредиенты
CREATE TABLE IF NOT EXISTS dish_ingredients (
    dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    is_main BOOLEAN DEFAULT false,
    quantity TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (dish_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS dish_ingredients_dish_id_idx ON dish_ingredients(dish_id);
CREATE INDEX IF NOT EXISTS dish_ingredients_ingredient_id_idx ON dish_ingredients(ingredient_id);

-- 3.4. Ресторан ↔ Настроения
CREATE TABLE IF NOT EXISTS location_vibes (
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    vibe_id UUID REFERENCES vibes(id) ON DELETE CASCADE,
    strength FLOAT DEFAULT 1.0 CHECK (strength >= 0 AND strength <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (location_id, vibe_id)
);

CREATE INDEX IF NOT EXISTS location_vibes_location_id_idx ON location_vibes(location_id);
CREATE INDEX IF NOT EXISTS location_vibes_vibe_id_idx ON location_vibes(vibe_id);

-- 3.5. Ресторан ↔ Теги
CREATE TABLE IF NOT EXISTS location_tags (
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (location_id, tag_id)
);

CREATE INDEX IF NOT EXISTS location_tags_location_id_idx ON location_tags(location_id);
CREATE INDEX IF NOT EXISTS location_tags_tag_id_idx ON location_tags(tag_id);

-- 3.6. Кухня ↔ Ингредиенты (характерные)
CREATE TABLE IF NOT EXISTS cuisine_ingredients (
    cuisine_id UUID REFERENCES cuisines(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    is_signature BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (cuisine_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS cuisine_ingredients_cuisine_id_idx ON cuisine_ingredients(cuisine_id);
CREATE INDEX IF NOT EXISTS cuisine_ingredients_ingredient_id_idx ON cuisine_ingredients(ingredient_id);

-- 3.7. Настроение ↔ Случаи
CREATE TABLE IF NOT EXISTS vibe_occasions (
    vibe_id UUID REFERENCES vibes(id) ON DELETE CASCADE,
    occasion TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (vibe_id, occasion)
);

CREATE INDEX IF NOT EXISTS vibe_occasions_vibe_id_idx ON vibe_occasions(vibe_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. ОБНОВЛЕНИЕ ТАБЛИЦЫ LOCATIONS
-- ───────────────────────────────────────────────────────────────────────────

-- Добавляем векторное поле для семантического поиска
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Добавляем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS locations_embedding_idx 
ON locations USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Добавляем индекс для полнотекстового поиска (если ещё нет)
CREATE INDEX IF NOT EXISTS locations_fts_idx ON locations USING GIN (fts);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. ФУНКЦИИ ДЛЯ СЕМАНТИЧЕСКОГО ПОИСКА
-- ───────────────────────────────────────────────────────────────────────────

-- 5.1. Поиск ресторанов по вектору
CREATE OR REPLACE FUNCTION search_locations_by_embedding(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.title,
        l.description,
        1 - (l.embedding <=> query_embedding) AS similarity
    FROM locations l
    WHERE l.status = 'active'
      AND 1 - (l.embedding <=> query_embedding) > match_threshold
    ORDER BY l.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5.2. Поиск похожих ресторанов
CREATE OR REPLACE FUNCTION find_similar_locations(
    target_location_id UUID,
    similarity_threshold FLOAT DEFAULT 0.8,
    max_results INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    similarity FLOAT
) AS $$
DECLARE
    target_embedding vector(768);
BEGIN
    SELECT embedding INTO target_embedding
    FROM locations
    WHERE id = target_location_id;
    
    IF target_embedding IS NULL THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        l.id,
        l.title,
        1 - (l.embedding <=> target_embedding) AS similarity
    FROM locations l
    WHERE l.id != target_location_id
      AND l.status = 'active'
      AND 1 - (l.embedding <=> target_embedding) > similarity_threshold
    ORDER BY l.embedding <=> target_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5.3. Поиск кухонь по вектору
CREATE OR REPLACE FUNCTION search_cuisines_by_embedding(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM cuisines c
    WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. MIGRATION: Перенос существующих данных
-- ───────────────────────────────────────────────────────────────────────────

-- 6.1. Миграция кухонь из locations
INSERT INTO cuisines (name, slug, description, origin_country)
SELECT DISTINCT 
    l.cuisine,
    LOWER(REGEXP_REPLACE(l.cuisine, '[^a-zA-Z0-9]+', '-', 'g')),
    l.cuisine || ' cuisine',
    NULL
FROM locations l
WHERE l.cuisine IS NOT NULL
  AND l.cuisine != ''
ON CONFLICT (name) DO NOTHING;

-- 6.2. Создание связей location_cuisines
INSERT INTO location_cuisines (location_id, cuisine_id, is_primary, confidence_score)
SELECT 
    l.id,
    c.id,
    true,  -- все существующие кухни считаем основными
    1.0
FROM locations l
JOIN cuisines c ON l.cuisine = c.name
WHERE l.cuisine IS NOT NULL
  AND l.cuisine != ''
ON CONFLICT (location_id, cuisine_id) DO NOTHING;

-- 6.3. Миграция vibes из массива в таблицу
INSERT INTO vibes (name, slug, category, description, synonyms)
SELECT DISTINCT 
    UNNEST(vibe),
    LOWER(REGEXP_REPLACE(UNNEST(vibe), '[^a-zA-Z0-9]+', '-', 'g')),
    'atmosphere',
    UNNEST(vibe) || ' atmosphere',
    ARRAY[]::TEXT[]
FROM locations
WHERE vibe IS NOT NULL
  AND array_length(vibe, 1) > 0
ON CONFLICT (name) DO NOTHING;

-- 6.4. Создание связей location_vibes
INSERT INTO location_vibes (location_id, vibe_id, strength)
SELECT 
    l.id,
    v.id,
    1.0
FROM locations l,
     UNNEST(l.vibe) AS v_name
JOIN vibes v ON v.name = v_name
ON CONFLICT (location_id, vibe_id) DO NOTHING;

-- 6.5. Миграция тегов из special_labels
INSERT INTO tags (name, slug, category, description)
SELECT DISTINCT 
    UNNEST(special_labels),
    LOWER(REGEXP_REPLACE(UNNEST(special_labels), '[^a-zA-Z0-9]+', '-', 'g')),
    'label',
    UNNEST(special_labels) || ' label',
    ARRAY[]::TEXT[]
FROM locations
WHERE special_labels IS NOT NULL
  AND array_length(special_labels, 1) > 0
ON CONFLICT (name) DO NOTHING;

-- 6.6. Создание связей location_tags
INSERT INTO location_tags (location_id, tag_id)
SELECT 
    l.id,
    t.id
FROM locations l,
     UNNEST(l.special_labels) AS t_name
JOIN tags t ON t.name = t_name
ON CONFLICT (location_id, tag_id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. TRIGGERS: Автоматическое обновление updated_at
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cuisines_updated_at
    BEFORE UPDATE ON cuisines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dishes_updated_at
    BEFORE UPDATE ON dishes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ingredients_updated_at
    BEFORE UPDATE ON ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vibes_updated_at
    BEFORE UPDATE ON vibes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tags_updated_at
    BEFORE UPDATE ON tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ───────────────────────────────────────────────────────────────────────────
-- 8. КОММЕНТАРИИ К ТАБЛИЦАМ
-- ───────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE cuisines IS 'Онтология кухонь с иерархией и векторным поиском';
COMMENT ON TABLE dishes IS 'Блюда с связями к кухням и ингредиентам';
COMMENT ON TABLE ingredients IS 'Ингредиенты с категориями и аллергенами';
COMMENT ON TABLE vibes IS 'Настроения и атмосфера ресторанов';
COMMENT ON TABLE tags IS 'Теги для классификации ресторанов';
COMMENT ON TABLE location_cuisines IS 'Связь ресторанов с кухнями';
COMMENT ON TABLE location_dishes IS 'Меню ресторанов';
COMMENT ON TABLE dish_ingredients IS 'Состав блюд';
COMMENT ON TABLE location_vibes IS 'Настроения ресторанов';
COMMENT ON TABLE location_tags IS 'Теги ресторанов';
COMMENT ON TABLE cuisine_ingredients IS 'Характерные ингредиенты для кухонь';
COMMENT ON TABLE vibe_occasions IS 'Случаи для настроений';
COMMENT ON COLUMN locations.embedding IS 'Векторное представление для семантического поиска';

-- ───────────────────────────────────────────────────────────────────────────
-- 9. RLS (ROW LEVEL SECURITY) - ОПЦИОНАЛЬНО
-- ───────────────────────────────────────────────────────────────────────────

-- Включаем RLS для всех новых таблиц
ALTER TABLE cuisines ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_cuisines ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dish_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_vibes ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuisine_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_occasions ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать (публичный доступ)
CREATE POLICY "Public read access" ON cuisines FOR SELECT USING (true);
CREATE POLICY "Public read access" ON dishes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON ingredients FOR SELECT USING (true);
CREATE POLICY "Public read access" ON vibes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON tags FOR SELECT USING (true);
CREATE POLICY "Public read access" ON location_cuisines FOR SELECT USING (true);
CREATE POLICY "Public read access" ON location_dishes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON dish_ingredients FOR SELECT USING (true);
CREATE POLICY "Public read access" ON location_vibes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON location_tags FOR SELECT USING (true);
CREATE POLICY "Public read access" ON cuisine_ingredients FOR SELECT USING (true);
CREATE POLICY "Public read access" ON vibe_occasions FOR SELECT USING (true);

-- Политика: только админы могут писать (нужно настроить роли)
-- CREATE POLICY "Admin write access" ON cuisines FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════
