import { supabase } from '../client.js'

export async function getSessionLocations(sessionId) {
  if (!sessionId || !supabase) return []
  try {
    const { data, error } = await supabase
      .from('session_locations')
      .select('location_id, shown_at')
      .eq('session_id', sessionId)
      .order('shown_at', { ascending: false })
    if (error) { console.warn('[SessionLocations] read error:', error.message); return [] }
    return (data || []).map(row => ({ id: row.location_id, shown_at: row.shown_at }))
  } catch { return [] }
}

export async function recordSessionLocations(sessionId, locations, userId) {
  if (!sessionId || !userId || !locations?.length || !supabase) return
  const rows = locations.map((loc, i) => ({
    session_id: sessionId,
    location_id: loc.id,
    user_id: userId,
    position: i,
    shown_at: new Date().toISOString(),
  }))
  try {
    await supabase
      .from('session_locations')
      .upsert(rows, { onConflict: 'session_id,location_id' })
  } catch (err) {
    console.warn('[SessionLocations] write error:', err?.message)
  }
}
