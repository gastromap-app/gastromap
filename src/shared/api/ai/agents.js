/**
 * Agentic Pipeline — Single execution path
 *
 * User message → LLM tool call → Semantic_Search → Location results → LLM response
 *
 * Exports:
 *   - runAgentPass(messages, ctx) — the single agentic loop
 *   - buildResponseMessages(usedLocations, userQuery, ...) — 2nd-call message builder (used by analysis.js)
 */

import { fetchOpenRouter } from './openrouter'
import { executeTool } from './tools'
import { MODEL_CASCADE } from './constants'
import { getOperationalRules } from './operational-rules'

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * runAgentPass — the single agentic loop.
 *
 * @param {Object[]} messages - Full message array (system + history + user)
 * @param {Object}   ctx      - { userId, sessionId, conversationHistory, sessionSummary, userData, geoCity, dietary }
 * @returns {Promise<{ text, usedLocations, attachments, modelUsed, toolCalls, timing }>}
 */
export async function runAgentPass(messages, ctx = {}) {
  const startTime = Date.now()
  const { cascade, temperature, maxTokens, useV2, cfg } = await readAdminConfig()

  // ── V2 Input Guardrail (gated behind feature flag) ──────────────────────
  if (useV2) {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    const userText = lastUserMsg?.content || ''

    const { classifyQuery } = await import('./guardrails/input.js')
    const queryClassification = classifyQuery(userText, { threshold: cfg?.guardThreshold ?? 0.6 })

    if (queryClassification.kind === 'off_topic') {
      const { recordGuardrailEvent } = await import('./guardrails/audit.js')
      await recordGuardrailEvent({
        stage: 'input', verdict: 'rejected', turnId: `turn_${Date.now()}`,
        reason: queryClassification.reason,
        userId: ctx?.userId, sessionId: ctx?.sessionId,
      })
      return {
        text: "I'm GastroGuide — I specialize in helping you discover great food spots! I can't help with that topic, but I'd love to help you find an amazing restaurant, café, or bar. What are you in the mood for?",
        usedLocations: [], attachments: [], modelUsed: 'guardrail',
        toolCalls: [], timing: { startMs: startTime, toolExecutionMs: 0, totalMs: Date.now() - startTime },
      }
    }
  }

  const sessionOpts = { sessionId: ctx?.sessionId || null, userId: ctx?.userId || null }

  // ── 1st LLM call — with tools ──────────────────────────────────────────
  const { response: firstRes, modelUsed } = await callLLMWithRetry(messages, {
    withTools: true, toolChoice: 'auto',
    cascade, temperature, maxTokens, ...sessionOpts,
  })
  const firstData = await firstRes.json()
  const choice = firstData.choices?.[0]
  if (!choice) throw new Error('No response from OpenRouter')

  const assistantMsg = choice.message
  const toolCalls = collectToolCalls(assistantMsg)

  // ── No tool call → return model text directly ──────────────────────────
  if (toolCalls.length === 0) {
    let text = cleanModelOutput(assistantMsg?.content || '')

    // V2 output guardrail
    if (useV2 && text) {
      text = await applyOutputGuardrail(text, ctx)
    }

    return {
      text, usedLocations: [], attachments: [], modelUsed,
      toolCalls: [], timing: { startMs: startTime, toolExecutionMs: 0, totalMs: Date.now() - startTime },
    }
  }

  // ── Execute each tool call ─────────────────────────────────────────────
  const toolStart = Date.now()
  const trackedToolCalls = []
  let usedLocations = []

  for (const tc of toolCalls) {
    const args = parseArgs(tc.function.arguments)
    let result
    try {
      result = await executeTool(tc.function.name, args, ctx)
    } catch (err) {
      console.error('[runAgentPass] executeTool error:', err?.message)
      result = { results: [] }
    }

    const resultList = result?.results || []
    trackedToolCalls.push({ name: tc.function.name, args, resultCount: resultList.length })

    if (resultList.length > 0) {
      usedLocations = resultList.slice(0, 5)
    }
  }
  const toolExecutionMs = Date.now() - toolStart

  // ── 2nd LLM call — generate natural-language response ──────────────────
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const userText = lastUserMsg?.content || ''
  const userContext = {
    city: ctx?.geoCity || null,
    foodieDNA: ctx?.userData?.foodieDNA || null,
    dietary: ctx?.dietary || [],
    favoriteCuisines: ctx?.userData?.favoriteCuisines || [],
  }
  const responseMessages = buildResponseMessages(
    usedLocations, userText, userContext,
    ctx?.conversationHistory || [], ctx?.sessionSummary || null,
  )

  const { response: secondRes, modelUsed: secondModel } = await callLLMWithRetry(responseMessages, {
    withTools: false, cascade, temperature, maxTokens, ...sessionOpts,
  })
  const secondData = await secondRes.json()
  let text = cleanModelOutput(secondData.choices?.[0]?.message?.content ?? '')

  // ── Guards ─────────────────────────────────────────────────────────────
  if (isGarbageResponse(text) && usedLocations.length > 0) {
    text = buildTemplateResponse(usedLocations, userText) || ''
  }
  if (text && usedLocations.length > 0) {
    const validated = validateGrounding(text, usedLocations)
    if (validated === null) {
      text = buildTemplateResponse(usedLocations, userText) || ''
    } else {
      text = validated
    }
  }
  if (!text && usedLocations.length > 0) {
    text = buildTemplateResponse(usedLocations, userText) || usedLocations.map(l => `**${l.title || l.name}**`).join(', ')
  }
  if (!text) {
    text = "I couldn't find places matching your criteria. Try a broader search!"
  }

  // V2 output guardrail
  if (useV2 && text) {
    text = await applyOutputGuardrail(text, ctx)
  }

  return {
    text, usedLocations, attachments: usedLocations,
    modelUsed: secondModel, toolCalls: trackedToolCalls,
    timing: { startMs: startTime, toolExecutionMs, totalMs: Date.now() - startTime },
  }
}

