# Photo Migration Scripts

## Overview

Batch scripts for migrating location photos from Google Places API to Cloudflare R2.
These scripts download photos, convert to WebP, upload to R2, and update the database.

**Current status:** ~69 locations still need photos (missing `google_place_id` or quota exhausted).

## Prerequisites

### Environment Variables

All scripts require these env vars (set in `.env` file):

| Variable | Description |
|----------|-------------|
| `GOOGLE_PLACES_API_KEY` | Google Places API key with Photos + Details enabled |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_ENDPOINT` | R2 S3-compatible endpoint URL |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_URL` | R2 public URL prefix for generated URLs |

### Google Places API Quota

- Daily quota resets at midnight Pacific Time
- `fix-5-and-delete-rest.mjs`: uses ~15 API calls (5 text searches + 5 detail requests + photo downloads)
- `fetch-photos-and-coords.mjs`: uses ~11 API calls per location (1 details + up to 10 photo downloads)
- Always run `--dry-run` first to check how many locations will be processed

## Execution Order

> ⚠️ Run scripts in this exact order. `fix-5-and-delete-rest.mjs` must run first.

### Step 1: Fix 5 locations + delete 19 others

```bash
node scripts/fix-5-and-delete-rest.mjs
```

**What it does:**
1. Searches Google Places for new `place_id` for 5 locations:
   - Megiddo Cafe & Bakery
   - Boby Specialty Coffee & Matcha
   - Karma Coffee Roastery
   - Bun Bakery
   - Café Bunker
2. Fetches photos + coordinates for each
3. Uploads photos to R2, updates DB
4. **Permanently deletes 19 other locations** from the database

**⚠️ WARNING:**
- This script does NOT support `--dry-run`
- Deletions are **irreversible**
- The 19 locations to be deleted are hardcoded in the script
- Run only once — subsequent runs will find "not found" for already-deleted locations

**API cost:** ~15 Google Places API calls

### Step 2: Fetch photos for remaining locations

```bash
# First: preview what will be processed (no API calls consumed)
node scripts/fetch-photos-and-coords.mjs --dry-run

# Then: process a limited batch
node scripts/fetch-photos-and-coords.mjs --limit=20

# Or: process all remaining
node scripts/fetch-photos-and-coords.mjs
```

**What it does:**
1. Finds all locations with `google_place_id` but without R2 photos
2. For each location:
   - Fetches place details (photos, coordinates, business status)
   - If permanently closed → marks as `hidden`
   - Downloads up to 10 photos, converts to WebP
   - Uploads to R2
   - Updates `image_url` (main) and `google_photos` (gallery) in DB
   - Verifies/corrects coordinates if drift > 0.001°

**Flags:**
- `--dry-run` — shows what would be processed without making any changes
- `--limit=N` — cap the number of locations processed in one run

**API cost:** ~11 calls per location (1 details + up to 10 photo downloads)

**Rate limiting:** Built-in delays (100ms between photos, 500ms between locations)

## Checking Progress

```bash
node scripts/check-photo-stats.js
```

Shows breakdown of photo sources (R2, Google CDN, Unsplash, none).

## Security Note

These scripts download photos using Google API URLs that contain the API key.
The key is used only in-memory during download — only R2 public URLs are stored in the database.
Never store raw Google API photo URLs (containing `key=...`) in `image_url` or `google_photos` fields.
