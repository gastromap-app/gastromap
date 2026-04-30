/**
 * Utility for exporting and importing location data in CSV format.
 */

export const LOCATION_FIELDS = [
    'id', 'title', 'category', 'country', 'city', 'address', 'description', 
    'insider_tip', 'must_try', 'price_range', 'website', 'phone', 
    'opening_hours', 'booking_url', 'image_url', 'lat', 'lng', 
    'is_hidden_gem', 'is_featured', 'status', 'special_labels', 
    'social_links', 'best_time_to_visit', 'tags', 'google_place_id', 
    'google_rating', 'cuisine_types', 'dietary_options', 'amenities', 
    'payment_methods', 'parking_info', 'accessibility_features', 
    'average_visit_duration', 'best_for', 'noise_level', 'wifi_quality', 
    'outdoor_seating', 'pet_friendly', 'child_friendly', 'reservation_required', 
    'dress_code', 'social_instagram', 'social_facebook', 'google_maps_url', 
    'vibe', 'what_to_try', 'michelin_stars', 'michelin_bib'
]

/**
 * Generates a CSV template with headers
 */
export const downloadCSVTemplate = () => {
    const headers = LOCATION_FIELDS.join(',')
    const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'gastromap_locations_template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

/**
 * Converts locations data to CSV and triggers download
 */
export const exportLocationsToCSV = (locations) => {
    if (!locations || locations.length === 0) return

    const rows = locations.map(loc => {
        return LOCATION_FIELDS.map(field => {
            let value = loc[field]
            
            // Handle arrays
            if (Array.isArray(value)) {
                value = value.join(';')
            } 
            // Handle JSON/Objects
            else if (value !== null && typeof value === 'object') {
                value = JSON.stringify(value)
            }
            
            // Escape quotes and wrap in quotes for CSV
            const stringValue = value === null || value === undefined ? '' : String(value)
            const escapedValue = stringValue.replace(/"/g, '""')
            return `"${escapedValue}"`
        }).join(',')
    })

    const csvContent = [LOCATION_FIELDS.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `gastromap_locations_export_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

/**
 * Helper to process imported CSV data back to database format
 */
export const processImportedRow = (row) => {
    const processed = {}
    
    LOCATION_FIELDS.forEach(field => {
        let value = row[field]
        
        if (value === '' || value === undefined || value === '—') {
            processed[field] = null
            return
        }

        // List of array fields
        const arrayFields = [
            'special_labels', 'best_time_to_visit', 'tags', 'cuisine_types', 
            'dietary_options', 'amenities', 'payment_methods', 
            'accessibility_features', 'best_for', 'vibe', 'what_to_try'
        ]

        // List of JSON fields
        const jsonFields = ['social_links']

        // List of numeric fields
        const numericFields = ['lat', 'lng', 'google_rating', 'michelin_stars', 'average_visit_duration']

        // List of boolean fields
        const booleanFields = [
            'is_hidden_gem', 'is_featured', 'outdoor_seating', 
            'pet_friendly', 'child_friendly', 'reservation_required', 
            'michelin_bib'
        ]

        if (arrayFields.includes(field)) {
            processed[field] = value.split(';').map(s => s.trim()).filter(Boolean)
        } else if (jsonFields.includes(field)) {
            try {
                processed[field] = JSON.parse(value)
            } catch (e) {
                processed[field] = []
            }
        } else if (numericFields.includes(field)) {
            processed[field] = value === '' ? null : Number(value)
        } else if (booleanFields.includes(field)) {
            processed[field] = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes'
        } else {
            processed[field] = value
        }
    })

    return processed
}