/**
 * Build the message array for the 2nd LLM call (response generation).
 * Uses OPERATIONAL_RULES as system prompt and injects tool results as structured
 * data in the system message.
 *
 * @param {Object[]} usedLocations - Location objects from tool execution
 * @param {string} userQuery - Original user question
 * @param {Object} [userContext] - Optional soft user context (DNA, dietary, city)
 * @param {Object[]} [conversationHistory] - Recent conversation turns
 * @param {string|null} [sessionSummary] - Session summary for long-term memory
 * @returns {Object[]} - Messages array for fetchOpenRouter
 */
export function buildResponseMessages(usedLocations, userQuery, userContext = null, conversationHistory = [], sessionSummary = null) {
  const rules = getOperationalRules()
  const langInstruction = 'IMPORTANT: Respond in the SAME language the user wrote their message in. Never switch languages.'

  let summaryBlock = ''
  if (sessionSummary) {
    summaryBlock = `\n\n[SESSION SUMMARY — what was discussed earlier]\n${sessionSummary}`
  }

  let userBlock = ''
  if (userContext) {
    const parts = []
    if (userContext.city) parts.push(`User city: ${userContext.city}`)
    if (userContext.foodieDNA) parts.push(`Taste profile: ${userContext.foodieDNA}`)
    if (userContext.dietary?.length) parts.push(`Dietary: ${userContext.dietary.join(', ')}`)
    if (userContext.favoriteCuisines?.length) parts.push(`Favorite cuisines: ${userContext.favoriteCuisines.join(', ')}`)
    if (parts.length > 0) {
      userBlock = `\n\n[USER CONTEXT — use silently for personalization, NEVER mention explicitly]\n${parts.join('\n')}`
    }
  }

  let locationBlock = ''
  if (usedLocations && usedLocations.length > 0) {
    const items = usedLocations.slice(0, 5).map((l, i) => {
      const name = l.title || l.name || 'Unnamed location'
      const parts = [`${i + 1}. ${name}`]
      if (l.category) parts.push(`   Category: ${l.category}`)
      if (l.city) parts.push(`   City: ${l.city}`)
      if (l.google_rating || l.rating) parts.push(`   Rating: ${l.google_rating || l.rating}`)
      if (l.price_range) parts.push(`   Price: ${l.price_range}`)
      if (l.description) parts.push(`   About: ${l.description.slice(0, 150)}`)
      if (l.vibe?.length) parts.push(`   Vibe: ${l.vibe.slice(0, 3).join(', ')}`)
      if (l.insider_tip) parts.push(`   Insider tip: ${l.insider_tip}`)
      if (l.what_to_try?.length) parts.push(`   Must try: ${l.what_to_try.slice(0, 3).join(', ')}`)
      if (l.distance) parts.push(`   Distance: ${l.distance}m`)
      return parts.join('\n')
    })
    locationBlock = `\n\n---\nDATA FROM DATABASE (these are the ONLY places you may mention):\n${items.join('\n\n')}\n\n⚠️ RULES FOR THIS DATA:\n- You MUST describe places from this list. Do NOT invent places.\n- If the places don't exactly match what the user asked for (e.g., they asked for restaurants but we found cafes), STILL recommend them — explain what you found and why it might interest them.\n- NEVER say "I couldn't find anything" when this DATA section contains places.`
  } else {
    locationBlock = '\n\n---\nNo places found matching the criteria. Suggest the user try a broader search (different area, cuisine type, or price range). Be helpful and encouraging.'
  }

  const systemContent = `${rules}\n\n${langInstruction}${summaryBlock}${userBlock}${locationBlock}`
  const messages = [{ role: 'system', content: systemContent }]

  // Include conversation history for context continuity (last 10 turns)
  if (conversationHistory && conversationHistory.length > 0) {
    const validHistory = conversationHistory
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .filter(m => m.content && m.content.trim() && m.content !== '…')
      .slice(-10)

    const historyTurns = validHistory.map((m, i, arr) => {
      const isRecent = i >= arr.length - 4
      const content = isRecent
        ? m.content.slice(0, 500)
        : m.content.slice(0, 120) + (m.content.length > 120 ? '...' : '')
      return { role: m.role, content }
    })
    messages.push(...historyTurns)
  }

  if (userQuery && userQuery.trim()) {
    messages.push({ role: 'user', content: userQuery })
  }

  return messages
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

/**
 * callLLMWithRetry — cascade + one retry on retryable errors.
 * fetchOpenRouter handles the cascade internally; this adds a single whole-call retry.
 */
async function callLLMWithRetry(messages, opts) {
  try {
    return await fetchOpenRouter(messages, opts)
  } catch (err) {
    if (isRetryableError(err)) {
      const delayMs = 500 + Math.floor(Math.random() * 1500)
      await new Promise(r => setTimeout(r, delayMs))
      return await fetchOpenRouter(messages, opts)
    }
    throw err
  }
}

/**
 * collectToolCalls — unified parser for native tool_calls and XML <tool_call> blocks.
 */
function collectToolCalls(assistantMsg) {
  if (!assistantMsg) return []

  // Native OpenAI tool_calls
  if (assistantMsg.tool_calls?.length) {
    return assistantMsg.tool_calls
  }

  // XML <tool_call> blocks in content
  return parseXmlToolCalls(assistantMsg.content)
}

/**
 * Parse XML tool call blocks from model content.
 * Handles: <tool_call><function=name><parameter=key>val</parameter></function></tool_call>
 * and JSON-in-XML: <tool_call>{"name":"...","arguments":{...}}</tool_call>
 */
function parseXmlToolCalls(text) {
  if (!text) return []
  const calls = []

  const blockRe = /<tool_call[^>]*>([\s\S]*?)<\/tool_call>/gi
  let m
  while ((m = blockRe.exec(text)) !== null) {
    const block = m[1]

    // Sub-format A: <function=search_locations> or <function name="search_locations">
    const fnMatch = /<function[=\s]+"?([^\s"<>]+)"?/i.exec(block)
    if (fnMatch) {
      const name = fnMatch[1].trim()
      const args = {}
      const paramRe = /<parameter[=\s]+"?([^\s"<>]+)"?[^>]*>([\s\S]*?)<\/parameter>/gi
      let pm
      while ((pm = paramRe.exec(block)) !== null) {
        const key = pm[1].trim()
        const raw = pm[2].trim()
        if (raw !== '' && !isNaN(raw)) args[key] = Number(raw)
        else if (raw === 'true') args[key] = true
        else if (raw === 'false') args[key] = false
        else args[key] = raw
      }
      calls.push({
        id: `xml_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        function: { name, arguments: JSON.stringify(args) },
      })
      continue
    }

    // Sub-format B: JSON object inside <tool_call>
    try {
      const jsonStr = block.trim()
      if (jsonStr.startsWith('{')) {
        const parsed = JSON.parse(jsonStr)
        if (parsed.name && (parsed.arguments || parsed.parameters)) {
          calls.push({
            id: `xml_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            function: {
              name: parsed.name,
              arguments: typeof parsed.arguments === 'string'
                ? parsed.arguments
                : JSON.stringify(parsed.arguments ?? parsed.parameters ?? {}),
            },
          })
        }
      }
    } catch { /* not valid JSON, skip */ }
  }
  return calls
}

