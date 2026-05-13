# GastroMap Frontend Functionality Audit

**Date:** 2025-01-10  
**Scope:** UI/UX Functionality & Broken Features  
**Files Reviewed:** 25+ core components, hooks, API layers, router, i18n config

---

## 🔴 CRITICAL — Broken Features

### 1. `_source` Field Leaks to Database on Save

**Location:** `src/features/admin/components/LocationFormSlideOver.jsx` (line 224)  
**Impact:** When a location is selected via Google Places autocomplete, `_source: 'google_places'` is set on `formData`. The `prepareSubmissionData()` in `useAdminLocations.js` only removes `_data_source` and `_candidates` — it does NOT remove `_source`. This internal UI field gets passed to `_toRow()` and then to `sanitizePayload()`, which will strip it (since `_source` is not in `VALID_LOCATION_COLUMNS`), but it generates a console warning on every save and indicates sloppy data flow.

**Fix:** Add `delete submissionData._source` in `prepareSubmissionData()`.

---

### 2. Duplicate `/classic` Route — First Match Wins, Second is Dead Code

**Location:** `src/app/router/AppRouter.jsx` (lines 155 and 159)  
**Impact:** `/classic` is defined twice:
- Line 155: `<Route path="/classic" element={<LandingPageV2 />} />` (standalone, no layout)
- Line 159: `<Route path="/classic" element={<LandingPage />} />` (inside `PublicLayout`)

React Router matches the first one. The second route (LandingPage inside PublicLayout) is **unreachable dead code**. If the intent was to show LandingPage (V1) with PublicLayout, it will never render.

**Fix:** Remove one of the duplicate routes or rename one to `/classic-v1`.

---

### 3. Russian (`ru`) Language Loaded but NOT in `supportedLngs`

**Location:** `src/i18n/config.js` (line 40)  
**Impact:** The i18n config imports `ruTranslation` and adds it to `resources`, but `supportedLngs` is `['en', 'pl', 'ua']` — Russian is excluded. When a user selects Russian in `LanguageSettingsPage`, i18next will **silently fall back to English** because `ru` is not a supported language. The UI shows Russian as an option (with flag 🇷🇺) but selecting it does nothing visible — a confusing UX.

**Fix:** Either add `'ru'` to `supportedLngs` or remove Russian from the `LanguageSettingsPage` language list.

---

### 4. Delete Button in LocationFormSlideOver Has No Confirmation

**Location:** `src/features/admin/components/LocationFormSlideOver.jsx` (lines 1307-1311)  
**Impact:** The delete button in the slide-over footer calls `onDelete(selectedLocation?.id)` and immediately calls `onClose()` without any confirmation dialog. While `handleDelete` in `useAdminLocations.js` does have a `confirm()` dialog, the slide-over calls `onDelete` directly and then closes the panel — if the user clicks "Cancel" on the confirm dialog, the panel is already closed, losing all form state.

**Fix:** Move `onClose()` into the `onSuccess` callback of the delete mutation, or await the confirmation before closing.

---

## 🟠 HIGH — Partially Working Features

### 5. Hardcoded Russian Strings in `useAdminLocations.js` — i18n Bypass

**Location:** `src/features/admin/hooks/useAdminLocations.js` (30+ instances)  
**Impact:** All toast messages, validation errors, and status messages are hardcoded in Russian:
- `'Название обязательно'` (Title required)
- `'Локация создана!'` (Location created)
- `'Ошибка удаления'` (Delete error)
- `'Нет данных для экспорта'` (No data to export)

These will display as Russian text regardless of the user's language setting. The `t()` function from `useTranslation` is imported but only used for URL validation errors.

**Fix:** Replace all hardcoded Russian strings with `t('...')` translation keys.

---

### 6. FilterModal Does NOT Lock Body Scroll

**Location:** `src/features/dashboard/components/FilterModal.jsx`  
**Impact:** The FilterModal uses `createPortal` and renders a fullscreen overlay, but does NOT set `document.body.style.overflow = 'hidden'` when open. On mobile, users can scroll the background content behind the modal. Other modals in the app (DonationModal, PhotoLightbox) correctly implement scroll locking.

**Fix:** Add a `useEffect` that sets `document.body.style.overflow = 'hidden'` when `isOpen` is true.

---

### 7. LocationFormSlideOver Does NOT Lock Body Scroll

**Location:** `src/features/admin/components/LocationFormSlideOver.jsx`  
**Impact:** The fullscreen slide-over panel has its own scroll container, but the underlying page body is not scroll-locked. On mobile devices, two-finger scrolling or momentum scroll can affect the background. The component uses `fixed inset-0` positioning which partially mitigates this, but doesn't fully prevent background scroll on iOS Safari.

