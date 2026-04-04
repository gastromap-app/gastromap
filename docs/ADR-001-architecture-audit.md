# ADR-001: GastroMap Architecture Audit & Decisions

**Status:** Accepted
**Date:** 2026-04-04
**Deciders:** Vitalii (Owner), Claude (Product Owner / Architect)

---

## Context

Full architecture audit of GastroMap v2 PWA prior to production hardening. The app is a React 18 + Vite 7 + Supabase + TanStack Query stack following Feature-Sliced Design (FSD). The audit covers frontend layers, backend schema, PWA config, data flow, and state management.

---

## Issues Found & Decisions Made

### 🔴 CRITICAL — Fixed

#### 1. Migration 006: Wrong Status String in `get_location_stats()`
**Problem:** `get_location_stats()` queried `status = 'published'` but the `locations` schema defines `status DEFAULT 'active'`. Admin dashboard always showed 0 published locations.
**Fix:** Changed to `status = 'active'` in `supabase/migrations/006_admin_stats_helpers.sql`.

#### 2. Admin Stat Hooks Made 4x Redundant Network Calls
**Problem:** `useCategoryStats`, `useTopLocations`, `useEngagementStats`, `usePaymentStats` each called `getAdminStats()` with different `queryKey`s — 4 separate API requests for the same data.
**Fix:** Unified all 4 hooks to use `queryKey: ['admin-stats']` (same as `useAdminStats`). TanStack Query deduplicates — ONE request, 4 consumers, each using the `select` option to derive their slice.

#### 3. PWA Manifest: Combined `'any maskable'` Purpose (Deprecated)
**Problem:** Single icon entry with `purpose: 'any maskable'` fails Lighthouse PWA audit. The W3C spec requires separate entries.
**Fix:** Split into two entries — `purpose: 'any'` and `purpose: 'maskable'` — in `vite.config.js`.

#### 4. Workbox Missing Supabase & Map Tile Caching
**Problem:** Service Worker had no runtime caching rules for Supabase REST API or CartoDB map tiles. The PWA was effectively non-functional offline — every API call failed.
**Fix:** Added 4 new Workbox rules:
- `*.supabase.co/rest/*` → **NetworkFirst** (5s timeout, 24h offline fallback)
- `*.supabase.co/storage/*` → **CacheFirst** (30 days — location images)
- `*.cartocdn.com/*` → **CacheFirst** (7 days — map tiles)

#### 5. Admin Bundle: Only 2 of 10 Admin Pages in Chunk
**Problem:** `manualChunks.admin` only listed `AdminLayout` and `AdminDashboardPage`. The other 8 pages were lazy-loaded but each ended up in their own micro-chunk, creating 8+ tiny network requests on admin navigation.
**Fix:** All 13 admin files now grouped in one `'admin'` chunk, loaded once per admin session.

#### 6. Artifact File `locations.api.backup.js` in Production Source
**Problem:** A backup file was committed and included in the build, adding dead code to the bundle.
**Fix:** Replaced with a tombstone stub with a clear `// DELETED` comment. Run `git rm src/shared/api/locations.api.backup.js` on next commit.

---

### 🟡 ARCHITECTURE — Fixed

#### 7. FSD Violation: `src/store/` Is Not a Valid FSD Layer
**Problem:** `useAppConfigStore` and `useNotificationStore` lived in `src/store/` — not a valid FSD layer. Shared state should be in `src/shared/`.
**Fix:** Copied stores to `src/shared/store/`. Original `src/store/` files converted to re-export stubs (`@deprecated`) for backward compat. Migrate imports gradually.

```
Before: import { useAppConfigStore } from '@/store/useAppConfigStore'
After:  import { useAppConfigStore } from '@/shared/store/useAppConfigStore'
```

#### 8. FSD Violation: `src/features/shared/` Is Not a Valid FSD Layer
**Problem:** `GastroAIChat`, `LanguageSelector`, `PaymentStub` components and `useAIChatStore` lived in `features/shared/` — "features" layer must not contain cross-feature shared code.
**Fix:** Moved to `src/shared/components/` and `src/shared/hooks/`. Old paths converted to re-export stubs.

```
Before: '@/features/shared/hooks/useAIChatStore'
After:  '@/shared/hooks/useAIChatStore'
```

---

### 🟠 TECH DEBT — Documented, Deferred

#### 9. Dual Data Source Conflict: Zustand (`useLocationsStore`) vs React Query (`useLocations`)
**Problem:** Two competing systems exist for location data:
- `useLocationsStore` (Zustand) — holds all locations in memory, populated on app mount via `initialize()`. Used by Explore page, Map, AI, filters.
- `useLocations()` (React Query) — server-state cache used by Admin panel.

These are intentionally separate (different use-cases: reactive filter state vs server data), but the design is fragile. `useLocationsStore` initializes with `MOCK_LOCATIONS` so users briefly see mock data on cold start.

**Decision:** Keep dual system for now. Track in tech debt.
**Improvement path:** Replace `useLocationsStore` initialization with a React Query-to-Zustand bridge, or use `useInfiniteLocations()` directly in the Explore page and eliminate the Zustand store for data caching entirely.

