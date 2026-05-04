import { supabase } from './client'

export async function getUserPreferences(userId) {
    if (!supabase) return {}

    const { data: up, error } = await supabase
        .from('user_preferences')
        .select('favorite_cuisines, vibe_preferences, dietary_restrictions, price_range, foodie_dna, atmosphere_preference, features, onboarding_completed')
        .eq('user_id', userId)
        .maybeSingle()

    if (!up || error) return {}
    return {
        longTerm: {
            favoriteCuisines:     up.favorite_cuisines  || [],
            vibePreference:       up.vibe_preferences     || [],
            dietaryRestrictions:  up.dietary_restrictions || [],
            priceRange:           up.price_range ? up.price_range.split(',') : [],
            foodieDNA:            up.foodie_dna || '',
            atmospherePreference: up.atmosphere_preference || '',
            features:             up.features ? (typeof up.features === 'string' ? up.features.split(',') : up.features) : [],
            onboardingCompleted:  up.onboarding_completed || false,
        }
    }
}

export async function updateUserPreferences(userId, preferences) {
    if (!supabase) return { error: 'No Supabase' }

    const dna = preferences?.longTerm || preferences || {}
    const { error: e2 } = await supabase
        .from('user_preferences')
        .upsert({
            user_id:              userId,
            favorite_cuisines:    dna.favoriteCuisines    || [],
            vibe_preferences:     dna.vibePreference      || [],
            dietary_restrictions: dna.dietaryRestrictions || [],
            price_range:          Array.isArray(dna.priceRange) ? dna.priceRange.join(',') : (dna.priceRange || null),
            foodie_dna:           dna.foodieDNA || '',
            atmosphere_preference: dna.atmospherePreference || '',
            features:             Array.isArray(dna.features) ? dna.features.join(',') : (dna.features || ''),
            onboarding_completed: dna.onboardingCompleted || false,
            last_updated:         new Date().toISOString(),
        }, { onConflict: 'user_id' })
    return { data: null, error: e2 }
}

