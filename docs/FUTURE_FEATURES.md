# GastroMap V2 -- Future Features Architecture

> Comprehensive architecture, logic, functionality, and design for 9 planned future features.

**Document Created:** 2026-04-03  
**Version:** 1.0.0  
**Project:** Gastromap_StandAlone  
**Base Stack:** React 18 + Vite + Supabase + Zustand + TanStack Query + Tailwind CSS + Leaflet

---

## Table of Contents

1. [Feature 1: Bio-Sync AI](#1-bio-sync-ai)
2. [Feature 2: AR Dish-o-Vision](#2-ar-dish-o-vision)
3. [Feature 3: Dine With Me](#3-dine-with-me)
4. [Feature 4: Reservation System](#4-reservation-system)
5. [Feature 5: Badges & Rewards](#5-badges--rewards)
6. [Feature 6: React Native Mobile App](#6-react-native-mobile-app)
7. [Feature 7: B2B Restaurant Portal](#7-b2b-restaurant-portal)
8. [Feature 8: Voice Search](#8-voice-search)
9. [Feature 9: Real SSR/SEO](#9-real-ssrseo)

---

## 1. Bio-Sync AI

### 1.1 Overview

**Bio-Sync AI** integrates with health and fitness platforms (Apple Health, Google Fit, MyFitnessPal) to provide personalized restaurant recommendations based on the user's real-time health data, dietary goals, nutritional intake, and fitness activity.

**Why it matters:**
- Users on specific diets (keto, low-sodium, high-protein) get instant matching recommendations
- Post-workout suggestions prioritize high-protein, calorie-appropriate venues
- Caloric budget awareness prevents over/under-eating recommendations
- Allergy and intolerance data syncs automatically from health apps
- Creates a unique value proposition no other restaurant app offers

### 1.2 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     BIO-SYNC AI ARCHITECTURE                      │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐    │
│  │ Apple Health │   │ Google Fit   │   │ MyFitnessPal API  │    │
│  │ (HealthKit)  │   │ (REST API)   │   │ (OAuth2 REST)     │    │
│  └──────┬───────┘   └──────┬───────┘   └─────────┬─────────┘    │
│         │                  │                      │              │
│         ▼                  ▼                      ▼              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Health Data Abstraction Layer               │    │
│  │         src/features/biosync/services/                   │    │
│  │                                                          │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐   │    │
│  │  │AppleHealth  │ │GoogleFit    │ │MyFitnessPal      │   │    │
│  │  │Adapter      │ │Adapter      │ │Adapter           │   │    │
│  │  └──────┬──────┘ └──────┬──────┘ └────────┬─────────┘   │    │
│  │         │               │                  │             │    │
│  │         ▼               ▼                  ▼             │    │
│  │  ┌─────────────────────────────────────────────────┐     │    │
│  │  │        NormalizedHealthData (unified schema)     │     │    │
│  │  └─────────────────────────────────────────────────┘     │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               │                                 │
│                               ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Health Data Processing Engine               │    │
│  │                                                          │    │
│  │  ┌───────────┐  ┌────────────┐  ┌───────────────────┐   │    │
│  │  │ Nutrient  │  │ Activity   │  │ Dietary Goal      │   │    │
│  │  │ Analyzer  │  │ Correlator │  │ Engine            │   │    │
│  │  └─────┬─────┘  └─────┬──────┘  └─────────┬─────────┘   │    │
│  │        │              │                     │             │    │
│  │        ▼              ▼                     ▼             │    │
│  │  ┌─────────────────────────────────────────────────┐     │    │
│  │  │           DietaryContext (Zustand store)         │     │    │
│  │  │  { caloriesRemaining, macros, allergies, goals } │     │    │
│  │  └─────────────────────────────────────────────────┘     │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               │                                 │
│                               ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              AI Recommendation Engine                    │    │
│  │                                                          │    │
│  │  Existing ai.api.js + gastroIntelligence.js extended     │    │
│  │  with DietaryContext as additional tool/filter input     │    │
│  │                                                          │    │
│  │  search_locations({                                      │    │
│  │    dietaryContext: {                                     │    │
│  │      remainingCalories: 450,                             │    │
│  │      proteinNeeded: 35,                                  │    │
│  │      avoidAllergens: ['gluten', 'dairy'],               │    │
│  │      goal: 'high-protein'                               │    │
│  │    }                                                   │    │
│  │  })                                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### 1.3 Database Schema

```sql
-- ============================================================
-- Bio-Sync AI Database Schema
-- ============================================================

-- User health provider connections
CREATE TABLE health_provider_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL CHECK (provider IN ('apple_health', 'google_fit', 'myfitnesspal')),
    provider_user_id TEXT,
    access_token    TEXT,
    refresh_token   TEXT,
    token_expires_at TIMESTAMPTZ,
    scopes          TEXT[] DEFAULT '{}',
    is_active       BOOLEAN DEFAULT true,
    last_sync_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(user_id, provider)
);

-- Cached health data (synced periodically, never real-time from health apps)
CREATE TABLE user_health_data (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    data_date       DATE NOT NULL,
    data_type       TEXT NOT NULL CHECK (data_type IN (
        'daily_nutrition', 'activity', 'weight', 'blood_glucose',
        'heart_rate', 'sleep', 'water_intake'
    )),
    data            JSONB NOT NULL,
    source_provider TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(user_id, data_date, data_type)
);

-- User dietary goals and restrictions (explicit + inferred)
CREATE TABLE user_dietary_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    goal_type       TEXT CHECK (goal_type IN (
        'weight_loss', 'weight_gain', 'maintenance',
        'muscle_gain', 'endurance', 'custom'
    )),
    daily_calories  INTEGER,
    macros          JSONB DEFAULT '{
        "protein_grams": null,
        "carbs_grams": null,
        "fat_grams": null,
        "protein_pct": null,
        "carbs_pct": null,
        "fat_pct": null
    }',
    diet_type       TEXT CHECK (diet_type IN (
        'none', 'keto', 'paleo', 'vegan', 'vegetarian',
        'mediterranean', 'low-carb', 'intermittent-fasting',
        'pescatarian', 'carnivore'
    )),
    allergens       TEXT[] DEFAULT '{}',
    intolerances    TEXT[] DEFAULT '{}',
    avoid_ingredients TEXT[] DEFAULT '{}',
    preferred_ingredients TEXT[] DEFAULT '{}',
    fasting_window  JSONB DEFAULT '{"start": null, "end": null}',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Sync job tracking
CREATE TABLE health_sync_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    error_message   TEXT,
    records_synced  INTEGER DEFAULT 0,
    started_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ,

    UNIQUE(user_id, provider)
);

-- Indexes
CREATE INDEX idx_health_data_user_date ON user_health_data(user_id, data_date DESC);
CREATE INDEX idx_health_connections_user ON health_provider_connections(user_id, is_active);
CREATE INDEX idx_health_sync_user ON health_sync_jobs(user_id, status);

-- Row Level Security
ALTER TABLE health_provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_health_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dietary_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own health connections"
    ON health_provider_connections FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users manage own health data"
    ON user_health_data FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users manage own dietary goals"
    ON user_dietary_goals FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users manage own sync jobs"
    ON health_sync_jobs FOR ALL
    USING (auth.uid() = user_id);
```

### 1.4 API Layer

```javascript
// src/features/biosync/api/health.api.js

import { supabase } from '@/shared/api/client';

// --- Provider Connection Management ---

export async function connectProvider(provider, authCode) {
  if (!supabase) throw new Error('Supabase not configured');

  // Exchange auth code for tokens via serverless function
  const response = await fetch('/api/health/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, authCode }),
  });

  if (!response.ok) throw new Error('Failed to connect health provider');

  const { tokens } = await response.json();

  const { error } = await supabase
    .from('health_provider_connections')
    .upsert({
      user_id: (await supabase.auth.getUser()).data.user.id,
      provider,
      is_active: true,
      last_sync_at: new Date().toISOString(),
    });

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function disconnectProvider(provider) {
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('health_provider_connections')
    .update({ is_active: false, access_token: null, refresh_token: null })
    .eq('user_id', (await supabase.auth.getUser()).data.user.id)
    .eq('provider', provider);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getConnectedProviders() {
  if (!supabase) return [];

  const { data } = await supabase
    .from('health_provider_connections')
    .select('provider, is_active, last_sync_at, scopes')
    .eq('user_id', (await supabase.auth.getUser()).data.user.id)
    .eq('is_active', true);

  return data || [];
}

// --- Health Data Queries ---

export async function getTodaysNutrition() {
  if (!supabase) return null;
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('user_health_data')
    .select('data, source_provider')
    .eq('user_id', (await supabase.auth.getUser()).data.user.id)
    .eq('data_date', today)
    .eq('data_type', 'daily_nutrition')
    .single();

  return data;
}

export async function getWeeklyActivitySummary() {
  if (!supabase) return [];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data } = await supabase
    .from('user_health_data')
    .select('data_date, data')
    .eq('user_id', (await supabase.auth.getUser()).data.user.id)
    .eq('data_type', 'activity')
    .gte('data_date', weekAgo.toISOString().split('T')[0])
    .order('data_date', { ascending: true });

  return data || [];
}

// --- Dietary Goals ---

export async function getDietaryGoals() {
  if (!supabase) return null;

  const { data } = await supabase
    .from('user_dietary_goals')
    .select('*')
    .eq('user_id', (await supabase.auth.getUser()).data.user.id)
    .single();

  return data;
}

export async function updateDietaryGoals(goals) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('user_dietary_goals')
    .upsert({
      user_id: (await supabase.auth.getUser()).data.user.id,
      ...goals,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// --- Sync Trigger ---

export async function triggerHealthSync(provider) {
  if (!supabase) throw new Error('Supabase not configured');

  const response = await fetch('/api/health/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });

  if (!response.ok) throw new Error('Sync trigger failed');
  return response.json();
}
```

**Serverless Functions:**
- `api/health/connect.js` -- OAuth token exchange
- `api/health/sync.js` -- Trigger data sync from provider
- `api/health/webhook.js` -- Receive webhooks from MyFitnessPal

### 1.5 UI/UX Design

```
┌─────────────────────────────────────────────┐
│  Bio-Sync Settings Page                     │
│  /profile/bio-sync                          │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Health Connections                   │  │
│  │                                       │  │
│  │  [🍎 Apple Health]    [Connected ✓]  │  │
│  │  Last sync: 5 min ago     [Disconnect]│  │
│  │                                       │  │
│  │  [🤖 Google Fit]      [Connect]      │  │
│  │                                       │  │
│  │  [📊 MyFitnessPal]    [Connected ✓]  │  │
│  │  Last sync: 2 hours ago   [Disconnect]│  │
│  │                                       │  │
│  │  [Sync Now]                           │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Today's Nutritional Budget           │  │
│  │                                       │  │
│  │  Calories  ████████░░░░  1,250/2,000 │  │
│  │  Protein   ██████░░░░░░  85g/150g    │  │
│  │  Carbs     ███████░░░░░  140g/250g   │  │
│  │  Fat       ████░░░░░░░░  30g/65g     │  │
│  │                                       │  │
│  │  [Based on Apple Health + MFP data]   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Dietary Goals                        │  │
│  │                                       │  │
│  │  Goal: ○ Weight Loss  ● Muscle Gain  │  │
│  │  Diet:  [Mediterranean ▼]            │  │
│  │                                       │  │
│  │  Allergens: [Gluten ✕] [Dairy ✕] [+] │  │
│  │                                       │  │
│  │  [Save Goals]                         │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Bio-Sync Toggle                      │  │
│  │                                       │  │
│  │  Use health data for recommendations  │  │
│  │  [══════════●════]  ON               │  │
│  │                                       │  │
│  │  Post-workout high-protein picks      │  │
│  │  Calorie-aware meal suggestions       │  │
│  │  Allergy filtering on all results     │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Design Principles:**
- Glass-morphism cards consistent with existing GastroMap UI
- Circular progress rings for macronutrients (use CSS, no heavy charting libs)
- Smooth Framer Motion transitions when data syncs
- Color-coded health indicators: green (within budget), amber (approaching), red (over)
- Privacy-first: explicit opt-in per provider, clear data usage explanation

### 1.6 Integration Points

| Existing Feature | Integration |
|---|---|
| `search_locations` (AI tool) | Add `dietaryContext` parameter to tool args |
| `useLocationsStore` | Add health-based filter presets |
| `GastroGuide AI` | System prompt includes user's dietary context |
| `LocationCard` | Show compatibility score with dietary goals |
| `User Preferences` | Merge with `user_dietary_goals` table |
| `PWA` | Request HealthKit/Google Fit permissions on install |

### 1.7 Implementation Phases

**Phase 1 -- Foundation (Weeks 1-2):**
- Create database tables and RLS policies
- Build `user_dietary_goals` CRUD API + UI
- Add dietary goal picker to onboarding flow
- Extend `search_locations` AI tool with dietary filtering

**Phase 2 -- Apple Health Integration (Weeks 3-4):**
- Implement HealthKit web-to-app bridge (iOS Safari only)
- Build `AppleHealthAdapter` service
- Create daily nutrition sync via HealthKit `HKSampleQuery`
- Build nutritional budget display component

**Phase 3 -- Google Fit & MyFitnessPal (Weeks 5-6):**
- OAuth2 flow for Google Fit REST API
- MyFitnessPal API integration (partner API or screen-scraping fallback)
- Unified `NormalizedHealthData` schema
- Cross-provider data merging logic

**Phase 4 -- AI Enhancement (Weeks 7-8):**
- Extend GastroGuide system prompt with dietary context
- Add post-workout recommendation mode
- Calorie-aware restaurant scoring
- Smart dish suggestions based on remaining macros

### 1.8 Technical Challenges

| Challenge | Solution |
|---|---|
| **HealthKit is iOS-native** -- no web API | Use `react-native-health` in RN app; for web PWA, use companion iOS app or deep link to Health app export |
| **Google Fit REST API requires server-side OAuth** | Use Vercel serverless functions with PKCE flow; store refresh tokens encrypted with Supabase Vault |
| **MyFitnessPal has no public API** | Use unofficial `myfitnesspal-client` npm package; implement screen-scraping fallback; pursue official partnership |
| **Privacy/GDPR compliance** | Explicit consent per provider; data minimization; 30-day auto-purge of raw health data |
| **Real-time sync latency** | Use background sync with Service Workers; cache last sync results in IndexedDB; show staleness indicator |

### 1.9 Estimated Complexity: **COMPLEX**

- Multiple external APIs with different auth models
- Sensitive health data requires rigorous security
- iOS HealthKit has no web API (web limitation)
- Requires significant AI prompt engineering

---

## 2. AR Dish-o-Vision

### 2.1 Overview

**AR Dish-o-Vision** uses the phone's camera to overlay dish information, ratings, and nutritional data when users point their phone at a restaurant menu or dish. This creates an immersive "point and learn" experience.

**Why it matters:**
- Transforms physical dining into an interactive discovery experience
- Helps users make informed choices when already at a restaurant
- Unique differentiator in the restaurant discovery space
- Natural extension of the knowledge graph (dishes, cuisines, ingredients)

### 2.2 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   AR DISH-O-VISION ARCHITECTURE                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Camera View (WebRTC getUserMedia)                      │    │
│  │  <video> element with real-time camera feed             │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Frame Capture & Preprocessing                          │    │
│  │  - Capture frame every 2 seconds (throttled)            │    │
│  │  - Resize to 640x480 for performance                    │    │
│  │  - Convert to blob/base64                               │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐              │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │ OCR Pipeline │   │ Object       │   │ QR/Barcode       │    │
│  │ (Tesseract.js│   │ Detection    │   │ Scanner          │    │
│  │  or Cloud    │   │ (TensorFlow  │   │ (Menu QR codes)  │    │
│  │  Vision API) │   │  Lite)       │   │                  │    │
│  └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘    │
│         │                  │                     │              │
│         ▼                  ▼                     ▼              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         Text/Entity Extraction & Matching               │    │
│  │                                                          │    │
│  │  Extracted: "Carbonara"                                  │    │
│  │  → Query knowledge_graph.api.js                          │    │
│  │  → Match dish: { name, cuisine, calories, allergens }    │    │
│  │  → Find on GastroMap locations serving this dish         │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               │                                 │
│                               ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              AR Overlay Renderer                        │    │
│  │                                                          │    │
│  │  <canvas> positioned over <video>                        │    │
│  │  Framer Motion animated info cards                       │    │
│  │  Tap-to-expand dish details                              │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 Database Schema

```sql
-- ============================================================
-- AR Dish-o-Vision Database Schema
-- ============================================================

-- Dish-to-location mapping (many-to-many)
CREATE TABLE location_dishes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    dish_id         UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    dish_name_local TEXT,                     -- Local menu name (may differ from canonical)
    price           NUMERIC(8,2),
    is_signature    BOOLEAN DEFAULT false,
    is_available    BOOLEAN DEFAULT true,
    description     TEXT,
    photo_url       TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(location_id, dish_name_local)
);

-- AR scan analytics
CREATE TABLE ar_scan_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    location_id     UUID REFERENCES locations(id),
    dish_id         UUID REFERENCES dishes(id),
    detected_text   TEXT,
    confidence      NUMERIC(3,2),             -- OCR/AI confidence 0.00-1.00
    scan_method     TEXT CHECK (scan_method IN ('ocr', 'object_detection', 'qr_code', 'manual')),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Menu images (user-contributed or restaurant-uploaded)
CREATE TABLE menu_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    image_url       TEXT NOT NULL,
    language        TEXT DEFAULT 'en',
    is_verified     BOOLEAN DEFAULT false,
    uploaded_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_location_dishes_location ON location_dishes(location_id);
CREATE INDEX idx_location_dishes_dish ON location_dishes(dish_id);
CREATE INDEX idx_ar_scan_events_user ON ar_scan_events(user_id, created_at DESC);
CREATE INDEX idx_ar_scan_events_location ON ar_scan_events(location_id, created_at DESC);
CREATE INDEX idx_menu_images_location ON menu_images(location_id);

-- RLS
ALTER TABLE location_dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Location dishes are readable by all"
    ON location_dishes FOR SELECT USING (true);

CREATE POLICY "Users can insert ar scan events"
    ON ar_scan_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Menu images are readable by all"
    ON menu_images FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upload menu images"
    ON menu_images FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
```

### 2.4 API Layer

```javascript
// src/features/arvision/api/arvision.api.js

import { supabase } from '@/shared/api/client';

// --- OCR Processing ---

export async function processMenuImage(imageBlob) {
  const formData = new FormData();
  formData.append('image', imageBlob, 'menu.jpg');

  const response = await fetch('/api/ar/ocr', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('OCR processing failed');
  return response.json();
  // Returns: { text: string, dishes: [{ name, confidence, line }] }
}

// --- Dish Recognition ---

export async function recognizeDish(imageBlob) {
  const formData = new FormData();
  formData.append('image', imageBlob, 'dish.jpg');

  const response = await fetch('/api/ar/recognize', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Dish recognition failed');
  return response.json();
  // Returns: { dish: { id, name, cuisine, confidence }, nutrition }
}

// --- Dish-to-Location Queries ---

export async function findDishesAtLocation(locationId) {
  if (!supabase) return [];

  const { data } = await supabase
    .from('location_dishes')
    .select(`*, dish:dishes(*)`)
    .eq('location_id', locationId)
    .eq('is_available', true)
    .order('is_signature', { ascending: false });

  return data || [];
}

export async function findLocationByDish(dishName) {
  if (!supabase) return [];

  const { data } = await supabase
    .from('location_dishes')
    .select(`*, location:locations(title, address, city, rating, image)`)
    .ilike('dish_name_local', `%${dishName}%`)
    .limit(10);

  return data || [];
}

// --- AR Scan Tracking ---

export async function logARScan(scanData) {
  if (!supabase) return;

  await supabase.from('ar_scan_events').insert({
    user_id: (await supabase.auth.getUser()).data.user?.id,
    location_id: scanData.locationId,
    dish_id: scanData.dishId,
    detected_text: scanData.detectedText,
    confidence: scanData.confidence,
    scan_method: scanData.method,
  });
}
```

**Serverless Functions:**
- `api/ar/ocr.js` -- Google Cloud Vision API or Tesseract.js server-side
- `api/ar/recognize.js` -- Dish image classification (ML model)

### 2.5 UI/UX Design

```
┌─────────────────────────────────────────────┐
│  AR Camera View                             │
│  Full-screen camera with overlay            │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  [Flash]  [Gallery]  [Menu/Dish ▼]   │  │
│  │                                       │  │
│  │         ╔═══════════════════╗         │  │
│  │         ║   LIVE CAMERA     ║         │  │
│  │         ║                   ║         │  │
│  │         ║  ┌─────────────┐  ║         │  │
│  │         ║  │Carbonara    │  ║         │  │
│  │         ║  │★★★★★ 1280cal│  ║         │  │
│  │         ║  │[Tap for info]│  ║         │  │
│  │         ║  └─────────────┘  ║         │  │
│  │         ║                   ║         │  │
│  │         ║  ┌─────────────┐  ║         │  │
│  │         ║  │Tiramisu     │  ║         │  │
│  │         ║  │★★★★☆ 450cal │  ║         │  │
│  │         ║  │[Tap for info]│  ║         │  │
│  │         ║  └─────────────┘  ║         │  │
│  │         ╚═══════════════════╝         │  │
│  │                                       │  │
│  │  [Shutter/Scan]        [AR Off]      │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Tap any dish card --> expand drawer:       │
│  ┌───────────────────────────────────────┐  │
│  │ Carbonara                  [x Close]  │  │
│  │ Italian Pasta                          │  │
│  │                                        │  │
│  │  Calories: 1,280   Protein: 45g       │  │
│  │  Allergens: Gluten, Dairy, Egg        │  │
│  │  Spicy Level: ░░░░░                   │  │
│  │                                        │  │
│  │  ★ 4.8 (234 reviews)                  │  │
│  │  $$ • Served at 12 nearby places      │  │
│  │                                        │  │
│  │  [View on Map]   [Add to Wishlist]    │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Design Principles:**
- Full-bleed camera view with minimal chrome
- Dish cards appear as floating glass-morphism panels
- Haptic feedback on dish detection (Vibration API)
- Dark overlay for text readability against any camera background
- Smooth Framer Motion spring animations for card appearance

### 2.6 Integration Points

| Existing Feature | Integration |
|---|---|
| Knowledge Graph (`dishes`, `cuisines`) | AR matches detected text against dish ontology |
| `locations` table | Links dishes to GastroMap venues |
| Location Details Page | "View Menu in AR" button |
| Bio-Sync AI | Overlays nutritional data from user's health context |
| `reviews` table | Show dish-specific ratings in AR overlay |

### 2.7 Implementation Phases

**Phase 1 -- OCR Foundation (Weeks 1-2):**
- Set up `/api/ar/ocr` serverless function with Google Cloud Vision API
- Build camera capture UI with `navigator.mediaDevices.getUserMedia`
- Implement frame throttling (capture every 2s)
- Display raw OCR text overlay

**Phase 2 -- Dish Matching (Weeks 3-4):**
- Build dish name extraction from OCR text (fuzzy matching)
- Integrate with knowledge graph `dishes` table
- Create dish info overlay cards
- Add tap-to-expand drawer

**Phase 3 -- Location Integration (Weeks 5-6):**
- `location_dishes` table population (admin + user-contributed)
- "Find this dish nearby" feature
- Menu image upload and storage

**Phase 4 -- Advanced Features (Weeks 7-8):**
- Dish image recognition with TensorFlow.js Lite
- QR code scanning for digital menus
- Bio-Sync nutritional overlay
- AR scan analytics dashboard

### 2.8 Technical Challenges

| Challenge | Solution |
|---|---|
| **Camera access in PWA** -- limited on iOS Safari | Use standard `getUserMedia`; iOS 17+ supports rear camera; provide fallback to photo upload |
| **OCR accuracy on menus** -- varied fonts, layouts | Use Google Cloud Vision API (best accuracy); fallback to Tesseract.js; pre-process images (contrast, deskew) |
| **Performance** -- real-time OCR is heavy | Throttle to 1 frame/2s; use Web Workers for client-side processing; server-side for production quality |
| **Dish name ambiguity** -- "Chicken" could be 100 dishes | Use location context; use cuisine context; show disambiguation UI |
| **TensorFlow.js model size** -- 50MB+ model | Use MobileNetV2 quantized (4MB); lazy-load only when user opens AR; show loading skeleton |

### 2.9 Estimated Complexity: **COMPLEX**

- Camera + ML pipeline is resource-intensive
- OCR accuracy varies dramatically by image quality
- Requires significant dish/location data for useful results
- iOS Safari limitations on camera features

---

## 3. Dine With Me

### 3.1 Overview

**Dine With Me** is a social dining feature that lets users discover and connect with other foodies in their vicinity who are open to dining together. It creates a real-time "social radar" for spontaneous meetups at restaurants.

**Why it matters:**
- Solves the "eating alone" problem for travelers, expats, and solo diners
- Creates a social network layer on top of restaurant discovery
- Increases user engagement and retention through social features
- Generates authentic, real-time social proof for restaurants

### 3.2 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    DINE WITH ME ARCHITECTURE                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Geolocation Tracking                                   │    │
│  │  useGeolocation hook extended with periodic updates     │    │
│  │  (every 60s when feature is active)                     │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Presence Service (Supabase Realtime)                   │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │  dining_presence table (PostgreSQL)              │   │    │
│  │  │  Broadcasts location + status via Supabase       │   │    │
│  │  │  Realtime channels for geo-hashed areas          │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               │                                 │
│                    ┌──────────┼──────────┐                     │
│                    ▼          ▼          ▼                      │
│  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐   │
│  │ Radar View │ │ Profile  │ │ Chat/DM    │ │ Event/Group  │   │
│  │ (Map Pins) │ │ Cards    │ │ (Supabase  │ │ Dining       │   │
│  │            │ │          │ │  Realtime) │ │ Meetups      │   │
│  └────────────┘ └──────────┘ └────────────┘ └──────────────┘   │
│                                                                  │
│  Privacy Controls:                                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Visibility:  ○ Everyone  ○ Friends Only  ○ Nobody     │    │
│  │  Radius:      [500m ----●---- 5km]                     │    │
│  │  Auto-hide:   After 30 min of inactivity               │    │
│  │  Block list:  [User management]                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 Database Schema

```sql
-- ============================================================
-- Dine With Me Database Schema
-- ============================================================

-- Real-time dining presence (ephemeral, auto-expiring)
CREATE TABLE dining_presence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    lat             NUMERIC(10,7) NOT NULL,
    lng             NUMERIC(10,7) NOT NULL,
    accuracy_meters INTEGER,
    location_id     UUID REFERENCES locations(id),
    status          TEXT DEFAULT 'looking' CHECK (status IN (
        'looking', 'eating', 'heading_to', 'leaving'
    )),
    message         TEXT,
    cuisine_prefs TEXT[] DEFAULT '{}',
    max_distance_m  INTEGER DEFAULT 2000,
    visibility      TEXT DEFAULT 'everyone' CHECK (visibility IN (
        'everyone', 'friends_only', 'nobody'
    )),
    party_size      INTEGER DEFAULT 1,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Friend connections
CREATE TABLE user_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    addressee_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(requester_id, addressee_id)
);

-- Direct messages between users
CREATE TABLE user_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content         TEXT NOT NULL CHECK (char_length(content) <= 500),
    is_read         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Group dining events
CREATE TABLE dining_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    location_id     UUID REFERENCES locations(id),
    title           TEXT NOT NULL,
    description     TEXT,
    cuisine_type    TEXT,
    scheduled_at    TIMESTAMPTZ NOT NULL,
    max_attendees   INTEGER DEFAULT 6,
    current_attendees INTEGER DEFAULT 1,
    status          TEXT DEFAULT 'open' CHECK (status IN ('open', 'full', 'cancelled', 'completed')),
    visibility      TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'friends_only', 'private')),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Event attendance
CREATE TABLE dining_event_attendees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES dining_events(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status          TEXT DEFAULT 'attending' CHECK (status IN ('attending', 'maybe', 'cancelled')),
    created_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(event_id, user_id)
);

-- Indexes (with PostGIS-style geo queries via bounding box)
CREATE INDEX idx_dining_presence_geo ON dining_presence USING gist (
    ll_to_earth(lat, lng)
);
CREATE INDEX idx_dining_presence_expires ON dining_presence(expires_at);
CREATE INDEX idx_dining_presence_user ON dining_presence(user_id);
CREATE INDEX idx_user_connections_user ON user_connections(requester_id, addressee_id);
CREATE INDEX idx_user_messages_recipient ON user_messages(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_dining_events_scheduled ON dining_events(scheduled_at, status);

-- RLS
ALTER TABLE dining_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dining presence: see others based on visibility"
    ON dining_presence FOR SELECT
    USING (
        visibility = 'everyone'
        OR (visibility = 'friends_only' AND EXISTS (
            SELECT 1 FROM user_connections
            WHERE (requester_id = dining_presence.user_id OR addressee_id = dining_presence.user_id)
            AND status = 'accepted'
            AND (addressee_id = auth.uid() OR requester_id = auth.uid())
        ))
    );

CREATE POLICY "Users manage own presence"
    ON dining_presence FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users manage own connections"
    ON user_connections FOR ALL
    USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can read messages they're part of"
    ON user_messages FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages"
    ON user_messages FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Dining events visible based on setting"
    ON dining_events FOR SELECT
    USING (
        visibility = 'public'
        OR (visibility = 'friends_only' AND EXISTS (
            SELECT 1 FROM user_connections
            WHERE (requester_id = dining_events.creator_id OR addressee_id = dining_events.creator_id)
            AND status = 'accepted'
            AND (addressee_id = auth.uid() OR requester_id = auth.uid())
        ))
        OR visibility = 'private' AND creator_id = auth.uid()
    );
```

### 3.4 API Layer

```javascript
// src/features/dinewithme/api/dinewithme.api.js

import { supabase } from '@/shared/api/client';

// --- Presence Management ---

export async function updatePresence({ lat, lng, status, message, cuisinePrefs }) {
  if (!supabase) throw new Error('Supabase not configured');

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min TTL

  const { data, error } = await supabase
    .from('dining_presence')
    .upsert({
      user_id: (await supabase.auth.getUser()).data.user.id,
      lat,
      lng,
      status,
      message,
      cuisine_preferences: cuisinePrefs || [],
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function clearPresence() {
  if (!supabase) return;

  await supabase
    .from('dining_presence')
    .delete()
    .eq('user_id', (await supabase.auth.getUser()).data.user.id);
}

// --- Nearby Users ---

export async function getNearbyDiners({ lat, lng, radiusMeters = 2000 }) {
  if (!supabase) return [];

  // Bounding box approximation
  const latRange = radiusMeters / 111320;
  const lngRange = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));

  const { data } = await supabase
    .from('dining_presence')
    .select(`*, profile:profiles(name, avatar_url, role)`)
    .gte('lat', lat - latRange)
    .lte('lat', lat + latRange)
    .gte('lng', lng - lngRange)
    .lte('lng', lng + lngRange)
    .gte('expires_at', new Date().toISOString())
    .neq('user_id', (await supabase.auth.getUser()).data.user.id);

  // Client-side haversine filtering for precision
  return (data || []).filter((p) => {
    const dist = haversineDistance(lat, lng, p.lat, p.lng);
    return dist <= radiusMeters;
  });
}

// --- Friend Connections ---

export async function sendFriendRequest(userId) {
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('user_connections')
    .insert({
      requester_id: (await supabase.auth.getUser()).data.user.id,
      addressee_id: userId,
    });

  if (error) throw new Error(error.message);
}

export async function respondToFriendRequest(connectionId, accept) {
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('user_connections')
    .update({ status: accept ? 'accepted' : 'blocked' })
    .eq('id', connectionId)
    .eq('addressee_id', (await supabase.auth.getUser()).data.user.id);

  if (error) throw new Error(error.message);
}

// --- Messaging ---

export async function sendMessage(recipientId, content) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('user_messages')
    .insert({
      sender_id: (await supabase.auth.getUser()).data.user.id,
      recipient_id: recipientId,
      content: content.slice(0, 500),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// --- Dining Events ---

export async function createDiningEvent(eventData) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('dining_events')
    .insert({
      creator_id: (await supabase.auth.getUser()).data.user.id,
      ...eventData,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// Helper: Haversine distance
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

### 3.5 UI/UX Design

```
┌─────────────────────────────────────────────┐
│  Dine With Me -- Radar View                 │
│  /dashboard/dine-with-me                    │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  [● You are VISIBLE]  [Radius: 2km]  │  │
│  │  Looking for: [Italian, Sushi v]     │  │
│  │  Status: * Looking to dine           │  │
│  │                                       │  │
│  │  "Anyone up for dinner near Krakow   │  │
│  │   Old Town? I know a great spot!"    │  │
│  │                                       │  │
│  │  [Update Presence]  [Go Invisible]   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Nearby Foodies (3 within 2km)       │  │
│  │                                       │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ [pin] Anna K.  -  350m away    │  │  │
│  │  │  At: Restauracja Pod Aniolem   │  │  │
│  │  │  Looking for companions        │  │  │
│  │  │  Prefers: Mediterranean        │  │  │
│  │  │  [Message] [Wave]              │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │                                       │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ [pin] Marco R. - 800m away     │  │  │
│  │  │  Wants: Sushi dinner           │  │  │
│  │  │  Party of 2, open to 4         │  │  │
│  │  │  [Message] [Wave]              │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │                                       │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ [event] Sushi Night Out        │  │  │
│  │  │  by Kasia - Tonight 7:30 PM   │  │  │
│  │  │  Sushi Miya - 3/6 spots left  │  │  │
│  │  │  [Join Event]                  │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌──────────────┐ ┌──────────────┐         │
│  │ [Requests 2] │ │ [Events 1]   │         │
│  └──────────────┘ └──────────────┘         │
└─────────────────────────────────────────────┘
```

**Design Principles:**
- Map-first view with pulsing avatar pins (like Snapchat map)
- Card-based list for quick scanning
- Color-coded pins: green (looking), blue (eating), amber (heading to)
- Privacy is paramount: clear visibility controls, auto-expire
- Friendly, warm language -- social dining, not dating

### 3.6 Integration Points

| Existing Feature | Integration |
|---|---|
| `useGeolocation` hook | Extended with periodic presence updates |
| Leaflet Map | New layer for nearby diner pins |
| `locations` table | Link presence to known GastroMap venues |
| `profiles` table | Display user info on presence cards |
| Existing review system | "Dined with [name]" review tags |
| GastroGuide AI | "Who's dining nearby?" conversational query |

### 3.7 Implementation Phases

**Phase 1 -- Core Presence (Weeks 1-2):**
- `dining_presence` table + RLS
- `updatePresence` / `clearPresence` API
- Basic radar view (list of nearby users)
- Visibility and auto-expire logic

**Phase 2 -- Social Features (Weeks 3-4):**
- Friend request system (`user_connections`)
- Direct messaging (`user_messages`)
- Supabase Realtime subscriptions for live updates
- Push notifications for nearby matches

**Phase 3 -- Events (Weeks 5-6):**
- `dining_events` table + CRUD
- Event creation flow with venue picker
- Attendance management
- Event discovery on map view

**Phase 4 -- Safety & Polish (Weeks 7-8):**
- Block/report functionality
- Rate limiting on messages
- Profile verification badges
- Activity feed ("Anna just checked in at...")

### 3.8 Technical Challenges

| Challenge | Solution |
|---|---|
| **Real-time geo queries without PostGIS** | Use bounding box approximation + client-side Haversine; upgrade to PostGIS for production scale |
| **Battery drain from constant location updates** | Only track when feature is active; throttle to 60s intervals; use background geolocation sparingly |
| **Harassment/safety concerns** | Mandatory friend-request-before-messaging (configurable); block/report; rate limits; admin moderation |
| **Privacy/GDPR** | Explicit opt-in; auto-expire presence (30 min); no location history stored; instant purge |
| **Low user density** -- chicken-and-egg problem | Seed with events from admin; show fallback for empty areas; integrate with existing user base first |

### 3.9 Estimated Complexity: **COMPLEX**

- Real-time bidirectional messaging
- Geo-spatial queries at scale
- Significant safety and moderation requirements
- Network effect dependency

---

## 4. Reservation System

### 4.1 Overview

**Reservation System** enables users to book tables directly through GastroMap, integrating with restaurant reservation management systems or providing a standalone booking flow for restaurants without existing systems.

**Why it matters:**
- Completes the user journey: discover --> decide --> book --> dine
- Revenue stream: charge restaurants per booking or via subscription
- Increases user engagement and app utility
- Restaurants get a new booking channel without tech overhead

### 4.2 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   RESERVATION SYSTEM ARCHITECTURE                 │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  GastroMap Reservation UI                               │    │
│  │  - Date/time picker                                    │    │
│  │  - Party size selector                                 │    │
│  │  - Special requests (allergies, occasions)             │    │
│  │  - Confirmation flow                                   │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                   │
│                    ┌────────┼────────┐                         │
│                    ▼        ▼        ▼                          │
│  ┌────────────┐ ┌────────┐ ┌────────┐ ┌──────────────────┐    │
│  │ Direct     │ │ Open-  │ │ Resy/  │ │ Email/SMS        │    │
│  │ (restaurant│ │ Table  │ │Seven-  │ │ Fallback         │    │
│  │  confirms) │ │  API   │ │  fork  │ │ (manual relay)   │    │
│  └────────────┘ └────────┘ └────────┘ └──────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Reservation Management (Supabase)                      │    │
│  │                                                          │    │
│  │  reservations ---┬--- reservation_slots                  │    │
│  │                  ├── restaurant_availability             │    │
│  │                  └--- reservation_notifications          │    │
│  │                                                          │    │
│  │  Webhook receivers for external providers                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Notification System                                    │    │
│  │  - Push notification (PWA)                             │    │
│  │  - Email confirmation                                  │    │
│  │  - SMS reminder (24h before)                           │    │
│  │  - Calendar invite (.ics attachment)                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Database Schema

```sql
-- ============================================================
-- Reservation System Database Schema
-- ============================================================

-- Restaurant reservation settings
CREATE TABLE restaurant_reservation_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE UNIQUE,
    accepts_reservations BOOLEAN DEFAULT true,
    booking_provider TEXT CHECK (booking_provider IN (
        'direct', 'opentable', 'resy', 'sevenrooms', 'manual'
    )),
    provider_external_id TEXT,
    max_party_size    INTEGER DEFAULT 10,
    min_party_size    INTEGER DEFAULT 1,
    advance_booking_days INTEGER DEFAULT 30,
    same_day_booking  BOOLEAN DEFAULT true,
    cancellation_hours INTEGER DEFAULT 24,
    deposit_required  BOOLEAN DEFAULT false,
    deposit_amount    NUMERIC(8,2),
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Weekly availability template
CREATE TABLE restaurant_availability (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    opens_at        TIME NOT NULL,
    closes_at       TIME NOT NULL,
    slot_interval_minutes INTEGER DEFAULT 30,
    max_reservations_per_slot INTEGER DEFAULT 4,
    is_active       BOOLEAN DEFAULT true,
    UNIQUE(location_id, day_of_week)
);

-- Specific date overrides (holidays, events)
CREATE TABLE availability_overrides (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    override_date   DATE NOT NULL,
    is_closed       BOOLEAN DEFAULT false,
    opens_at        TIME,
    closes_at       TIME,
    max_reservations_per_slot INTEGER,
    reason          TEXT,
    UNIQUE(location_id, override_date)
);

-- Reservations
CREATE TABLE reservations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    party_size      INTEGER NOT NULL CHECK (party_size BETWEEN 1 AND 20),
    status          TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'cancelled', 'no_show', 'completed'
    )),
    special_requests TEXT,
    occasion        TEXT CHECK (occasion IN (
        null, 'birthday', 'anniversary', 'date', 'business', 'celebration'
    )),
    table_number    TEXT,
    provider_booking_id TEXT,
    confirmation_code TEXT UNIQUE,
    cancelled_at    TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Reservation notifications
CREATE TABLE reservation_notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN (
        'confirmation', 'reminder_24h', 'reminder_1h',
        'cancelled', 'modified'
    )),
    channel         TEXT NOT NULL CHECK (channel IN ('push', 'email', 'sms')),
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at         TIMESTAMPTZ,
    error_message   TEXT
);

-- Indexes
CREATE INDEX idx_reservations_user ON reservations(user_id, reservation_date DESC);
CREATE INDEX idx_reservations_location ON reservations(location_id, reservation_date);
CREATE INDEX idx_reservations_status ON reservations(status, reservation_date);
CREATE INDEX idx_availability_location ON restaurant_availability(location_id, day_of_week);
CREATE INDEX idx_overrides_date ON availability_overrides(location_id, override_date);

-- RLS
ALTER TABLE restaurant_reservation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reservation settings readable by all"
    ON restaurant_reservation_settings FOR SELECT USING (true);

CREATE POLICY "Users manage own reservations"
    ON reservations FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Restaurant owners see reservations at their venues"
    ON reservations FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM locations WHERE locations.id = reservations.location_id
        AND locations.owner_id = auth.uid()
    ));
```

### 4.4 API Layer

```javascript
// src/features/reservations/api/reservations.api.js

import { supabase } from '@/shared/api/client';

// --- Availability ---

export async function getAvailability(locationId, date) {
  if (!supabase) return { slots: [] };

  const dayOfWeek = new Date(date).getDay();

  const { data: availability } = await supabase
    .from('restaurant_availability')
    .select('*')
    .eq('location_id', locationId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single();

  const { data: override } = await supabase
    .from('availability_overrides')
    .select('*')
    .eq('location_id', locationId)
    .eq('override_date', date)
    .single();

  if (override?.is_closed) return { slots: [], isClosed: true, reason: override.reason };

  const effective = override || availability;
  if (!effective) return { slots: [], isClosed: true, reason: 'Not available' };

  const slots = generateTimeSlots(effective, date);

  const { data: bookings } = await supabase
    .from('reservations')
    .select('reservation_time')
    .eq('location_id', locationId)
    .eq('reservation_date', date)
    .in('status', ['pending', 'confirmed']);

  const bookingCounts = {};
  bookings?.forEach((b) => {
    const key = b.reservation_time;
    bookingCounts[key] = (bookingCounts[key] || 0) + 1;
  });

  return {
    slots: slots.map((slot) => ({
      time: slot,
      available: (bookingCounts[slot] || 0) < effective.max_reservations_per_slot,
      remaining: effective.max_reservations_per_slot - (bookingCounts[slot] || 0),
    })),
  };
}

// --- Booking ---

export async function createReservation(bookingData) {
  if (!supabase) throw new Error('Supabase not configured');

  const confirmationCode = generateConfirmationCode();

  const { data, error } = await supabase
    .from('reservations')
    .insert({
      user_id: (await supabase.auth.getUser()).data.user.id,
      location_id: bookingData.locationId,
      reservation_date: bookingData.date,
      reservation_time: bookingData.time,
      party_size: bookingData.partySize,
      special_requests: bookingData.specialRequests,
      occasion: bookingData.occasion,
      confirmation_code: confirmationCode,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Queue notifications
  await supabase.from('reservation_notifications').insert([
    { reservation_id: data.id, type: 'confirmation', channel: 'push' },
    { reservation_id: data.id, type: 'confirmation', channel: 'email' },
  ]);

  return { ...data, confirmationCode };
}

export async function cancelReservation(reservationId, reason) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq('id', reservationId)
    .eq('user_id', (await supabase.auth.getUser()).data.user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getUserReservations() {
  if (!supabase) return [];

  const { data } = await supabase
    .from('reservations')
    .select(`*, location:locations(title, address, city, image)`)
    .eq('user_id', (await supabase.auth.getUser()).data.user.id)
    .order('reservation_date', { ascending: true })
    .order('reservation_time', { ascending: true });

  return data || [];
}

// Helpers
function generateTimeSlots(availability, date) {
  const slots = [];
  const interval = availability.slot_interval_minutes;
  let current = timeToMinutes(availability.opens_at);
  const end = timeToMinutes(availability.closes_at);

  while (current < end) {
    slots.push(minutesToTime(current));
    current += interval;
  }
  return slots;
}

function generateConfirmationCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = Math.floor(Math.random() * 999).toString().padStart(3, '0');
  return `GM-${date}-${seq}`;
}
```

### 4.5 UI/UX Design

```
┌─────────────────────────────────────────────┐
│  Location Details -- Reservation Tab        │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  [cal] Book a Table at Pod Aniolem    │  │
│  │                                       │  │
│  │  Date:  [Apr 5, 2026 v]              │  │
│  │  Party: [.. 2 people v]              │  │
│  │                                       │  │
│  │  Available Times:                     │  │
│  │  [6:00] [6:30] [7:00] [7:30] [8:00]  │  │
│  │   [ok]   [ok]   [ok]   [1]    [ok]    │  │
│  │  [ok]=Available  [1]=1 spot left      │  │
│  │                                       │  │
│  │  Occasion: (optional)                 │  │
│  │  ( ) None  ( ) Birthday  ( ) Date    │  │
│  │  ( ) Anniversary  ( ) Business        │  │
│  │                                       │  │
│  │  Special requests:                    │  │
│  │  [Window seat, nut allergy________]   │  │
│  │                                       │  │
│  │  [Book Table -- Confirmation Free]   │  │
│  │  Free cancellation up to 24h before   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  After booking:                            │
│  ┌───────────────────────────────────────┐  │
│  │  [check] Reservation Confirmed!       │  │
│  │                                       │  │
│  │  Code: GM-20260405-042               │  │
│  │  Pod Aniolem - Apr 5, 7:00 PM       │  │
│  │  Party of 2                          │  │
│  │                                       │  │
│  │  [Add to Calendar]  [Share]          │  │
│  │  You'll get a reminder 24h before    │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 4.6 Integration Points

| Existing Feature | Integration |
|---|---|
| `LocationDetailsPage` | New "Reservations" tab |
| `locations` table | `reservations_required` field already exists |
| User Dashboard | "My Reservations" section |
| GastroGuide AI | "Book a table at..." conversational booking |
| Stripe API | Deposit payments for premium restaurants |
| PWA Push | Reservation reminders and confirmations |

### 4.7 Implementation Phases

**Phase 1 -- Direct Booking (Weeks 1-2):**
- Database schema migration
- Basic availability generation from templates
- Reservation creation and cancellation flow
- Confirmation code generation

**Phase 2 -- Notification System (Weeks 3-4):**
- Push notification integration
- Email confirmations via Resend/SendGrid
- Calendar invite generation (.ics)
- 24h/1h reminder scheduling via cron

**Phase 3 -- External Integrations (Weeks 5-8):**
- OpenTable API integration (partner program)
- Resy API integration
- SevenRooms webhook setup
- Unified booking abstraction layer

**Phase 4 -- Restaurant Tools (Weeks 9-10):**
- Restaurant owner reservation management (B2B Portal)
- No-show tracking
- Analytics dashboard
- Capacity management

### 4.8 Technical Challenges

| Challenge | Solution |
|---|---|
| **Restaurant external APIs are restricted** | OpenTable/Resy require partnership; start with direct + manual email fallback |
| **Double booking prevention** | Optimistic locking with `max_reservations_per_slot`; retry on conflict; atomic updates |
| **Timezone handling** | Store all times in restaurant's local timezone; convert on display; use `luxon` library |
| **No-show enforcement** | Track no-show rate per user; limit bookings for chronic no-shows; require deposits |
| **Cancellation abuse** | Configurable cancellation window; track patterns; temporary booking restrictions |

### 4.9 Estimated Complexity: **MEDIUM**

- Core booking flow is straightforward
- External API integrations are the complex part (but can be phased)
- Notification system is well-understood pattern
- Timezone and availability logic requires careful testing

---

## 5. Badges & Rewards

### 5.1 Overview

**Badges & Rewards** is a gamification system that rewards users for engaging with the platform: visiting restaurants, writing reviews, discovering new places, sharing experiences, and building their foodie profile.

**Why it matters:**
- Drives user engagement and retention through intrinsic motivation
- Creates social proof and status signaling
- Encourages desired behaviors (reviews, visits, social sharing)
- Differentiates GastroMap from basic restaurant listing apps

### 5.2 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   BADGES & REWARDS ARCHITECTURE                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Event Tracker (Zustand + Supabase Realtime)            │    │
│  │                                                          │    │
│  │  user_reviews.create  --->  BadgeEngine.evaluate()      │    │
│  │  user_visits.create   --->  BadgeEngine.evaluate()      │    │
│  │  user_favorites.add   --->  BadgeEngine.evaluate()      │    │
│  │  user_shares.create   --->  BadgeEngine.evaluate()      │    │
│  │  user_streaks.update  --->  BadgeEngine.evaluate()      │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               │                                 │
│                               ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Badge Engine (src/features/gamification/)              │    │
│  │                                                          │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐   │    │
│  │  │ Rule        │  │ Progress    │  │ Reward         │   │    │
│  │  │ Evaluator   │  │ Tracker     │  │ Distributor    │   │    │
│  │  │             │  │             │  │                │   │    │
│  │  │ Checks if   │  │ Updates     │  │ Grants badges, │   │    │
│  │  │ conditions  │  │ progress    │  │ points, perks  │   │    │
│  │  │ are met     │  │ bars        │  │                │   │    │
│  │  └─────────────┘  └─────────────┘  └────────────────┘   │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               │                                 │
│                    ┌──────────┼──────────┐                     │
│                    ▼          ▼          ▼                      │
│  ┌────────────┐ ┌──────────┐ ┌────────┐ ┌──────────────────┐   │
│  │ User       │ │ Leader-  │ │ Reward │ │ Achievement      │   │
│  │ Badges     │ │ board    │ │ Points │ │ Showcase Page    │   │
│  │ Collection │ │ Rankings │ │ Wallet │ │                  │   │
│  └────────────┘ └──────────┘ └────────┘ └──────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 Database Schema

```sql
-- ============================================================
-- Badges & Rewards Database Schema
-- ============================================================

-- Badge definitions (admin-managed)
CREATE TABLE badge_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL,
    category        TEXT CHECK (category IN (
        'explorer', 'critic', 'social', 'streak', 'milestone', 'seasonal'
    )),
    tier            TEXT CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'legendary')),
    icon_url        TEXT,
    requirements    JSONB NOT NULL,
    points_value    INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    is_secret       BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- User badge earnings
CREATE TABLE user_badges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    badge_id        UUID NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
    earned_at       TIMESTAMPTZ DEFAULT now(),
    context         JSONB DEFAULT '{}',

    UNIQUE(user_id, badge_id)
);

-- User points/rewards wallet
CREATE TABLE user_points (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    total_points    INTEGER DEFAULT 0,
    spent_points    INTEGER DEFAULT 0,
    level           INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Points transaction history (audit trail)
CREATE TABLE points_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount          INTEGER NOT NULL,
    reason          TEXT NOT NULL,
    reference_type  TEXT,
    reference_id    UUID,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Available rewards (redeemable with points)
CREATE TABLE reward_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT NOT NULL,
    cost_points     INTEGER NOT NULL,
    reward_type     TEXT CHECK (reward_type IN (
        'discount', 'free_item', 'priority_booking', 'exclusive_access',
        'profile_badge', 'subscription_trial'
    )),
    reward_config   JSONB,
    is_active       BOOLEAN DEFAULT true,
    redemption_limit INTEGER,
    redeemed_count  INTEGER DEFAULT 0,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- User reward redemptions
CREATE TABLE user_reward_redemptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reward_id       UUID NOT NULL REFERENCES reward_definitions(id),
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'refunded')),
    redeemed_at     TIMESTAMPTZ DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    used_at         TIMESTAMPTZ,
    redemption_code TEXT UNIQUE
);

-- User streaks (consecutive days of activity)
CREATE TABLE user_streaks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    current_streak  INTEGER DEFAULT 0,
    longest_streak  INTEGER DEFAULT 0,
    last_active_date DATE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_user_badges_user ON user_badges(user_id, earned_at DESC);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX idx_points_tx_user ON points_transactions(user_id, created_at DESC);
CREATE INDEX idx_user_rewards_user ON user_reward_redemptions(user_id, status);
CREATE INDEX idx_streaks_active ON user_streaks(last_active_date);

-- RLS
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badge definitions readable by all"
    ON badge_definitions FOR SELECT USING (is_active = true);

CREATE POLICY "Users see own badges"
    ON user_badges FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users see own points"
    ON user_points FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users see own transactions"
    ON points_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Reward definitions readable by all"
    ON reward_definitions FOR SELECT USING (is_active = true);

CREATE POLICY "Users manage own redemptions"
    ON user_reward_redemptions FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users see own streaks"
    ON user_streaks FOR ALL
    USING (auth.uid() = user_id);
```

### 5.4 API Layer

```javascript
// src/features/gamification/api/gamification.api.js

import { supabase } from '@/shared/api/client';

// --- Badge Engine ---

export const BADGE_RULES = {
  first_review: {
    check: async (userId) => {
      const { count } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      return count >= 1;
    },
    badge: 'first-review',
  },
  ten_reviews: {
    check: async (userId) => {
      const { count } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      return count >= 10;
    },
    badge: 'ten-reviews',
  },
  first_visit: {
    check: async (userId) => {
      const { count } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      return count >= 1;
    },
    badge: 'first-visit',
  },
  city_explorer: {
    check: async (userId) => {
      const { data } = await supabase
        .from('visits')
        .select('location:locations(city)')
        .eq('user_id', userId);
      const uniqueCities = new Set(data?.map((v) => v.location?.city));
      return uniqueCities.size >= 5;
    },
    badge: 'city-explorer',
  },
  cuisine_connoisseur: {
    check: async (userId) => {
      const { data } = await supabase
        .from('visits')
        .select('location:locations(cuisine)')
        .eq('user_id', userId);
      const uniqueCuisines = new Set(data?.map((v) => v.location?.cuisine));
      return uniqueCuisines.size >= 10;
    },
    badge: 'cuisine-connoisseur',
  },
  seven_day_streak: {
    check: async (userId) => {
      const { data } = await supabase
        .from('user_streaks')
        .select('current_streak')
        .eq('user_id', userId)
        .single();
      return data?.current_streak >= 7;
    },
    badge: 'week-warrior',
  },
};

export async function evaluateBadges(userId) {
  const earned = [];

  for (const [ruleKey, rule] of Object.entries(BADGE_RULES)) {
    const meetsRequirement = await rule.check(userId);
    if (meetsRequirement) {
      const { data: existing } = await supabase
        .from('user_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_id', (await getBadgeIdBySlug(rule.badge)))
        .single();

      if (!existing) {
        earned.push(rule.badge);
      }
    }
  }

  return earned;
}

// --- Points ---

export async function awardPoints(userId, amount, reason, reference) {
  if (!supabase) return;

  const { error } = await supabase.rpc('add_points', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_reference_type: reference?.type,
    p_reference_id: reference?.id,
  });

  if (error) throw new Error(error.message);
}

// --- Streaks ---

export async function updateStreak(userId) {
  if (!supabase) return;

  const today = new Date().toISOString().split('T')[0];

  const { data: streak } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!streak) {
    await supabase.from('user_streaks').insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    });
    return;
  }

  const lastDate = streak.last_active_date;
  const daysDiff = Math.floor(
    (new Date(today) - new Date(lastDate)) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff === 0) return; // Already active today

  const newStreak = daysDiff === 1 ? streak.current_streak + 1 : 1;
  const newLongest = Math.max(newStreak, streak.longest_streak);

  await supabase
    .from('user_streaks')
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_active_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}

// --- Rewards ---

export async function redeemReward(userId, rewardId) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data: points } = await supabase
    .from('user_points')
    .select('total_points, spent_points')
    .eq('user_id', userId)
    .single();

  const available = points.total_points - points.spent_points;

  const { data: reward } = await supabase
    .from('reward_definitions')
    .select('*')
    .eq('id', rewardId)
    .single();

  if (available < reward.cost_points) {
    throw new Error('Insufficient points');
  }

  const { data, error } = await supabase
    .from('user_reward_redemptions')
    .insert({
      user_id: userId,
      reward_id: rewardId,
      redemption_code: generateRedemptionCode(),
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await awardPoints(userId, -reward.cost_points, `Redeemed: ${reward.name}`);

  return data;
}
```

**PostgreSQL Function for atomic point updates:**

```sql
CREATE OR REPLACE FUNCTION add_points(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE user_points
  SET total_points = total_points + p_amount,
      level = calculate_level(total_points + p_amount),
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO points_transactions (user_id, amount, reason, reference_type, reference_id)
  VALUES (p_user_id, p_amount, p_reason, p_reference_type, p_reference_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calculate_level(points INTEGER) RETURNS INTEGER AS $$
BEGIN
  -- Level formula: level = floor(sqrt(points / 100)) + 1
  RETURN floor(sqrt(GREATEST(points, 0) / 100.0)) + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### 5.5 UI/UX Design

```
┌─────────────────────────────────────────────┐
│  Badges & Rewards                           │
│  /dashboard/rewards                         │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Level 7 Foodie  -  4,250 points     │  │
│  │  ████████████░░░░░░░░ 42% to Level 8 │  │
│  │                                       │  │
│  │  🔥 12-day streak!                    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Badges Collection (12/30 earned)    │  │
│  │                                       │  │
│  │  [🍽️] [✍️] [🌍] [🔥] [🍕]          │  │
│  │  First 10   City  Week  Pizza        │  │
│  │  Visit Revs  Explr  War   Lover       │  │
│  │                                       │  │
│  │  [🔒] [🔒] [🔒]  (secret)            │  │
│  │   ???  ???  ???                       │  │
│  │                                       │  │
│  │  [View All Badges -->]                │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Redeem Rewards                       │  │
│  │                                       │  │
│  │  10% off at any partner               │  │
│  │  [500 points]  [Redeem]              │  │
│  │                                       │  │
│  │  Free dessert at 3 restaurants        │  │
│  │  [200 points]  [Redeem]              │  │
│  │                                       │  │
│  │  Priority booking (30 days)           │  │
│  │  [1,000 points] [Redeem]             │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [Leaderboard]  [My Activity]              │
└─────────────────────────────────────────────┘
```

### 5.6 Integration Points

| Existing Feature | Integration |
|---|---|
| `reviews` table | Review count badges, quality scoring |
| `visits` table | Visit count, cuisine diversity, city explorer badges |
| `favorites` table | Collection milestones |
| Existing `LeaderboardPage` | Extend with points-based ranking |
| `ProfilePage` | Display badge showcase and level |
| `Dine With Me` | Social badges for group dining |

### 5.7 Implementation Phases

**Phase 1 -- Core System (Weeks 1-2):**
- Database schema + badge definitions
- Badge engine with rule evaluator
- Points wallet + transaction log
- Streak tracking

**Phase 2 -- UI & Display (Weeks 3-4):**
- Badges collection page
- Profile badge showcase
- Level progress bar
- Toast notifications on badge unlock

**Phase 3 -- Rewards (Weeks 5-6):**
- Reward definitions CRUD
- Redemption flow with point deduction
- Redemption code generation
- Restaurant validation UI

**Phase 4 -- Advanced (Weeks 7-8):**
- Seasonal/limited-time badges
- Social sharing of achievements
- Admin badge management interface
- Analytics on engagement impact

### 5.8 Technical Challenges

| Challenge | Solution |
|---|---|
| **Real-time badge evaluation** -- checking on every action is expensive | Use event-driven evaluation; batch process for complex rules; cache in Zustand |
| **Points exploitation** -- users gaming the system | Rate limit point-earning actions; require meaningful activity (review min 50 chars); admin can reverse fraudulent points |
| **Secret badge leaks** | Only return secret badge names after earned; separate query for secret badge metadata |
| **Badge definition changes** | Version badge definitions; re-evaluate all users on rule change; log evaluation history |

### 5.9 Estimated Complexity: **MEDIUM**

- Straightforward CRUD + event evaluation
- Main complexity is in rule engine design
- Points economy needs careful balancing
- Well-defined patterns exist (gamification is common)

---

## 6. React Native Mobile App

### 6.1 Overview

**React Native** creates a true native mobile app for iOS and Android using the existing React knowledge base, sharing business logic and API layer with the web PWA while providing native performance, push notifications, camera access, and app store presence.

**Why it matters:**
- Native push notifications (reliable, unlike PWA push on iOS)
- Full camera access (critical for AR Dish-o-Vision)
- HealthKit/Google Fit native APIs (for Bio-Sync AI)
- App store presence and discovery
- Better performance for map rendering and animations
- Background location tracking (for Dine With Me)

### 6.2 Architecture

```
  Project Structure:
  gastromap-mobile/
  |-- app/                    # Expo Router (file-based routing)
  |   |-- (auth)/            # Auth stack
  |   |   |-- login.tsx      # Login screen
  |   |   +-- signup.tsx     # Signup screen
  |   |-- (tabs)/            # Tab navigation
  |   |   |-- _layout.tsx    # Tab bar config
  |   |   |-- index.tsx      # Explore/Home
  |   |   |-- map.tsx        # Full-screen map
  |   |   |-- arvision.tsx   # AR Dish-o-Vision
  |   |   |-- dinewithme.tsx # Social radar
  |   |   +-- profile.tsx    # User profile
  |   +-- location/          # Location detail
  |       +-- [id].tsx       # Dynamic route
  |
  |-- src/
  |   |-- shared/            # SHARED WITH WEB (monorepo)
  |   |   |-- api/           # SAME API functions
  |   |   |-- config/        # SAME config
  |   |   +-- hooks/         # Platform-adapted hooks
  |   |-- mobile/            # Mobile-specific
  |   |   |-- components/    # Native components
  |   |   |-- navigation/    # React Navigation config
  |   |   |-- services/      # Native services (push, camera)
  |   |   +-- utils/         # Mobile utilities
  |   +-- store/             # Zustand stores (shared)
  |
  |-- packages/              # Monorepo packages
  |   +-- gastromap-core/    # Shared business logic
  |       |-- api/           # API functions (shared)
  |       |-- types/         # TypeScript types
  |       +-- utils/         # Shared utilities
  |
  |-- app.json               # Expo config
  |-- eas.json               # EAS Build config
  +-- package.json

  Shared Code Strategy (Monorepo with Turborepo):

  gastromap-web/          gastromap-mobile/
  (Vite + React)          (Expo + React Native)
       |                        |
       +-----------+------------+
                   |
             gastromap-core/
             (API, types, utils, stores)
```

### 6.3 Database Schema

No new database tables needed. The mobile app uses the **exact same Supabase backend** as the web app. All existing tables and RLS policies apply.

The only addition would be device registration for push notifications:

```sql
-- Push notification device tokens
CREATE TABLE push_devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    platform        TEXT CHECK (platform IN ('ios', 'android', 'web')),
    expo_push_token TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT true,
    last_seen_at    TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_push_devices_user ON push_devices(user_id, is_active);

ALTER TABLE push_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own devices"
    ON push_devices FOR ALL
    USING (auth.uid() = user_id);
```

### 6.4 API Layer

The mobile app reuses the **exact same API functions** from `src/shared/api/`:

```typescript
// packages/gastromap-core/src/api/locations.ts
// Shared API -- works in both web and mobile

import { supabase } from './client';

export interface LocationFilters {
  category?: string;
  query?: string;
  priceLevel?: string[];
  minRating?: number;
  vibe?: string[];
  city?: string;
  country?: string;
  limit?: number;
  offset?: number;
}

export async function getLocations(filters: LocationFilters) {
  // Same implementation as web
  // Falls back to mocks when Supabase not configured
}

export async function getLocationById(id: string) {
  // Same implementation as web
}
```

**Mobile-specific services:**

```typescript
// src/mobile/services/pushNotifications.ts
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '@gastromap/core/api/client';

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    alert('Push notifications require a physical device');
    return;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  await supabase.from('push_devices').upsert({
    user_id: (await supabase.auth.getUser()).data.user.id,
    platform: Device.osName.toLowerCase(),
    expo_push_token: token,
    is_active: true,
  });

  return token;
}

// src/mobile/services/camera.ts
import * as ImagePicker from 'expo-image-picker';

export async function capturePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });

  if (result.canceled) return null;
  return result.assets[0].uri;
}
```

### 6.5 UI/UX Design

```
┌─────────────────────────────────────────────┐
│  iOS/Android App -- Tab Navigation          │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Explore Home                         │  │
│  │  [Native map with clustering]         │  │
│  │                                       │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ [pin] Nearby Restaurants        │  │  │
│  │  │ Pod Aniolem ★4.8 $$ 200m       │  │  │
│  │  │ Szara ★4.6 $$$ 450m            │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │                                       │  │
│  │  [Native bottom sheet for details]   │  │
│  │  Drag up for full info               │  │
│  │  Drag down to dismiss                │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [Home] [Map] [AR] [Social] [Profile]      │
│                                             │
│  Native features:                           │
│  - Haptic feedback on interactions          │
│  - Swipe gestures for card dismissal        │
│  - Pull-to-refresh on lists                 │
│  - Native share sheet                       │
│  - Deep linking from notifications          │
│  - Biometric auth (Face ID / Fingerprint)   │
└─────────────────────────────────────────────┘
```

### 6.6 Integration Points

| Existing Feature | Integration |
|---|---|
| `supabase-js` | Same SDK works in React Native |
| Zustand stores | Fully compatible, shared via monorepo |
| TanStack Query | Use `@tanstack/react-query` (same package) |
| All API functions | Shared via `gastromap-core` package |
| i18n | Use `i18next` + `react-i18next` (same setup) |
| Supabase Auth | Same auth flow, plus biometric login |

### 6.7 Implementation Phases

**Phase 1 -- Monorepo Setup (Weeks 1-2):**
- Initialize Expo project with Turborepo
- Create `gastromap-core` shared package
- Migrate API layer to TypeScript
- Configure shared Zustand stores

**Phase 2 -- Core Screens (Weeks 3-5):**
- Auth screens (login, signup, biometric)
- Explore/home screen with native map
- Location detail with bottom sheet
- Tab navigation structure

**Phase 3 -- Feature Parity (Weeks 6-8):**
- Dashboard pages (saved, visited, profile)
- Review writing flow
- AI chat interface
- Admin screens (basic)

**Phase 4 -- Native Features (Weeks 9-12):**
- Push notifications (Expo Notifications)
- Camera integration (for AR)
- HealthKit/Google Fit (for Bio-Sync)
- Background location (for Dine With Me)
- Deep linking from notifications

**Phase 5 -- App Store (Weeks 13-14):**
- App Store / Play Store metadata
- Screenshots and preview video
- Submission and review process
- OTA update pipeline (EAS Update)

### 6.8 Technical Challenges

| Challenge | Solution |
|---|---|
| **Monorepo complexity** | Use Turborepo for build orchestration; share only truly common code; keep platform-specific code separate |
| **Leaflet doesn't work in RN** | Use `react-native-maps` (Apple Maps/Google Maps); abstract map interface so web uses Leaflet, mobile uses RN Maps |
| **Tailwind CSS in RN** | Use `NativeWind` (Tailwind for RN) or `tamagui`; keep styling system consistent |
| **Vite-specific code in shared packages** | Avoid `import.meta.env`; use runtime config; test shared code in both environments |
| **App store review rejection** | Ensure app provides real value beyond web; implement native-only features; follow HIG/Material guidelines |
| **Supabase SDK compatibility** | `@supabase/supabase-js` works in RN; async storage needs `@react-native-async-storage/async-storage` adapter |

### 6.9 Estimated Complexity: **COMPLEX**

- Significant engineering effort (3-4 months minimum)
- Monorepo architecture adds DevOps complexity
- Maintaining feature parity with web is ongoing
- App store submission and maintenance overhead
- BUT: leverages existing React + Supabase knowledge

---

## 7. B2B Restaurant Portal

### 7.1 Overview

**B2B Restaurant Portal** is a dedicated dashboard for restaurant owners and managers to manage their GastroMap listing, view analytics, respond to reviews, manage reservations, and access business insights.

**Why it matters:**
- Creates a revenue stream (subscription-based)
- Gives restaurants ownership of their data and presence
- Improves data quality (owners update their own info)
- Competitive advantage: restaurants actively participate in the platform
- Enables premium features (promoted listings, analytics)

### 7.2 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                  B2B RESTAURANT PORTAL ARCHITECTURE               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Restaurant Owner Authentication                        │    │
│  │  - Claim restaurant flow (verify ownership)            │    │
│  │  - Multi-staff access (owner, manager, staff roles)    │    │
│  │  - SSO with Google Business Profile (future)           │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Portal Dashboard (New route: /portal)                  │    │
│  │                                                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │Listing   │ │Reviews   │ │Analytics │ │Reservat- │   │    │
│  │  │Manager   │ │Response  │ │& Insights│ │  ions    │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │    │
│  │                                                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │Menu      │ │Photos &  │ │Promo-    │ │Billing & │   │    │
│  │  │Editor    │ │Media     │ │tions     │ │Subscript-│   │    │
│  │  │          │ │Manager   │ │Campaigns │ │  ion     │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Subscription Tiers                                     │    │
│  │                                                          │    │
│  │  Free:          Basic listing, review alerts            │    │
│  │  Pro ($29/mo):  Analytics, promo posts, menu editor     │    │
│  │  Premium ($79/mo): Everything + promoted listing, API   │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### 7.3 Database Schema

```sql
-- ============================================================
-- B2B Restaurant Portal Database Schema
-- ============================================================

-- Restaurant ownership/claims
CREATE TABLE restaurant_claims (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    claimant_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    verification_method TEXT CHECK (verification_method IN (
        'phone_call', 'email', 'document', 'postcard'
    )),
    verification_code TEXT,
    verified_at     TIMESTAMPTZ,
    rejected_reason TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(location_id)
);

-- Restaurant team members (staff access)
CREATE TABLE restaurant_team (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role            TEXT DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
    added_by        UUID REFERENCES profiles(id),
    created_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(location_id, user_id)
);

-- Restaurant subscription
CREATE TABLE restaurant_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE UNIQUE,
    tier            TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'premium')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'expired')),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Analytics events (page views, clicks)
