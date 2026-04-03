# GastroMap API Reference

> Comprehensive API documentation for GastroMap — a gastronomy discovery app with AI-powered recommendations, user engagement features, and admin moderation.

**Base Architecture:** All client-side API functions use Supabase when configured (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`), with automatic mock data fallbacks for offline development. React Query hooks are the only supported way for components to fetch data.

---

## Table of Contents

- [Shared Utilities](#shared-utilities)
- [Locations API](#locations-api)
- [Auth API](#auth-api)
- [AI / GastroIntelligence API](#ai--gastrointelligence-api)
- [Admin API](#admin-api)
- [Favorites API](#favorites-api)
- [Visits API](#visits-api)
- [Reviews API](#reviews-api)
- [Leaderboard API](#leaderboard-api)
- [Preferences API](#preferences-api)
- [Translation API](#translation-api)
- [React Query Hooks](#react-query-hooks)
- [Serverless Functions](#serverless-functions)
- [Mock Data Fallbacks](#mock-data-fallbacks)

---

## Shared Utilities

**File:** `src/shared/api/client.js`

### `supabase`

The Supabase client instance. `null` when environment variables are not configured.

```js
import { supabase } from '@/shared/api/client'
// supabase is null when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set
```

### `ApiError`

Generic error class carrying HTTP status for consistent error handling in React Query `onError` callbacks.

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable error message |
| `status` | `number` | HTTP status code (default: 500) |
| `code` | `string` | Machine-readable error code |

```js
import { ApiError } from '@/shared/api/client'

throw new ApiError('Invalid API key', 401, 'AUTH_ERROR')
```

**Error Codes Used Across the API:**

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `WEAK_PASSWORD` | 400 | Password below minimum length |
| `AUTH_ERROR` | 401 | Authentication failure (invalid credentials or API key) |
| `EMPTY_MESSAGE` | 400 | AI query message is empty |
| `UPDATE_ERROR` | 400 | Profile update failed |
| `UNKNOWN_ERROR` | 500 | Unspecified server error |

### `simulateDelay(ms)`

Simulates network latency in development mode. No-op in production.

```js
await simulateDelay(400) // waits 400ms only when config.app.isDev === true
```

---

## Locations API

**File:** `src/shared/api/locations.api.js`

### `getLocations(filters)`

Fetch a paginated, filtered list of active locations.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `filters.category` | `string` | - | Category filter (e.g., `"Restaurant"`, `"Cafe"`) |
| `filters.query` | `string` | - | Full-text search via Supabase `fts` column |
| `filters.priceLevel` | `string[]` | - | Price levels: `["$"]`, `["$$"]`, `["$$$"]`, `["$$$$"]` |
| `filters.minRating` | `number` | - | Minimum rating threshold (1-5) |
| `filters.vibe` | `string[]` | - | Array of vibes (overlaps match) |
| `filters.city` | `string` | - | Case-insensitive city filter |
| `filters.country` | `string` | - | Case-insensitive country filter |
| `filters.limit` | `number` | `100` | Max results per page |
| `filters.offset` | `number` | `0` | Pagination offset |

**Returns:** `Promise<{ data: Location[], total: number, hasMore: boolean }>`

```js
const result = await getLocations({
  category: 'Restaurant',
  city: 'Krakow',
  minRating: 4.0,
  priceLevel: ['$$', '$$$'],
  vibe: ['Romantic'],
  limit: 20,
  offset: 0,
})
```

### `getLocation(id)`

Fetch a single location by ID. Returns `null` if not found.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Location UUID |

**Returns:** `Promise<Location | null>`

```js
const location = await getLocation('1')
```

### `createLocation(data, enableTranslation?)`

Create a new location. Automatically translates to all supported languages when AI is configured.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | `Object` | — | Location data (see Location shape below) |
| `enableTranslation` | `boolean` | `AUTO_TRANSLATE` | Enable auto-translation |

**Returns:** `Promise<Location>`

```js
const location = await createLocation({
  title: 'New Restaurant',
  description: 'A great place to eat',
  address: 'Main Street 1',
  city: 'Krakow',
  country: 'Poland',
  lat: 50.0619,
  lng: 19.9368,
  category: 'Restaurant',
  priceLevel: '$$',
})
```

### `updateLocation(id, updates, enableTranslation?)`

Update an existing location. Auto-translates if translatable fields change.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `id` | `string` | — | Location UUID |
| `updates` | `Object` | — | Partial fields to update |
| `enableTranslation` | `boolean` | `AUTO_TRANSLATE` | Enable auto-translation |

**Returns:** `Promise<Location>`

```js
const updated = await updateLocation('1', {
  title: 'Updated Title',
  rating: 4.9,
})
```

**Translatable Fields** (trigger auto-translation when changed):
- `title`, `description`, `address`, `insider_tip`, `what_to_try`, `ai_context`

### `deleteLocation(id)`

Permanently delete a location.

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Location UUID |

**Returns:** `Promise<void>`

```js
await deleteLocation('1')
```

### `getLocationTranslated(id, lang?)`

Get a location with translated fields for a specific language.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `id` | `string` | — | Location UUID |
| `lang` | `string` | `'en'` | Language code: `en`, `pl`, `uk`, `ru` |

**Returns:** `Promise<Location & { isTranslated?: boolean, translatedTo?: string } | null>`

```js
const plLocation = await getLocationTranslated('1', 'pl')
```

### `getCategories()`

Fetch distinct category names for filter dropdowns.

**Returns:** `Promise<string[]>` — e.g., `['All', 'Bar', 'Cafe', 'Fine Dining', 'Food Hall', 'Restaurant', 'Street Food']`

### `getLocationsNearby(coords, radiusKm?)`

Find locations within a radius using the Haversine formula (client-side filtering).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `coords` | `{ lat: number, lng: number }` | — | Center coordinates |
| `radiusKm` | `number` | `2` | Radius in kilometers |

**Returns:** `Promise<{ data: Location[], total: number, hasMore: boolean }>`

```js
const nearby = await getLocationsNearby({ lat: 50.0619, lng: 19.9368 }, 5)
```

### `getLocationById`

Alias for `getLocation`. Used by `useLocation(id)` hook.

### Location Shape

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `title` | `string` | Location name |
| `description` | `string` | Short description |
| `address` | `string` | Full address |
| `city` | `string` | City name |
| `country` | `string` | Country name |
| `coordinates` | `{ lat: number, lng: number }` | GPS coordinates |
| `category` | `string` | Category (Restaurant, Cafe, Bar, etc.) |
| `cuisine` | `string` | Cuisine type |
| `image` | `string` | Cover image URL |
| `photos` | `string[]` | Additional photo URLs |
| `rating` | `number` | Average rating (0-5) |
| `priceLevel` | `string` | Price: `$`, `$$`, `$$$`, `$$$$` |
| `openingHours` | `string` | Hours string |
| `tags` | `string[]` | Display tags |
| `special_labels` | `string[]` | Special labels |
| `vibe` | `string[]` | Atmosphere vibes |
| `features` | `string[]` | Available features |
| `best_for` | `string[]` | Occasion suitability |
| `dietary` | `string[]` | Dietary options |
| `has_wifi` | `boolean` | Has WiFi |
| `has_outdoor_seating` | `boolean` | Has outdoor seating |
| `reservations_required` | `boolean` | Reservations needed |
| `michelin_stars` | `number` | Michelin star count |
| `michelin_bib` | `boolean` | Michelin Bib Gourmand |
| `insider_tip` | `string` | Expert insider tip |
| `what_to_try` | `string[]` | Recommended dishes |
| `ai_keywords` | `string[]` | Hidden keywords for AI search |
| `ai_context` | `string` | Hidden AI context description |
| `status` | `string` | `active`, `pending`, `rejected` |
| `createdAt` | `string` | ISO timestamp |
| `updatedAt` | `string` | ISO timestamp |

---

## Auth API

**File:** `src/shared/api/auth.api.js`

### `signIn(email, password)`

Sign in with email and password.

| Parameter | Type | Description |
|-----------|------|-------------|
| `email` | `string` | User email |
| `password` | `string` | User password |

**Returns:** `Promise<{ user: User, token: string }>`

```js
const { user, token } = await signIn('user@example.com', 'password123')
```

### `signUp(email, password, name?)`

Register a new account. May require email confirmation depending on Supabase settings.

| Parameter | Type | Description |
|-----------|------|-------------|
| `email` | `string` | User email |
| `password` | `string` | Min 6 characters |
| `name` | `string` | Display name (optional) |

**Returns:** `Promise<{ user: User, token: string } | { emailConfirmation: true }>`

```js
const result = await signUp('new@example.com', 'password123', 'John Doe')
if (result.emailConfirmation) {
  // Check email for confirmation link
}
```

### `signOut()`

Sign out the current session.

**Returns:** `Promise<void>`

```js
await signOut()
```

### `updateProfile(userId, updates)`

Update user profile fields (name, avatar).

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | `string` | User ID |
| `updates.name` | `string` | Display name |
| `updates.avatar` | `string` | Avatar URL |

**Returns:** `Promise<{ id: string, name: string, avatar: string, role: string }>`

```js
const profile = await updateProfile('user_123', {
  name: 'New Name',
  avatar: 'https://example.com/avatar.jpg',
})
```

### `subscribeToAuthChanges(onSession, onSignOut)`

Set up a real-time listener for auth state changes. Called once in `App.jsx` on mount.

| Parameter | Type | Description |
|-----------|------|-------------|
| `onSession` | `(session: { user: User, token: string }) => void` | Called on sign-in |
| `onSignOut` | `() => void` | Called on sign-out |

**Returns:** `() => void` — Unsubscribe function

```js
const unsubscribe = subscribeToAuthChanges(
  ({ user, token }) => setUser(user),
  () => setUser(null)
)
// Later: unsubscribe()
```

### User Shape

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | User UUID |
| `name` | `string` | Display name |
| `email` | `string` | Email address |
| `role` | `string` | `user` or `admin` |
| `avatar` | `string | null` | Avatar URL |
| `createdAt` | `string` | ISO timestamp |

**Admin Detection:** Users with emails in `ADMIN_EMAILS` list (`admin@gastromap.com`, `alik2191@gmail.com`) get `admin` role by default if no DB profile exists yet.

---

## AI / GastroIntelligence API

**File:** `src/shared/api/ai.api.js`

### `analyzeQuery(message, context?)`

Analyze a user query and return a GastroGuide response. Uses OpenRouter with tool-use (function calling) when API key is configured, falls back to local scoring engine otherwise.

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | `string` | User's natural language query |
| `context.preferences` | `Object` | User preferences for personalization |
| `context.preferences.favoriteCuisines` | `string[]` | Preferred cuisines |
| `context.preferences.vibePreference` | `string[]` | Preferred vibes |
| `context.preferences.priceRange` | `string[]` | Budget range |
| `context.preferences.dietaryRestrictions` | `string[]` | Dietary restrictions |
| `context.history` | `Array<{ role: string, content: string }>` | Recent chat history (last 8 messages) |

**Returns:** `Promise<AIResponse>`

```js
const response = await analyzeQuery('Where can I find a romantic dinner in Krakow?', {
  preferences: {
    favoriteCuisines: ['Italian', 'Polish'],
    priceRange: ['$$', '$$$'],
  },
  history: [
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi! How can I help you discover great places?' },
  ],
})
```

### `analyzeQueryStream(message, context?, onChunk)`

Streaming variant with simulated word-by-word typing effect.

| Parameter | Type | Description |
|-----------|------|-------------|
| `message` | `string` | User query |
| `context` | `Object` | Same as `analyzeQuery` |
| `onChunk` | `(chunk: string) => void` | Callback for each word chunk |

**Returns:** `Promise<AIResponse>`

```js
let displayText = ''
const response = await analyzeQueryStream(
  'Best cafe for working remotely?',
  {},
  (chunk) => {
    displayText += chunk
    updateUI(displayText)
  }
)
```

### AIResponse Shape

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | Text response to display |
| `matches` | `Location[]` | Matched locations for UI cards (up to 3) |
| `intent` | `'recommendation' | 'info' | 'general'` | Detected user intent |

### Model Cascade (Proxy Mode)

When using the Vercel serverless proxy, models cascade in this order:

| Priority | Model | Description |
|----------|-------|-------------|
| 1 | `meta-llama/llama-3.3-70b-instruct:free` | Best quality, 131K ctx |
| 2 | `qwen/qwen3-coder:free` | Strong reasoning, 262K ctx |
| 3 | `z-ai/glm-4.5-air:free` | Fast & capable |
| 4 | `minimax/minimax-m2.5:free` | Productive |
| 5 | `google/gemma-3-27b-it:free` | Google quality |
| 6 | `google/gemma-3-12b-it:free` | Balanced |
| 7 | `openai/gpt-oss-20b:free` | Apache 2.0 |
| 8 | `nvidia/nemotron-nano-9b-v2:free` | Fastest |

### Tool Definitions

The AI has access to two tools:

#### `search_locations`

Search gastro locations by filters. The model decides which filters to apply.

| Argument | Type | Description |
|----------|------|-------------|
| `city` | `string` | City name |
| `cuisine` | `string[]` | Cuisine types |
| `vibe` | `string[]` | Atmosphere vibes |
| `price_level` | `string[]` | Price levels |
| `category` | `string` | Category |
| `features` | `string[]` | Features (outdoor seating, wifi, etc.) |
| `best_for` | `string[]` | Occasions |
| `dietary` | `string[]` | Dietary needs |
| `min_rating` | `number` | Minimum rating (1-5) |
| `keyword` | `string` | Free-text search across all fields |
| `michelin` | `boolean` | Filter Michelin-recognized only |
| `limit` | `integer` | Max results (default: 5) |

#### `get_location_details`

Get full details for a specific location.

| Argument | Type | Description |
|----------|------|-------------|
| `location_id` | `string` | Required. The location ID |

### Active AI Configuration

```js
// Admin store overrides env vars at runtime
const config = getActiveAIConfig()
// { apiKey, model, fallbackModel }
```

Environment variables:
- `VITE_OPENROUTER_API_KEY` — OpenRouter API key (client-side, for dev)
- `VITE_OPENROUTER_MODEL` — Primary model override
- `VITE_OPENROUTER_MODEL_FALLBACK` — Fallback model

---

## Admin API

**File:** `src/shared/api/admin.api.js`

### `getAdminStats()`

Fetch comprehensive admin dashboard statistics.

**Returns:** `Promise<{ locations, users, engagement, payments }>`

```js
const stats = await getAdminStats()
// {
//   locations: { total, published, pending, rejected },
//   users: { total, this_month, this_week },
//   engagement: { total_visits, total_reviews, total_favorites, pending_reviews },
//   payments: { total_payments, total_revenue, active_subscriptions, this_month_revenue }
// }
```

Uses Supabase RPC functions: `get_location_stats`, `get_user_stats`, `get_engagement_stats`, `get_payment_stats`.

### `getRecentLocations(limit?)`

Fetch most recently created locations.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | `5` | Number of results |

**Returns:** `Promise<Array<{ id, title, category, city, created_at }>>`

### `getRecentActivity(limit?)`

Fetch recent user visits with location names.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | `10` | Number of results |

**Returns:** `Promise<Array<{ id, user_id, location_id, visited_at, locations: { title } }>>`

### `getProfiles()`

Fetch all user profiles.

**Returns:** `Promise<Array<{ id, email, name, role, avatar_url, created_at }>>`

### `updateProfileRole(userId, role)`

Change a user's role.

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | `string` | User ID |
| `role` | `string` | New role (`user`, `admin`) |

**Returns:** `Promise<{ data, error }>`

### `getPendingReviews()`

Fetch reviews awaiting moderation.

**Returns:** `Promise<Array<Review & { profiles: { name }, locations: { title } }>>`

### `updateReviewStatus(reviewId, status, comment?)`

Approve or reject a review.

| Parameter | Type | Description |
|-----------|------|-------------|
| `reviewId` | `string` | Review ID |
| `status` | `string` | `published` or `rejected` |
| `comment` | `string` | Admin comment (optional) |

**Returns:** `Promise<{ data, error }>`

### `getPendingLocations()`

Fetch locations awaiting approval.

**Returns:** `Promise<Array<{ id, title, category, city, created_at }>>`

---

## Favorites API

**File:** `src/shared/api/favorites.api.js`

### `getUserFavorites(userId)`

Get user's favorited location IDs.

**Returns:** `Promise<Array<{ location_id, created_at }>>`

### `getUserFavoritesWithLocations(userId)`

Get user's favorites with full location data (joined query).

**Returns:** `Promise<Array<{ location_id, created_at, locations: Location }>>`

### `addFavorite(userId, locationId)`

Add a location to user's favorites.

**Returns:** `Promise<{ data, error }>`

### `removeFavorite(userId, locationId)`

Remove a location from user's favorites.

**Returns:** `Promise<{ error }>`

### `isFavorite(userId, locationId)`

Check if a location is favorited by the user.

**Returns:** `Promise<boolean>`

```js
const favorited = await isFavorite('user_123', 'location_456')
```

---

## Visits API

**File:** `src/shared/api/visits.api.js`

### `getUserVisits(userId)`

Get all user visits.

**Returns:** `Promise<Array<UserVisit>>`

### `getUserVisitsWithLocations(userId)`

Get user visits with joined location data.

**Returns:** `Promise<Array<UserVisit & { locations: { title, image, category, rating, city } }>>`

### `addVisit(userId, locationId, rating, reviewText)`

Log a visit. Uses upsert (updates if visit already exists).

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | `string` | User ID |
| `locationId` | `string` | Location ID |
| `rating` | `number` | Rating (1-5) |
| `reviewText` | `string` | Review text |

**Returns:** `Promise<{ data, error }>`

### `updateVisit(visitId, updates)`

Update an existing visit.

**Returns:** `Promise<{ data, error }>`

### `deleteVisit(visitId)`

Delete a visit.

**Returns:** `Promise<{ error }>`

### `hasVisited(userId, locationId)`

Check if user has visited a location.

**Returns:** `Promise<boolean>`

---

## Reviews API

**File:** `src/shared/api/reviews.api.js`

### `getLocationReviews(locationId)`

Get published reviews for a location (with user profiles).

**Returns:** `Promise<Array<Review & { profiles: { name, avatar_url } }>>`

### `getUserReviews(userId)`

Get all reviews by a user (with location titles).

**Returns:** `Promise<Array<Review & { locations: { title } }>>`

### `createReview(userId, locationId, rating, reviewText)`

Create a new review. Status is set to `pending` for moderation.

**Returns:** `Promise<{ data, error }>`

### `updateReview(reviewId, updates)`

Update an existing review.

**Returns:** `Promise<{ data, error }>`

### `deleteReview(reviewId)`

Delete a review.

**Returns:** `Promise<{ error }>`

### Review Shape

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Review ID |
| `user_id` | `string` | Author user ID |
| `location_id` | `string` | Location ID |
| `rating` | `number` | Rating (1-5) |
| `review_text` | `string` | Review content |
| `status` | `string` | `pending`, `published`, `rejected` |
| `created_at` | `string` | ISO timestamp |
| `updated_at` | `string` | ISO timestamp |

---

## Leaderboard API

**File:** `src/shared/api/leaderboard.api.js`

### `getLeaderboard(limit?)`

Fetch the global leaderboard via Supabase RPC `get_leaderboard`.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | `50` | Number of entries |

**Returns:** `Promise<Array<{ user_id, total_points, ... }>>`

```js
const leaderboard = await getLeaderboard(20)
```

### `getUserRank(userId)`

Get a specific user's rank and points.

**Returns:** `Promise<{ rank: number, points: number }>`

```js
const { rank, points } = await getUserRank('user_123')
// { rank: 5, points: 340 }
```

---

## Preferences API

**File:** `src/shared/api/preferences.api.js`

### `getUserPreferences(userId)`

Get user preferences stored in the `profiles.preferences` JSON column.

**Returns:** `Promise<Object>`

```js
const prefs = await getUserPreferences('user_123')
// { favoriteCuisines: ['Italian'], vibePreference: ['Romantic'], ... }
```

### `updateUserPreferences(userId, preferences)`

Update user preferences.

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | `string` | User ID |
| `preferences` | `Object` | Preferences object |

**Returns:** `Promise<{ data, error }>`

```js
await updateUserPreferences('user_123', {
  favoriteCuisines: ['Italian', 'Polish'],
  vibePreference: ['Romantic', 'Cozy'],
  priceRange: ['$$', '$$$'],
  dietaryRestrictions: ['vegetarian'],
})
```

---

## Translation API

**File:** `src/shared/api/translation.api.js`

### `translateText(text, targetLang)`

Translate a single string using AI.

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text to translate |
| `targetLang` | `string` | Target language code |

**Returns:** `Promise<string>`

### `translateArray(texts, targetLang)`

Translate an array of strings in parallel.

**Returns:** `Promise<string[]>`

### `translateLocation(locationData, targetLang, sourceLang?)`

Translate all translatable fields of a location.

**Returns:** `Promise<Location>`

### `autoTranslateAll(locationData, sourceLang?)`

Translate a location to all supported languages.

**Returns:** `Promise<Location & { translations: Object }>`

### `saveTranslations(locationId, translations)`

Save translations to `location_translations` table.

### `getTranslations(locationId)`

Fetch translations for a location.

**Returns:** `Promise<{ [langCode]: { title, description, address, insider_tip, what_to_try, ai_context, translated_at } } | null>`

### `batchTranslate(locations, targetLang)`

Translate multiple locations to a single language in parallel.

### `detectLanguage(text)`

Heuristic language detection using Unicode character ranges.

**Returns:** `string` — Detected language code (`en`, `pl`, `uk`, `ru`)

### Supported Languages

| Code | Language | Label |
|------|----------|-------|
| `en` | English | EN |
| `pl` | Polish | PL |
| `uk` | Ukrainian | UK |
| `ru` | Russian | RU |

### Translatable Fields

`title`, `description`, `address`, `insider_tip`, `what_to_try`, `ai_context`

---

## React Query Hooks

**File:** `src/shared/api/queries.js`

All hooks use `@tanstack/react-query`. Components should **only** use these hooks — never call API functions directly.

### Query Keys

Centralized query keys for cache invalidation:

```js
import { queryKeys } from '@/shared/api/queries'

// Usage examples:
queryKeys.locations.all                          // ['locations']
queryKeys.locations.filtered(filters)            // ['locations', 'filtered', filters]
queryKeys.locations.detail(id)                   // ['locations', 'detail', id]
queryKeys.locations.nearby(coords)               // ['locations', 'nearby', coords]
queryKeys.categories                             // ['categories']
queryKeys.ai.query(message)                      // ['ai', 'query', message]
```

### Location Hooks

#### `useLocations(filters)`

Fetch filtered locations list.

```js
const { data, isLoading, error } = useLocations({
  category: 'Restaurant',
  city: 'Krakow',
  minRating: 4.0,
})
// data: { data: Location[], total: number, hasMore: boolean }
```

#### `useInfiniteLocations(filters)`

Infinite scroll / pagination variant.

```js
const {
  data,           // { pages: [{ data, total, hasMore }], pageParams }
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteLocations({ category: 'Cafe' })
```

#### `useLocation(id)`

Fetch a single location. Disabled when `id` is null/undefined.

```js
const { data: location, isLoading } = useLocation('1')
```

#### `useCategories()`

Fetch category list. Cached indefinitely (`staleTime: Infinity`).

```js
const { data: categories } = useCategories()
// ['All', 'Bar', 'Cafe', 'Fine Dining', ...]
```

#### `useLocationsNearby(coords, radiusKm?)`

Fetch nearby locations. Disabled when coords are invalid.

```js
const { data } = useLocationsNearby({ lat: 50.0619, lng: 19.9368 }, 5)
```

### Location Mutations

#### `useCreateLocationMutation()`

```js
const mutation = useCreateLocationMutation()
mutation.mutate({ title: 'New Place', city: 'Krakow', ... })
// Auto-invalidates all location queries on success
```

#### `useUpdateLocationMutation()`

```js
const mutation = useUpdateLocationMutation()
mutation.mutate({ id: '1', updates: { title: 'Updated' } })
```

#### `useDeleteLocationMutation()`

```js
const mutation = useDeleteLocationMutation()
mutation.mutate('1')
```

### AI Hooks

#### `useAIQueryMutation()`

One-shot AI query mutation (intentionally not cached between sessions).

```js
const mutation = useAIQueryMutation()
mutation.mutate({
  message: 'Best cafe for working remotely in Krakow?',
  context: { preferences: myPreferences, history: chatHistory },
})
// Result: { content: string, matches: Location[], intent: string }
```

### Admin Hooks

#### `useAdminStats()`

Dashboard statistics. `staleTime: 60s`.

```js
const { data } = useAdminStats()
// { locations, users, engagement, payments }
```

#### `useRecentLocations(limit?)`

`staleTime: 60s`.

#### `useRecentActivity(limit?)`

`staleTime: 30s`.

#### `useProfiles()`

All user profiles. `staleTime: 60s`.

#### `useUpdateProfileRoleMutation()`

```js
const mutation = useUpdateProfileRoleMutation()
mutation.mutate({ userId: 'user_123', role: 'admin' })
```

#### `usePendingReviews()`

`staleTime: 30s`.

#### `useUpdateReviewStatusMutation()`

```js
const mutation = useUpdateReviewStatusMutation()
mutation.mutate({ reviewId: 'rev_1', status: 'published', comment: 'Looks good!' })
```

#### `usePendingLocations()`

`staleTime: 30s`.

#### `useUpdateLocationStatusMutation()`

```js
const mutation = useUpdateLocationStatusMutation()
mutation.mutate({ id: 'loc_1', status: 'active' })
```

#### `useCategoryStats()`

Derived from `getAdminStats()`. `staleTime: 60s`.

#### `useTopLocations(limit?)`

Derived from `getAdminStats()`. `staleTime: 60s`.

#### `useEngagementStats()`

Derived from `getAdminStats()`. `staleTime: 30s`.

#### `usePaymentStats()`

Derived from `getAdminStats()`. `staleTime: 60s`.

### Favorites Hooks

#### `useUserFavorites(userId)`

Disabled when `userId` is falsy. `staleTime: 60s`.

#### `useUserFavoritesWithLocations(userId)`

Disabled when `userId` is falsy. `staleTime: 60s`.

#### `useAddFavoriteMutation()`

```js
const mutation = useAddFavoriteMutation()
mutation.mutate({ userId: 'user_123', locationId: 'loc_456' })
```

#### `useRemoveFavoriteMutation()`

```js
const mutation = useRemoveFavoriteMutation()
mutation.mutate({ userId: 'user_123', locationId: 'loc_456' })
```

### Visits Hooks

#### `useUserVisits(userId)`

Disabled when `userId` is falsy. `staleTime: 60s`.

#### `useUserVisitsWithLocations(userId)`

Disabled when `userId` is falsy. `staleTime: 60s`.

#### `useAddVisitMutation()`

```js
const mutation = useAddVisitMutation()
mutation.mutate({
  userId: 'user_123',
  locationId: 'loc_456',
  rating: 5,
  reviewText: 'Amazing food!',
})
```

#### `useDeleteVisitMutation()`

```js
const mutation = useDeleteVisitMutation()
mutation.mutate({ visitId: 'visit_789', userId: 'user_123' })
```

### Reviews Hooks

#### `useLocationReviews(locationId)`

`staleTime: 60s`.

#### `useUserReviews(userId)`

Disabled when `userId` is falsy. `staleTime: 60s`.

#### `useCreateReviewMutation()`

```js
const mutation = useCreateReviewMutation()
mutation.mutate({
  userId: 'user_123',
  locationId: 'loc_456',
  rating: 4,
  reviewText: 'Great atmosphere.',
})
```

### Leaderboard Hooks

#### `useLeaderboard(limit?)`

`staleTime: 5 minutes`.

```js
const { data: leaderboard } = useLeaderboard(20)
```

#### `useUserRank(userId)`

Disabled when `userId` is falsy. `staleTime: 60s`.

```js
const { data: { rank, points } } = useUserRank('user_123')
```

### Preferences Hooks

#### `useUserPreferences(userId)`

Disabled when `userId` is falsy. `staleTime: 60s`.

#### `useUpdatePreferencesMutation()`

```js
const mutation = useUpdatePreferencesMutation()
mutation.mutate({
  userId: 'user_123',
  preferences: { favoriteCuisines: ['Italian', 'Polish'] },
})
```

---

## Serverless Functions

### AI Chat Proxy

**File:** `api/ai/chat.js` (Vercel Serverless)

Proxies AI requests to OpenRouter so the API key stays server-side. Implements cascading model rotation for high availability.

**Endpoint:** `POST /api/ai/chat`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | `Array<{ role, content }>` | Yes | Chat messages array |
| `model` | `string` | No | Requested model (cascade starts from here) |
| `max_tokens` | `number` | No | Max response tokens (clamped to 4096) |
| `tools` | `Array` | No | Tool definitions for function calling |
| `tool_choice` | `string` | No | Tool choice strategy (default: `auto`) |

**Response (Success):**

```json
{
  "choices": [{
    "message": { "content": "I recommend...", "tool_calls": [...] },
    "finish_reason": "stop"
  }],
  "_model_used": "meta-llama/llama-3.3-70b-instruct:free"
}
```

**Response (All Models Rate-Limited):**

```json
{
  "error": "All AI models are currently rate-limited. Please try again in a minute.",
  "last_error": "Rate limit exceeded",
  "models_tried": ["meta-llama/llama-3.3-70b-instruct:free", "qwen/qwen3-coder:free", ...]
}
```

**Response (Method Not Allowed):**

```json
{ "error": "Method not allowed" }  // 405 for non-POST
```

**Response (Missing API Key):**

```json
{ "error": "OPENROUTER_API_KEY not configured on server" }  // 500
```

### Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `OPENROUTER_API_KEY` | Server only | OpenRouter API key (no `VITE_` prefix) |

### Cascade Behavior

The proxy iterates through models on these status codes: `429`, `500`, `502`, `503`, `400`, `404`. Other errors (like `401` for invalid API key) return immediately without retrying.

---

## Mock Data Fallbacks

### How It Works

When Supabase is not configured (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not set), every API function falls back to mock data or in-memory operations. This enables:

1. **Offline development** — no database connection needed
2. **Preview/demo mode** — app works without any backend
3. **Graceful degradation** — if Supabase queries fail, mocks are used

### Detection Logic

```js
const USE_SUPABASE = config.supabase.isConfigured
// true when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set
```

### Mock Data Sources

| API Module | Mock Source | Behavior |
|------------|-------------|----------|
| **Locations** | `src/mocks/locations.js` | 16 pre-seeded Krakow/Warsaw locations with full detail |
| **Auth** | In-memory `MOCK_USERS` array | 2 admin users; creates random users for unknown emails |
| **Admin** | Empty mock objects | Returns zero-stats and empty arrays |
| **Favorites** | In-memory (no persistence) | Returns `[]` or `{ error: 'No Supabase' }` |
| **Visits** | In-memory (no persistence) | Returns `[]` or `{ error: 'No Supabase' }` |
| **Reviews** | In-memory (no persistence) | Returns `[]` or `{ error: 'No Supabase' }` |
| **Leaderboard** | Empty array | Returns `[]` or `{ rank: 0, points: 0 }` |
| **Preferences** | Empty object | Returns `{}` or `{ error: 'No Supabase' }` |

### Locations Mock Data

**File:** `src/mocks/locations.js`

Contains **16 locations** across two cities:

| ID | Name | City | Category | Rating |
|----|------|------|----------|--------|
| 1 | Cafe Camelot | Krakow | Cafe | 4.8 |
| 2 | Hamsa Hummus & Happiness | Krakow | Restaurant | 4.6 |
| 3 | Szara Ges | Krakow | Fine Dining | 4.9 |
| 4 | Forum Przestrzenie | Krakow | Bar | 4.5 |
| 5 | Alchemia | Krakow | Bar | 4.5 |
| 6 | Cafe Mleczarnia | Krakow | Cafe | 4.4 |
| 7 | Massolit Books & Cafe | Krakow | Cafe | 4.6 |
| 8 | Pierogi Mr. Vincent | Krakow | Restaurant | 4.6 |
| 9 | Plac Nowy - Zapiekanka Rotunda | Krakow | Street Food | 4.4 |
| 10 | Bunkier Cafe | Krakow | Bar | 4.1 |
| 11 | Hala Koszyki | Warsaw | Food Hall | 4.4 |
| 12 | Bar Bambino | Warsaw | Restaurant | 4.3 |
| 13 | E. Wedel Chocolate Lounge | Warsaw | Cafe | 4.5 |
| 14 | Same Krafty | Warsaw | Bar | 4.4 |
| 15 | Pyzy Flaki Gorace | Warsaw | Restaurant | 4.7 |
| 16 | Nolita Restaurant | Warsaw | Fine Dining | 4.7 |

**Categories:** `['All', 'Cafe', 'Restaurant', 'Bar', 'Fine Dining', 'Street Food', 'Food Hall']`

### Mock CRUD Operations

Locations mock data supports full CRUD in-memory:

| Operation | Behavior |
|-----------|----------|
| **Create** | Adds to `MOCK_LOCATIONS` array with `mock_${Date.now()}` ID |
| **Read** | Filters/reads from `MOCK_LOCATIONS` array |
| **Update** | Modifies entry in `MOCK_LOCATIONS` array |
| **Delete** | Splices from `MOCK_LOCATIONS` array |

> **Note:** Mock CRUD changes are lost on page reload since they exist only in memory.

### Supabase Error Fallback

Even when Supabase **is** configured, individual query failures fall back to mocks:

```js
// locations.api.js
const { data, error, count } = await q
if (error) {
  console.warn('[locations.api] Supabase query failed, using mocks:', error.message)
  return _mockGetLocations(filters)
}
```

This means the app stays functional even during transient Supabase outages.

### Auth Mock Details

```js
// Known admin emails get admin role
signIn('admin@gastromap.com', 'anything')
// -> { user: { role: 'admin', ... }, token: 'mock-admin-jwt' }

// Unknown emails get user role
signIn('random@test.com', 'anything')
// -> { user: { id: 'user_abc123', role: 'user', ... }, token: 'mock-user-jwt' }

// Signup requires email + password (min 6 chars)
signUp('new@test.com', 'short')
// -> throws ApiError('Password must be at least 6 characters', 400, 'WEAK_PASSWORD')
```

### Simulated Latency

Mock operations include artificial delays in development mode to simulate real network conditions:

| Operation | Delay |
|-----------|-------|
| `signIn` | 400ms |
| `signUp` | 500ms |
| `signOut` | 100ms |
| `updateProfile` | 300ms |

Delays are disabled in production (`config.app.isDev === false`).

---

## Architecture Notes

### Data Flow

```
Component
    |
    v
React Query Hook (queries.js)
    |
    v
API Function (*.api.js)
    |
    +-- Supabase configured? --yes--> Supabase Client --> Supabase API
    |
    +-- no (or error) ---------> Mock Data
```

### AI Data Flow

```
User Query
    |
    v
analyzeQuery() / analyzeQueryStream()
    |
    +-- API Key configured? --yes--> OpenRouter (Tool Use)
    |                                    |
    |                                    v
    |                            executeTool() (local)
    |                                    |
    |                                    v
    |                            Zustand Store (useLocationsStore)
    |
    +-- no ---------------------> Local Scoring Engine (gastroIntelligence)
```

### Key Design Principles

1. **Hooks-only access** — Components never call API functions directly
2. **Graceful degradation** — Supabase failures fall back to mocks automatically
3. **Centralized query keys** — All cache invalidation uses `queryKeys` constants
4. **Auto-translation** — Location CRUD triggers AI translation when configured
5. **Model cascade** — AI requests rotate through multiple free models for reliability
6. **Server-side AI proxy** — Production uses Vercel serverless to protect API keys
