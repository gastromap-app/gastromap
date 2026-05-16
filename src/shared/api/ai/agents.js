/**
 * Agentic Loop with Function Calling
 *
 * Handles the agent pass workflow:
 * 1. Call OpenRouter with tool definitions
 * 2. If tool calls detected (native OR XML text), execute them locally
 * 3. Send results back to model for final text generation
 */

import { fetchOpenRouter } from './openrouter'
import { executeTool } from './tools'
import { MODEL_CASCADE } from './constants'

/**
 * Remove all tool-call artifacts from a model's text output so the user
 * never sees raw XML or JSON tool-call blocks in the chat UI.
 *
 * Handles multiple formats emitted by free models:
 *  - <tool_call>...</tool_call>   (Hermes, Nemotron, GLM…)
 *  - {"name":"search_locations","arguments":{…}}  (some models leak JSON)
 *  - {"matches":[...]}  (legacy GastroAI inline JSON)
 */
function cleanModelOutput(text) {
    if (!text) return ''
    return text
        // Strip XML tool_call blocks
        .replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '')
        // Strip stray <function=...> tags without tool_call wrapper
        .replace(/<function[\s\S]*?<\/function>/gi, '')
        // Strip thinking/reasoning blocks (Gemini 2.5 Flash outputs these)
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
        .replace(/<plan>[\s\S]*?<\/plan>/gi, '')
        // Strip inline JSON that looks like a tool call object
        .replace(/\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:[\s\S]*?\}/g, '')
        // Strip legacy {"matches":[...]} blobs
        .replace(/\{"matches":\[.*?\]\}\s*$/s, '')
        // Remove [PERSON_NAME] and similar bracketed placeholders
        .replace(/\[PERSON_NAME\]/gi, '')
        .replace(/\[USER_NAME\]/gi, '')
        .replace(/\[NAME\]/gi, '')
        // Clean up double spaces left after removal
        .replace(/  +/g, ' ')
        .trim()
}

/**
 * @param {string} text - Raw assistant message content
 * @returns {Array<{id:string, function:{name:string, arguments:string}}>}
 */
