# GastroMap Database Documentation

Complete documentation of the PostgreSQL database schema, relationships, security policies, and migration procedures for the GastroMap V2 platform.

---

## Table of Contents

1. [Database Schema Overview](#1-database-schema-overview)
   - [Core Tables](#core-tables)
   - [Knowledge Graph Tables](#knowledge-graph-tables)
   - [Junction Tables](#junction-tables)
   - [User Data Tables](#user-data-tables)
   - [Payment & Subscription Tables](#payment--subscription-tables)
   - [Translation Tables](#translation-tables)
   - [AI & Learning Tables](#ai--learning-tables)
2. [Entity Relationship Diagram](#2-entity-relationship-diagram)
3. [Row Level Security (RLS) Policies](#3-row-level-security-rls-policies)
4. [Indexes](#4-indexes)
5. [PostgreSQL Functions](#5-postgresql-functions)
6. [Custom Data Types & Enum Values](#6-custom-data-types--enum-values)
7. [Triggers](#7-triggers)
8. [Migration Guide](#8-migration-guide)

---

## 1. Database Schema Overview

### Core Tables

#### `locations`

The central table storing restaurant/venue information.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `title` | `TEXT` | NOT NULL | Venue name |
| `description` | `TEXT` | | Venue description |
| `address` | `TEXT` | | Street address |
| `city` | `TEXT` | NOT NULL | City name |
| `country` | `TEXT` | NOT NULL | Country name |
| `lat` | `NUMERIC(10,7)` | | Latitude coordinate |
| `lng` | `NUMERIC(10,7)` | | Longitude coordinate |
| `category` | `TEXT` | | Venue category (e.g., Restaurant, Cafe, Bar, Fine Dining, Street Food, Food Hall) |
| `cuisine` | `TEXT` | | Cuisine type (e.g., Polish, French, Japanese) |
| `image` | `TEXT` | | Cover image URL |
| `photos` | `TEXT[]` | `'{}'` | Array of photo URLs |
| `rating` | `NUMERIC(3,1)` | `0` | Average rating |
| `price_level` | `TEXT` | `'$$'` | Price level (`$`, `$$`, `$$$`, `$$$$`) |
| `opening_hours` | `TEXT` | | Opening hours string |
| `tags` | `TEXT[]` | `'{}'` | General tags |
| `special_labels` | `TEXT[]` | `'{}'` | Special labels/achievements |
| `vibe` | `TEXT[]` | `'{}'` | Atmosphere descriptors |
| `features` | `TEXT[]` | `'{}'` | Venue features |
| `best_for` | `TEXT[]` | `'{}'` | Best use cases (date, solo, friends, family, etc.) |
| `dietary` | `TEXT[]` | `'{}'` | Dietary options |
| `has_wifi` | `BOOLEAN` | `false` | WiFi availability |
| `has_outdoor_seating` | `BOOLEAN` | `false` | Outdoor seating |
| `reservations_required` | `BOOLEAN` | `false` | Reservation requirement |
| `michelin_stars` | `SMALLINT` | `0` | Michelin star count |
| `michelin_bib` | `BOOLEAN` | `false` | Michelin Bib Gourmand |
| `insider_tip` | `TEXT` | | AI-generated insider tip |
| `what_to_try` | `TEXT[]` | `'{}'` | Recommended dishes |
| `ai_keywords` | `TEXT[]` | `'{}'` | AI-generated search keywords |
| `ai_context` | `TEXT` | | AI-generated context description |
| `status` | `TEXT` | `'active'` | Status: `active`, `hidden`, `coming_soon` |
| `embedding` | `vector(768)` | | Semantic search vector (pgvector) |
| `fts` | `tsvector` | Generated | Full-text search column (generated from title, description, city, cuisine, tags, ai_context) |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |

#### `profiles`

User profile data linked to Supabase auth.users.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | | Primary key, FK to `auth.users(id)` ON DELETE CASCADE |
| `email` | `TEXT` | | User email |
| `name` | `TEXT` | | Display name |
| `role` | `TEXT` | `'user'` | CHECK: `user`, `admin`, `moderator` |
| `avatar_url` | `TEXT` | | Avatar image URL |
| `preferences` | `JSONB` | `'{}'` | User preferences (added in migration 005) |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |

---

### Knowledge Graph Tables

#### `cuisines`

Ontology of world cuisines with hierarchical relationships.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `name` | `TEXT` | UNIQUE NOT NULL | Cuisine name |
| `parent_id` / `parent_cuisine_id` | `UUID` | FK to `cuisines(id)` | Parent cuisine (hierarchy) |
| `slug` | `TEXT` | UNIQUE NOT NULL | URL-friendly slug |
| `description` | `TEXT` | | Description |
| `origin_country` | `TEXT` | | Country of origin |
| `characteristics` | `JSONB` | `'{}'` | Cuisine characteristics |
| `tags` | `TEXT[]` | `'{}'` | Tags (from ontology migration) |
| `embedding` | `vector(768)` | | Semantic search vector |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |

#### `dishes`

Individual dishes linked to cuisines.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `name` | `TEXT` | NOT NULL | Dish name |
| `slug` | `TEXT` | UNIQUE | URL-friendly slug |
| `description` | `TEXT` | | Description |
| `cuisine_id` | `UUID` | FK to `cuisines(id)` | Associated cuisine |
| `category` | `TEXT` | CHECK: `appetizer`, `main`, `dessert`, `drink`, `snack` | Dish category |
| `price_range` | `TEXT` | CHECK: `$`, `$$`, `$$$` | Price range |
| `is_signature` | `BOOLEAN` | `false` | Signature dish flag |
| `vegetarian` | `BOOLEAN` | `false` | Vegetarian flag |
| `vegan` | `BOOLEAN` | `false` | Vegan flag |
| `gluten_free` | `BOOLEAN` | `false` | Gluten-free flag |
| `spicy_level` | `INTEGER` | `0` CHECK 0-5 | Spiciness level |
| `ingredients` | `JSONB` | `'[]'` | Ingredient list |
| `allergens` | `TEXT[]` | `'{}'` | Allergen list |
| `image_url` | `TEXT` | | Dish image URL |
| `preparation_time` | `INT` | | Prep time in minutes |
| `difficulty` | `TEXT` | | Difficulty level |
| `traditional_region` | `TEXT` | | Traditional region |
| `tags` | `TEXT[]` | `'{}'` | Tags |
| `embedding` | `vector(768)` | | Semantic search vector |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |

#### `ingredients`

Ingredient ontology with categories and allergen info.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `name` | `TEXT` | UNIQUE NOT NULL | Ingredient name |
| `slug` | `TEXT` | UNIQUE NOT NULL | URL-friendly slug |
| `category` | `TEXT` | CHECK: `vegetable`, `fruit`, `meat`, `fish`, `seafood`, `dairy`, `grain`, `spice`, `herb`, `nut`, `legume`, `other` | Ingredient category |
| `is_allergen` | `BOOLEAN` | `false` | Allergen flag |
| `is_vegetarian` | `BOOLEAN` | `true` | Vegetarian flag |
| `is_vegan` | `BOOLEAN` | `true` | Vegan flag |
| `origin` | `TEXT` | | Origin region/country |
| `season` | `TEXT[]` | `'{}'` | Available seasons |
| `description` | `TEXT` | | Description (from ontology migration) |
| `seasonal` | `BOOLEAN` | `false` | Seasonal flag |
| `tags` | `TEXT[]` | `'{}'` | Tags |
| `embedding` | `vector(768)` | | Semantic search vector |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |

#### `vibes`

Atmosphere/mood ontology for venues.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `name` | `TEXT` | UNIQUE NOT NULL | Vibe name |
| `slug` | `TEXT` | UNIQUE NOT NULL | URL-friendly slug |
| `category` | `TEXT` | CHECK: `atmosphere`, `occasion`, `crowd` | Vibe category |
| `description` | `TEXT` | | Description |
| `synonyms` | `TEXT[]` | `'{}'` | Synonym list |
| `opposite_ids` | `UUID[]` | `'{}'` | Opposite vibe references |
| `embedding` | `vector(768)` | | Semantic search vector |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |

#### `tags`

General-purpose tag ontology.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `name` | `TEXT` | UNIQUE NOT NULL | Tag name |
| `slug` | `TEXT` | UNIQUE NOT NULL | URL-friendly slug |
| `category` | `TEXT` | CHECK: `occasion`, `feature`, `label`, `dietary`, `activity` | Tag category |
| `description` | `TEXT` | | Description |
| `parent_id` | `UUID` | FK to `tags(id)` | Parent tag (hierarchy) |
| `embedding` | `vector(768)` | | Semantic search vector |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |

#### `allergens`

Allergen ontology.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `name` | `TEXT` | UNIQUE NOT NULL | Allergen name |
| `slug` | `TEXT` | UNIQUE NOT NULL | URL-friendly slug |
| `description` | `TEXT` | | Description |
| `severity` | `TEXT` | | Severity level |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

#### `dietary_restrictions`

Dietary restriction ontology.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `name` | `TEXT` | UNIQUE NOT NULL | Restriction name |
| `slug` | `TEXT` | UNIQUE NOT NULL | URL-friendly slug |
| `description` | `TEXT` | | Description |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

#### `location_features`

Venue feature ontology.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `name` | `TEXT` | UNIQUE NOT NULL | Feature name |
| `slug` | `TEXT` | UNIQUE NOT NULL | URL-friendly slug |
| `category` | `TEXT` | | Feature category |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

---

### Junction Tables

#### `location_cuisines`

Many-to-many: locations to cuisines.

| Column | Type | Default | Description |
|---|---|---|---|
| `location_id` | `UUID` | PK, FK to `locations(id)` ON DELETE CASCADE | Location reference |
| `cuisine_id` | `UUID` | PK, FK to `cuisines(id)` ON DELETE CASCADE | Cuisine reference |
| `is_primary` / `is_specialty` | `BOOLEAN` | `false` | Primary/specialty cuisine flag |
| `confidence_score` | `FLOAT` | `1.0` CHECK 0-1 | Confidence score |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

#### `location_dishes`

Many-to-many: locations to dishes (menu items).

| Column | Type | Default | Description |
|---|---|---|---|
| `location_id` | `UUID` | PK, FK to `locations(id)` ON DELETE CASCADE | Location reference |
| `dish_id` | `UUID` | PK, FK to `dishes(id)` ON DELETE CASCADE | Dish reference |
| `is_signature` | `BOOLEAN` | `false` | Signature dish flag |
| `price` | `FLOAT` / `TEXT` | | Dish price |
| `available` | `BOOLEAN` | `true` | Availability flag |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

#### `dish_ingredients`

Many-to-many: dishes to ingredients.

| Column | Type | Default | Description |
|---|---|---|---|
| `dish_id` | `UUID` | PK, FK to `dishes(id)` ON DELETE CASCADE | Dish reference |
| `ingredient_id` | `UUID` | PK, FK to `ingredients(id)` ON DELETE CASCADE | Ingredient reference |
| `is_main` | `BOOLEAN` | `false` | Main ingredient flag |
| `quantity` | `TEXT` | | Quantity description |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

#### `location_vibes`

Many-to-many: locations to vibes.

| Column | Type | Default | Description |
|---|---|---|---|
| `location_id` | `UUID` | PK, FK to `locations(id)` ON DELETE CASCADE | Location reference |
| `vibe_id` | `UUID` | PK, FK to `vibes(id)` ON DELETE CASCADE | Vibe reference |
| `strength` | `FLOAT` | `1.0` CHECK 0-1 | Vibe strength |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

#### `location_tags`

Many-to-many: locations to tags.

| Column | Type | Default | Description |
|---|---|---|---|
| `location_id` | `UUID` | PK, FK to `locations(id)` ON DELETE CASCADE | Location reference |
| `tag_id` | `UUID` | PK, FK to `tags(id)` ON DELETE CASCADE | Tag reference |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

#### `cuisine_ingredients`

Many-to-many: cuisines to characteristic ingredients.

| Column | Type | Default | Description |
|---|---|---|---|
| `cuisine_id` | `UUID` | PK, FK to `cuisines(id)` ON DELETE CASCADE | Cuisine reference |
| `ingredient_id` | `UUID` | PK, FK to `ingredients(id)` ON DELETE CASCADE | Ingredient reference |
| `is_signature` | `BOOLEAN` | `false` | Signature ingredient flag |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

#### `vibe_occasions`

Vibe to occasion mapping.

| Column | Type | Default | Description |
|---|---|---|---|
| `vibe_id` | `UUID` | PK, FK to `vibes(id)` ON DELETE CASCADE | Vibe reference |
| `occasion` | `TEXT` | NOT NULL | Occasion description |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

#### `location_dietary`

Many-to-many: locations to dietary restrictions.

| Column | Type | Default | Description |
|---|---|---|---|
| `location_id` | `UUID` | PK, FK to `locations(id)` ON DELETE CASCADE | Location reference |
| `dietary_id` | `UUID` | PK, FK to `dietary_restrictions(id)` ON DELETE CASCADE | Dietary restriction reference |

---

### User Data Tables

#### `user_favorites`

User bookmarked/saved locations.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `user_id` | `UUID` | NOT NULL, FK to `profiles(id)` ON DELETE CASCADE | User reference |
| `location_id` | `UUID` | NOT NULL, FK to `locations(id)` ON DELETE CASCADE | Location reference |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

**Unique constraint:** `(user_id, location_id)`

#### `user_visits`

User visit history with optional reviews.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `user_id` | `UUID` | NOT NULL, FK to `profiles(id)` ON DELETE CASCADE | User reference |
| `location_id` | `UUID` | NOT NULL, FK to `locations(id)` ON DELETE CASCADE | Location reference |
| `visited_at` | `TIMESTAMPTZ` | `now()` | Visit timestamp |
| `rating` | `INTEGER` | CHECK 1-5 | User rating |
| `review_text` | `TEXT` | | Review content |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

**Unique constraint:** `(user_id, location_id)`

#### `reviews`

Standalone review records with moderation workflow.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `user_id` | `UUID` | NOT NULL, FK to `profiles(id)` ON DELETE CASCADE | User reference |
| `location_id` | `UUID` | NOT NULL, FK to `locations(id)` ON DELETE CASCADE | Location reference |
| `rating` | `INTEGER` | CHECK 1-5 | Review rating |
| `review_text` | `TEXT` | | Review content |
| `status` | `TEXT` | `'pending'` CHECK: `pending`, `published`, `rejected` | Moderation status |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |

---

### Payment & Subscription Tables

#### `payments`

Stripe payment records (with mock support).

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `user_id` | `UUID` | NOT NULL, FK to `auth.users(id)` ON DELETE CASCADE | User reference |
| `stripe_payment_intent_id` | `VARCHAR(255)` | UNIQUE | Stripe Payment Intent ID |
| `stripe_checkout_session_id` | `VARCHAR(255)` | UNIQUE | Stripe Checkout Session ID |
| `product_id` | `VARCHAR(255)` | NOT NULL | Product identifier |
| `product_name` | `VARCHAR(255)` | NOT NULL | Product name |
| `amount` | `INTEGER` | NOT NULL | Amount in cents/groszy |
| `currency` | `VARCHAR(3)` | `'PLN'` | Currency code |
| `status` | `VARCHAR(50)` | `'pending'` | Status: `pending`, `processing`, `succeeded`, `failed`, `refunded` |
| `payment_method` | `VARCHAR(50)` | | Method: `card`, `blik`, `p24` |
| `receipt_url` | `TEXT` | | Receipt URL |
| `metadata` | `JSONB` | `'{}'` | Additional metadata |
| `error_message` | `TEXT` | | Error details |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |
| `paid_at` | `TIMESTAMPTZ` | | Payment completion timestamp |

#### `subscriptions`

User subscription management.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `user_id` | `UUID` | NOT NULL, FK to `auth.users(id)` ON DELETE CASCADE | User reference |
| `stripe_subscription_id` | `VARCHAR(255)` | UNIQUE | Stripe Subscription ID |
| `product_id` | `VARCHAR(255)` | NOT NULL | Product identifier |
| `status` | `VARCHAR(50)` | `'inactive'` | Status: `inactive`, `active`, `paused`, `cancelled`, `expired` |
| `current_period_start` | `TIMESTAMPTZ` | | Period start |
| `current_period_end` | `TIMESTAMPTZ` | | Period end |
| `cancel_at_period_end` | `BOOLEAN` | `false` | Scheduled cancellation |
| `canceled_at` | `TIMESTAMPTZ` | | Cancellation timestamp |
| `metadata` | `JSONB` | `'{}'` | Additional metadata |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |

#### `user_roles`

User roles and permissions for admin/moderator management.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `user_id` | `UUID` | NOT NULL, UNIQUE, FK to `auth.users(id)` ON DELETE CASCADE | User reference |
| `role` | `VARCHAR(50)` | `'user'` | Role: `user`, `admin`, `moderator`, `contributor` |
| `permissions` | `JSONB` | `'[]'` | Permission array |
| `granted_by` | `UUID` | FK to `auth.users(id)` | Granting user |
| `granted_at` | `TIMESTAMPTZ` | `now()` | Grant timestamp |
| `expires_at` | `TIMESTAMPTZ` | | Expiration timestamp |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |

---

### Translation Tables

#### `location_translations`

Multi-language translations for location data.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `location_id` | `UUID` | NOT NULL, UNIQUE, FK to `locations(id)` ON DELETE CASCADE | Location reference |
| `translations` | `JSONB` | `'{}'` NOT NULL | Translations object per language |
| `source_language` | `VARCHAR(2)` | `'auto'` | Source language code |
| `translation_model` | `VARCHAR(100)` | `'openrouter'` | Translation model used |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |

**Translations JSON structure:**

```json
{
  "en": {
    "title": "...",
    "description": "...",
    "address": "...",
    "insider_tip": "...",
    "what_to_try": ["..."],
    "ai_context": "...",
    "translated_at": "2026-03-31T..."
  },
  "pl": { "... "},
  "uk": { "..." },
  "ru": { "..." }
}
```

---

### AI & Learning Tables

#### `user_preferences`

User preference profile for GastroGuide AI personalization.

| Column | Type | Default | Description |
|---|---|---|---|
| `user_id` | `UUID` | PK, FK to `auth.users(id)` | User reference |
| `favorite_cuisines` | `TEXT[]` | `'{}'` | Preferred cuisines |
| `disliked_cuisines` | `TEXT[]` | `'{}'` | Disliked cuisines |
| `vibe_preferences` | `TEXT[]` | `'{}'` | Preferred vibes |
| `price_range` | `TEXT` | | Preferred price range |
| `dietary_restrictions` | `TEXT[]` | `'{}'` | Dietary restrictions |
| `implicit_preferences` | `JSONB` | `'{}'` | AI-inferred preferences |
| `context_preferences` | `JSONB` | `'{}'` | Contextual preferences |
| `preference_confidence` | `FLOAT` | `0.5` | Confidence in preferences (0-1) |
| `last_updated` | `TIMESTAMPTZ` | `now()` | Last preference update |
| `total_interactions` | `INT` | `0` | Total interaction count |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |

#### `chat_sessions`

AI chat session tracking.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `user_id` | `UUID` | FK to `auth.users(id)` | User reference |
| `started_at` | `TIMESTAMPTZ` | `now()` | Session start |
| `ended_at` | `TIMESTAMPTZ` | | Session end |
| `message_count` | `INT` | `0` | Message count |
| `intent_summary` | `TEXT` | | User intent summary |
| `locations_mentioned` | `UUID[]` | | Mentioned location IDs |
| `final_recommendation` | `UUID` | | Final recommended location |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

#### `chat_messages`

Individual chat messages within sessions.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `session_id` | `UUID` | FK to `chat_sessions(id)` ON DELETE CASCADE | Session reference |
| `user_id` | `UUID` | FK to `auth.users(id)` | User reference |
| `role` | `TEXT` | NOT NULL | Message role (user/assistant) |
| `content` | `TEXT` | NOT NULL | Message content |
| `timestamp` | `TIMESTAMPTZ` | `now()` | Message timestamp |
| `tokens_used` | `INT` | | Token count |
| `model_used` | `TEXT` | | AI model identifier |
| `feedback_score` | `INT` | | User feedback score |
| `feedback_text` | `TEXT` | | User feedback text |
| `extracted_preferences` | `JSONB` | | Preferences extracted from message |

#### `contributors`

Contributor leaderboard and stats.

| Column | Type | Default | Description |
|---|---|---|---|
| `user_id` | `UUID` | PK, FK to `auth.users(id)` | User reference |
| `email` | `TEXT` | | Contributor email |
| `full_name` | `TEXT` | | Contributor name |
| `submissions_count` | `INT` | `0` | Total submissions |
| `approved_count` | `INT` | `0` | Approved submissions |
| `rejected_count` | `INT` | `0` | Rejected submissions |
| `total_score` | `FLOAT` | `0` | Contributor score |
| `rank` | `INT` | | Current rank |
| `is_top_10` | `BOOLEAN` | `false` | Top 10 contributor flag |
| `lifetime_subscription` | `BOOLEAN` | `false` | Lifetime subscription reward |
| `joined_at` | `TIMESTAMPTZ` | `now()` | Join timestamp |
| `last_submission_at` | `TIMESTAMPTZ` | | Last submission timestamp |

#### `user_submissions`

User-submitted venue suggestions awaiting moderation.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `user_id` | `UUID` | FK to `auth.users(id)` | Submitter reference |
| `title` | `TEXT` | NOT NULL | Venue name |
| `city` | `TEXT` | NOT NULL | City |
| `address` | `TEXT` | NOT NULL | Address |
| `lat` | `FLOAT` | NOT NULL | Latitude |
| `lng` | `FLOAT` | NOT NULL | Longitude |
| `category` | `TEXT` | NOT NULL | Venue category |
| `insider_tip` | `TEXT` | NOT NULL | Insider tip |
| `must_try` | `TEXT[]` | NOT NULL | Must-try dishes |
| `description` | `TEXT` | | Description |
| `cuisine` | `TEXT[]` | | Cuisine types |
| `vibe` | `TEXT[]` | | Vibe descriptors |
| `price_level` | `TEXT` | | Price level |
| `features` | `TEXT[]` | | Features |
| `images` | `TEXT[]` | | Image URLs |
| `website` | `TEXT` | | Website URL |
| `phone` | `TEXT` | | Phone number |
| `opening_hours` | `TEXT` | | Opening hours |
| `submitted_at` | `TIMESTAMPTZ` | `now()` | Submission timestamp |
| `status` | `TEXT` | `'pending'` | Status: `pending`, `approved`, `rejected` |
| `moderated_by` | `UUID` | | Moderator user ID |
| `moderated_at` | `TIMESTAMPTZ` | | Moderation timestamp |
| `rejection_reason` | `TEXT` | | Reason for rejection |

#### `ai_agent_configs`

AI agent configuration for different roles.

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `agent_name` | `TEXT` | NOT NULL UNIQUE | Agent name |
| `model_provider` | `TEXT` | NOT NULL | Model provider (e.g., openrouter) |
| `model_id` | `TEXT` | NOT NULL | Model identifier |
| `system_prompt` | `TEXT` | | System prompt |
| `temperature` | `FLOAT` | `0.7` | Temperature setting |
| `max_tokens` | `INT` | `1024` | Max token output |
| `tone` | `TEXT` | | Agent tone |
| `data_sources` | `TEXT[]` | `'{}'` | Data source list |
| `learning_enabled` | `BOOLEAN` | `true` | Learning toggle |
| `personalization_depth` | `TEXT` | `'medium'` | Personalization level |
| `auto_approve` | `BOOLEAN` | `false` | Auto-approve flag |
| `is_active` | `BOOLEAN` | `true` | Active status |
| `updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |
| `created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |

---

## 2. Entity Relationship Diagram

```
┌──────────────────────┐
│      auth.users      │  (Supabase Auth)
│──────────────────────│
│ id (PK)              │
│ email                │
│ raw_user_meta_data   │
└──────┬───────┬───────┘
       │       │
       │       │ 1:1
       │       ├─────────────────────────────────────────┐
       │       │                                         │
       ▼       ▼                                         ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│   profiles   │  │  user_roles  │  │user_preferences  │
│──────────────│  │──────────────│  │──────────────────│
│ id (PK,FK)   │  │ id (PK)      │  │ user_id (PK,FK)  │
│ email        │  │ user_id (UK) │  │ favorite_cuisines│
│ name         │  │ role         │  │ disliked_cuisines│
│ role         │  │ permissions  │  │ vibe_preferences │
│ avatar_url   │  │ granted_by   │  │ price_range      │
│ preferences  │  │ expires_at   │  │ dietary_restrict.│
│ created_at   │  │ created_at   │  │ implicit_prefs   │
│ updated_at   │  │ updated_at   │  │ context_prefs    │
└──────┬───────┘  └──────────────┘  └──────────────────┘
       │
       │ 1:N
       ├─────────────────────────────────────────────────────┐
       │                                                     │
       ▼                                                     ▼
┌──────────────┐  ┌────────────────┐  ┌─────────────────────┐
│user_favorites│  │  user_visits   │  │      reviews        │
│──────────────│  │────────────────│  │─────────────────────│
│ id (PK)      │  │ id (PK)        │  │ id (PK)             │
│ user_id (FK) │  │ user_id (FK)   │  │ user_id (FK)        │
│ location_id  │  │ location_id    │  │ location_id (FK)    │
│ created_at   │  │ visited_at     │  │ rating              │
│              │  │ rating         │  │ review_text         │
│              │  │ review_text    │  │ status              │
│              │  │ created_at     │  │ created_at          │
│              │  │ UNIQUE(u,l)    │  │ updated_at          │
└──────┬───────┘  └──────┬───────┘  └─────────────────────┘
       │                 │
       │                 │ N:1
       │                 │
       ▼                 ▼
┌──────────────────────────────────────────────────────────┐
│                       locations                           │
│──────────────────────────────────────────────────────────│
│ id (PK)                                                   │
│ title, description, address, city, country                │
│ lat, lng, category, cuisine, image, photos[]              │
│ rating, price_level, opening_hours                        │
│ tags[], special_labels[], vibe[], features[]              │
│ best_for[], dietary[]                                     │
│ has_wifi, has_outdoor_seating, reservations_required      │
│ michelin_stars, michelin_bib                              │
│ insider_tip, what_to_try[], ai_keywords[], ai_context     │
│ status, embedding vector(768), fts tsvector               │
│ created_at, updated_at                                    │
└──────┬──────┬───────┬───────┬──────┬──────┬──────────────┘
       │      │       │       │      │      │
       │      │       │       │      │      │ Junction Tables
       │      │       │       │      │      │
       ▼      ▼       ▼       ▼      ▼      ▼
┌─────────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────────┐
│location ││locat.││locat.││locat.││locat.││location  │
│_cuisines││_dishes││_vibes││_tags ││_dietary││_features │
└────┬────┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──────────┘
     │        │       │       │       │
     ▼        ▼       ▼       ▼       ▼
┌─────────┐┌──────┐┌──────┐┌──────┐┌──────────────────┐
│cuisines ││dishes││vibes ││tags  ││dietary_restrict. │
│─────────││──────││──────││──────││──────────────────│
│id (PK)  ││id(PK)││id(PK)││id(PK)││id (PK)           │
│name     ││name  ││name  ││name  ││name              │
│parent_id││cuisine││category││cat. ││slug              │
│slug     ││category││embedding││parent││description     │
│embedding││embed.││synonyms││embed.││created_at        │
│...      ││...   ││...   ││...   ││                  │
└─────────┘└──┬───┘└──────┘└──────┘└──────────────────┘
              │
              ▼
       ┌──────────────┐
       │dish_ingr.    │
       │──────────────│
       │dish_id (FK)  │
       │ingredient_id │
       │is_main       │
       │quantity      │
       └──────┬───────┘
              ▼
       ┌──────────────┐
       │ingredients   │
       │──────────────│
       │id (PK)       │
       │name          │
       │slug          │
       │category      │
       │is_allergen   │
       │embedding     │
       │...           │
       └──────────────┘

┌──────────────────────┐  ┌──────────────────┐  ┌───────────────────┐
│      payments        │  │   subscriptions  │  │location_translat. │
│──────────────────────│  │──────────────────│  │───────────────────│
│ id (PK)              │  │ id (PK)          │  │ id (PK)           │
│ user_id (FK)         │  │ user_id (FK)     │  │ location_id (UK)  │
│ stripe_payment_int.  │  │ stripe_sub_id    │  │ translations JSONB│
│ stripe_checkout_sess │  │ product_id       │  │ source_language   │
│ product_id/name      │  │ status           │  │ translation_model │
│ amount, currency     │  │ period_start/end │  │ created_at        │
│ status               │  │ cancel_at_end    │  │ updated_at        │
│ payment_method       │  │ metadata         │  │                   │
│ receipt_url          │  │ created_at       │  │                   │
│ metadata, error_msg  │  │ updated_at       │  │                   │
│ created_at, updated_at│ │                  │  │                   │
│ paid_at              │  │                  │  │                   │
└──────────────────────┘  └──────────────────┘  └───────────────────┘

┌──────────────────────┐  ┌──────────────────┐  ┌───────────────────┐
│   chat_sessions      │  │  chat_messages   │  │  user_submissions │
│──────────────────────│  │──────────────────│  │───────────────────│
│ id (PK)              │  │ id (PK)          │  │ id (PK)           │
│ user_id (FK)         │  │ session_id (FK)  │  │ user_id (FK)      │
│ started_at, ended_at │  │ user_id (FK)     │  │ title, city, addr │
│ message_count        │  │ role, content    │  │ lat, lng, category│
│ intent_summary       │  │ timestamp        │  │ insider_tip       │
│ locations_mentioned  │  │ tokens_used      │  │ must_try[]        │
│ final_recommendation │  │ model_used       │  │ description       │
│ created_at           │  │ feedback_score   │  │ cuisine[], vibe[] │
└──────────────────────┘  │ feedback_text    │  │ status            │
                          │ extracted_prefs  │  │ moderated_by      │
                          └──────────────────┘  │ rejection_reason  │
                                                └───────────────────┘

┌──────────────────────┐  ┌──────────────────┐
│    contributors      │  │ ai_agent_configs  │
│──────────────────────│  │──────────────────│
│ user_id (PK)         │  │ id (PK)           │
│ email, full_name     │  │ agent_name (UNIQUE│
│ submissions_count    │  │ model_provider    │
│ approved_count       │  │ model_id          │
│ rejected_count       │  │ system_prompt     │
│ total_score, rank    │  │ temperature       │
│ is_top_10            │  │ max_tokens        │
│ lifetime_subscription│  │ learning_enabled  │
│ joined_at            │  │ personalization   │
│ last_submission_at   │  │ is_active         │
└──────────────────────┘  │ created_at        │
                          └───────────────────┘
```

---

## 3. Row Level Security (RLS) Policies

### `locations`

RLS is enabled. Public can only see `active` locations; admins have full access.

| Policy Name | Operation | Condition |
|---|---|---|
| `Public read active locations` | SELECT | `status = 'active'` |
| `Service role full access` | ALL | `auth.role() = 'service_role'` |
| `Admin read all locations` | SELECT | `get_my_role() = 'admin'` |
| `Admin insert locations` | INSERT | `get_my_role() = 'admin'` |
| `Admin update locations` | UPDATE | `get_my_role() = 'admin'` |
| `Admin delete locations` | DELETE | `get_my_role() = 'admin'` |

### `profiles`

RLS is enabled. Users can only access their own profile; admins can read all.

| Policy Name | Operation | Condition |
|---|---|---|
| `profiles: own read` | SELECT | `auth.uid() = id` |
| `profiles: admin read all` | SELECT | `get_my_role() = 'admin'` |
| `profiles: own update` | UPDATE | `auth.uid() = id` (both USING and WITH CHECK) |
| `profiles: service role all` | ALL | `auth.role() = 'service_role'` |

**Grants:**
- `SELECT, UPDATE` to `authenticated`
- `ALL` to `service_role`

### `user_favorites`

RLS is enabled. Users can only manage their own favorites.

| Policy Name | Operation | Condition |
|---|---|---|
| `Users can view own favorites` | SELECT | `auth.uid() = user_id` |
| `Users can add own favorites` | INSERT | `auth.uid() = user_id` |
| `Users can delete own favorites` | DELETE | `auth.uid() = user_id` |

### `user_visits`

RLS is enabled. Full CRUD on own visits only.

| Policy Name | Operation | Condition |
|---|---|---|
| `Users can view own visits` | SELECT | `auth.uid() = user_id` |
| `Users can add own visits` | INSERT | `auth.uid() = user_id` |
| `Users can update own visits` | UPDATE | `auth.uid() = user_id` |
| `Users can delete own visits` | DELETE | `auth.uid() = user_id` |

### `reviews`

RLS is enabled. Published reviews are public; users manage own; admins manage all.

| Policy Name | Operation | Condition |
|---|---|---|
| `Anyone can view published reviews` | SELECT | `status = 'published'` |
| `Users can view own reviews` | SELECT | `auth.uid() = user_id` |
| `Users can add own reviews` | INSERT | `auth.uid() = user_id` |
| `Users can update own reviews` | UPDATE | `auth.uid() = user_id` |
| `Admins can manage all reviews` | ALL | `EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'super_admin'))` |

### `payments`

RLS is enabled. Users see own; admins see all.

| Policy Name | Operation | Condition |
|---|---|---|
| `Users can view own payments` | SELECT | `auth.uid() = user_id` |
| `Users can create own payments` | INSERT | `auth.uid() = user_id` |
| `Admins can view all payments` | SELECT | `EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')` |

### `subscriptions`

RLS is enabled. Users see own; admins see all.

| Policy Name | Operation | Condition |
|---|---|---|
| `Users can view own subscriptions` | SELECT | `auth.uid() = user_id` |
| `Users can create own subscriptions` | INSERT | `auth.uid() = user_id` |
| `Admins can view all subscriptions` | SELECT | `EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')` |

### `user_roles`

RLS is enabled. Users see own; only admins can manage.

| Policy Name | Operation | Condition |
|---|---|---|
| `Users can view own roles` | SELECT | `auth.uid() = user_id` |
| `Admins can manage roles` | ALL | `EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')` |

### `location_translations`

RLS is enabled. Anyone can read; authenticated can create; admin/moderator can update; admin can delete.

| Policy Name | Operation | Condition |
|---|---|---|
| `Anyone can view translations` | SELECT | `true` |
| `Authenticated users can create translations` | INSERT | `auth.role() = 'authenticated'` |
| `Admins and moderators can update translations` | UPDATE | `EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'moderator'))` |
| `Admins can delete translations` | DELETE | `EX EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')` |

**Grants:**
- `SELECT` to `PUBLIC`
- `INSERT, UPDATE` to `authenticated`

### Knowledge Graph Tables (RLS: Public Read)

All knowledge graph tables have RLS enabled with a single policy: **public read access**. No write policies are defined (admin write access is commented out and left for future configuration).

| Table | Policy |
|---|---|
| `cuisines` | `Public read access` — SELECT WHERE `true` |
| `dishes` | `Public read access` — SELECT WHERE `true` |
| `ingredients` | `Public read access` — SELECT WHERE `true` |
| `vibes` | `Public read access` — SELECT WHERE `true` |
| `tags` | `Public read access` — SELECT WHERE `true` |
| `location_cuisines` | `Public read access` — SELECT WHERE `true` |
| `location_dishes` | `Public read access` — SELECT WHERE `true` |
| `dish_ingredients` | `Public read access` — SELECT WHERE `true` |
| `location_vibes` | `Public read access` — SELECT WHERE `true` |
| `location_tags` | `Public read access` — SELECT WHERE `true` |
| `cuisine_ingredients` | `Public read access` — SELECT WHERE `true` |
| `vibe_occasions` | `Public read access` — SELECT WHERE `true` |

### Tables Without RLS

The following tables do **not** have RLS enabled (intended to be managed server-side only):

- `user_preferences`
- `chat_sessions`
- `chat_messages`
- `contributors`
- `user_submissions`
- `ai_agent_configs`
- `allergens`
- `dietary_restrictions`
- `location_features`

---

## 4. Indexes

### Full-Text Search Indexes

| Index | Table | Columns | Type | Purpose |
|---|---|---|---|---|
| `locations_fts_gin` | `locations` | `fts` (tsvector) | GIN | Full-text search on generated column (title, description, city, cuisine, tags, ai_context) |

### Location Filter Indexes

| Index | Table | Column | Type | Purpose |
|---|---|---|---|---|
| `locations_category_idx` | `locations` | `category` | B-tree | Filter by venue category |
| `locations_city_idx` | `locations` | `city` | B-tree | Filter by city |
| `locations_status_idx` | `locations` | `status` | B-tree | Filter by status (active/hidden/coming_soon) |

### Vector Search Indexes (pgvector IVFFlat)

| Index | Table | Column | Type | Lists | Purpose |
|---|---|---|---|---|---|
| `cuisines_embedding_idx` | `cuisines` | `embedding` | IVFFlat (cosine) | 50 | Semantic cuisine search |
| `dishes_embedding_idx` | `dishes` | `embedding` | IVFFlat (cosine) | 50 | Semantic dish search |
| `ingredients_embedding_idx` | `ingredients` | `embedding` | IVFFlat (cosine) | 50 | Semantic ingredient search |
| `vibes_embedding_idx` | `vibes` | `embedding` | IVFFlat (cosine) | 50 | Semantic vibe search |
| `tags_embedding_idx` | `tags` | `embedding` | IVFFlat (cosine) | 50 | Semantic tag search |
| `locations_embedding_idx` | `locations` | `embedding` | IVFFlat (cosine) | 100 | Semantic location search |

### Junction Table Indexes

| Index | Table | Column | Purpose |
|---|---|---|---|
| `location_cuisines_location_id_idx` | `location_cuisines` | `location_id` | Join locations to cuisines |
| `location_cuisines_cuisine_id_idx` | `location_cuisines` | `cuisine_id` | Join cuisines to locations |
| `location_dishes_location_id_idx` | `location_dishes` | `location_id` | Join locations to dishes |
| `location_dishes_dish_id_idx` | `location_dishes` | `dish_id` | Join dishes to locations |
| `dish_ingredients_dish_id_idx` | `dish_ingredients` | `dish_id` | Join dishes to ingredients |
| `dish_ingredients_ingredient_id_idx` | `dish_ingredients` | `ingredient_id` | Join ingredients to dishes |
| `location_vibes_location_id_idx` | `location_vibes` | `location_id` | Join locations to vibes |
| `location_vibes_vibe_id_idx` | `location_vibes` | `vibe_id` | Join vibes to locations |
| `location_tags_location_id_idx` | `location_tags` | `location_id` | Join locations to tags |
| `location_tags_tag_id_idx` | `location_tags` | `tag_id` | Join tags to locations |
| `cuisine_ingredients_cuisine_id_idx` | `cuisine_ingredients` | `cuisine_id` | Join cuisines to ingredients |
| `cuisine_ingredients_ingredient_id_idx` | `cuisine_ingredients` | `ingredient_id` | Join ingredients to cuisines |
| `vibe_occasions_vibe_id_idx` | `vibe_occasions` | `vibe_id` | Join vibes to occasions |

### Knowledge Graph Column Indexes

| Index | Table | Column | Purpose |
|---|---|---|---|
| `cuisines_parent_id_idx` | `cuisines` | `parent_id` | Hierarchical cuisine queries |
| `cuisines_slug_idx` | `cuisines` | `slug` | Slug lookups |
| `dishes_cuisine_id_idx` | `dishes` | `cuisine_id` | Filter dishes by cuisine |
| `dishes_category_idx` | `dishes` | `category` | Filter dishes by category |
| `ingredients_category_idx` | `ingredients` | `category` | Filter ingredients by category |
| `vibes_category_idx` | `vibes` | `category` | Filter vibes by category |
| `tags_category_idx` | `tags` | `category` | Filter tags by category |
| `tags_parent_id_idx` | `tags` | `parent_id` | Hierarchical tag queries |

### User Data Indexes

| Index | Table | Column | Purpose |
|---|---|---|---|
| `idx_user_favorites_user_id` | `user_favorites` | `user_id` | User's favorites lookup |
| `idx_user_favorites_location_id` | `user_favorites` | `location_id` | Location's favorite count |
| `idx_reviews_location_id` | `reviews` | `location_id` | Location's reviews lookup |
| `idx_reviews_user_id` | `reviews` | `user_id` | User's reviews lookup |
| `idx_reviews_status` | `reviews` | `status` | Filter by moderation status |

### Payment Indexes

| Index | Table | Column | Purpose |
|---|---|---|---|
| `idx_payments_user_id` | `payments` | `user_id` | User's payment history |
| `idx_payments_status` | `payments` | `status` | Filter by payment status |
| `idx_payments_created_at` | `payments` | `created_at DESC` | Sort by recent payments |
| `idx_subscriptions_user_id` | `subscriptions` | `user_id` | User's subscription lookup |
| `idx_subscriptions_status` | `subscriptions` | `status` | Filter by subscription status |
| `idx_user_roles_user_id` | `user_roles` | `user_id` | User's role lookup |
| `idx_user_roles_role` | `user_roles` | `role` | Filter users by role |

### Translation Indexes

| Index | Table | Column | Type | Purpose |
|---|---|---|---|---|
| `idx_location_translations_location_id` | `location_translations` | `location_id` | Fast location translation lookup |
| `idx_location_translations_updated_at` | `location_translations` | `updated_at DESC` | Sort by recently translated |
| `idx_location_translations_languages` | `location_translations` | `translations` | GIN | JSONB queries on translation object |

---

## 5. PostgreSQL Functions

### Helper Functions

#### `set_updated_at()`

Auto-updates the `updated_at` column on `locations` before each UPDATE.

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
```

#### `set_profile_updated_at()`

Auto-updates the `updated_at` column on `profiles` before each UPDATE.

```sql
CREATE OR REPLACE FUNCTION public.set_profile_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
```

#### `handle_updated_at()`

Generic updated_at trigger used by `payments`, `subscriptions`, `user_roles`, and `location_translations`.

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### `update_updated_at_column()`

Generic updated_at trigger used by knowledge graph tables (`cuisines`, `dishes`, `ingredients`, `vibes`, `tags`).

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Auth Functions

#### `handle_new_user()` (Profiles version)

Auto-creates a `profiles` row when a new user signs up via `auth.users`.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'user'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;
```

**Trigger:** `AFTER INSERT ON auth.users`

#### `handle_new_user()` (User Roles version)

Auto-creates a `user_roles` row with default `user` role on signup.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_roles (user_id, role, permissions)
    VALUES (NEW.id, 'user', '[]'::jsonb);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Trigger:** `AFTER INSERT ON auth.users`

> **Note:** Both functions fire on `auth.users` insert. The last one installed (by migration order) will be the active trigger.

#### `get_my_role()`

Returns the current user's role from the `profiles` table. Uses `SECURITY DEFINER` to bypass RLS.

```sql
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
```

**Grants:** `EXECUTE` to `authenticated`, `anon`

### Admin Statistics Functions

#### `get_location_stats()`

Returns JSON with location counts by status.

```sql
-- Returns:
{
  "total": 16,
  "published": 10,
  "pending": 3,
  "rejected": 3
}
```

#### `get_user_stats()`

Returns JSON with user counts (total, this month, this week).

```sql
-- Returns:
{
  "total": 150,
  "this_month": 25,
  "this_week": 5
}
```

#### `get_top_locations(limit_count INT DEFAULT 10)`

Returns top locations by combined engagement (visits + reviews + favorites).

| Column | Type |
|---|---|
| `location_id` | `UUID` |
| `title` | `TEXT` |
| `category` | `TEXT` |
| `visit_count` | `BIGINT` |
| `review_count` | `BIGINT` |
| `save_count` | `BIGINT` |

#### `get_engagement_stats()`

Returns JSON with engagement metrics.

```sql
-- Returns:
{
  "total_visits": 500,
  "total_reviews": 120,
  "total_favorites": 300,
  "pending_reviews": 15
}
```

#### `get_payment_stats()`

Returns JSON with payment and revenue metrics.

```sql
-- Returns:
{
  "total_payments": 85,
  "total_revenue": 450000,
  "active_subscriptions": 30,
  "this_month_revenue": 75000
}
```

### Gamification Functions

#### `get_leaderboard()`

Calculates user leaderboard with points system:
- **10 points** per place visited
- **25 points** per published review
- **5 points** per place saved (favorited)

| Column | Type |
|---|---|
| `user_id` | `UUID` |
| `name` | `TEXT` |
| `email` | `TEXT` |
| `avatar_url` | `TEXT` |
| `places_visited` | `BIGINT` |
| `reviews_written` | `BIGINT` |
| `places_saved` | `BIGINT` |
| `total_points` | `BIGINT` |

```sql
-- Points formula:
total_points = (places_visited * 10) + (reviews_written * 25) + (places_saved * 5)
```

### Semantic Search Functions

#### `search_locations_by_embedding(query_embedding, match_threshold, match_count)`

Searches locations by vector similarity using cosine distance.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query_embedding` | `vector(768)` | | Query vector |
| `match_threshold` | `FLOAT` | `0.7` | Minimum similarity score |
| `match_count` | `INT` | `20` | Max results |

#### `find_similar_locations(target_location_id, similarity_threshold, max_results)`

Finds locations similar to a given location.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `target_location_id` | `UUID` | | Reference location |
| `similarity_threshold` | `FLOAT` | `0.8` | Minimum similarity |
| `max_results` | `INT` | `10` | Max results |

#### `search_cuisines_by_embedding(query_embedding, match_threshold, match_count)`

Searches cuisines by vector similarity.

### Translation Functions

#### `get_location_translated(p_location_id, p_language)`

Returns a location row with translated fields for the requested language. Falls back to original fields if no translation exists.

| Parameter | Type | Default |
|---|---|---|
| `p_location_id` | `UUID` | |
| `p_language` | `VARCHAR(2)` | `'en'` |

Returns 35 columns including both original and translated fields (`translated_title`, `translated_description`, `translated_address`, `translated_insider_tip`, `translated_what_to_try`, `translated_ai_context`).

#### `auto_translate_location()`

Trigger function that creates a placeholder row in `location_translations` when a new location is inserted. Actual translation happens via the API layer.

---

## 6. Custom Data Types & Enum Values

The project uses `TEXT` columns with `CHECK` constraints instead of PostgreSQL `ENUM` types for flexibility.

### Role Values

| Context | Table | Column | Allowed Values |
|---|---|---|---|
| Profile roles | `profiles` | `role` | `user`, `admin`, `moderator` |
| User roles | `user_roles` | `role` | `user`, `admin`, `moderator`, `contributor` |

### Location Status

| Table | Column | Allowed Values |
|---|---|---|
| `locations` | `status` | `active`, `hidden`, `coming_soon` |

### Review Status

| Table | Column | Allowed Values |
|---|---|---|
| `reviews` | `status` | `pending`, `published`, `rejected` |

### User Submission Status

| Table | Column | Allowed Values |
|---|---|---|
| `user_submissions` | `status` | `pending` (others not explicitly constrained) |

### Payment Status

| Table | Column | Allowed Values |
|---|---|---|
| `payments` | `status` | `pending`, `processing`, `succeeded`, `failed`, `refunded` |

### Payment Methods

| Table | Column | Allowed Values |
|---|---|---|
| `payments` | `payment_method` | `card`, `blik`, `p24` |

### Subscription Status

| Table | Column | Allowed Values |
|---|---|---|
| `subscriptions` | `status` | `inactive`, `active`, `paused`, `cancelled`, `expired` |

### Dish Category

| Table | Column | Allowed Values |
|---|---|---|
| `dishes` | `category` | `appetizer`, `main`, `dessert`, `drink`, `snack` |

### Dish Price Range

| Table | Column | Allowed Values |
|---|---|---|
| `dishes` | `price_range` | `$`, `$$`, `$$$` |

### Ingredient Category

| Table | Column | Allowed Values |
|---|---|---|
| `ingredients` | `category` | `vegetable`, `fruit`, `meat`, `fish`, `seafood`, `dairy`, `grain`, `spice`, `herb`, `nut`, `legume`, `other` |

### Vibe Category

| Table | Column | Allowed Values |
|---|---|---|
| `vibes` | `category` | `atmosphere`, `occasion`, `crowd` |

### Tag Category

| Table | Column | Allowed Values |
|---|---|---|
| `tags` | `category` | `occasion`, `feature`, `label`, `dietary`, `activity` |

### Price Level (locations)

| Table | Column | Common Values |
|---|---|---|
| `locations` | `price_level` | `$`, `$$`, `$$$`, `$$$$` |

---

## 7. Triggers

| Trigger Name | Table | Event | Function | Purpose |
|---|---|---|---|---|
| `locations_updated_at` | `locations` | BEFORE UPDATE | `set_updated_at()` | Auto-update `updated_at` |
| `trg_profiles_updated_at` | `profiles` | BEFORE UPDATE | `set_profile_updated_at()` | Auto-update `updated_at` |
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` | Auto-create user role entry |
| `set_updated_at_payments` | `payments` | BEFORE UPDATE | `handle_updated_at()` | Auto-update `updated_at` |
| `set_updated_at_subscriptions` | `subscriptions` | BEFORE UPDATE | `handle_updated_at()` | Auto-update `updated_at` |
| `set_updated_at_user_roles` | `user_roles` | BEFORE UPDATE | `handle_updated_at()` | Auto-update `updated_at` |
| `set_updated_at_translations` | `location_translations` | BEFORE UPDATE | `handle_translation_updated_at()` | Auto-update `updated_at` |
| `update_cuisines_updated_at` | `cuisines` | BEFORE UPDATE | `update_updated_at_column()` | Auto-update `updated_at` |
| `update_dishes_updated_at` | `dishes` | BEFORE UPDATE | `update_updated_at_column()` | Auto-update `updated_at` |
| `update_ingredients_updated_at` | `ingredients` | BEFORE UPDATE | `update_updated_at_column()` | Auto-update `updated_at` |
| `update_vibes_updated_at` | `vibes` | BEFORE UPDATE | `update_updated_at_column()` | Auto-update `updated_at` |
| `update_tags_updated_at` | `tags` | BEFORE UPDATE | `update_updated_at_column()` | Auto-update `updated_at` |

---

## 8. Migration Guide

### Prerequisites

1. **Supabase Project**: Ensure you have an active Supabase project.
2. **pgvector Extension**: The knowledge graph migrations require the `vector` extension. Install it via:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. **Database Password**: Have your Supabase database connection string ready.

### Running Migrations

#### Option A: Supabase Dashboard (SQL Editor)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste each migration file in the order below
4. Execute them one by one

#### Option B: Supabase CLI

```bash
# Login to Supabase
npx supabase login

# Link your project
npx supabase link --project-ref <your-project-ref>

# Push all migrations
npx supabase db push
```

#### Option C: psql Direct Connection

```bash
psql "postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"
\i /path/to/migration/001_locations.sql
```

### Migration Execution Order

**Order matters.** Run migrations in this exact sequence:

| # | File | Description | Dependencies |
|---|---|---|---|
| 1 | `001_locations.sql` | Creates `locations` table, seed data (4 Krakow venues), FTS index, RLS | None |
| 2 | `002_seed_venues.sql` | Seeds 12 additional venues (Krakow + Warsaw) | `001_locations.sql` |
| 3 | `003_profiles.sql` | Creates `profiles` table, auth triggers, role helper, RLS policies, admin setup | `001_locations.sql` |
| 4 | `004_favorites.sql` | Creates `user_favorites` table with RLS and indexes | `001_locations.sql`, `003_profiles.sql` |
| 5 | `005_visits_and_reviews.sql` | Creates `user_visits`, `reviews` tables, adds `preferences` to profiles, `get_leaderboard()` function | `001_locations.sql`, `003_profiles.sql`, `004_favorites.sql` |
| 6 | `006_admin_stats_helpers.sql` | Creates admin stat functions (`get_location_stats`, `get_user_stats`, `get_top_locations`, `get_engagement_stats`, `get_payment_stats`) | All prior migrations |
| 7 | `20260328_knowledge_graph.sql` | Creates pgvector extension, knowledge graph tables (cuisines, dishes, ingredients, vibes, tags), junction tables, semantic search functions, data migration from locations | `001_locations.sql` |
| 8 | `20260331_knowledge_graph_ontology.sql` | Creates ontology tables (cuisines, dishes, ingredients, allergens, dietary_restrictions, vibes, location_features) with seed data | `20260328_knowledge_graph.sql` |
| 9 | `20260331_payments_system.sql` | Creates `payments`, `subscriptions`, `user_roles` tables with RLS, triggers, and auth hooks | `003_profiles.sql` |
| 10 | `20260331_auto_translation.sql` | Creates `location_translations` table, translation functions, RLS policies | `001_locations.sql`, `20260331_payments_system.sql` (for user_roles reference) |
| 11 | `20260331_user_preferences_learning.sql` | Creates `user_preferences`, `chat_sessions`, `chat_messages`, `contributors`, `user_submissions`, `ai_agent_configs` tables | `003_profiles.sql` |
| 12 | `20260331_add_admin_user.sql` | Assigns admin role to `alik2191@gmail.com` | `20260331_payments_system.sql` (requires `user_roles`) |

### Quick Start (Fresh Database)

For a completely new database, run in this order:

```bash
# Core foundation
psql -f 001_locations.sql        # Locations + initial seed
psql -f 002_seed_venues.sql      # Additional venue seed data
psql -f 003_profiles.sql         # Auth + profiles + RLS

# User features
psql -f 004_favorites.sql        # Favorites
psql -f 005_visits_and_reviews.sql  # Visits, reviews, leaderboard

# Admin tools
psql -f 006_admin_stats_helpers.sql  # Dashboard stats functions

# Knowledge graph (requires pgvector)
psql -f 20260328_knowledge_graph.sql        # Core KG + semantic search
psql -f 20260331_knowledge_graph_ontology.sql  # Ontology + seed data

# Payments & roles
psql -f 20260331_payments_system.sql      # Payments, subscriptions, roles

# Translations
psql -f 20260331_auto_translation.sql      # Multi-language support

# AI & learning
psql -f 20260331_user_preferences_learning.sql  # AI personalization

# Admin setup (run after at least one user signs up)
psql -f 20260331_add_admin_user.sql       # Assign admin role
```

### Important Notes

1. **Idempotency**: All migrations use `IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, and `ON CONFLICT DO NOTHING` patterns, making them safe to re-run.

2. **pgvector Extension**: Migration `20260328_knowledge_graph.sql` includes `CREATE EXTENSION IF NOT EXISTS vector;`. This requires the `vector` extension to be available in your Supabase project (enabled by default in modern Supabase projects).

3. **Auth Trigger Conflict**: Both `003_profiles.sql` and `20260331_payments_system.sql` define a trigger `on_auth_user_created` on `auth.users`. The last migration to run will overwrite the previous trigger. To ensure both behaviors work:
   - The profiles version creates a `profiles` row
   - The payments version creates a `user_roles` row
   - Consider merging both into a single trigger if you need both behaviors active simultaneously.

4. **Admin Setup**: The `20260331_add_admin_user.sql` migration should only be run **after** the target user (`alik2191@gmail.com`) has signed up and exists in `auth.users`.

5. **Seed Data**: Migrations `001_locations.sql` and `002_seed_venues.sql` insert 16 total venues (4 + 12) across Krakow and Warsaw. `20260328_knowledge_graph.sql` also migrates cuisines, vibes, and tags from existing location data. `20260331_knowledge_graph_ontology.sql` seeds 10 cuisines, 10 vibes, and 8 dietary restrictions.

6. **RLS on Knowledge Graph**: Knowledge graph tables have public read access but no write policies configured. Admin write access is commented out for future implementation. Consider adding write policies before production use.

7. **Tables Without RLS**: Several AI/learning tables (`user_preferences`, `chat_sessions`, `chat_messages`, `contributors`, `user_submissions`, `ai_agent_configs`) have no RLS enabled. These should be accessed only through server-side API routes, not directly from the client.

### Verifying Migration Success

After running all migrations, verify the schema:

```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check RLS is enabled on expected tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check all functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Verify seed data
SELECT COUNT(*) AS location_count FROM locations;          -- Should be 16
SELECT COUNT(*) AS cuisine_count FROM cuisines;            -- Should be 10+ (from migration)
SELECT COUNT(*) AS vibe_count FROM vibes;                  -- Should be 10+ (from migration)

-- Verify leaderboard function works
SELECT * FROM get_leaderboard() LIMIT 5;

-- Verify admin stats
SELECT get_location_stats();
SELECT get_user_stats();
SELECT get_engagement_stats();
SELECT get_payment_stats();
```

---

> **Last Updated**: 2026-04-03
> **Database**: PostgreSQL 15+ (Supabase)
> **Extensions**: `vector` (pgvector for 768-dimensional embeddings)
