import { useQuery } from '@tanstack/react-query'
import { getCityImage } from '@/services/nominatimApi'
import { supabase } from '@/shared/api/client'

/**
 * Fetch cities for a country from the locations table in Supabase.
 * Returns only cities that have approved locations in the database.
 *
 * React Query caches: stale after 24h, kept in memory 48h.
 */
export function useCitiesQuery(country) {
    // Capitalize first letter and replace dashes with spaces for country name
    const countryName = country
        ? country.charAt(0).toUpperCase() + country.slice(1).replace(/-/g, ' ')
        : country

    return useQuery({
        queryKey: ['cities', country?.toLowerCase()],
        queryFn: async () => {
            // Get unique cities from locations table filtered by country
            const { data, error } = await supabase
                .from('locations')
                .select('city')
                .ilike('country', `%${countryName}%`)
                .in('status', ['active', 'approved'])
                .not('city', 'is', null)

            if (error) {
                throw new Error(`Failed to fetch cities: ${error.message}`)
            }

            if (!data || data.length === 0) {
                return []
            }

            // Fetch geo covers for cities
            const { data: coversData } = await supabase
                .from('geo_covers')
                .select('slug, image_url')
                .eq('geo_type', 'city')

            const coverMap = Object.fromEntries(
                (coversData || []).map(c => [c.slug, c.image_url])
            )

            // Aggregate unique cities and count locations in each
            const cityMap = {}
            data.forEach(row => {
                const name = row.city
                if (!name) return
                cityMap[name] = (cityMap[name] || 0) + 1
            })

            // Convert to array format with count and image
            const cities = Object.entries(cityMap).map(([name, count]) => {
                const slug = name.toLowerCase().replace(/\s+/g, '-')
                return {
                    name,
                    count,
                    image: coverMap[slug] || getCityImage(name),
                }
            })

            // Sort by count (descending) then by name
            cities.sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count
                return a.name.localeCompare(b.name)
            })

            return cities
        },
        staleTime: 24 * 60 * 60 * 1000,
        gcTime:    48 * 60 * 60 * 1000,
        enabled: !!country,
        retry: 1,
    })
}