CREATE TABLE restaurant_analytics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL CHECK (event_type IN (
        'page_view', 'direction_click', 'website_click', 'phone_click',
        'reservation_click', 'share', 'favorite', 'save'
    )),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Promotional posts (like social media posts for restaurants)
CREATE TABLE restaurant_promotions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    image_urls      TEXT[] DEFAULT '{}',
    promotion_type  TEXT CHECK (promotion_type IN (
        'special_offer', 'event', 'new_dish', 'seasonal', 'announcement'
    )),
    valid_from      TIMESTAMPTZ,
    valid_until     TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Owner responses to reviews
CREATE TABLE owner_review_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id       UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    responder_id    UUID NOT NULL REFERENCES profiles(id),
    response_text   TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    UNIQUE(review_id)
);

-- Indexes
CREATE INDEX idx_analytics_location_date ON restaurant_analytics(location_id, created_at DESC);
CREATE INDEX idx_analytics_type ON restaurant_analytics(location_id, event_type);
CREATE INDEX idx_promotions_location ON restaurant_promotions(location_id, is_active);
CREATE INDEX idx_owner_responses_review ON owner_review_responses(review_id);
CREATE INDEX idx_team_location ON restaurant_team(location_id);

-- RLS
ALTER TABLE restaurant_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_review_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members see their restaurant claims"
    ON restaurant_claims FOR ALL
    USING (claimant_id = auth.uid() OR EXISTS (
        SELECT 1 FROM restaurant_team WHERE restaurant_team.location_id = restaurant_claims.location_id
        AND restaurant_team.user_id = auth.uid()
    ));