**Fix:** Add body scroll lock when `isOpen` is true.

---

### 8. `rating` Field Handling — Dual Rating Confusion

**Location:** `src/shared/api/locations.api.js` (`_toRow` function, lines 680-682)  
**Impact:** The `_toRow` function maps both `google_rating` and `rating` to the DB column `google_rating`:
```js
if (d.google_rating !== undefined) row.google_rating = Number(d.google_rating)
else if (d.rating !== undefined) row.google_rating = Number(d.rating)
```
The admin form has TWO separate rating fields (internal rating and Google rating), but the DB only has `google_rating`. The "internal rating" field in the form (`formData.rating`) will overwrite `google_rating` if `google_rating` is not explicitly set. The `normalise()` function creates a separate `rating` field from `google_rating`, creating a circular dependency.

**Fix:** Either add a `rating` column to the DB or remove the "internal rating" field from the admin form to avoid confusion.

---

### 9. Admin Filter `allVibes` Uses Wrong Return Type from `getLabelGroups`

**Location:** `src/features/admin/components/LocationFilters.jsx` (line 56)  
**Impact:** The code does:
```js
const allVibes = React.useMemo(() => {
    const groups = getLabelGroups(i18n.language)
    return Object.entries(groups).flatMap(([_group, items]) => items)
}, [i18n.language])
```
But `getLabelGroups` returns an **array** of `{ group, items }` objects (based on usage in LocationFormSlideOver where it's iterated with `.map(({ group, items }) => ...)`). Using `Object.entries()` on an array gives `[['0', {...}], ['1', {...}]]` — the destructured `items` would be the entire object `{ group, items }`, not just the items array. This means the vibes filter in the admin panel likely shows `[object Object]` or nothing.

**Fix:** Change to `groups.flatMap(g => g.items)`.

---

## 🟡 MEDIUM — UI/UX Issues

### 10. SmartSearchBar Dropdown Z-Index Conflict with Map Controls

**Location:** `src/features/dashboard/components/SmartSearchBar.jsx` (dropdown `z-50`)  
**Impact:** The search dropdown uses `z-50`, but on the MapPage, the search overlay container is at `z-[600]`. The dropdown renders inside this container so it works, but if the SmartSearchBar is used elsewhere (e.g., DashboardPage without the z-600 wrapper), the dropdown could appear behind other fixed elements.

**Severity:** Low risk in current usage, but fragile.

---

### 11. FilterModal `$$$$` Price Level Not Supported by Backend

**Location:** `src/features/dashboard/components/FilterModal.jsx` (line ~price grid)  
**Impact:** The FilterModal offers 4 price levels: `$`, `$$`, `$$$`, `$$$$`. But the admin form's `PRICE_LEVELS` and the `locationFilters.js` only handle `$`, `$$`, `$$$`. Selecting `$$$$` in the public filter will match zero locations since no location can have that price range set via the admin panel.

**Fix:** Either add `$$$$` to admin PRICE_LEVELS or remove it from FilterModal.

---

### 12. Map Markers Don't Handle Missing Coordinates Gracefully

**Location:** `src/features/dashboard/components/MapTab.jsx` (marker rendering)  
**Impact:** The map renders markers for all `visibleLocations` using `[loc.lat, loc.lng]`. If a location has `lat: 0, lng: 0` (the default from `normalise()` when coordinates are missing), it will render a marker at Null Island (0°N, 0°E in the Atlantic Ocean). The `normalise()` function defaults to `Number(row.lat ?? 0)`.

**Fix:** Filter out locations where `lat === 0 && lng === 0` before rendering markers.

---

### 13. Photo Upload Progress — No Real Progress Indicator

**Location:** `src/features/admin/components/LocationFormSlideOver.jsx` (upload section)  
**Impact:** The upload area shows a spinning icon and a Framer Motion bar that animates from 0 to 100% width, but this is a fake progress animation — it doesn't reflect actual upload progress. For large images on slow connections, the user has no idea how long the upload will take.

**Severity:** UX annoyance, not a bug.

---

### 14. Mobile Safe Area Handling — Inconsistent `env(safe-area-inset-top)` Usage

**Location:** Multiple components  
**Impact:** The LocationFormSlideOver header uses `mt-[env(safe-area-inset-top)]` on individual elements rather than padding the container. The DashboardPage uses `paddingTop: 'calc(env(safe-area-inset-top) + 6.5rem)'` inline. The MapPage uses `paddingTop: 'calc(env(safe-area-inset-top) + 4.5rem)'`. This inconsistency means different pages handle the notch differently, potentially causing content to be hidden behind the status bar on some pages.

---

### 15. `handleCreateNew` Default Coordinates Are Hardcoded to Krakow

**Location:** `src/features/admin/hooks/useAdminLocations.js` (line ~130)  
**Impact:** New locations default to `lat: 50.0647, lng: 19.9450` (Krakow, Poland). If the admin is adding a location in a different city/country, the map in the form will initially show Krakow, which is confusing. Should default to null or use the admin's current geolocation.

---

## 🟢 LOW — Missing Features or Dead Code

### 16. Dead Code: `handleLoadGooglePhotos` is Unused

**Location:** `src/features/admin/components/LocationFormSlideOver.jsx` (line ~260)  
**Impact:** The function `handleLoadGooglePhotos` is defined but has an `eslint-disable-next-line no-unused-vars` comment. It's never called from the UI. The photo loading happens automatically in `handlePlaceSelected`.

**Fix:** Remove dead code.

---

### 17. Dead Code: `_handleUpdateEmbedding` and `_handleReindex` are Unused

**Location:** `src/features/admin/components/LocationFormSlideOver.jsx` (lines ~330-345)  
**Impact:** Both functions are prefixed with `_` and never called from the UI. They were likely replaced by `handleFullEnrich`.

**Fix:** Remove dead code.

---

### 18. `addCulinaryItem` Modifies `must_try` as String — Inconsistent with Array Pattern

**Location:** `src/features/admin/hooks/useAdminLocations.js` (line ~305)  
**Impact:** The `addCulinaryItem` function treats `must_try` as a comma-separated string, while the rest of the form uses `what_to_try` as an array. This creates inconsistency — if a user adds items via the culinary search AND the tag input, they'll be stored differently.

---

### 19. `LandingPage` (V1) Import is Unused in Practice

**Location:** `src/app/router/AppRouter.jsx` (line 63)  
**Impact:** `LandingPage` is lazy-imported but only used in the unreachable duplicate `/classic` route (see issue #2). This adds to the bundle's code-splitting map unnecessarily.

---

### 20. Region Selection in LanguageSettingsPage Does Nothing

**Location:** `src/features/dashboard/pages/LanguageSettingsPage.jsx`  
**Impact:** The "Local Region" section allows selecting a region (Poland, Germany, Ukraine, UK) but the selection is stored only in local component state (`useState`). It's never persisted or used anywhere in the app. Pure dead UI.

**Fix:** Either implement region-based functionality or remove the section.

---

### 21. `useI18n` Hook's `setAdminLanguage` Sets Russian — But Russian is Unsupported

**Location:** `src/hooks/useI18n.js` (line 30)  
**Impact:** `setAdminLanguage()` calls `setLanguage('ru')`, but since `ru` is not in `supportedLngs`, this silently falls back to English. The function exists but is effectively a no-op.

---

### 22. `getAvailableLanguages` Returns Hardcoded Fallback

**Location:** `src/hooks/useI18n.js` (line 34)  
**Impact:** Returns `i18nInstance.options.supportedLngs || ['en', 'ru', 'pl', 'ua']` — the fallback includes `ru` which isn't actually supported. If `supportedLngs` is somehow undefined, the UI would show Russian as available.

---

## 📋 Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| 🔴 CRITICAL | 4 | `_source` leak, duplicate route, Russian lang broken, delete no-confirm race |
| 🟠 HIGH | 5 | Hardcoded Russian, no scroll lock (2), rating confusion, admin vibes filter broken |
| 🟡 MEDIUM | 6 | Z-index fragility, `$$$$` mismatch, null island markers, fake progress, safe-area inconsistency, hardcoded coords |
| 🟢 LOW | 7 | Dead code (3), inconsistent data types, unused imports, dead UI, broken helper |

---

## 🛠️ Recommended Fix Priority

1. **Immediate (blocks users):**
   - Fix admin vibes filter `Object.entries` on array (issue #9)
   - Add `'ru'` to `supportedLngs` or remove from UI (issue #3)
   - Fix delete button race condition (issue #4)

2. **This sprint:**
   - Replace all hardcoded Russian strings with i18n keys (issue #5)
   - Add scroll lock to FilterModal and LocationFormSlideOver (issues #6, #7)
   - Remove duplicate `/classic` route (issue #2)
   - Clean `_source` from submission data (issue #1)

3. **Next sprint:**
   - Resolve rating field confusion (issue #8)
   - Filter out 0,0 coordinates from map (issue #12)
   - Remove `$$$$` from FilterModal or add to admin (issue #11)
   - Clean up dead code (issues #16, #17, #19, #20)

4. **Backlog:**
   - Real upload progress indicator
   - Consistent safe-area handling
   - Dynamic default coordinates for new locations
