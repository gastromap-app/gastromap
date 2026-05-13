# 🔴 SCHEMA MISMATCH AUDIT — GastroMap Locations Table

**Date:** 2026-05-14  
**Auditor:** Automated Code/DB Cross-Reference  
**Scope:** `src/shared/api/locations.api.js` (`_toRow()`) + `src/shared/lib/schema-validator.js` (`VALID_LOCATION_COLUMNS`, `sanitizePayload()`) vs actual DB schema (all migrations applied)

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 CRITICAL | 3 | Columns in VALID_LOCATION_COLUMNS that were DROPPED from DB |
| 🟠 HIGH | 2 | Deprecated mappings that silently remap to dropped columns |
| 🟡 MEDIUM | 4 | Legacy columns in validator that could cause confusion |
| 🟢 INFO | 2 | Columns in DB not referenced by code (no risk) |

---

## 🔴 CRITICAL — Columns Code Sends That DB Doesn't Have

These columns are listed in `VALID_LOCATION_COLUMNS` (so `sanitizePayload()` will NOT strip them), meaning they WILL be sent to Supabase and cause **PostgREST PGRST200 errors** (silent save failures).

### 1. `outdoor_seating` — DROPPED in migration `20260428_remove_duplicate_columns.sql`

**Status:** Column was dropped. Canonical column is `has_outdoor_seating`.  
**Impact:** If any form sends `outdoor_seating` directly (not via `_toRow()` remapping), `sanitizePayload()` will pass it through because it's in `VALID_LOCATION_COLUMNS`. The DB will reject it.  
**Code path:**
- `VALID_LOCATION_COLUMNS` includes `'outdoor_seating'` ← **BUG**
- `_toRow()` correctly maps `d.outdoor_seating → row.has_outdoor_seating` (safe path)
- But if raw form data bypasses `_toRow()` and goes through `sanitizePayload()` directly, `outdoor_seating` passes validation and hits the DB

**Fix:**
```javascript
// In schema-validator.js VALID_LOCATION_COLUMNS — REMOVE:
'outdoor_seating',

// Add to DEPRECATED_COLUMNS:
'outdoor_seating': 'has_outdoor_seating',
```

### 2. `reservation_required` — DROPPED in migration `20260428_remove_duplicate_columns.sql`

**Status:** Column was dropped. Canonical column is `reservations_required`.  
**Impact:** Same as above. `VALID_LOCATION_COLUMNS` includes it, so `sanitizePayload()` won't strip it.  
**Code path:**
- `VALID_LOCATION_COLUMNS` includes `'reservation_required'` ← **BUG**
- `_toRow()` correctly maps `d.reservation_required → row.reservations_required` (safe path)
- Direct payload with `reservation_required` key will pass validation and fail at DB

**Fix:**
```javascript
// In schema-validator.js VALID_LOCATION_COLUMNS — REMOVE:
'reservation_required',

// Add to DEPRECATED_COLUMNS:
'reservation_required': 'reservations_required',
```

### 3. `wifi_quality` — DROPPED in migration `20260428_remove_duplicate_columns.sql`

**Status:** Column was dropped (Step 3b of the migration). Canonical column is `has_wifi`.  
**Impact:** `wifi_quality` is NOT in `VALID_LOCATION_COLUMNS` but IS referenced in `_toRow()`:
```javascript
if (d.wifi_quality !== undefined) row.has_wifi = typeof d.wifi_quality === 'boolean' ? d.wifi_quality : d.wifi_quality !== 'none'
```
This `_toRow()` mapping is actually **safe** — it converts `wifi_quality` input to `has_wifi` output. However, the `20260425_fix_admin_schema.sql` migration added `wifi_quality` as a column, and then `20260428` dropped it. Any code that reads `wifi_quality` from the DB will get `undefined`.

**Fix:** No code fix needed for writes (mapping is correct). But `normalise()` should NOT try to read `row.wifi_quality` from DB results. Currently it doesn't — ✅ safe.

---

## 🟠 HIGH — Columns in VALID_LOCATION_COLUMNS That Were Dropped

These are in the allowlist but the DB columns no longer exist. Any payload containing these keys will pass `sanitizePayload()` validation and cause a DB error.

| Column | Dropped In | Canonical Replacement | In VALID_LOCATION_COLUMNS? |
|--------|-----------|----------------------|---------------------------|
| `outdoor_seating` | 20260428 | `has_outdoor_seating` | ✅ YES — **BUG** |
| `reservation_required` | 20260428 | `reservations_required` | ✅ YES — **BUG** |

### Additional Risk: `DEPRECATED_COLUMNS` Mapping Gap