CREATE POLICY "Team members see their team"
    ON restaurant_team FOR ALL
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM restaurant_team rt WHERE rt.location_id = restaurant_team.location_id
        AND rt.user_id = auth.uid()
    ));

CREATE POLICY "Restaurants see own analytics"
    ON restaurant_analytics FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM restaurant_team WHERE restaurant_team.location_id = restaurant_analytics.location_id
        AND restaurant_team.user_id = auth.uid()
    ));

CREATE POLICY "Restaurants manage own promotions"
    ON restaurant_promotions FOR ALL
    USING (EXISTS (
        SELECT 1 FROM restaurant_team WHERE restaurant_team.location_id = restaurant_promotions.location_id
        AND restaurant_team.user_id = auth.uid()
    ));

CREATE POLICY "Owner responses visible to all"
    ON owner_review_responses FOR SELECT USING (true);

CREATE POLICY "Restaurants manage own responses"
    ON owner_review_responses FOR ALL
    USING (EXISTS (
        SELECT 1 FROM restaurant_team WHERE restaurant_team.location_id = owner_review_responses.location_id
        AND restaurant_team.user_id = auth.uid()
    ));
```

### 7.4 API Layer

```javascript
// src/features/b2b/api/b2b.api.js

import { supabase } from '@/shared/api/client';

