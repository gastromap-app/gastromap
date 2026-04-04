-- ═══════════════════════════════════════════════════════
-- GASTROMAP V2 - SCHEMA RECONCILIATION & ONTOLOGY FIX
-- ═══════════════════════════════════════════════════════

-- 1. FIX CUISINES TABLE
ALTER TABLE cuisines ADD COLUMN IF NOT EXISTS slug TEXT;
UPDATE cuisines SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;
-- Handle duplicates just in case (though name is unique already)
ALTER TABLE cuisines ALTER COLUMN slug SET NOT NULL;
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cuisines_slug_unique') THEN
    ALTER TABLE cuisines ADD CONSTRAINT cuisines_slug_unique UNIQUE (slug);
  END IF;
END $$;

ALTER TABLE cuisines ADD COLUMN IF NOT EXISTS origin_country TEXT;
ALTER TABLE cuisines ADD COLUMN IF NOT EXISTS parent_cuisine_id UUID REFERENCES cuisines(id);
ALTER TABLE cuisines ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 2. FIX DISHES TABLE
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS slug TEXT;
UPDATE dishes SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;
ALTER TABLE dishes ALTER COLUMN slug SET NOT NULL;
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dishes_slug_unique') THEN
    ALTER TABLE dishes ADD CONSTRAINT dishes_slug_unique UNIQUE (slug);
  END IF;
END $$;

ALTER TABLE dishes ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS preparation_time INT;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS difficulty TEXT;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS traditional_region TEXT;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 3. FIX INGREDIENTS TABLE
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS slug TEXT;
UPDATE ingredients SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;
ALTER TABLE ingredients ALTER COLUMN slug SET NOT NULL;
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingredients_slug_unique') THEN
    ALTER TABLE ingredients ADD CONSTRAINT ingredients_slug_unique UNIQUE (slug);
  END IF;
END $$;

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS seasonal BOOLEAN DEFAULT FALSE;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 4. NEW ONTOLOGY TABLES
CREATE TABLE IF NOT EXISTS allergens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  severity TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dietary_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS location_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RELATIONS
CREATE TABLE IF NOT EXISTS location_dishes (
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE,
  price TEXT,
  is_signature BOOLEAN DEFAULT FALSE,
  available BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (location_id, dish_id)
);

CREATE TABLE IF NOT EXISTS location_dietary (
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  dietary_id UUID REFERENCES dietary_restrictions(id) ON DELETE CASCADE,
  PRIMARY KEY (location_id, dietary_id)
);

-- Update existing location_cuisines if needed
ALTER TABLE location_cuisines ADD COLUMN IF NOT EXISTS is_specialty BOOLEAN DEFAULT FALSE;

-- 6. INSERT SEED DATA
INSERT INTO cuisines (name, slug, origin_country, description) VALUES
  ('Italian', 'italian', 'Italy', 'Traditional Italian cuisine'),
  ('Polish', 'polish', 'Poland', 'Traditional Polish cuisine'),
  ('French', 'french', 'France', 'Classic French gastronomy'),
  ('Japanese', 'japanese', 'Japan', 'Japanese traditional dishes'),
  ('Chinese', 'chinese', 'China', 'Regional Chinese cuisines'),
  ('Indian', 'indian', 'India', 'Spicy Indian flavors'),
  ('Mexican', 'mexican', 'Mexico', 'Authentic Mexican food'),
  ('Mediterranean', 'mediterranean', 'Greece', 'Fresh Mediterranean ingredients'),
  ('American', 'american', 'USA', 'Classic American dishes'),
  ('Thai', 'thai', 'Thailand', 'Aromatic Thai cuisine')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO vibes (name, slug, category, description) VALUES
  ('Romantic', 'romantic', 'atmosphere', 'Perfect for date nights'),
  ('Casual', 'casual', 'atmosphere', 'Relaxed and informal'),
  ('Fine Dining', 'fine-dining', 'atmosphere', 'Upscale elegant experience'),
  ('Family-Friendly', 'family-friendly', 'atmosphere', 'Great for families'),
  ('Cozy', 'cozy', 'atmosphere', 'Warm and intimate'),
  ('Trendy', 'trendy', 'atmosphere', 'Hip and modern'),
  ('Business', 'business', 'occasion', 'Suitable for business meetings'),
  ('Late Night', 'late-night', 'occasion', 'Open late'),
  ('Brunch', 'brunch', 'occasion', 'Weekend brunch spot')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO dietary_restrictions (name, slug, description) VALUES
  ('Vegetarian', 'vegetarian', 'No meat'),
  ('Vegan', 'vegan', 'No animal products'),
  ('Gluten-Free', 'gluten-free', 'No gluten'),
  ('Halal', 'halal', 'Islamic dietary laws'),
  ('Kosher', 'kosher', 'Jewish dietary laws'),
  ('Pescatarian', 'pescatarian', 'Fish but no meat'),
  ('Lactose-Free', 'lactose-free', 'No dairy'),
  ('Nut-Free', 'nut-free', 'No nuts')
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE cuisines IS 'Knowledge Graph: World Cuisines Ontology';
COMMENT ON TABLE dishes IS 'Knowledge Graph: Dishes Ontology';
COMMENT ON TABLE ingredients IS 'Knowledge Graph: Ingredients Ontology';
