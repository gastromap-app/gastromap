import { supabase } from '../../client.js'

export async function recordGuardrailEvent({ stage, verdict, turnId, reason, payload = {}, userId = null, sessionId = null }) {
  // Sanitize payload — strip sensitive fields
  const sanitized = { ...payload }
  for (const key of Object.keys(sanitized)) {
    if (/key|secret|token|password/i.test(key)) delete sanitized[key]
  }

  try {
    console.log(`[Guardrail] ${stage}/${verdict}: ${reason}`, { turnId })
    if (supabase) {
      await supabase.from('ai_guardrail_events').insert({
        stage, verdict, turn_id: turnId, reason,
        payload: sanitized, user_id: userId, session_id: sessionId,
      })
    }
  } catch (err) {
    console.warn('[Guardrail] Failed to record event:', err?.message)
  }
}
