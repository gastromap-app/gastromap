import { supabase } from '../client.js'

/**
 * @typedef {Object} PersonalContext
 * @property {string|null} foodieDNA
 * @property {Array<string>} dietaryRestrictions
 * @property {Array<string>} favoriteCuisines
 * @property {Array<{ city: string, country: string|null, visits: number }>} locationHistory
 * @property {Array<{ id: string, title: string }>} favorites
 * @property {Array<{ id: string, title: string }>} visited
 * @property {string|null} sessionSummary
 */

/**
 * Load personal context for the AI bot. Graceful — returns null fields for
 * anything that's empty or fails. Never blocks the bot from working.
 *
 * @param {string} userId
 * @param {string|null} sessionId
 * @returns {Promise<PersonalContext|null>}
 */
export async function loadPersonalContext(userId, sessionId) {
  if (!userId || !supabase) return null

  try {
    const [prefsRes, favoritesRes, visitedRes, summaryRes, historyRes] = await Promise.all([
      supabase.from('user_preferences').select('dietary_restrictions, favorite_cuisines, vibe_preferences, price_range, foodie_dna, atmosphere_preference, features').eq('user_id', userId).maybeSingle(),
      supabase.from('user_favorites').select('location_id, locations(id, title)').eq('user_id', userId).limit(20),
      supabase.from('user_visits').select('location_id, locations(id, title)').eq('user_id', userId).order('visited_at', { ascending: false }).limit(20),
      sessionId ? supabase.from('chat_sessions').select('summary').eq('id', sessionId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('user_location_history').select('city, country, visit_count').eq('user_id', userId).order('visit_count', { ascending: false }).limit(10),
    ])

    return {
      foodieDNA: prefsRes.data?.foodie_dna || null,
      dietaryRestrictions: prefsRes.data?.dietary_restrictions || [],
      favoriteCuisines: prefsRes.data?.favorite_cuisines || [],
      locationHistory: (historyRes.data || []).map(h => ({ city: h.city, country: h.country, visits: h.visit_count })),
      favorites: (favoritesRes.data || []).map(f => f.locations || { id: f.location_id, title: null }).filter(l => l.id),
      visited: (visitedRes.data || []).map(v => v.locations || { id: v.location_id, title: null }).filter(l => l.id),
      sessionSummary: summaryRes.data?.summary || null,
    }
  } catch (err) {
    console.warn('[ContextLoader] Failed to load personal context:', err?.message)
    return null
  }
}
