# GastroMap Performance Audit Report

**Date:** 2025-01-XX  
**Stack:** React 19 + Vite 7 + Supabase + Zustand + TanStack Query  
**Build time:** 6.33s  
**Total precache:** 3,248 KB (121 entries)

---

## 1. Bundle Size Analysis (Largest Chunks)

| Chunk | Raw Size | Gzipped | Notes |
|-------|----------|---------|-------|
| `index.js` (main) | **474.56 KB** | 156.12 KB | ⚠️ CRITICAL — app shell + shared code |
| `recharts.js` | 397.39 KB | 115.52 KB | ⚠️ Only used on Admin Stats page |
| `react-core.js` | 192.84 KB | 60.39 KB | React + ReactDOM (unavoidable) |
| `supabase.js` | 187.53 KB | 49.29 KB | Supabase client (used everywhere) |
| `leaflet.js` | 159.86 KB | 50.22 KB | Map library (only Map/Admin pages) |
| `framer-motion.js` | 130.40 KB | 43.09 KB | Animation library (used broadly) |
| `gsap.js` | 113.72 KB | 44.82 KB | ⚠️ Only used on LandingPageV3 |
| `ui-primitives.js` | 108.45 KB | 37.65 KB | Headless UI + Radix |
| `AdminLocationsPage.js` | 106.90 KB | 26.52 KB | ⚠️ Largest page chunk |
| `MapTab.js` | 76.20 KB | 19.78 KB | Map component |
| `AdminKnowledgeGraphPage.js` | 76.46 KB | 17.95 KB | Knowledge graph |
| `tanstack.js` | 52.63 KB | 15.42 KB | React Query |
| `i18n.js` | 48.38 KB | 15.80 KB | Translations |
| `lucide.js` | 36.49 KB | 12.46 KB | Icon library |

**Total JS payload (initial load):** ~1.2 MB raw / ~400 KB gzipped (estimated critical path)

---

## 2. Critical Performance Issues

### 🔴 CRITICAL: Main Bundle (`index.js`) is 474 KB

The main `index.js` chunk contains all shared code, stores, utilities, layouts, and the eagerly-loaded `LandingPageV3`. This is loaded on EVERY page visit.

**Root causes:**
- `LandingPageV3` is imported directly (not lazy-loaded) and pulls in `gsap`, `ScrollTrigger`, `framer-motion` hooks
- All Zustand stores (`useLocationsStore`, `useAuthStore`, `useAIChatStore`, `useGeoStore`, `useFavoritesStore`, `useUserPrefsStore`, `useNotificationStore`) are bundled in the main chunk
- `MainLayout`, `PublicLayout`, error boundaries, PWA components all in main chunk
- `SmoothScroll` (Lenis) wrapper is always loaded even on pages that don't scroll

### 🔴 CRITICAL: Data Fetching Waterfall in App.jsx

```
Step 1: initAuth() → waits for Supabase auth session (network call)
Step 2: ONLY AFTER auth resolves → initialize() locations (another network call)  
Step 3: ONLY AFTER auth resolves → subscribeToRealtime()
```

**Impact:** Users see a blank/loading screen for `auth_time + locations_fetch_time` sequentially. Public pages (landing, features, pricing) don't need auth but still wait for it because `OnboardingGate` wraps `AppRouter`.

Additionally, `AppConfigBootstrap` fires `loadFromDB()` independently — this is a 3rd parallel request that could race with auth.

### 🔴 CRITICAL: `useAdminLocations` Hook — Monolithic Re-render Bomb

This hook returns **70+ values** in a single object. Any state change (typing in search, opening a menu, toast appearing) causes ALL consumers to re-render.

**Specific issues:**
- 20+ `useState` calls in one hook
- Returns all mutations, all state, all setters, all handlers
- `formData` changes on every keystroke → entire AdminLocationsPage re-renders
- `filteredLocations` is recomputed on every render (not memoized within the hook)
- `toast` state changes trigger full page re-render

### 🟡 HIGH: `LocationFormSlideOver` Re-renders on Every Keystroke

The form uses `setFormData(prev => ({ ...prev, [field]: val }))` which creates a new object reference on every keystroke. Since `formData` is passed as a prop from the parent (which gets it from `useAdminLocations`), this triggers:
1. Parent re-render (useAdminLocations state change)
2. SlideOver re-render (new formData prop)
3. All child components re-render (no memoization)

The component imports Leaflet's `MapContainer` + `TileLayer` + `Marker` which re-initialize on every re-render of the form.

### 🟡 HIGH: GSAP Loaded Eagerly for Landing Page Only