// --- Claim & Ownership ---

export async function claimRestaurant(locationId, verificationMethod) {
  if (!supabase) throw new Error('Supabase not configured');

  const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const { data, error } = await supabase
    .from('restaurant_claims')
    .insert({
      location_id: locationId,
      claimant_id: (await supabase.auth.getUser()).data.user.id,
      verification_method: verificationMethod,
      verification_code: verificationCode,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Send verification (phone call, email, or postcard)
  if (verificationMethod === 'phone_call') {
    await fetch('/api/b2b/verify-phone', {
      method: 'POST',
      body: JSON.stringify({ locationId, code: verificationCode }),
    });
  } else if (verificationMethod === 'email') {
    await fetch('/api/b2b/verify-email', {
      method: 'POST',
      body: JSON.stringify({ locationId, code: verificationCode }),
    });
  }

  return data;
}

export async function verifyClaim(locationId, code) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('restaurant_claims')
    .update({ status: 'verified', verified_at: new Date().toISOString() })
    .eq('location_id', locationId)
    .eq('verification_code', code)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Create owner team entry
  await supabase.from('restaurant_team').insert({
    location_id: locationId,
    user_id: data.claimant_id,
    role: 'owner',
  });

  return data;
}

// --- Listing Management ---

export async function updateListing(locationId, updates) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('locations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', locationId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// --- Review Responses ---

export async function respondToReview(reviewId, locationId, responseText) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('owner_review_responses')
    .insert({
      review_id: reviewId,
      location_id: locationId,
      responder_id: (await supabase.auth.getUser()).data.user.id,
      response_text: responseText,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// --- Analytics ---

export async function getAnalytics(locationId, period = '30d') {
  if (!supabase) return { views: 0, clicks: {}, trend: [] };

  const dateFrom = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  dateFrom.setDate(dateFrom.getDate() - days);

  const { count: views } = await supabase
    .from('restaurant_analytics')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('event_type', 'page_view')
    .gte('created_at', dateFrom.toISOString());

  const { data: clicks } = await supabase
    .from('restaurant_analytics')
    .select('event_type, count')
    .eq('location_id', locationId)
    .neq('event_type', 'page_view')
    .gte('created_at', dateFrom.toISOString());

  const { data: trend } = await supabase
    .from('restaurant_analytics')
    .select('created_at, event_type')
    .eq('location_id', locationId)
    .eq('event_type', 'page_view')
    .gte('created_at', dateFrom.toISOString())
    .order('created_at', { ascending: true });

  return { views: views || 0, clicks: clicks || [], trend: trend || [] };
}

// --- Promotions ---

export async function createPromotion(locationId, promoData) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('restaurant_promotions')
    .insert({
      location_id: locationId,
      ...promoData,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
```

### 7.5 UI/UX Design

```
┌─────────────────────────────────────────────┐
│  Restaurant Portal Dashboard                │
│  /portal/dashboard                          │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  [store] Pod Aniolem - Pro Plan      │  │
│  │  [Upgrade to Premium]                │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌────────────┐ ┌────────────┐ ┌─────────┐  │
│  │ 2,340      │ │ 156        │ │ 4.8     │  │
│  │ Views      │ │ Clicks     │ │ Rating  │  │
│  │ ^ 12%      │ │ ^ 8%       │ │ ★★★★★   │  │
│  │ vs last mo │ │ vs last mo │ │ 234 rev │  │
│  └────────────┘ └────────────┘ └─────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Views This Month                     │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │  .:.:..::...:..:..::...:..:.:.  │  │  │
│  │  │  1  5  10  15  20  25  30      │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Recent Reviews (3 new)              │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ ★★★★★ "Amazing experience!"     │  │  │
│  │  │ by Anna K. - 2 hours ago        │  │  │
│  │  │ [Reply] [Flag]                  │  │  │
│  │  └─────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ ★★★☆☆ "Good but slow service"   │  │  │
│  │  │ by Tom R. - 1 day ago           │  │  │
│  │  │ [Reply] [Flag]                  │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Quick Actions                        │  │
│  │  [Edit Listing] [Post Promotion]     │  │
│  │  [Update Menu] [View Reservations]   │  │
│  │  [Manage Photos] [Analytics Detail]  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 7.6 Integration Points

| Existing Feature | Integration |
|---|---|
| `locations` table | Owners update their own listing data |
| `reviews` table | Owner responses displayed on reviews |
| `reservations` table | Reservation management dashboard |
| Stripe API | Subscription billing for Pro/Premium tiers |
| Admin dashboard | Admins see claims, verify ownership |
| Analytics tracking | Existing event tracking extended with portal views |

### 7.7 Implementation Phases

**Phase 1 -- Claim & Auth (Weeks 1-2):**
- `restaurant_claims` table + verification flow
- `restaurant_team` table for multi-staff access
- `/portal` route with role-based access
- Basic dashboard with listing overview

**Phase 2 -- Listing Management (Weeks 3-4):**
- Edit listing form (hours, photos, description)
- Photo upload and management
- Review viewing and response flow
- Promotion posting system

**Phase 3 -- Analytics (Weeks 5-6):**
- Analytics event tracking extension
- Dashboard charts (views, clicks, trends)
- Export functionality (CSV)
- Comparative period analysis

**Phase 4 -- Monetization (Weeks 7-8):**
- Subscription tier system
- Stripe integration for recurring billing
- Feature gating by tier
- Promoted listing system

### 7.8 Technical Challenges

| Challenge | Solution |
|---|---|
| **Ownership verification** -- how to prove you own a restaurant | Phone verification (call restaurant, provide code); email verification (domain match); document upload; postcard with code |
| **Analytics accuracy** -- bot traffic inflating views | Implement bot detection (user agent analysis, IP filtering); count unique visitors, not raw views |
| **Review manipulation** -- owners creating fake positive reviews | RLS prevents self-reviewing; IP/device fingerprinting; flag suspicious patterns |
| **Multi-restaurant owners** -- managing multiple locations | `restaurant_team` table supports N:M relationship; switcher dropdown in portal |
| **Free tier abuse** -- claiming restaurants without managing them | Auto-revoke claims after 30 days of inactivity; require verified contact info; limit claims per user |

### 7.9 Estimated Complexity: **MEDIUM**

- Well-understood pattern (like Google Business Profile)
- Subscription billing is straightforward with Stripe
- Main complexity is in ownership verification
- Analytics requires careful event tracking design

---

## 8. Voice Search

### 8.1 Overview

**Voice Search** enables users to search for restaurants, ask questions, and interact with GastroMap using spoken language. It uses the Web Speech API for speech-to-text on web and native speech recognition on mobile.

**Why it matters:**
- Hands-free searching (while driving, walking, cooking)
- Accessibility for users with motor impairments or dyslexia
- Faster than typing for complex queries ("find a romantic Italian place under 500m")
- Natural complement to the existing GastroGuide AI chat
- Competitive advantage in the restaurant discovery space

### 8.2 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     VOICE SEARCH ARCHITECTURE                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Speech Input                                           │    │
│  │                                                          │    │
│  │  Web:  SpeechRecognition API (webkitSpeechRecognition)  │    │
│  │  RN:   expo-speech-recognition or native module         │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Speech Processing Pipeline                             │    │
│  │                                                          │    │
│  │  1. Real-time interim results (live transcription)      │    │
│  │  2. Final result --> text string                        │    │
│  │  3. Language detection (match user's i18n setting)     │    │
│  │  4. Confidence check (reject if < 0.7)                 │    │
│  └────────────────────────────┬────────────────────────────┘    │
│                               │                                 │
│                    ┌──────────┼──────────┐                     │
│                    ▼          ▼          ▼                      │
│  ┌────────────┐ ┌──────────┐ ┌────────┐ ┌──────────────────┐   │
│  │ Direct     │ │ AI Query │ │ Gastro │ │ Command          │   │
│  │ Search     │ │ (Natural │ │ Guide  │ │ Execution        │   │
│  │ (text      │ │  Language│ │ Chat   │ │ (voice commands) │   │
│  │  match)    │ │  search) │ │ (send  │ │                  │   │
│  │            │ │          │ │  to AI)│ │                  │   │
│  └────────────┘ └──────────┘ └────────┘ └──────────────────┘   │
│                                                                  │
│  Voice Commands:                                                 │
│  "Go to saved places"        --> Navigate to /saved             │
│  "Show me nearby restaurants" --> Trigger nearby search         │
│  "Open Pod Aniolem"          --> Navigate to location detail    │
│  "Filter by Italian"         --> Apply cuisine filter           │
│  "Switch to dark mode"       --> Toggle theme                   │
│  "What's the rating of X"    --> Query location details         │
└──────────────────────────────────────────────────────────────────┘
```

### 8.3 Database Schema

No new database tables needed. Voice search is a **purely client-side input method** that feeds into existing search and AI systems.

The only addition is analytics tracking:

```sql
-- Voice search analytics
CREATE TABLE voice_search_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    query_text      TEXT NOT NULL,
    language        TEXT,
    confidence      NUMERIC(3,2),
    result_count    INTEGER,
    was_actioned    BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_voice_search_user ON voice_search_events(user_id, created_at DESC);
CREATE INDEX idx_voice_search_query ON voice_search_events(query_text);

ALTER TABLE voice_search_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert voice search events"
    ON voice_search_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read voice search events"
    ON voice_search_events FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    ));
```

### 8.4 API Layer

```javascript
// src/features/voicesearch/services/voiceSearch.js

// --- Speech Recognition Service ---

class VoiceSearchEngine {
  constructor() {
    this.recognition = null;
    this.isSupported = this.checkSupport();
    this.interimCallback = null;
    this.resultCallback = null;
    this.errorCallback = null;
  }

  checkSupport() {
    return !!(
      window.SpeechRecognition ||
      window.webkitSpeechRecognition
    );
  }

  initialize(language = 'en-US') {
    if (!this.isSupported) return false;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = language;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript && this.interimCallback) {
        this.interimCallback(interimTranscript);
      }

      if (finalTranscript && this.resultCallback) {
        const confidence = event.results[event.results.length - 1][0].confidence;
        this.resultCallback(finalTranscript.trim(), confidence);
      }
    };

    this.recognition.onerror = (event) => {
      if (this.errorCallback) {
        this.errorCallback(event.error);
      }
    };

    return true;
  }

  start() {
    if (!this.recognition) return false;
    try {
      this.recognition.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  stop() {
    if (!this.recognition) return;
    this.recognition.stop();
  }

  onInterimResult(callback) { this.interimCallback = callback; }
  onFinalResult(callback) { this.resultCallback = callback; }
  onError(callback) { this.errorCallback = callback; }
}

// --- Voice Command Parser ---

const VOICE_COMMANDS = {
  navigation: [
    { patterns: ['go to saved', 'open saved', 'show saved'], action: 'navigate:/saved' },
    { patterns: ['go to profile', 'open profile'], action: 'navigate:/profile' },
    { patterns: ['go to map', 'open map'], action: 'navigate:/explore' },
    { patterns: ['go to leaderboard', 'open leaderboard'], action: 'navigate:/dashboard/leaderboard' },
  ],
  search: [
    { patterns: ['find.*nearby', 'show.*nearby', 'nearby.*restaurant'], action: 'search:nearby' },
    { patterns: ['find.*italian', 'search.*italian'], action: 'filter:cuisine:Italian' },
    { patterns: ['filter.*cheap', 'budget.*low'], action: 'filter:price:$' },
    { patterns: ['filter.*expensive', 'fine dining'], action: 'filter:price:$$$$' },
  ],
  theme: [
    { patterns: ['dark mode', 'switch to dark'], action: 'theme:dark' },
    { patterns: ['light mode', 'switch to light'], action: 'theme:light' },
  ],
};

export function parseVoiceCommand(text) {
  const lower = text.toLowerCase();

  for (const [category, commands] of Object.entries(VOICE_COMMANDS)) {
    for (const cmd of commands) {
      for (const pattern of cmd.patterns) {
        if (new RegExp(pattern, 'i').test(lower)) {
          return { type: 'command', category, action: cmd.action };
        }
      }
    }
  }

  // Not a command -- treat as search query
  return { type: 'search', query: text };
}

// --- Voice Search Hook ---

// src/features/voicesearch/hooks/useVoiceSearch.js
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { VoiceSearchEngine, parseVoiceCommand } from '../services/voiceSearch';
import { useLocationsStore } from '@/features/public/hooks/useLocationsStore';

const engine = new VoiceSearchEngine();

export function useVoiceSearch() {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState(null);
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { setQuery } = useLocationsStore();

  useEffect(() => {
    const langMap = { en: 'en-US', pl: 'pl-PL', ru: 'ru-RU', ua: 'uk-UA' };
    const locale = langMap[i18n.language] || 'en-US';

    engine.initialize(locale);

    engine.onInterimResult((text) => {
      setInterimText(text);
    });

    engine.onFinalResult((text, confidence) => {
      setFinalText(text);
      setIsListening(false);

      if (confidence < 0.7) {
        setError('Low confidence. Please try again.');
        return;
      }

      const parsed = parseVoiceCommand(text);
      if (parsed.type === 'command') {
        executeVoiceCommand(parsed.action, navigate, setQuery);
      } else {
        setQuery(parsed.query);
      }
    });

    engine.onError((err) => {
      setIsListening(false);
      if (err === 'not-allowed') {
        setError('Microphone access denied. Please grant permission.');
      } else if (err === 'no-speech') {
        setError('No speech detected. Please try again.');
      } else {
        setError(`Voice error: ${err}`);
      }
    });
  }, [i18n.language, navigate, setQuery]);

  const startListening = useCallback(() => {
    setInterimText('');
    setFinalText('');
    setError(null);
    const success = engine.start();
    setIsListening(success);
  }, []);

  const stopListening = useCallback(() => {
    engine.stop();
    setIsListening(false);
  }, []);

  return {
    isSupported: engine.isSupported,
    isListening,
    interimText,
    finalText,
    error,
    startListening,
    stopListening,
  };
}

// --- Command Execution ---

function executeVoiceCommand(action, navigate, setQuery) {
  const [type, value] = action.split(':');

  switch (type) {
    case 'navigate':
      navigate(value);
      break;
    case 'search':
      if (value === 'nearby') {
        // Trigger geolocation-based search
        navigator.geolocation.getCurrentPosition((pos) => {
          setQuery(`nearby:${pos.coords.latitude},${pos.coords.longitude}`);
        });
      }
      break;
    case 'filter':
      const [filterType, filterValue] = value.split(':');
      // Apply filter via Zustand store
      break;
    case 'theme':
      // Toggle theme via useTheme hook
      break;
  }
}
```

### 8.5 UI/UX Design

```
┌─────────────────────────────────────────────┐
│  Voice Search -- Search Bar Integration     │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  [🎤] Search restaurants...         │  │
│  │                                       │  │
│  │  Tap the microphone to speak          │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  When active (listening):                   │
│  ┌───────────────────────────────────────┐  │
│  │  [🔴] I'm listening...               │  │
│  │                                       │  │
│  │  "find a romant" (interim)            │  │
│  │  "find a romantic italian restau..."  │  │
│  │                                       │  │
│  │        .   .       .   .              │  │
│  │      .   .   .   .   .   .            │  │
│  │    (animated waveform)                │  │
│  │                                       │  │
│  │  [Tap to stop]                        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  After processing:                          │
│  ┌───────────────────────────────────────┐  │
│  │  You said: "Find romantic Italian     │  │
│  │  restaurants in Krakow"               │  │
│  │                                       │  │
│  │  Found 12 results:                    │  │
│  │  1. Trattoria Romana ★4.7            │  │
│  │  2. La Dolce Vita ★4.5               │  │
│  │  3. Nonna's Kitchen ★4.8             │  │
│  │                                       │  │
│  │  [🎤 Search again]  [Refine]         │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Design Principles:**
- Microphone icon integrated into existing search bar (minimal disruption)
- Animated waveform while listening (Framer Motion)
- Real-time interim transcript shown as user speaks
- Clear visual/audio feedback when listening starts/stops
- Support for all 4 languages (en, pl, ru, ua) with auto-detection

### 8.6 Integration Points

| Existing Feature | Integration |
|---|---|
| Search bar (existing) | Add microphone button to search input |
| `useLocationsStore` | Voice queries set search/filter state |
| GastroGuide AI | Voice input feeds directly into AI chat |
| i18n system | Speech recognition language matches user's locale |
| GastroAIChat | Voice input as alternative to typing |
| Navigation | Voice commands navigate between pages |

### 8.7 Implementation Phases

**Phase 1 -- Core Recognition (Weeks 1-2):**
- `VoiceSearchEngine` class with Web Speech API
- `useVoiceSearch` hook
- Microphone button in search bar
- Basic interim/final result display

**Phase 2 -- Command Parsing (Weeks 3-4):**
- Voice command parser with regex patterns
- Navigation commands (go to saved, profile, etc.)
- Filter commands (cuisine, price, vibe)
- Theme toggle command

**Phase 3 -- AI Integration (Weeks 5-6):**
- Voice input to GastroGuide AI chat
- Voice query to natural language search
- Confidence threshold handling
- Multi-language support (pl, ru, ua)

**Phase 4 -- Polish & Accessibility (Weeks 7-8):**
- Animated waveform visualization
- Haptic feedback on voice events
- Voice search analytics
- Accessibility audit (WCAG compliance)

### 8.8 Technical Challenges

| Challenge | Solution |
|---|---|
| **Web Speech API not universal** -- Firefox has limited support | Graceful fallback: hide microphone icon if unsupported; provide text alternative; detect via `checkSupport()` |
| **Background noise interference** | Use `recognition.lang` for better accuracy; implement noise gate; suggest users retry in quiet environment |
| **Privacy concerns** -- microphone access | Clear permission prompt; visual indicator when mic is active; no audio stored, only transcribed text |
| **Accent and dialect handling** | Web Speech API uses system locale; allow manual language override; train regex patterns on common speech patterns |
| **iOS Safari limitations** | iOS Safari supports SpeechRecognition since iOS 14.5; require user gesture to start; show clear instructions |

### 8.9 Estimated Complexity: **SIMPLE**

- Web Speech API is well-documented and widely supported
- No server-side infrastructure needed (purely client-side)
- Command parsing is straightforward regex matching
- Main work is UI polish and multi-language support

---

## 9. Real SSR/SEO

### 9.1 Overview

**Real SSR/SEO** transforms GastroMap from a client-side rendered SPA into a server-side rendered application that delivers fully rendered HTML to search engines and users, dramatically improving search engine rankings, initial load performance, and social sharing.

**Why it matters:**
- Current Vite SPA is invisible to search engine crawlers (no rendered HTML)
- Location pages (`/location/:id`) cannot be indexed by Google
- Social media link previews are broken (no Open Graph meta tags per page)
- First Contentful Paint (FCP) is delayed until JS executes
- Competitors with SSR rank significantly higher in search results

### 9.2 Architecture

Three architectural options, evaluated by complexity and benefit:

```
OPTION A: Vercel Edge Middleware + Pre-rendering (RECOMMENDED)
═══════════════════════════════════════════════════════════════

  Current (SPA):                    After (SSR via Edge):

  Browser --> Vercel --> dist/      Browser --> Vercel Edge Middleware
  index.html --> JS loads -->               |
  React renders --> App appears             ├── /location/:id
                                            |   --> Fetch location from Supabase
  All routes serve the same                 --> Render full HTML server-side
  empty shell.                              --> Send complete HTML to browser
                                            |
                                            ├── /explore/:country/:city
                                            |   --> Pre-rendered static HTML
                                            |   --> Hydrate on client
                                            |
                                            └── / (landing page)
                                                --> Already static (SSG)
                                                --> Add dynamic meta tags

  Pros: Minimal code changes, keeps Vite build
  Cons: Edge functions have limits (no heavy rendering)


OPTION B: Migrate to Next.js (COMPLETE REWRITE)
═══════════════════════════════════════════════

  Next.js App Router:

  src/app/
  ├── layout.tsx              # Root layout (shared providers)
  ├── page.tsx                # Landing (SSG)
  ├── explore/
  │   └── [country]/
  │       └── [city]/
  │           └── page.tsx    # ISR (revalidate every 1hr)
  ├── location/
  │   └── [id]/
  │       └── page.tsx        # SSR (fetch from Supabase)
  ├── dashboard/
  │   └── page.tsx            # Client-only (auth required)
  ├── admin/
  │   └── page.tsx            # Client-only (auth required)
  └── api/
      └── ai/chat/route.ts    # Edge API route

  Pros: Best-in-class SSR, built-in SEO, image optimization
  Cons: Massive rewrite (routing, build, config all change)


OPTION C: Prerender.io / Rendertron Service (QUICKEST)
════════════════════════════════════════════════════════

  Browser --> Vercel --> SPA (normal users get SPA)
                            |
  Googlebot --> Prerender.io --> Renders SPA in headless Chrome
                            --> Caches rendered HTML
                            --> Serves to crawler

  Pros: Zero code changes, works immediately
  Cons: Ongoing cost ($20-200/mo), not true SSR, caching staleness
```

**Recommendation: Start with Option C (immediate SEO fix), then migrate to Option A (Edge SSR) for a permanent solution. Option B is a last resort if A proves insufficient.**

### 9.3 Database Schema

No new tables needed for SSR. The existing `locations` table already has all the data needed for rendering.

What IS needed: **Dynamic meta tag generation** for each page type.

```sql
-- SEO metadata extension for locations (optional enhancement)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS canonical_url TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS schema_markup JSONB;

-- SEO sitemap entries (for sitemap.xml generation)
CREATE TABLE seo_sitemap_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path            TEXT NOT NULL UNIQUE,
    priority        NUMERIC(2,1) DEFAULT 0.5,   -- 0.0 to 1.0
    changefreq      TEXT DEFAULT 'weekly' CHECK (changefreq IN (
        'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'
    )),
    lastmod         TIMESTAMPTZ DEFAULT now(),
    is_indexed      BOOLEAN DEFAULT true
);

-- Populate initial sitemap
INSERT INTO seo_sitemap_entries (path, priority, changefreq) VALUES
    ('/', 1.0, 'daily'),
    ('/features', 0.8, 'monthly'),
    ('/pricing', 0.7, 'monthly'),
    ('/about', 0.6, 'monthly');

-- Location pages are added dynamically via trigger
CREATE OR REPLACE FUNCTION update_location_sitemap()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active' THEN
        INSERT INTO seo_sitemap_entries (path, priority, changefreq, lastmod)
        VALUES (
            '/location/' || NEW.id,
            CASE
                WHEN NEW.michelin_stars > 0 THEN 0.9
                WHEN NEW.rating >= 4.5 THEN 0.8
                ELSE 0.6
            END,
            'weekly',
            now()
        )
        ON CONFLICT (path) DO UPDATE
        SET lastmod = now(), is_indexed = true;
    ELSE
        UPDATE seo_sitemap_entries
        SET is_indexed = false, lastmod = now()
        WHERE path = '/location/' || NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_location_sitemap
    AFTER INSERT OR UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_location_sitemap();
```

### 9.4 API Layer

**Edge Middleware for SSR (Option A):**

```javascript
// middleware.js (Vercel Edge Middleware)

import { createClient } from '@supabase/supabase-js';

export const config = {
  matcher: ['/location/:id*', '/explore/:country*', '/features*', '/pricing*'],
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip if request is for API, static assets, or authenticated routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin')
  ) {
    return;
  }

  // For location pages, pre-render HTML
  if (pathname.startsWith('/location/')) {
    const locationId = pathname.split('/location/')[1]?.split('?')[0];
    if (locationId) {
      return await renderLocationPage(request, locationId);
    }
  }

  // For explore pages, pre-render with city data
  if (pathname.startsWith('/explore/')) {
    return await renderExplorePage(request, pathname);
  }

  // For all other pages, serve SPA with enhanced meta tags
  return;
}

async function renderLocationPage(request, locationId) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Server-side key
  );

  const { data: location } = await supabase
    .from('locations')
    .select('*')
    .eq('id', locationId)
    .eq('status', 'active')
    .single();

  if (!location) {
    return; // Let SPA handle 404
  }

  // Generate HTML with meta tags
  const html = generateLocationHTML(location);

  // Return prerendered HTML
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

function generateLocationHTML(location) {
  const title = `${location.title} - ${location.city} | GastroMap`;
  const description = location.description?.slice(0, 160) ||
    `Discover ${location.title} in ${location.city}. ${location.cuisine} cuisine, ${location.price_level} price level.`;
  const image = location.image || 'https://gastromap.com/og-default.jpg';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="https://gastromap.com/location/${location.id}" />
  <meta property="og:type" content="restaurant" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${image}" />

  <!-- Canonical URL -->
  <link rel="canonical" href="https://gastromap.com/location/${location.id}" />

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "name": location.title,
    "description": location.description,
    "image": location.image,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": location.address,
      "addressLocality": location.city,
      "addressCountry": location.country,
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": location.lat,
      "longitude": location.lng,
    },
    "servesCuisine": location.cuisine,
    "priceRange": location.price_level,
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": location.rating,
      "reviewCount": location.review_count || 0,
    },
    "openingHoursSpecification": location.opening_hours
      ? { "@type": "OpeningHoursSpecification", "dayOfWeek": "All", ...parseHours(location.opening_hours) }
      : undefined,
  })}
  </script>

  <!-- Load SPA -->
  <script type="module" crossorigin src="/assets/index-HASH.js"></script>
  <link rel="stylesheet" href="/assets/index-HASH.css">
</head>
<body>
  <div id="root">
    <!-- Pre-rendered content for crawlers -->
    <main>
      <h1>${escapeHtml(location.title)}</h1>
      <p>${escapeHtml(location.description || '')}</p>
      <p>${escapeHtml(location.address || '')}, ${escapeHtml(location.city)}</p>
      <p>Rating: ${location.rating}/5 | ${location.cuisine} | ${location.price_level}</p>
      ${location.image ? `<img src="${escapeHtml(location.image)}" alt="${escapeHtml(location.title)}" />` : ''}
    </main>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

**Sitemap Generation:**

```javascript
// api/sitemap.xml.js (Serverless function)

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get all indexable locations
  const { data: locations } = await supabase
    .from('locations')
    .select('id, updated_at, status')
    .eq('status', 'active');

  // Get static sitemap entries
  const { data: staticEntries } = await supabase
    .from('seo_sitemap_entries')
    .select('*')
    .eq('is_indexed', true);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Static pages
  staticEntries?.forEach((entry) => {
    xml += `
  <url>
    <loc>https://gastromap.com${entry.path}</loc>
    <lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`;
  });

  // Location pages
  locations?.forEach((loc) => {
    xml += `
  <url>
    <loc>https://gastromap.com/location/${loc.id}</loc>
    <lastmod>${new Date(loc.updated_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  });

  xml += '\n</urlset>';

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  res.send(xml);
}
```

**robots.txt:**

```
// public/robots.txt
User-agent: *
Allow: /
Allow: /location/
Allow: /explore/
Allow: /features
Allow: /pricing
Allow: /about

Disallow: /dashboard/
Disallow: /admin/
Disallow: /api/
Disallow: /profile/
Disallow: /auth/

Sitemap: https://gastromap.com/sitemap.xml
```

### 9.5 UI/UX Design

Users don't directly see SSR -- they experience it through:

1. **Faster initial page load** -- Content appears before JS hydrates
2. **Rich social sharing** -- Beautiful link previews on WhatsApp, Twitter, Facebook
3. **Search engine visibility** -- GastroMap pages appear in Google results

```
Before (SPA -- no SSR):
═══════════════════════

Google Search Result:
  gastromap.com
  (No title, no description -- Google sees empty HTML shell)

Twitter Share Preview:
  gastromap.com/location/abc123
  [No image, no title, no description]


After (SSR):
════════════

Google Search Result:
  Pod Aniolem - Krakow | GastroMap
  Historic underground restaurant in Krakow's Old Town.
  Polish cuisine, $$$, Rating: 4.8/5 (234 reviews).
  gastromap.com/location/abc123
  [★★★★★] Rich Snippet with rating stars!

Twitter Share Preview:
  ┌───────────────────────────────────────┐
  │  [Restaurant photo]                   │
  │                                       │
  │  Pod Aniolem - Krakow | GastroMap    │
  │  Historic underground restaurant in   │
  │  Krakow's Old Town. Polish cuisine.   │
  │                                       │
  │  gastromap.com                        │
  └───────────────────────────────────────┘

Google Rich Results:
  ┌───────────────────────────────────────┐
  │  Pod Aniolem                          │
  │  ★★★★★ 4.8  (234 reviews)           │
  │  $$$  Polish Restaurant               │
  │  15 Slawkowska St, Krakow            │
  │  Open until 11:00 PM                 │
  │  [Directions] [Menu] [Reserve]       │
  └───────────────────────────────────────┘
```

### 9.6 Integration Points

| Existing Feature | Integration |
|---|---|
| `vercel.json` | Add Edge Middleware configuration |
| `vite.config.js` | May need adjustments for SSR compatibility |
| `index.html` | Add default Open Graph meta tags as fallback |
| `locations` table | Source of truth for location meta tags |
| Existing routes | Add server-side rendering per route |
| PWA Service Worker | Ensure SW doesn't interfere with SSR responses |
| i18n | Serve language-specific meta tags (`<html lang="pl">`) |

### 9.7 Implementation Phases

**Phase 1 -- Quick Wins (Week 1):**
- Add Prerender.io or similar service (immediate SEO improvement)
- Generate `sitemap.xml` serverless function
- Add proper `robots.txt`
- Add default Open Graph tags to `index.html`

**Phase 2 -- Edge Middleware (Weeks 2-3):**
- Set up Vercel Edge Middleware (`middleware.js`)
- Implement `/location/:id` server-side rendering
- Add JSON-LD structured data for restaurants
- Cache strategy: CDN + stale-while-revalidate

**Phase 3 -- Full Coverage (Weeks 4-5):**
- SSR for `/explore/:country/:city` pages
- Dynamic sitemap generation
- Per-page canonical URLs
- i18n-aware meta tags (language-specific titles/descriptions)

**Phase 4 -- Monitoring & Optimization (Weeks 6-7):**
- Google Search Console integration
- Core Web Vitals monitoring
- A/B test SSR vs SPA performance
- Schema markup validation
- Track organic traffic improvement

### 9.8 Technical Challenges

| Challenge | Solution |
|---|---|
| **Vercel Edge runtime limits** -- 4MB bundle, no Node.js APIs | Keep middleware minimal; only fetch essential data; use Supabase REST API (not SDK) for lightweight queries |
| **Hydration mismatch** -- SSR HTML differs from client render | Ensure server and client render the same initial state; use `suppressHydrationWarning` sparingly |
| **Dynamic meta for 4 languages** -- each page needs 4 versions | Generate meta tags based on `Accept-Language` header or URL locale prefix (`/pl/location/:id`) |
| **Caching stale data** -- restaurant info changes | Use `stale-while-revalidate` (serve stale, revalidate in background); set cache TTL to 1 hour for locations |
| **Auth routes must stay client-side** -- dashboard, admin | Use Edge Middleware `matcher` to exclude auth-protected routes; these remain pure SPA |
| **PWA + SSR conflict** -- Service Worker may serve stale shell | Configure SW to network-first for HTML requests; use `navigateFallback` carefully |

### 9.9 Estimated Complexity: **MEDIUM**

- Option C (Prerender.io) is SIMPLE and immediate
- Option A (Edge Middleware) is MEDIUM complexity with high reward
- Option B (Next.js migration) is COMPLEX and would take 2-3 months
- Recommended: Start with C, build A in parallel

---

## Feature Comparison Summary

| Feature | Complexity | Est. Timeline | Revenue Impact | User Impact | Dependencies |
|---------|-----------|---------------|----------------|-------------|--------------|
| **1. Bio-Sync AI** | Complex | 8 weeks | Medium (differentiation) | High (health users) | React Native (for HealthKit) |
| **2. AR Dish-o-Vision** | Complex | 8 weeks | Low (engagement) | Medium (novelty) | Knowledge Graph data |
| **3. Dine With Me** | Complex | 8 weeks | Low (engagement) | High (social users) | Critical mass of users |
| **4. Reservation System** | Medium | 10 weeks | High (per-booking fee) | High (all users) | Restaurant partnerships |
| **5. Badges & Rewards** | Medium | 8 weeks | Medium (retention) | Medium (all users) | None |
| **6. React Native** | Complex | 14 weeks | High (app store) | High (mobile users) | Monorepo setup |
| **7. B2B Portal** | Medium | 8 weeks | High (subscriptions) | N/A (B2B) | Restaurant onboarding |
| **8. Voice Search** | Simple | 8 weeks | Low (accessibility) | Medium (convenience) | None |
| **9. Real SSR/SEO** | Medium | 7 weeks | High (organic traffic) | Low (invisible) | None |

## Recommended Implementation Order

Based on dependencies, impact, and complexity:

```
Priority 1 (Quick Wins, No Dependencies):
  1. Voice Search (8 weeks)          -- Simple, immediate user value
  2. Real SSR/SEO (7 weeks)          -- Critical for growth, invisible to users
  3. Badges & Rewards (8 weeks)      -- Boosts engagement, no external deps

Priority 2 (Revenue Generation):
  4. B2B Portal (8 weeks)            -- Direct revenue via subscriptions
  5. Reservation System (10 weeks)   -- Revenue + completes user journey

Priority 3 (Platform Expansion):
  6. React Native (14 weeks)         -- Enables Bio-Sync + AR native features
  7. Dine With Me (8 weeks)          -- Social layer, needs user base

Priority 4 (Advanced Features):
  8. Bio-Sync AI (8 weeks)           -- Best with RN + HealthKit
  9. AR Dish-o-Vision (8 weeks)      -- Best with RN + native camera
```

## Cross-Feature Dependencies

```
Voice Search ──────────────> No dependencies (standalone)
Real SSR/SEO ──────────────> No dependencies (standalone)
Badges & Rewards ──────────> No dependencies (standalone)
B2B Portal ────────────────> Reservation System (partial)
Reservation System ────────> B2B Portal (for restaurant management)
React Native ──────────────> Bio-Sync AI (enables), AR Vision (enables)
Dine With Me ──────────────> React Native (better with native location)
Bio-Sync AI ───────────────> React Native (for HealthKit native APIs)
AR Dish-o-Vision ──────────> React Native (for native camera + ML)
```

---

## General Implementation Notes

### Code Organization

All features should follow the existing Feature-Sliced Design pattern:

```
src/
  features/
    biosync/         # Feature 1: Bio-Sync AI
    arvision/        # Feature 2: AR Dish-o-Vision
    dinewithme/      # Feature 3: Dine With Me
    reservations/    # Feature 4: Reservation System
    gamification/    # Feature 5: Badges & Rewards
    voicesearch/     # Feature 8: Voice Search
    b2b/             # Feature 7: B2B Portal
```

### Database Migration Strategy

Each feature's tables should be added via separate migration files:

```
supabase/migrations/
  010_bio_sync_tables.sql
  011_ar_vision_tables.sql
  012_dine_with_me_tables.sql
  013_reservation_tables.sql
  014_gamification_tables.sql
  015_b2b_portal_tables.sql
  016_voice_search_tables.sql
  017_seo_enhancements.sql
```

### Testing Strategy

- Unit tests for all API functions (Vitest)
- Component tests for UI (Testing Library)
- Integration tests for database operations (Supabase + test DB)
- E2E tests for critical user flows (Playwright/Cypress)

### Performance Budget

- Each feature adds max 50KB gzipped to initial bundle
- Lazy-load all feature-specific code
- Use React.lazy() for feature routes
- Defer non-critical data fetching (React Query `enabled: false` until needed)

---

**Document maintained by:** Gas AI - Architecture Team  
**Last reviewed:** 2026-04-03  
**Next review:** After first feature implementation begins