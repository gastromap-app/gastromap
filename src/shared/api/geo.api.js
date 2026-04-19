/**
 * geo.api.js — Country / City cover image management.
 *
 * Table: public.geo_covers  (slug, geo_type, name, image_url)
 * Bucket: storage/geo-covers  (public, max 5 MB, images only)
 */
import { supabase } from '@/shared/api/client'

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Fetch all geo covers of a given type ('country' | 'city'). */
export async function getGeoCovers(geoType = 'country') {
    const { data, error } = await supabase
        .from('geo_covers')
        .select('id, slug, geo_type, name, image_url')
        .eq('geo_type', geoType)
        .order('slug')
    if (error) throw error
    return data ?? []
}

/** Fetch a single cover by slug + type. Returns null when not found. */
export async function getGeoCover(slug, geoType = 'country') {
    const { data } = await supabase
        .from('geo_covers')
        .select('image_url')
        .eq('slug', slug)
        .eq('geo_type', geoType)
        .maybeSingle()
    return data?.image_url ?? null
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Upload a file to the geo-covers bucket and return the public URL.
 * Always upserts (replaces) the file at the same path.
 */
export async function uploadGeoCoverImage(file, slug, geoType = 'country') {
    const ext  = file.name.split('.').pop().toLowerCase()
    const path = `${geoType}/${slug}.${ext}`

    const { error: uploadError } = await supabase.storage
        .from('geo-covers')
        .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('geo-covers').getPublicUrl(path)
    // Bust cache by appending a timestamp so the new image loads immediately
    return `${data.publicUrl}?t=${Date.now()}`
}

/**
 * Save (insert or update) a geo cover record.
 * `image_url` can be a Storage URL or any external URL.
 */
export async function upsertGeoCover({ slug, geo_type = 'country', name, image_url }) {
    const { error } = await supabase
        .from('geo_covers')
        .upsert(
            { slug, geo_type, name, image_url },
            { onConflict: 'slug,geo_type' }
        )
    if (error) throw error
}

/** Delete a geo cover record (and optionally its storage file). */
export async function deleteGeoCover(slug, geoType = 'country') {
    const { error } = await supabase
        .from('geo_covers')
        .delete()
        .eq('slug', slug)
        .eq('geo_type', geoType)
    if (error) throw error
}