The `DEPRECATED_COLUMNS` object does NOT include mappings for `outdoor_seating` or `reservation_required`. This means:
1. If a payload has `outdoor_seating`, `sanitizePayload()` finds it in `VALID_LOCATION_COLUMNS` and passes it through AS-IS
2. The DB rejects it because the column doesn't exist
3. The save silently fails (or throws depending on error handling)

---

## 🟡 MEDIUM — Legacy Columns That Could Cause Data Loss or Confusion

### 1. `image` in VALID_LOCATION_COLUMNS

**Status:** The original `image` column still exists in DB (never dropped), but `image_url` is the canonical column.  
**Risk:** If code sends `image` directly, it writes to the legacy column. The `normalise()` function reads from `row.image_url`, so data written to `image` may be invisible to the UI.  
**Mitigation:** `_toRow()` correctly maps `d.image → row.image_url`. But `VALID_LOCATION_COLUMNS` includes both `'image'` and `'image_url'`, so a raw payload with `image` key would write to the wrong column.

**Fix:**
```javascript
// Move 'image' from VALID_LOCATION_COLUMNS to DEPRECATED_COLUMNS:
'image': 'image_url',
```

### 2. `photos` in VALID_LOCATION_COLUMNS

**Status:** Original `photos` column still exists in DB, but `google_photos` is canonical.  
**Risk:** Same pattern — writing to `photos` directly won't be read by `normalise()` which reads `row.google_photos`.  
**Note:** `DEPRECATED_COLUMNS` already has `'photos': 'google_photos'` but `photos` is ALSO in `VALID_LOCATION_COLUMNS`. The validator checks `VALID_LOCATION_COLUMNS` first, so the deprecated mapping is never triggered.

**Fix:**
```javascript
// REMOVE from VALID_LOCATION_COLUMNS:
'photos',
// Already in DEPRECATED_COLUMNS — will now correctly remap
```

### 3. `features` in VALID_LOCATION_COLUMNS

**Status:** Original `features` column still exists in DB, but `amenities` is canonical.  
**Risk:** Writing to `features` directly won't be read by `normalise()` which reads `row.amenities`.  
**Note:** `DEPRECATED_COLUMNS` has `'features': 'amenities'` but `features` is ALSO in `VALID_LOCATION_COLUMNS`, so the remap never fires.

**Fix:**
```javascript
// REMOVE from VALID_LOCATION_COLUMNS:
'features',
// Already in DEPRECATED_COLUMNS — will now correctly remap
```

### 4. `dietary` in VALID_LOCATION_COLUMNS

**Status:** Original `dietary` column still exists in DB, but `dietary_options` is canonical.  
**Risk:** Same pattern as above.  
**Note:** `DEPRECATED_COLUMNS` has `'dietary': 'dietary_options'` but `dietary` is ALSO in `VALID_LOCATION_COLUMNS`.

**Fix:**
```javascript
// REMOVE from VALID_LOCATION_COLUMNS:
'dietary',
// Already in DEPRECATED_COLUMNS — will now correctly remap
```

### 5. `cuisine` in VALID_LOCATION_COLUMNS

**Status:** Original `cuisine` (text) column still exists in DB, but `cuisine_types` (text[]) is canonical.  
**Risk:** Writing a string to `cuisine` won't populate `cuisine_types` which is what the app reads.  
**Note:** `DEPRECATED_COLUMNS` has `'cuisine': 'cuisine_types'` but `cuisine` is ALSO in `VALID_LOCATION_COLUMNS`.

**Fix:**
```javascript
// REMOVE from VALID_LOCATION_COLUMNS:
'cuisine',
// Already in DEPRECATED_COLUMNS — will now correctly remap
```

---

## 🟢 INFO — DB Columns Not Referenced by Code (No Risk)

| Column | Added In | Notes |
|--------|----------|-------|
| `kg_profile` | 20260507 | JSONB column for KG edge function; not in VALID_LOCATION_COLUMNS or _toRow() |
| `google_price_level` | 20260513 | Integer version; `google_price_level` IS in VALID_LOCATION_COLUMNS but _toRow() never outputs it |
| `rating` (original) | 001_locations | Legacy numeric column; never dropped but code maps to `google_rating` |

---

## 📋 Complete Column Existence Matrix