`LandingPageV3` is the only non-lazy page and imports `gsap` + `ScrollTrigger` (113 KB). This means:
- First-time visitors to ANY route download GSAP
- The `manualChunks` config correctly splits GSAP into its own chunk, but since `LandingPageV3` is eagerly imported, it's still loaded on initial page load

### 🟡 HIGH: Recharts (397 KB) Loaded for Admin Stats Only

Recharts + D3 dependencies are the 2nd largest chunk. They're only used on `AdminStatsPage` and `AdminDashboardPage`. The lazy loading is correct, but the chunk itself is enormous.

---

## 3. Lazy Loading Status

### ✅ Properly Lazy-Loaded:
- All Auth pages (Login, SignUp, ForgotPassword, ResetPassword)
- All Dashboard pages (DashboardPage, MapPage, AIGuidePage, etc.)
- All Admin pages (AdminLocationsPage, AdminKnowledgeGraphPage, etc.)
- All Public pages except LandingPageV3 (Features, Pricing, About, etc.)
- `OnboardingFlow` component

### ❌ NOT Lazy-Loaded (in main bundle):
- **`LandingPageV3`** — eagerly imported, pulls gsap + framer-motion into critical path
- **`MainLayout`** — always loaded
- **`PublicLayout`** — always loaded
- **`OnboardingGate`** — always loaded (but lightweight)
- **`ReloadPrompt`** — always loaded
- **`InstallPrompt`** — always loaded
- **`OfflineIndicator`** — always loaded
- All Zustand stores — always loaded
- `SmoothScroll` (Lenis) — always loaded

---

## 4. Re-render Hotspots

| Component | Trigger | Impact |
|-----------|---------|--------|
| `AdminLocationsPage` | Any state in `useAdminLocations` | Full page + all children re-render |
| `LocationFormSlideOver` | Every keystroke in any field | Form + embedded map re-render |
| `MapTab` | `mapMarkers` store update | All markers re-created |
| `useLocationsStore` filter setters | Each setter calls `applyAllFilters` | Recomputes filtered list + triggers subscribers |
| `LandingPageV3` | Scroll events (GSAP ScrollTrigger) | Multiple animation recalculations |

---

## 5. Memory Leaks Found

### 🔴 `ReloadPrompt.jsx` — setInterval never cleared
```javascript
// Line 18: setInterval without storing reference for cleanup
setInterval(() => r.update(), 60 * 60 * 1000)
```
This interval runs forever once the SW registers. If the component unmounts and remounts (unlikely but possible with error boundaries), a new interval is created without clearing the old one.

### 🔴 `usePWA.js` — `appinstalled` listener never removed
```javascript
// Line 22-25: Anonymous function, can't be removed
window.addEventListener('appinstalled', () => {
    setIsInstallable(false)
    setIsInstalled(true)
    setDeferredPrompt(null)
})
// Cleanup only removes 'beforeinstallprompt', NOT 'appinstalled'
```

### 🟡 `ThemeController.js` — matchMedia listener never removed
```javascript
// Line 60: Singleton adds listener on import, never removes it
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {...})
```
Since this is a singleton that lives for the app lifetime, it's low-risk but technically a leak.

### 🟡 `ProfilePage.jsx` — SW `updatefound` and `statechange` listeners
```javascript
// Lines 250-254: Listeners added to registration object, never removed
registration.addEventListener('updatefound', () => {...})
newWorker.addEventListener('statechange', () => {...})
```
These are added inside an async handler and never cleaned up. Low frequency but accumulates on repeated "check for updates" clicks.

---

## 6. Data Fetching Patterns

### Waterfall Pattern (App.jsx):
```
[Auth Init] ──────────────────→ [Locations Fetch] ──────→ [Realtime Subscribe]
     ↓                                                          
[AppConfig Load] (parallel, independent)
```

### Sequential Issues:
1. **Auth blocks everything** — even public pages wait for auth to resolve before rendering content
2. **Locations fetch waits for auth** — intentional (RLS), but could prefetch public locations
3. **OnboardingGate** makes an additional Supabase call (`loadFromSupabase`) after auth resolves

