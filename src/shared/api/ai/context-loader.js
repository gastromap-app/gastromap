import { supabase } from '../../client.js'

/**
 * @typedef {Object} PersonalContext
 * @property {string|null} foodieDNA
 * @property {Array<string>} dietaryRestrictions
 * @property {Array<{ city: string, country: string|null, visits: number }>} locationHistory
 * @property {Array<{ id: string, title: string }>} favorites
 * @property {Array<{ id: string, title: string }>} visited
 * @property {string|null} sessionSummary
 */

/**
 * @param {string} userId
 * @param {'personal'|'factual'|'off_topic'} kind
 * @param {string|null} sessionId
 * @returns {Promise<PersonalContext|null>}
 */
export async function loadPersonalContext(userId, kind, sessionId) {
  if (kind !== 'personal' || !userId || !supabase) return null

  try {
    const [profileRes, prefsRes, favoritesRes, visitedRes, summaryRes, historyRes] = await Promise.all([
      supabase.from('profiles').select('foodie_dna').eq('id', userId).single(),
      supabase.from('user_preferences').select('dietary_restrictions, favorite_cuisines, vibe_preference, price_range').eq('user_id', userId).single(),
      supabase.from('favorites').select('location_id, locations(id, title)').eq('user_id', userId).limit(20),
      supabase.from('location_visits').select('location_id, locations(id, title)').eq('user_id', userId).order('visited_at', { ascending: false }).limit(20),
      sessionId ? supabase.from('chat_sessions').select('summary').eq('id', sessionId).single() : Promise.resolve({ data: null }),
      supabase.from('user_location_history').select('city, country, visit_count').eq('user_id', userId).order('visit_count', { ascending: false }).limit(10),
    ])

    return {
      foodieDNA: profileRes.data?.foodie_dna || null,
      dietaryRestrictions: prefsRes.data?.dietary_restrictions || [],
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
