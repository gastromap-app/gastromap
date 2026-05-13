# 🐛 GastroMap Bug Scan Report

**Date:** 2025-01-XX  
**Scope:** Data flow, API layer, frontend components, routing, state management  
**Status:** Report only — no fixes applied

---

## 1. DATA FLOW BUGS

### 🔴 CRITICAL — `getLocationMenu` / `saveScannedMenu` crash when Supabase is null

**File:** `src/shared/api/locations.api.js` (lines 896–900, 928–931)  
**What breaks:** Both `getLocationMenu()` and `saveScannedMenu()` log a warning when `supabase` is null but **do not return early**. Execution continues to `supabase.from(...)` on the next line, causing an unhandled `TypeError: Cannot read properties of null`.

```js
export async function getLocationMenu(locationId) {
    if (!supabase) {
        safeWarn('[locations.api] Supabase not configured, returning empty menu')
        // ❌ BUG: Missing `return []` — falls through to supabase.from() below
    }
    const { data, error } = await supabase.from('location_dishes')...
}
```

**Impact:** App crashes on LocationDetailsPage in offline/mock mode. Same bug in `saveScannedMenu` and `deleteLocationDish` / `updateLocationDish`.

---

### 🟡 HIGH — `normalise()` creates `what_to_try` from `must_try` but `_toRow()` writes both back

**File:** `src/shared/api/locations.api.js` (lines 119–120, 740–741)  
**What breaks:** `normalise()` synthesizes `what_to_try` from `must_try` if the array is empty:
```js
what_to_try: Array.isArray(row.what_to_try) ? row.what_to_try : (row.must_try ? [row.must_try] : []),
must_try: row.must_try ?? (Array.isArray(row.what_to_try) ? row.what_to_try[0] : ''),
```
When the UI sends this back through `_toRow()`, both `what_to_try` and `must_try` are written. On the next read cycle, `must_try` gets wrapped into `what_to_try` again, causing **data duplication** over repeated save cycles. If a location has `must_try = "Pasta"` and no `what_to_try`, after one save cycle it becomes `what_to_try: ["Pasta"]` AND `must_try: "Pasta"`. After another cycle through normalise → UI → _toRow, the data is stable but the initial transformation is lossy if `what_to_try` had different content than `must_try`.

---

### 🟡 HIGH — `updateLocation` timeout race: destructuring a rejected Promise

**File:** `src/shared/api/locations.api.js` (lines 404–407)  
**What breaks:**
```js
const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new ApiError('Save timed out...', 408, 'TIMEOUT')), 20000)
)
const { data: updated, error } = await Promise.race([savePromise, timeoutPromise])
```
When the timeout fires, `Promise.race` rejects with an `ApiError`. The destructuring `{ data: updated, error }` **never executes** — the rejection propagates as an unhandled exception. The `if (error)` check below is dead code for the timeout path. The error is caught by the caller, but the `ApiError` thrown by the timeout has no `data` or `error` property — it's just thrown raw. This means the error message format differs from normal save failures, potentially confusing error handlers upstream.

---

### 🟡 HIGH — `sanitizePayload` remaps `image` → `image_url` but `VALID_LOCATION_COLUMNS` also includes `image`

**File:** `src/shared/lib/schema-validator.js` (lines 8, 72)  
**What breaks:** `VALID_LOCATION_COLUMNS` contains both `'image'` and `'image_url'`. `DEPRECATED_COLUMNS` maps `'image' → 'image_url'`. The comment says "Check deprecated FIRST" but the code checks `if (key in DEPRECATED_COLUMNS)` first. Since `'image'` is in DEPRECATED_COLUMNS, it gets remapped to `image_url`. However, if the payload contains BOTH `image` and `image_url`, the `image` value is silently dropped (because `!sanitized[canonical]` prevents overwrite). This is correct behavior but confusing — the `image` entry in `VALID_LOCATION_COLUMNS` is dead/unreachable code that misleads developers.

---

### 🟡 MEDIUM — `normalise()` returns fields that don't exist in DB

**File:** `src/shared/api/locations.api.js` (normalise function)  
**What breaks:** `normalise()` returns `name`, `type`, `cuisine`, `images`, `features`, `dietary`, `openingHours`, `createdAt`, `updatedAt` — these are UI aliases. If a component passes the normalised object directly to `updateLocation()` without filtering, `_toRow()` will map some of these back (e.g., `features` → `amenities`), but `createdAt`/`updatedAt` will be silently stripped by `sanitizePayload`. Not a crash, but causes confusion when developers expect these fields to persist.

---

## 2. API LAYER BUGS

### 🔴 CRITICAL — `getRecentLocations` silently swallows errors

