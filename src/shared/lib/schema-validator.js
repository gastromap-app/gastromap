/**
 * Schema validation utilities for GastroMap
 * Prevents "column not found" errors by validating fields against actual DB schema
 */

// Columns that ACTUALLY exist in the locations table (verified against migrations)
// IMPORTANT: Only include columns that exist in the CURRENT DB schema.
// Columns that were dropped must NOT be here — they go in DEPRECATED_COLUMNS.
export const VALID_LOCATION_COLUMNS = new Set([
    // Core fields
    'id', 'title', 'description', 'address',
    'city', 'country', 'category', 'status',
    'lat', 'lng', 'city_slug', 'country_slug',
    
    // Media (canonical columns only)
    'image', 'image_url', 'google_photos',
    
    // Rating & Price
    'google_rating', 'google_user_ratings_total',
    'price_range', 'google_price_level',
    
    // Flags & Meta
    'is_hidden_gem', 'is_featured',
    
    // Cuisine (canonical is cuisine_types; legacy 'cuisine' text still exists)
    'cuisine_types', 'cuisine',
    
    // Arrays
    'tags', 'vibe', 'special_labels', 'best_for', 'best_time_to_visit',
    'noise_level', 'average_visit_duration',
    'amenities', 'dietary_options',
    
    // Amenities (canonical booleans only — outdoor_seating & reservation_required were DROPPED)
    'has_wifi', 'has_outdoor_seating',
    'pet_friendly', 'child_friendly',
    'reservations_required',
    
    // Content
    'opening_hours', 'website', 'phone', 'booking_url',
    'insider_tip', 'must_try', 'what_to_try',
    
    // Google External Info
    'google_place_id', 'google_maps_url', 'google_formatted_address', 'google_vicinity',
    
    // AI Content & Metadata
    'ai_keywords', 'ai_context', 'embedding', 'ai_enriched',
    'ai_description_generated', 'ai_insider_tip_generated', 'ai_must_try_generated',
    'ai_enrichment_status', 'ai_enrichment_error', 'ai_enrichment_last_attempt',
    
    // KG enrichment fields
    'kg_cuisines', 'kg_dishes', 'kg_ingredients', 'kg_allergens', 'kg_enriched_at',
    
    // Michelin
    'michelin_stars', 'michelin_bib',
    
    // Social
    'social_instagram', 'social_facebook',
    
    // Analytics (read-only, but valid columns)
    'views_count', 'saves_count', 'visits_count', 'comments_count',
    'trending_score', 'trending_at',
    
    // Admin
    'moderation_note',
    'created_at', 'updated_at'
]);

// Deprecated/dropped column names — mapped to their canonical replacements.
// sanitizePayload() checks this AFTER VALID_LOCATION_COLUMNS, so keys here
// must NOT also appear in VALID_LOCATION_COLUMNS.
export const DEPRECATED_COLUMNS = {
    'rating': 'google_rating',                    // No 'rating' column in DB
    'price_level': 'price_range',                 // Renamed
    'images': 'google_photos',                    // Renamed
    'photos': 'google_photos',                    // Legacy field name
    'features': 'amenities',                      // Renamed
    'dietary': 'dietary_options',                  // Renamed
    'outdoor_seating': 'has_outdoor_seating',     // DROPPED in 20260428
    'reservation_required': 'reservations_required', // DROPPED in 20260428
    'wifi_quality': 'has_wifi',                   // DROPPED in 20260428
    'image': 'image_url',                         // Legacy; canonical is image_url
};

/**
 * Deeply sanitizes values to prevent XSS
 */
function sanitizeValue(value) {
    if (typeof value === 'string') {
        return value
            .replace(/<[^>]*>?/gm, '') // Remove HTML tags
            .replace(/on\w+="[^"]*"/gm, '') // Remove inline events
            .trim();
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value !== null && typeof value === 'object') {
        const cleaned = {};
        for (const [k, v] of Object.entries(value)) {
            cleaned[k] = sanitizeValue(v);
        }
        return cleaned;
    }
    return value;
}

/**
 * Filters payload to only include valid DB columns and sanitizes values.
 * Prevents PostgREST schema cache errors and Stored XSS.
 * 
 * Order of checks:
 * 1. DEPRECATED_COLUMNS — remap to canonical name (checked FIRST to catch legacy keys)
 * 2. VALID_LOCATION_COLUMNS — pass through as-is
 * 3. Everything else — stripped with console warning
 */
export function sanitizePayload(payload, validColumns = VALID_LOCATION_COLUMNS) {
    const sanitized = {};
    const removed = [];
    
    for (const [key, value] of Object.entries(payload)) {
        // Check deprecated FIRST — ensures remapping even if key exists in valid set
        if (key in DEPRECATED_COLUMNS) {
            const canonical = DEPRECATED_COLUMNS[key];
            if (canonical && !sanitized[canonical]) {
                sanitized[canonical] = sanitizeValue(value);
            }
            removed.push(`${key}→${canonical || 'dropped'}`);
        } else if (validColumns.has(key)) {
            sanitized[key] = sanitizeValue(value);
        } else {
            removed.push(key);
        }
    }
    
    if (removed.length > 0) {
        console.warn(`[sanitizePayload] Remapped/removed: ${removed.join(', ')}`);
    }
    
    return sanitized;
}

/**
 * Check if a column name is valid for locations table
 */
export function isValidColumn(columnName) {
    return VALID_LOCATION_COLUMNS.has(columnName);
}