### Parallel Opportunities:
- Public locations could be fetched in parallel with auth (they don't need auth for public data)
- `AppConfigBootstrap` already runs in parallel (good)
- `OnboardingGate.loadFromSupabase()` could run in parallel with `initialize()`

---

## 7. Recommended Optimizations (Prioritized)

### P0 — Critical (Immediate Impact)

1. **Lazy-load `LandingPageV3`**
   - Move to `React.lazy()` like other pages
   - Saves ~113 KB (GSAP) from initial bundle for non-landing routes
   - Risk: Slightly slower landing page first paint (mitigate with preload hint)

2. **Split `useAdminLocations` into focused hooks**
   ```
   useAdminLocationsList()    → data fetching, filtering, pagination
   useAdminLocationForm()     → formData, selectedLocation, save/create
   useAdminLocationActions()  → approve, reject, delete, AI operations
   useAdminLocationToast()    → toast state
   ```
   This prevents form keystrokes from re-rendering the entire list.

3. **Debounce form inputs in `LocationFormSlideOver`**
   - Use `useDeferredValue` or a debounced setter for text fields
   - Wrap the embedded `MapContainer` in `React.memo` to prevent re-initialization

4. **Break the auth → data waterfall for public routes**
   - Fetch public locations immediately (no auth needed for public data)
   - Only gate authenticated routes behind auth resolution
   - Move `OnboardingGate` inside `RequireAuth` instead of wrapping entire router

### P1 — High Priority

5. **Replace Recharts with a lighter alternative**
   - Consider `lightweight-charts`, `uPlot`, or `chart.js` (much smaller)
   - Or dynamically import recharts only when AdminStatsPage mounts (already lazy, but chunk is huge)

6. **Tree-shake Lucide icons**
   - Current: 36 KB chunk. Verify only used icons are imported (not `import * from 'lucide-react'`)
   - Vite should tree-shake, but verify no barrel imports

7. **Memoize `filteredLocations` computation**
   - `applyAllFilters` runs on every filter setter call
   - Consider `useMemo` pattern or Zustand `subscribeWithSelector` for consumers that only need specific slices

8. **Fix `ReloadPrompt` setInterval leak**
   ```javascript
   const intervalId = setInterval(() => r.update(), 60 * 60 * 1000)
   // Store and clear on component unmount
   ```

9. **Fix `usePWA` appinstalled listener leak**
   ```javascript
   const handleInstalled = () => { ... }
   window.addEventListener('appinstalled', handleInstalled)
   return () => {
       window.removeEventListener('beforeinstallprompt', handler)
       window.removeEventListener('appinstalled', handleInstalled)
   }
   ```

### P2 — Medium Priority

10. **Preload critical chunks**
    - Add `<link rel="modulepreload">` for `react-core`, `supabase`, `react-router` chunks
    - Use Vite's `build.modulePreload` configuration

11. **Virtualize AdminLocationsPage list**
    - Already has `@tanstack/react-virtual` in dependencies
    - With 500 locations loaded, DOM nodes are excessive
    - Implement virtual scrolling for the location list

12. **Lazy-load Leaflet in `LocationFormSlideOver`**
    - The admin form imports the full Leaflet library for a small preview map
    - Wrap the map section in `Suspense` with dynamic import

13. **Remove `SmoothScroll` (Lenis) from non-scrolling pages**
    - Map page is `fixed inset-0` — Lenis adds overhead for nothing
    - Consider conditionally loading Lenis only on pages that benefit from it

14. **Reduce Supabase client bundle**
    - 187 KB is large; check if `@supabase/supabase-js` can be imported more selectively
    - Consider using the lighter `@supabase/postgrest-js` directly for read-only operations

### P3 — Nice to Have

15. **Enable Brotli compression** on the hosting platform (Vercel supports it by default)

16. **Add `loading="lazy"` to all images** not in the viewport (already using `LazyImage` component — verify coverage)

17. **Consider route-based prefetching** — when user hovers over nav links, prefetch that route's chunk

18. **Move i18n translations to dynamic imports** — load only the active language, not all 48 KB

---

## 8. Vite Config Assessment

### ✅ Good Practices:
- Manual chunks properly split heavy libraries (leaflet, recharts, gsap, framer-motion)
- Production console/debugger stripping enabled
- PWA workbox configured with sensible caching strategies
- `chunkSizeWarningLimit` set to 600 KB

### ⚠️ Improvements:
- No `build.target` specified — could target modern browsers for smaller output
- No `build.cssCodeSplit: true` explicitly (default is true, but worth confirming)
- Consider adding `build.reportCompressedSize: true` for better build output visibility
- The `manualChunks` function doesn't handle the case where `ogl` (3D library) is imported by the eagerly-loaded landing page

---

## Summary

| Category | Status |
|----------|--------|
| Lazy Loading | ✅ Good (except LandingPageV3) |
| Code Splitting | ✅ Good (manual chunks configured) |
| Bundle Size | ⚠️ Main chunk too large (474 KB) |
| Re-render Performance | 🔴 Critical issues in Admin pages |
| Data Fetching | ⚠️ Sequential waterfall blocks initial render |
| Memory Leaks | 🟡 2 confirmed leaks (low severity) |
| Caching Strategy | ✅ Well-configured PWA workbox |

**Estimated improvement from P0 fixes:** 30-40% faster initial load, 60-70% fewer re-renders on Admin pages.