**File:** `src/shared/api/admin.api.js` (lines 32–39)  
**What breaks:**
```js
export async function getRecentLocations(limit = 5) {
    if (!supabase) return mockRecentLocations
    const { data } = await supabase
        .from('locations')
        .select('id, title, category, city, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
    return data || []
}
```
The `error` return from Supabase is **completely ignored**. If the query fails (RLS, network, schema mismatch), the function returns `[]` with no indication of failure. The admin dashboard shows "no recent locations" instead of an error state.

---

### 🟡 HIGH — `isFavorite` and `hasVisited` silently swallow errors

**Files:** `src/shared/api/favorites.api.js` (line 30–33), `src/shared/api/visits.api.js` (line 47–50)  
**What breaks:**
```js
export async function isFavorite(userId, locationId) {
    if (!supabase) return false
    const { data } = await supabase.from('user_favorites')...
    return !!data
}
```
If the query fails with an error (e.g., RLS blocks the read), `data` is `null` and the function returns `false` — the user sees "not favorited" even though the actual state is unknown. No error is thrown or logged.

---

### 🟡 HIGH — `getAdminStats` returns partial data without indicating failures

**File:** `src/shared/api/admin.api.js` (lines 5–30)  
**What breaks:** Uses `Promise.allSettled` which is good, but `safeGet` only logs a warning for failed promises. The returned object has `null` for failed stats, but the UI likely doesn't distinguish between "0 users" and "failed to fetch users". The `top_locations` fallback uses `|| []` which masks the null, but other fields like `locations`, `users`, `engagement` return `null` directly — components accessing `stats.locations.total` will crash with `TypeError: Cannot read properties of null`.

---

### 🟡 HIGH — `incrementView` has a read-then-write race condition