#### 10. Favorites: Zustand (Offline) vs Supabase (Server) Are Never Synced
**Problem:** `useFavoritesStore` (Zustand + localStorage) and `useUserFavorites` (React Query + Supabase `user_favorites` table) are completely independent. A user's saved items on one device don't appear on another.
**Decision:** The offline-first Zustand store is intentional for unauthenticated users. For authenticated users, the `useOfflineSync` hook has a `TODO` to flush to Supabase on reconnect — this must be implemented.
**Required fix:** When `initAuth()` succeeds, call `useUserFavorites(userId)` and merge server favorites into `useFavoritesStore`.

#### 11. AI API Key Exposed in Client Bundle
**Problem:** `VITE_OPENROUTER_API_KEY` is embedded in the Vite bundle and visible in devtools. The `ai.api.js` itself warns: *"For production, proxy all AI calls through a server-side edge function."*
**Decision:** Acceptable for MVP (using free-tier models with no billing risk). Must be fixed before any paid model usage.
**Required fix:** Create a Supabase Edge Function at `/functions/v1/ai-chat` that holds the key server-side. Set `config.ai.proxyUrl` to that endpoint. The `useProxy` getter in `env.js` already handles this — only the edge function needs to be written.

#### 12. `src/hooks/useLocationsQuery.js` Fetches from OpenStreetMap (Conflicts with Supabase)
**Problem:** `useLocationsQuery` fetches from Nominatim + Overpass API and overwrites `useLocationsStore` — competing with the `initialize()` call that loads from Supabase. Two different sources will fight for the same store state.
**Decision:** `useLocationsQuery` appears to be unused (not imported anywhere critical). Evaluate removal. If OSM data is needed (e.g. for initial city seeding), it should write to its own isolated query cache, not to `useLocationsStore`.

#### 13. `src/hooks/` — Root-Level Hooks Outside FSD
**Problem:** Hooks in `src/hooks/` (`useDebounce`, `useGeolocation`, `usePWA`, `useTheme`, etc.) are valid shared utilities but live outside the FSD layer structure.
**Decision:** These are utility hooks with no FSD domain — acceptable at root level. Can be migrated to `src/shared/hooks/` during cleanup.

---

## Architecture Diagram (Current State)

```
┌─────────────────────────────────────────────────────────┐
│  Browser / PWA (React 18, Vite 7)                        │
│                                                          │
│  app/         → AppProviders → AppRouter                 │
│  features/    → admin/ | auth/ | dashboard/ | public/   │
│  shared/      → api/ | config/ | store/ | hooks/ (NEW)  │
│  components/  → layout/ | ui/ | pwa/ | guards/          │
│  hooks/       → utility hooks (debounce, geo, PWA…)     │
└────────────────────────┬────────────────────────────────┘
                         │  Supabase JS Client
┌────────────────────────▼────────────────────────────────┐
│  Supabase (PostgreSQL + Auth + Storage + RLS)            │
│                                                          │
│  Tables:   locations, profiles, user_favorites,          │
│            user_visits, reviews, payments,               │
│            subscriptions, knowledge_graph ontology       │
│  Functions: get_location_stats(), get_engagement_stats() │
│             get_my_role(), handle_new_user()             │
│  RLS:      Public reads active; users own data;          │
│            admin reads all via SECURITY DEFINER          │
└─────────────────────────────────────────────────────────┘
                         │  OpenRouter API
┌────────────────────────▼────────────────────────────────┐
│  AI Layer (GastroGuide)                                  │
│                                                          │
│  Model cascade: 8 free LLMs with automatic fallback     │
│  Tool use: search_locations, get_location_details        │
│  Streaming: SSE token delivery via analyzeQueryStream()  │
│  ⚠️  Key in client bundle — proxy edge fn needed in prod │
└─────────────────────────────────────────────────────────┘
```

---

## State Management Decision

| Data Type         | Layer           | Rationale                              |
|------------------|-----------------|---------------------------------------|
| Auth / Session    | Zustand+persist | Survives refresh, syncs across tabs   |
| Server data       | React Query     | Caching, dedup, background refetch    |
| Filter/UI state   | Zustand         | Instant, no network overhead          |
| AI chat history   | Zustand+persist | Survives navigation within session    |
| User preferences  | Zustand+persist | Survives logout, used offline         |
| App config        | Zustand+persist | Admin-configurable at runtime         |

---

## Action Items

- [ ] `git rm src/shared/api/locations.api.backup.js` — remove artifact
- [ ] Migrate all `@/store/` imports → `@/shared/store/`
- [ ] Migrate all `@/features/shared/` imports → `@/shared/`
- [ ] Implement favorites sync: on `initAuth()` success → merge Supabase favorites into `useFavoritesStore`
- [ ] Create Supabase Edge Function `ai-chat` to proxy OpenRouter key out of bundle
- [ ] Evaluate `src/hooks/useLocationsQuery.js` — likely dead code (OSM approach abandoned in favor of Supabase)
- [ ] Apply migration 006 fix to production Supabase project
- [ ] Run Lighthouse PWA audit after vite.config.js changes to verify score improvement