| Column | In DB? | In VALID_LOCATION_COLUMNS? | In _toRow() output? | Status |
|--------|--------|---------------------------|---------------------|--------|
| `outdoor_seating` | ❌ DROPPED | ✅ YES | ❌ (maps to has_outdoor_seating) | 🔴 REMOVE from validator |
| `reservation_required` | ❌ DROPPED | ✅ YES | ❌ (maps to reservations_required) | 🔴 REMOVE from validator |
| `wifi_quality` | ❌ DROPPED | ❌ NO | ❌ (maps to has_wifi) | ✅ Safe |
| `image` | ✅ (legacy) | ✅ YES | ❌ (maps to image_url) | 🟡 Move to DEPRECATED |
| `photos` | ✅ (legacy) | ✅ YES | ❌ (maps to google_photos) | 🟡 Move to DEPRECATED |
| `features` | ✅ (legacy) | ✅ YES | ❌ (maps to amenities) | 🟡 Move to DEPRECATED |
| `dietary` | ✅ (legacy) | ✅ YES | ❌ (maps to dietary_options) | 🟡 Move to DEPRECATED |
| `cuisine` | ✅ (legacy) | ✅ YES | ❌ (maps to cuisine_types) | 🟡 Move to DEPRECATED |
| `has_outdoor_seating` | ✅ | ✅ YES | ✅ YES | ✅ Correct |
| `reservations_required` | ✅ | ✅ YES | ✅ YES | ✅ Correct |
| `has_wifi` | ✅ | ✅ YES | ✅ YES | ✅ Correct |
| `image_url` | ✅ | ✅ YES | ✅ YES | ✅ Correct |
| `google_photos` | ✅ | ❌ NO | ✅ YES | 🟡 Add to validator |
| `google_rating` | ✅ | ✅ YES | ✅ YES | ✅ Correct |
| `embedding` | ✅ | ❌ NO | ✅ YES | 🟡 Add to validator |

---

## 🛠️ Recommended Fixes

### Fix 1: Update `VALID_LOCATION_COLUMNS` (schema-validator.js)

```javascript
// REMOVE these (dropped from DB):
'outdoor_seating',
'reservation_required',

// REMOVE these (legacy — should go through DEPRECATED_COLUMNS remap):
'image',
'photos',
'features',
'dietary',
'cuisine',

// ADD these (exist in DB, used by _toRow(), but missing from validator):
'google_photos',
'embedding',
```

### Fix 2: Update `DEPRECATED_COLUMNS` (schema-validator.js)

```javascript
export const DEPRECATED_COLUMNS = {
    'rating': 'google_rating',
    'price_level': 'price_range',
    'images': 'google_photos',
    'image_url': null,                    // Still valid
    'cuisine': 'cuisine_types',
    'photos': 'google_photos',
    'features': 'amenities',
    'dietary': 'dietary_options',
    // ADD THESE:
    'outdoor_seating': 'has_outdoor_seating',     // Dropped 2026-04-28
    'reservation_required': 'reservations_required', // Dropped 2026-04-28
    'wifi_quality': 'has_wifi',                   // Dropped 2026-04-28
    'image': 'image_url',                         // Legacy column, canonical is image_url
};
```

### Fix 3: Add `google_photos` and `embedding` to VALID_LOCATION_COLUMNS

These are output by `_toRow()` and exist in the DB but are missing from the validator. If any code path calls `sanitizePayload()` on a row that already contains these keys, they'd be stripped.

---

## 🔍 Root Cause Analysis

The bug pattern is:
1. Migration `20260425_fix_admin_schema.sql` ADDED `outdoor_seating`, `reservation_required`, `wifi_quality` as new columns
2. Migration `20260428_remove_duplicate_columns.sql` DROPPED those same columns 3 days later
3. `schema-validator.js` was updated to include them (step 1) but never updated to remove them (step 2)
4. `_toRow()` was correctly updated to map these to canonical names, but the validator still allows the raw dropped names through

This is a **migration-code sync gap** — the validator must be updated every time a column is dropped.

---

## ⚠️ Additional Concern: `sanitizePayload()` Logic Order

```javascript
if (validColumns.has(key)) {
    sanitized[key] = sanitizeValue(value);
} else if (DEPRECATED_COLUMNS[key]) {
    // Remap...
}
```

The check order means: if a key is in BOTH `VALID_LOCATION_COLUMNS` AND `DEPRECATED_COLUMNS`, the deprecated remap is **never triggered**. This is why `photos`, `features`, `dietary`, `cuisine` are never remapped despite having entries in `DEPRECATED_COLUMNS` — they're found in `VALID_LOCATION_COLUMNS` first.

**This is the fundamental design flaw.** Either:
- Remove legacy names from `VALID_LOCATION_COLUMNS` (recommended), OR
- Check `DEPRECATED_COLUMNS` first before `VALID_LOCATION_COLUMNS`

---

*End of audit report.*
