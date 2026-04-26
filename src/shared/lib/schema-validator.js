/**
 * Schema validation utilities for GastroMap
 * Prevents "column not found" errors by validating fields against actual DB schema
 */

// Columns that exist in locations table (verified from migrations)
// Use this list to prevent sending non-existent columns to Supabase
export const VALID_LOCATION_COLUMNS = new Set([
    // Core fields
    'id', 'title', 'description', 'address',
    'city', 'country', 'category', 'status',
    'lat', 'lng',
    
    // Media
    'image', 'image_url', 'google_photos', 'photos',
    
    // Rating & Price (only canonical names)
    'google_rating', 'price_range',
    
    // Cuisine
    'cuisine_types', 'cuisine',
    
    // Features
    'tags', 'vibe', 'special_labels', 'best_for',
    'amenities', 'features', 'dietary_options', 'dietary',
    
    // Amenities (specific)
    'wifi_quality', 'has_wifi',
    'outdoor_seating', 'has_outdoor_seating',
    'reservation_required', 'reservations_required',
    
    // Content
    'opening_hours', 'website', 'phone', 'booking_url',
    'insider_tip', 'must_try', 'what_to_try',
    
    // AI fields
    'ai_keywords', 'ai_context', 'embedding',
    'ai_enrichment_status', 'ai_enrichment_error', 'ai_enrichment_last_attempt',
    
    // KG enrichment fields
    'kg_cuisines', 'kg_dishes', 'kg_ingredients', 'kg_allergens', 'kg_enriched_at',
    
    // Michelin
    'michelin_stars', 'michelin_bib',
    
    // Meta
    'moderation_note',
    'created_at', 'updated_at'
]);

// Deprecated column names (should be mapped to canonical names)
export const DEPRECATED_COLUMNS = {
    'rating': 'google_rating',           // Was renamed in schema migrations
    'price_level': 'price_range',         // Renamed for clarity
    'images': 'google_photos',            // Renamed
    'image_url': null,                     // Still valid, no mapping needed
};

/**
 * Filters payload to only include valid DB columns
 * Prevents PostgREST schema cache errors
 */
export function sanitizePayload(payload, validColumns = VALID_LOCATION_COLUMNS) {
    const sanitized = {};
    const removed = [];
    
    for (const [key, value] of Object.entries(payload)) {
        if (validColumns.has(key)) {
            sanitized[key] = value;
        } else if (DEPRECATED_COLUMNS[key]) {
            // Remap deprecated column to canonical name
            const canonical = DEPRECATED_COLUMNS[key];
            if (canonical) {
                sanitized[canonical] = value;
            }
            removed.push(`${key}→${canonical}`);
        } else {
            removed.push(key);
        }
    }
    
    if (removed.length > 0) {
        console.warn(`[sanitizePayload] Removed invalid columns: ${removed.join(', ')}`);
    }
    
    return sanitized;
}

/**
 * Check if a column name is valid for locations table
 */
export function isValidColumn(columnName) {
    return VALID_LOCATION_COLUMNS.has(columnName);
}
