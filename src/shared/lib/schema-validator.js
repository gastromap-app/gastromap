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
    'lat', 'lng', 'city_slug', 'country_slug',
    
    // Media
    'image', 'image_url', 'google_photos', 'photos',
    
    // Rating & Price
    'google_rating', 'google_user_ratings_total',
    'price_range', 'google_price_level',
    
    // Flags & Meta
    'is_hidden_gem', 'is_featured', 'status',
    
    // Cuisine
    'cuisine_types', 'cuisine',
    
    // Ambience & Logistics
    'tags', 'vibe', 'special_labels', 'best_for', 'best_time_to_visit',
    'noise_level', 'average_visit_duration',
    'amenities', 'features', 'dietary_options', 'dietary',
    
    // Amenities (specific)
    'has_wifi', 'has_outdoor_seating', 'outdoor_seating',
    'pet_friendly', 'child_friendly',
    'reservations_required', 'reservation_required',
    
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
    
    // Analytics
    'views_count', 'saves_count', 'visits_count', 'comments_count',
    'trending_score', 'trending_at',
    
    // Admin
    'moderation_note',
    'created_at', 'updated_at'
]);

// Deprecated column names (should be mapped to canonical names)
export const DEPRECATED_COLUMNS = {
    'rating': 'google_rating',            // Column removed from DB; use google_rating
    'price_level': 'price_range',         // Renamed for clarity
    'images': 'google_photos',            // Renamed
    'image_url': null,                     // Still valid, no mapping needed
    // Legacy UI fields that should be removed from form data
    'cuisine': 'cuisine_types',           // Legacy single-value field
    'photos': 'google_photos',            // Legacy field name
    'features': 'amenities',              // Renamed
    'dietary': 'dietary_options',         // Renamed
};

/**
 * Deeply sanitizes values to prevent XSS
 */
function sanitizeValue(value) {
    if (typeof value === 'string') {
        // Basic but effective XSS protection: strip HTML tags and dangerous attributes
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
 * Filters payload to only include valid DB columns and sanitizes values
 * Prevents PostgREST schema cache errors and Stored XSS
 */
export function sanitizePayload(payload, validColumns = VALID_LOCATION_COLUMNS) {
    const sanitized = {};
    const removed = [];
    
    for (const [key, value] of Object.entries(payload)) {
        if (validColumns.has(key)) {
            sanitized[key] = sanitizeValue(value);
        } else if (DEPRECATED_COLUMNS[key]) {
            // Remap deprecated column to canonical name
            const canonical = DEPRECATED_COLUMNS[key];
            if (canonical) {
                sanitized[canonical] = sanitizeValue(value);
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