function parseXmlToolCalls(text) {
    if (!text) return []
    const calls = []

    // ── Format 1: <tool_call> <function=name> <parameter=key>val</parameter> </function> </tool_call>
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
                if (raw !== '' && !isNaN(raw)) {
                    args[key] = Number(raw)
                } else if (raw === 'true') {
                    args[key] = true
                } else if (raw === 'false') {
                    args[key] = false
                } else {
                    args[key] = raw
                }
            }
            calls.push({
                id: `xml_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                function: { name, arguments: JSON.stringify(args) },
            })
            continue
        }

        // Sub-format B: JSON object inside <tool_call>{"name":"search_locations","arguments":{...}}</tool_call>
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
 * Run one agentic pass:
 * 1. Call OpenRouter (no stream) to get tool_calls or direct content.
 * 2. If tool_calls (native OpenAI format or XML text) → execute locally → send results back → get final text.
 *
 * @param {Array} messages - Full messages array including system prompt
 * @param {Object|Array} [ctx] - Execution context: { locations, geo, userId }.
 *                               Legacy callers may pass a locations array directly.
 * @returns {Promise<{ text: string, usedLocations: Array, modelUsed: string, attachments?: Array,
 *                    needsGeo?: boolean, askClarification?: { question, suggestions } }>}
 */
export async function runAgentPass(messages, ctx = {}) {
    const startTime = Date.now()

    // Backwards-compat: callers used to pass a locations array directly.
    if (Array.isArray(ctx)) ctx = { locations: ctx }
    const locations = ctx?.locations || []
    void locations // kept for API parity

    // ── Read admin config from store ────────────────────────────────────────
    let adminCascade = []
    let adminTemp = 0.7
    let adminMaxTokens = 1024
    let cfg = null
    try {
        const { useAppConfigStore } = await import('@/shared/store/useAppConfigStore')
        // Ensure Supabase config is loaded (no-op if already loaded)
        await useAppConfigStore.getState().loadFromDB()
        cfg = useAppConfigStore.getState()
        adminCascade = cfg.aiModelCascade || []
        adminTemp = cfg.aiGuideTemp ?? 0.7
        adminMaxTokens = cfg.aiGuideMaxTokens ?? 1024
    } catch { /* config store not available — use defaults */ }

    // Use admin cascade if set, otherwise fall back to MODEL_CASCADE
    const cascade = adminCascade.length > 0 ? adminCascade : MODEL_CASCADE

    // ── V2 Guardrails (gated behind feature flag) ────────────────────────────
    const useV2 = cfg?.aiBotImprovementsV2 ?? false
    let queryClassification = null

    if (useV2) {
        // Extract user text from the last user message
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
        const userText = lastUserMsg?.content || ''

        // Stage 1: Input Guardrail
        const { classifyQuery } = await import('./guardrails/input.js')
        queryClassification = classifyQuery(userText, { threshold: cfg.guardThreshold ?? 0.6 })

        console.log('[Agent] Stage 1 classification:', { kind: queryClassification.kind, confidence: queryClassification.confidence })

        if (queryClassification.kind === 'off_topic') {
            const { recordGuardrailEvent } = await import('./guardrails/audit.js')
            const turnId = `turn_${Date.now()}`
            await recordGuardrailEvent({
                stage: 'input', verdict: 'rejected', turnId,
                reason: queryClassification.reason,
                userId: ctx?.userId, sessionId: ctx?.sessionId,
            })
            // Return polite refusal without calling LLM/tools
            return {
                text: "I'm GastroGuide — I specialize in helping you discover great food spots! I can't help with that topic, but I'd love to help you find an amazing restaurant, café, or bar. What are you in the mood for?",
                usedLocations: [],
                attachments: [],
                modelUsed: 'guardrail',
                toolCalls: [],
                timing: { startMs: startTime, toolExecutionMs: 0, totalMs: Date.now() - startTime },
            }
        }
    }

    // Tracked tool calls for enhanced metadata
    const trackedToolCalls = []

    // First call: detect tool calls
    const { response: res, modelUsed } = await fetchOpenRouter(messages, {
        stream: false,
        withTools: true,
        temperature: adminTemp,
        maxTokens: adminMaxTokens,
        cascade,
    })
    const data = await res.json()
    const choice = data.choices?.[0]

    if (!choice) throw new Error('No response from OpenRouter')

    const assistantMsg = choice.message
    const finishReason = choice.finish_reason

    // ── Path A: Native OpenAI tool_calls ────────────────────────────────────
    if (finishReason === 'tool_calls' && assistantMsg.tool_calls?.length) {
        return runToolCalls(assistantMsg.tool_calls, assistantMsg, messages, ctx, modelUsed, 'native', {
            startTime, trackedToolCalls, adminTemp, adminMaxTokens, cascade, useV2,
        })
    }

    // ── Path B: XML tool calls embedded in text (some free models) ──────────
    const xmlCalls = parseXmlToolCalls(assistantMsg.content)
    if (xmlCalls.length) {
        return runToolCalls(xmlCalls, assistantMsg, messages, ctx, modelUsed, 'xml', {
            startTime, trackedToolCalls, adminTemp, adminMaxTokens, cascade, useV2,
        })
    }

    // ── Path C: No tool calls — return text directly ─────────────────────────
    // Strip any stray XML/JSON artifacts the model might have left in the text
    const cleanText = cleanModelOutput(assistantMsg.content)

    // ── Stage 2: Output Guardrail (V2 only) ─────────────────────────────────
    if (useV2 && cleanText) {
        const { validateResponse } = await import('./guardrails/output.js')
        const { getSessionLocations } = await import('./session-locations.js')
        const sessionLocs = ctx?.sessionId ? await getSessionLocations(ctx.sessionId) : []
        const allowedLocs = [] // Path C has no tool-fetched locations
        const sessionLocsFormatted = sessionLocs.map(sl => ({ id: sl.id, title: sl.title || '' }))
        const { sanitizedText, redactions } = validateResponse(cleanText, allowedLocs, sessionLocsFormatted)

        if (redactions.length) {
            const { recordGuardrailEvent } = await import('./guardrails/audit.js')
            await recordGuardrailEvent({
                stage: 'output', verdict: 'modified',
                turnId: `turn_${Date.now()}`,
                reason: `Redacted ${redactions.length} items`,
                payload: { redactions: redactions.map(r => ({ kind: r.kind, original: r.original })) },
                userId: ctx?.userId, sessionId: ctx?.sessionId,
            })
        }

        return {
            text: sanitizedText,
            usedLocations: [],
            attachments: [],
            modelUsed,
            toolCalls: trackedToolCalls,
            timing: {
                startMs: startTime,
                toolExecutionMs: 0,
                totalMs: Date.now() - startTime,
            },
        }
    }

    return {
        text: cleanText,
        usedLocations: [],
        attachments: [],
        modelUsed,
        toolCalls: trackedToolCalls,
        timing: {
            startMs: startTime,
            toolExecutionMs: 0,
            totalMs: Date.now() - startTime,
        },
    }
}

/**
 * Execute tool calls, then ask the model for a natural-language final answer.
 *
 * @param {Array}  toolCalls    - Tool call objects (native or xml-parsed, both have .function.name/.arguments)
 * @param {Object} assistantMsg - The assistant message that contained the tool calls
 * @param {Array}  messages     - Original messages array
 * @param {Object} ctx          - Execution context: { locations, geo, userId }
 * @param {string} modelUsed    - Which model produced this response
 * @param {'native'|'xml'} mode - Whether we're handling native or XML tool calls
 */
async function runToolCalls(toolCalls, assistantMsg, messages, ctx, modelUsed, mode, meta = {}) {
    const { startTime = Date.now(), trackedToolCalls = [], adminTemp = 0.7, adminMaxTokens = 1024, cascade, useV2 = false } = meta
    const locations = ctx?.locations || []
    const toolResults = []
    let usedLocations = []
    let toolTime = 0

    for (const toolCall of toolCalls) {
        let args = {}
        try {
            args = JSON.parse(toolCall.function.arguments)
        } catch {
            args = {}
        }

        const toolStart = Date.now()
        const result = await executeTool(toolCall.function.name, args, ctx)
        toolTime += Date.now() - toolStart

        // Track this tool call for enhanced metadata
        const resultCount = Array.isArray(result) ? result.length : (result ? 1 : 0)
        trackedToolCalls.push({ name: toolCall.function.name, args, resultCount })

        // Early exit: needs_geo — tool signalled that live GPS is required.
        // Stop the agent loop so the UI can prompt the user and retry.
        if (result && typeof result === 'object' && result.needs_geo) {
            return {
                text: '',
                usedLocations: [],
                attachments: [],
                needsGeo: true,
                pendingTool: { name: toolCall.function.name, args },
                modelUsed,
                toolCalls: trackedToolCalls,
                timing: {
                    startMs: startTime,
                    toolExecutionMs: toolTime,
                    totalMs: Date.now() - startTime,
                },
            }
        }

        // Early exit: ask_clarification — surface the question directly.
        if (result && typeof result === 'object' && result.ask_clarification) {
            return {
                text: result.question || '',
                usedLocations: [],
                attachments: [],
                askClarification: {
                    question: result.question || '',
                    suggestions: result.suggestions || [],
                },
                modelUsed,
                toolCalls: trackedToolCalls,
                timing: {
                    startMs: startTime,
                    toolExecutionMs: toolTime,
                    totalMs: Date.now() - startTime,
                },
            }
        }

        if (mode === 'native') {
            // Native mode: use the OpenAI tool role format
            toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
            })
        } else {
            // XML mode: model doesn't understand the 'tool' role — inject results as user message
            const stripped = `[Search results for ${toolCall.function.name}]\n${JSON.stringify(result, null, 2)}\n\nNow please answer the user's question naturally based on these results. Do not show raw JSON.\nIMPORTANT: Answer in the SAME language the user wrote their last message in.`
            toolResults.push({ role: 'user', content: stripped })
        }

        // Collect full location objects for UI cards.
        // search_locations + search_nearby → array of mapLocation results.
        // We use resultList directly — after data-loading-architecture migration,
        // useLocationsStore may be empty (shim). Tool results already contain full data.
        if (toolCall.function.name === 'search_locations' || toolCall.function.name === 'search_nearby') {
            const resultList = Array.isArray(result) ? result : (result?.results || [])
            if (resultList.length > 0) {
                usedLocations = resultList.slice(0, 5)
            }
        }
        if (toolCall.function.name === 'get_location_details' && result?.id) {
            usedLocations = [result]
        }
        if (toolCall.function.name === 'compare_locations' && result?.items?.length) {
            usedLocations = result.items
        }
    }

    // Second call: get final text with tool results (no tools needed)
    // Detect user language from the last user message for language reminder
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    const userLangHint = lastUserMsg?.content && /[а-яёА-ЯЁ]/.test(lastUserMsg.content) ? 'Russian'
        : lastUserMsg?.content && /[а-яіїєґА-ЯІЇЄҐ]/.test(lastUserMsg.content) ? 'Ukrainian'
        : lastUserMsg?.content && /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(lastUserMsg.content) ? 'Polish'
        : null

    // Build a response instruction with FULL tool results (not compressed)
    // Models need the actual data (insider_tip, vibe, description) to write good responses
    const userLangNote = userLangHint ? `Respond in ${userLangHint}.` : 'Respond in the same language as the user.'
    
    let responseInstruction
    if (usedLocations.length > 0) {
        // Send full location data so model can reference insider_tip, vibe, what_to_try
        const locationData = usedLocations.slice(0, 5).map((l, i) => {
            const obj = { name: l.title || l.name, category: l.category, city: l.city }
            if (l.google_rating || l.rating) obj.rating = l.google_rating || l.rating
            if (l.price_range) obj.price = l.price_range
            if (l.description) obj.description = l.description.slice(0, 200)
            if (l.vibe?.length) obj.vibe = l.vibe.slice(0, 3)
            if (l.insider_tip) obj.insider_tip = l.insider_tip
            if (l.ai_summary) obj.summary = l.ai_summary
            if (l.what_to_try?.length) obj.must_try = l.what_to_try.slice(0, 3)
            if (l.image) obj.image = l.image
            return obj
        })
        responseInstruction = `Here are the places I found:\n${JSON.stringify(locationData, null, 1)}\n\nWrite a warm, expert recommendation. For each place: **bold the name**, 2-3 sentences why it fits, and *insider tip* if available. Keep total response under 400 words. ${userLangNote}`
    } else {
        responseInstruction = `No places found matching the exact criteria. Suggest the user try a broader search (different area, cuisine type, or price range). Be helpful and encouraging. ${userLangNote}`
    }

    let finalMessages
    if (mode === 'native') {
        // Compact mode: don't send full tool JSON to the model for the response.
        // Instead, send only the compact summary in responseInstruction.
        finalMessages = [
            ...messages,
            { role: 'user', content: responseInstruction },
        ]
    } else {
        // XML mode: same compact approach
        finalMessages = [
            ...messages,
            { role: 'user', content: responseInstruction },
        ]
    }

    const { response: finalRes } = await fetchOpenRouter(finalMessages, {
        stream: false,
        withTools: false,
        temperature: adminTemp,
        maxTokens: adminMaxTokens,
        cascade,
    })
    const finalData = await finalRes.json()
    
    console.log('[Agent] 2nd call response:', {
        hasChoices: !!finalData.choices?.length,
        contentLength: finalData.choices?.[0]?.message?.content?.length || 0,
        model: finalData._model_used,
        finishReason: finalData.choices?.[0]?.finish_reason,
        contentPreview: finalData.choices?.[0]?.message?.content?.slice(0, 100),
    })
    
    // Clean the final response — some models still emit XML/JSON artifacts
    // even when tools are disabled (withTools: false)
    let finalContent = cleanModelOutput(finalData.choices?.[0]?.message?.content ?? '')

    // If model returned empty text but we have locations, generate a minimal response
    if (!finalContent && usedLocations.length > 0) {
        const names = usedLocations.slice(0, 5).map(l => `**${l.title || l.name}**`).join(', ')
        finalContent = `Here are some places I found: ${names}`
    }

    // ── Stage 2: Output Guardrail (V2 only) ─────────────────────────────────
    if (useV2 && finalContent) {
        const { validateResponse } = await import('./guardrails/output.js')
        const { getSessionLocations } = await import('./session-locations.js')
        const sessionLocs = ctx?.sessionId ? await getSessionLocations(ctx.sessionId) : []
        const allowedLocs = usedLocations.map(l => ({ id: l.id, title: l.title || l.name }))
        const sessionLocsFormatted = sessionLocs.map(sl => ({ id: sl.id, title: sl.title || '' }))
        const { sanitizedText, redactions } = validateResponse(finalContent, allowedLocs, sessionLocsFormatted)

        if (redactions.length) {
            const { recordGuardrailEvent } = await import('./guardrails/audit.js')
            await recordGuardrailEvent({
                stage: 'output', verdict: 'modified',
                turnId: `turn_${Date.now()}`,
                reason: `Redacted ${redactions.length} items`,
                payload: { redactions: redactions.map(r => ({ kind: r.kind, original: r.original })) },
                userId: ctx?.userId, sessionId: ctx?.sessionId,
            })
        }

        return {
            text: sanitizedText,
            usedLocations,
            attachments: usedLocations,
            modelUsed,
            toolCalls: trackedToolCalls,
            timing: {
                startMs: startTime,
                toolExecutionMs: toolTime,
                totalMs: Date.now() - startTime,
            },
        }
    }

    return {
        text: finalContent,
        usedLocations,
        attachments: usedLocations,
        modelUsed,
        toolCalls: trackedToolCalls,
        timing: {
            startMs: startTime,
            toolExecutionMs: toolTime,
            totalMs: Date.now() - startTime,
        },
    }
}
