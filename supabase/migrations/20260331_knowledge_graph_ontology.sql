-- ═══════════════════════════════════════════════════════
-- GASTROMAP V2 - KNOWLEDGE GRAPH & ONTOLOGY
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cuisines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  origin_country TEXT,
  parent_cuisine_id UUID REFERENCES cuisines(id),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cuisine_id UUID REFERENCES cuisines(id),
  category TEXT,
  preparation_time INT,
  difficulty TEXT,
  traditional_region TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  description TEXT,
  seasonal BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS vibes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS location_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- СВЯЗИ С ЛОКАЦИЯМИ
CREATE TABLE IF NOT EXISTS location_cuisines (
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  cuisine_id UUID REFERENCES cuisines(id) ON DELETE CASCADE,
  is_specialty BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (location_id, cuisine_id)
);

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

CREATE TABLE IF NOT EXISTS location_vibes (
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  vibe_id UUID REFERENCES vibes(id) ON DELETE CASCADE,
  PRIMARY KEY (location_id, vibe_id)
);

-- SEED DATA
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
  ('Brunch', 'brunch', 'occasion', 'Weekend brunch spot'),
  ('Outdoor Seating', 'outdoor', 'feature', 'Terrace or garden seating')
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