/**
 * Check if LLM response is garbage (hallucination, wrong language mix, nonsense).
 */
function isGarbageResponse(text) {
  if (!text || text.length < 10) return true
  if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text) && /[а-яА-Я]/.test(text)) return true
  if (/[\u4e00-\u9fff]{3,}/.test(text)) return true
  if (/\bfunction\b.*\{|void\s+\w+\(|#include|#endif|\.map\(\)/.test(text)) return true
  const specialChars = text.replace(/[\w\sа-яА-ЯёЁіїєґІЇЄҐąćęłńóśźżĄĆĘŁŃÓŚŹŻ.,!?:;'"()\-—–]/g, '')
  if (specialChars.length / text.length > 0.3) return true
  if (/(.)\1{10,}/.test(text) || /(\)\s*){8,}/.test(text)) return true
  if (/[\u0600-\u06FF\u0590-\u05FF]/.test(text) && /[а-яА-Я]/.test(text)) return true
  return false
}

/**
 * Validate that the LLM response only mentions places from the provided data.
 * Returns null if all bold names are hallucinated (signal to use template).
 */
function validateGrounding(text, usedLocations) {
  if (!text || !usedLocations?.length) return text

  const boldNames = []
  const boldRe = /\*\*([^*]+)\*\*/g
  let match
  while ((match = boldRe.exec(text)) !== null) {
    boldNames.push(match[1].trim().toLowerCase())
  }
  if (boldNames.length === 0) return text

  const allowedNames = new Set()
  for (const loc of usedLocations) {
    if (loc.title) allowedNames.add(loc.title.toLowerCase())
    if (loc.name) allowedNames.add(loc.name.toLowerCase())
    const title = (loc.title || loc.name || '').toLowerCase()
    const words = title.split(/\s+/)
    if (words.length > 2) allowedNames.add(words.slice(0, 3).join(' '))
  }

  const hallucinated = boldNames.filter(name => {
    for (const allowed of allowedNames) {
      if (allowed.includes(name) || name.includes(allowed)) return false
    }
    return true
  })

  if (hallucinated.length > 0 && hallucinated.length === boldNames.length) {
    console.warn('[Agent] ALL places hallucinated:', hallucinated, '— using template response')
    return null
  }
  return text
}

/**
 * Generate a template response from location data when LLM produces garbage.
 */
function buildTemplateResponse(usedLocations, userText) {
  if (!usedLocations?.length) return null
  const items = usedLocations.slice(0, 5).map(l => {
    const name = l.title || l.name
    let desc = ''
    if (l.description) desc = l.description.slice(0, 100)
    else if (l.vibe?.length) desc = `Атмосфера: ${l.vibe.slice(0, 2).join(', ')}`
    const tip = l.insider_tip ? `\n*Совет:* ${l.insider_tip}` : ''
    const tryThis = l.what_to_try?.length ? `\n*Попробуй:* ${l.what_to_try.slice(0, 2).join(', ')}` : ''
    return `**${name}**\n${desc}${tip}${tryThis}`
  })
  return items.join('\n\n')
}

/**
 * Remove all tool-call artifacts from a model's text output.
 */
function cleanModelOutput(text) {
  if (!text) return ''
  return text
    .replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '')
    .replace(/<function[\s\S]*?<\/function>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<plan>[\s\S]*?<\/plan>/gi, '')
    .replace(/\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:[\s\S]*?\}/g, '')
    .replace(/\{"matches":\[.*?\]\}\s*$/s, '')
    .replace(/\[PERSON_NAME\]/gi, '')
    .replace(/\[USER_NAME\]/gi, '')
    .replace(/\[NAME\]/gi, '')
    .replace(/  +/g, ' ')
    .trim()
}

/** Read admin config from useAppConfigStore */
async function readAdminConfig() {
  let cascade = MODEL_CASCADE
  let temperature = 0.7
  let maxTokens = 2048
  let useV2 = false
  let cfg = null

  try {
    const { useAppConfigStore } = await import('@/shared/store/useAppConfigStore')
    await useAppConfigStore.getState().loadFromDB()
    cfg = useAppConfigStore.getState()
    const adminCascade = cfg.aiModelCascade || []
    if (adminCascade.length > 0) cascade = adminCascade
    temperature = cfg.aiGuideTemp ?? 0.7
    maxTokens = Math.max(2048, Math.min(8192, cfg.aiGuideMaxTokens ?? 2048))
    useV2 = cfg.aiBotImprovementsV2 ?? false
  } catch { /* config store not available — use defaults */ }

  return { cascade, temperature, maxTokens, useV2, cfg }
}

/** Safely parse tool call arguments */
function parseArgs(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

/** Check if an error is retryable (network, 5xx, abort) */
function isRetryableError(err) {
  if (!err) return false
  if (err.name === 'AbortError') return true
  const msg = (err.message || '').toLowerCase()
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) return true
  if (msg.includes('503') || msg.includes('502') || msg.includes('500') || msg.includes('429')) return true
  return false
}

/** Apply V2 output guardrail */
async function applyOutputGuardrail(text, ctx) {
  try {
    const { validateResponse } = await import('./guardrails/output.js')
    const { sanitizedText, redactions } = validateResponse(text)
    if (redactions.length) {
      const { recordGuardrailEvent } = await import('./guardrails/audit.js')
      await recordGuardrailEvent({
        stage: 'output', verdict: 'modified', turnId: `turn_${Date.now()}`,
        reason: `Redacted ${redactions.length} items`,
        payload: { redactions: redactions.map(r => ({ kind: r.kind, original: r.original })) },
        userId: ctx?.userId, sessionId: ctx?.sessionId,
      })
    }
    return sanitizedText
  } catch { return text }
}
