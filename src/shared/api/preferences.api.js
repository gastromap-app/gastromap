import { supabase } from './client'

export async function getUserPreferences(userId) {
    if (!supabase) return {}

    // Try `profiles` table first (legacy)
    const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .single()
    if (!error && data?.preferences) return data.preferences

    // Fallback: try `user_profiles` table (new schema)
    const { data: up } = await supabase
        .from('user_profiles')
        .select('dna_cuisines, dna_vibes, dna_allergens, dna_price')
        .eq('id', userId)
        .single()

    if (!up) return {}
    return {
        longTerm: {
            favoriteCuisines:     up.dna_cuisines  || [],
            vibePreference:       up.dna_vibes     || [],
            dietaryRestrictions:  up.dna_allergens || [],
            priceRange:           up.dna_price     || [],
        }
    }
}

export async function updateUserPreferences(userId, preferences) {
    if (!supabase) return { error: 'No Supabase' }

    // Try `profiles` table first (legacy)
    const { data, error } = await supabase
        .from('profiles')
        .update({ preferences })
        .eq('id', userId)
        .select('preferences')
        .single()

    if (!error) return { data, error: null }

    // Fallback: try `user_profiles` table (new schema)
    const dna = preferences?.longTerm || preferences || {}
    const { error: e2 } = await supabase
        .from('user_profiles')
        .upsert({
            id:           userId,
            dna_cuisines: dna.favoriteCuisines    || [],
            dna_vibes:    dna.vibePreference      || [],
            dna_allergens: dna.dietaryRestrictions || [],
            dna_price:    dna.priceRange          || [],
            updated_at:   new Date().toISOString(),
        })
    return { data: null, error: e2 }
}