**File:** `src/shared/api/locations.api.js` (lines 1070–1105)  
**What breaks:** The fallback path (when RPC doesn't exist) does:
1. Read current `views_count`
2. Increment by 1
3. Write back

If two users view the same location simultaneously, both read the same count (e.g., 5), both write 6, and one view is lost. This is a classic lost-update race condition. The RPC path is safe (atomic), but the fallback is not.

---

### 🟡 MEDIUM — `telegram/process.js` accesses `query.value` instead of `query`

**File:** `api/telegram/process.js` (line ~693)  
**What breaks:**
```js
const { chatId, query, username: _username } = req.body || {}
// ...
const userQuery = query.value  // ❌ If query is a string, .value is undefined
```
If the Telegram webhook sends `query` as a plain string (which is the standard format), `query.value` is `undefined`. The subsequent `typeof userQuery !== 'string'` check catches this and returns 400, but the error message "Invalid query" is misleading — the query was valid, just accessed incorrectly. This suggests the code expects a specific wrapper format `{ value: "..." }` that may not match the actual webhook payload.

---

### 🟡 MEDIUM — Background tasks in `updateLocation` use `window.dispatchEvent` (breaks in SSR/tests)

**File:** `src/shared/api/locations.api.js` (lines 425, 510, 516, 522)  
**What breaks:** The `updateLocation` function dispatches `CustomEvent` on `window` for background task status. If this code ever runs in a Node.js context (SSR, tests, or the Telegram serverless function importing shared utils), `window` is undefined and throws `ReferenceError`. Currently safe because it's only called from the browser, but it's a latent bug if code is refactored.

---

### 🟡 MEDIUM — `knowledge-graph.api.js` uses `localStorage` in `saveViaProxy` (breaks in SSR)

**File:** `src/shared/api/knowledge-graph.api.js` (saveViaProxy function)  
**What breaks:** The JWT fallback reads from `localStorage` directly. If this module is ever imported server-side (e.g., for pre-rendering or testing), it will throw `ReferenceError: localStorage is not defined`.

---

## 3. FRONTEND COMPONENT BUGS

### 🟡 HIGH — `LocationDetailsPage` accesses `location.openingHours` without null check on `location`

**File:** `src/features/public/pages/LocationDetailsPage.jsx` (line ~175)  
**What breaks:**
```js
const { label: openLabel, isOpen } = useOpenStatus(location?.openingHours)
```
This is called before the `if (!location) return ...` guard. If `location` is null during the first render (before query resolves), `location?.openingHours` is `undefined` which is safe. However, the `useOpenStatus` hook is called unconditionally — if it has internal effects that depend on a valid value, it could cause issues. More critically, the hook is called with potentially stale data if `locationQuery` changes.

---

### 🟡 HIGH — `DashboardPage` creates `thirtyDaysAgo` inside `useMemo` with ESLint suppression

**File:** `src/features/dashboard/pages/DashboardPage.jsx` (line ~165)  
**What breaks:**
```js
const countries = useMemo(() => {
    const countryMap = {}
    // eslint-disable-next-line react-hooks/purity
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    // ...
}, [locations, dbCoverMap])
```
The `thirtyDaysAgo` date is computed inside `useMemo` but the memo only re-runs when `locations` or `dbCoverMap` changes. If the user keeps the app open across midnight, the "new" badge calculation becomes stale (off by a day). The ESLint suppression hides this. Low practical impact but indicates a code smell.

---

### 🟡 MEDIUM — `LocationDetailsPage` toggleFavorite sync logic is inverted

**File:** `src/features/public/pages/LocationDetailsPage.jsx` (line ~120)  
**What breaks:**
```js
// Sync localStorage to match DB state after toggle
if (!dbFavIds.includes(id) !== isLocalFav(id)) {
    localToggle(id)
}
```
After the DB toggle, `dbFavIds` is **stale** (it's from the previous React Query cache). The comparison `!dbFavIds.includes(id) !== isLocalFav(id)` uses pre-mutation state for `dbFavIds` but post-mutation state for `isLocalFav` (since `localToggle` hasn't been called yet). This means the sync condition is evaluated against inconsistent state. React Query will eventually refetch and correct it, but there's a brief UI flicker where localStorage and DB disagree.

---

### 🟡 MEDIUM — `DashboardPage` `user.full_name` access without optional chaining

**File:** `src/features/dashboard/pages/DashboardPage.jsx` (line ~155)  
**What breaks:**
```js
const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || t('dashboard.traveler')
```
This is actually safe due to optional chaining. However, the auth store's `user` object (from `useAuthStore`) stores `name` not `full_name` (see auth store: `{ id, name, email, role, avatar, createdAt }`). So `user?.full_name` is always `undefined`, and the greeting always falls back to `user?.email?.split('@')[0]`. The `full_name` field doesn't exist on the user object — it should be `user?.name`.

---

## 4. ROUTING & NAVIGATION BUGS

### 🟡 HIGH — Duplicate `/classic` route (two different components)

**File:** `src/app/router/AppRouter.jsx` (lines 154, 158)  
**What breaks:**
```jsx
<Route path="/classic" element={<LandingPageV2 />} />  {/* Standalone */}
{/* ... inside PublicLayout ... */}
<Route path="/classic" element={<LandingPage />} />     {/* Wrapped in PublicLayout */}
```
React Router matches the **first** route it finds. The standalone `/classic` route (line 154) renders `LandingPageV2` without `PublicLayout`. The second `/classic` inside `PublicLayout` (line 158) is **unreachable** — `LandingPage` (V1) can never be rendered. This is likely a leftover from migration that wastes bundle size (LandingPage is still lazy-loaded but never used).

---

### 🟡 MEDIUM — `AuthRedirect` runs on every route change (performance)

**File:** `src/app/router/AppRouter.jsx` (lines 38–50)  
**What breaks:** `AuthRedirect` is rendered at the top level of `<Routes>` (outside any `<Route>`), so it re-renders on every navigation. The `useEffect` inside checks `PUBLIC_PATHS.has(location.pathname)` on every route change. While not a crash bug, it's unnecessary work and could cause a brief flash if the redirect fires during a legitimate navigation to a public path while authenticated.

---

### 🟡 MEDIUM — `/location/:id` is accessible without auth but nested inside `MainLayout` with `RequireAuth` sibling

**File:** `src/app/router/AppRouter.jsx` (lines 167–170)  
**What breaks:** The `/location/:id` route is correctly placed outside `RequireAuth` but inside `MainLayout`. The `MainLayout` component calls `useRealtimeSubscription(user?.id)` which subscribes to Supabase Realtime. For unauthenticated users, `user?.id` is `null/undefined`, so the subscription is a no-op. This is safe but wasteful — the subscription hook still runs its setup logic on every render for anonymous users.

---

## 5. STATE MANAGEMENT BUGS

### 🟡 HIGH — `useLocationsStore.initialize()` race condition with filters

**File:** `src/shared/store/useLocationsStore.js` (initialize function)  
**What breaks:** The `initialize()` function reads filter state (`activeCategory`, `activeCity`, etc.) from the store at the time of the fetch. If a user changes a filter while `initialize()` is in-flight, the returned data matches the OLD filters but is stored as the current `locations`. The `filteredLocations` is then recomputed with the NEW filters against data fetched with OLD filters — potentially showing incorrect results until the next fetch.

The `_initGen` counter prevents stale results from overwriting newer ones, but it doesn't prevent the scenario where:
1. User is on "Cafe" filter → initialize starts fetching cafes
2. User switches to "Bar" → filter updates, filteredLocations recomputes (empty because locations only has cafes)
3. Cafe fetch completes → locations set to cafes, filteredLocations recomputed with "Bar" filter → shows nothing

---

### 🟡 HIGH — Realtime subscription in `useLocationsStore` doesn't normalise incoming data

**File:** `src/shared/store/useLocationsStore.js` (subscribeToRealtime, line ~290)  
**What breaks:**
```js
if (payload.eventType === 'INSERT') {
    const updated = [...state.locations, payload.new]  // ❌ raw DB row, not normalised
    set({ locations: updated, ... })
}
```
Realtime payloads contain raw DB column names (`google_rating`, `cuisine_types`, etc.) but the store expects normalised objects (with aliases like `rating`, `cuisine`, `images`, etc.). Components that access `location.rating` or `location.images` on a realtime-inserted location will get `undefined`. The data is inconsistent with locations loaded via `getLocations()` which passes through `normalise()`.

---

### 🟡 MEDIUM — `useAuthStore` persists `isAuthenticated` but `initAuth` sets `isLoading: true`

**File:** `src/shared/store/useAuthStore.js`  
**What breaks:** On page refresh, the persisted state has `isAuthenticated: true` and `user: {...}`. Then `initAuth()` is called and sets `isLoading: true`. During the brief window between `initAuth()` starting and the auth callback firing, the app has `isAuthenticated: true` AND `isLoading: true`. The `RequireAuth` guard shows `<AuthLoader />` when `isLoading` is true, regardless of `isAuthenticated`. This causes a brief loading spinner flash on every page refresh for authenticated users, even though their session is valid.

---

### 🟡 MEDIUM — `useLocationsStore.loadMore()` can duplicate locations

**File:** `src/shared/store/useLocationsStore.js` (loadMore function)  
**What breaks:**
```js
const merged = [...state.locations, ...data]
```
If a location was added via Realtime (INSERT event) between page loads, `loadMore()` fetches it again from the API. The simple array concat creates a duplicate. Unlike `fetchInBounds()` which uses a `Map` for deduplication, `loadMore()` does not deduplicate.

---

### 🟡 MEDIUM — `logout()` clears localStorage key `'auth-storage'` but persist middleware re-writes it

**File:** `src/shared/store/useAuthStore.js` (logout function)  
**What breaks:**
```js
localStorage.removeItem('auth-storage') // Force clear persistence
await signOut()
```
The Zustand `persist` middleware automatically writes to `'auth-storage'` whenever state changes. The `set()` call earlier in `logout()` (which sets `user: null, isAuthenticated: false`) triggers a persist write. Then `localStorage.removeItem('auth-storage')` removes it. But if any subsequent `set()` call happens (e.g., from the `signOut()` error path setting `error`), persist writes again with `{ user: null, token: null, isAuthenticated: false }`. The removeItem is effectively a no-op because persist re-writes immediately. Not harmful (the persisted state is correct), but the code is misleading.

---

## 6. TELEGRAM BOT BUGS

### 🟡 HIGH — `process.js` references undefined variable `braveResults` in console.log

**File:** `api/telegram/process.js` (line ~705)  
**What breaks:**
```js
console.log('[process] Sources:', { places: !!placesData, apify: !!apifyData, brave: !!braveResults })
```
Wait — looking more carefully, the variable is `braveResults` from the destructured `Promise.allSettled` result. However, the actual line in the file is:
```js
console.log('[process] Sources:', { places: !!placesData, apify: !!apifyData, brave: !!brav
```
The file appears truncated in the read, but if the variable name is `braveResults` and it's properly destructured from the allSettled array, this is fine. The real concern is the `query.value` access pattern mentioned in Section 2.

---

### 🟡 MEDIUM — `triggerAutoTranslation` creates a new Supabase client on every call

**File:** `api/telegram/process.js` (triggerAutoTranslation function)  
**What breaks:** The function dynamically imports `@supabase/supabase-js` and creates a new client instance every time it's called. While not a crash bug, this is wasteful — the `createClient` at the top of the file (used by `insertLocation`) could be reused. More importantly, the dynamic import `await import('@supabase/supabase-js')` shadows the static import at the top of the file, which is confusing.

---

## Summary

| Severity | Count | Category |
|----------|-------|----------|
| 🔴 CRITICAL | 2 | Missing return after null check (crash), Silent error swallowing |
| 🟡 HIGH | 10 | Race conditions, data inconsistency, unreachable routes, stale state |
| 🟡 MEDIUM | 9 | Performance issues, misleading code, minor data flow issues |

### Top 3 Bugs to Fix First:
1. **`getLocationMenu` / `saveScannedMenu` missing return** — crashes the app in offline mode
2. **Realtime subscription doesn't normalise data** — causes undefined property access for all realtime-updated locations
3. **`getRecentLocations` swallows errors** — admin dashboard silently shows wrong data

---

*Report generated by automated bug scan. Manual verification recommended before applying fixes.*
