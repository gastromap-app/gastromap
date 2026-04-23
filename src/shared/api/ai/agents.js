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
 * Parse XML-style tool calls emitted by models that don't support native function calling.
 *
 * Some free models (Gemma, GLM, Hermes…) output:
 *   <tool_call> <function=search_locations> <parameter=city> Krakow </parameter> ... </function> </tool_call>
 * instead of using the OpenAI tool_calls structured format.
 *
 * @param {string} text - Raw assistant message content
 * @returns {Array<{id:string, function:{name:string, arguments:string}}>}
 */
function parseXmlToolCalls(text) {
    if (!text) return []
    const calls = []
    const blockRe = /<tool_call[^>]*>([\s\S]*?)<\/tool_call>/gi
    let m
    while ((m = blockRe.exec(text)) !== null) {
        const block = m[1]
        // <function=search_locations> or <function name="search_locations">
        const fnMatch = /<function[=\s]+"?([^\s">]+)"?/i.exec(block)
        if (!fnMatch) continue
        const name = fnMatch[1].trim()
        const args = {}
        const paramRe = /<parameter[=\s]+"?([^\s">]+)"?[^>]*>([\s\S]*?)<\/parameter>/gi
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
    }
    return calls
}

/**
 * Run one agentic pass:
 * 1. Call OpenRouter (no stream) to get tool_calls or direct content.
 * 2. If tool_calls (native OpenAI format or XML text) → execute locally → send results back → get final text.
 *
 * @param {Array} messages - Full messages array including system prompt
 * @param {Array} [locations=[]] - Optional locations for local tool execution
 * @returns {Promise<{ text: string, usedLocations: Array, modelUsed: string }>}
 *   - text: Final text response from model
 *   - usedLocations: Array of full location objects referenced in tools
 *   - modelUsed: Which model was actually used from cascade
 */
export async function runAgentPass(messages, locations = []) {
    const startTime = Date.now()

    // ── Read admin config from store ────────────────────────────────────────
    let adminCascade = []
    let adminTemp = 0.7
    let adminMaxTokens = 1024
    try {
        const { useAppConfigStore } = await import('@/shared/store/useAppConfigStore')
        const cfg = useAppConfigStore.getState()
        adminCascade = cfg.aiModelCascade || []
        adminTemp = cfg.aiGuideTemp ?? 0.7
        adminMaxTokens = cfg.aiGuideMaxTokens ?? 1024
    } catch { /* config store not available — use defaults */ }

    // Use admin cascade if set, otherwise fall back to MODEL_CASCADE
    const cascade = adminCascade.length > 0 ? adminCascade : MODEL_CASCADE

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
        return runToolCalls(assistantMsg.tool_calls, assistantMsg, messages, locations, modelUsed, 'native', {
            startTime, trackedToolCalls, adminTemp, adminMaxTokens, cascade,
        })
    }

    // ── Path B: XML tool calls embedded in text (some free models) ──────────
    const xmlCalls = parseXmlToolCalls(assistantMsg.content)
    if (xmlCalls.length) {
        return runToolCalls(xmlCalls, assistantMsg, messages, locations, modelUsed, 'xml', {
            startTime, trackedToolCalls, adminTemp, adminMaxTokens, cascade,
        })
    }

    // ── Path C: No tool calls — return text directly ─────────────────────────
    // Strip any stray XML artifacts the model might have left in the text
    const cleanText = (assistantMsg.content ?? '').replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '').trim()
    return {
        text: cleanText,
        usedLocations: [],
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
 * @param {Array}  locations    - Available locations for local execution
 * @param {string} modelUsed    - Which model produced this response
 * @param {'native'|'xml'} mode - Whether we're handling native or XML tool calls
 */
async function runToolCalls(toolCalls, assistantMsg, messages, locations, modelUsed, mode, meta = {}) {
    const { startTime = Date.now(), trackedToolCalls = [], adminTemp = 0.7, adminMaxTokens = 1024, cascade } = meta
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
        const result = await executeTool(toolCall.function.name, args, locations)
        toolTime += Date.now() - toolStart

        // Track this tool call for enhanced metadata
        const resultCount = Array.isArray(result) ? result.length : (result ? 1 : 0)
        trackedToolCalls.push({ name: toolCall.function.name, args, resultCount })

        if (mode === 'native') {
            // Native mode: use the OpenAI tool role format
            toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
            })
        } else {
            // XML mode: model doesn't understand the 'tool' role — inject results as user message
            const stripped = `[Search results for ${toolCall.function.name}]\n${JSON.stringify(result, null, 2)}\n\nNow please answer the user's question naturally based on these results. Do not show raw JSON.`
            toolResults.push({ role: 'user', content: stripped })
        }

        // Collect full location objects for UI cards
        if (toolCall.function.name === 'search_locations' && Array.isArray(result)) {
            let activeLocations = locations
            if (!activeLocations?.length) {
                const { useLocationsStore } = await import('@/shared/store/useLocationsStore')
                activeLocations = useLocationsStore.getState().locations
            }
            usedLocations = result
                .map(r => activeLocations.find(l => l.id === r.id))
                .filter(Boolean)
                .slice(0, 3)
        }
        if (toolCall.function.name === 'get_location_details' && result?.id) {
            let activeLocations = locations
            if (!activeLocations?.length) {
                const { useLocationsStore } = await import('@/shared/store/useLocationsStore')
                activeLocations = useLocationsStore.getState().locations
            }
            const loc = activeLocations.find(l => l.id === result.id)
            if (loc) usedLocations = [loc]
        }
    }

    // Second call: get final text with tool results (no tools needed)
    let finalMessages
    if (mode === 'native') {
        finalMessages = [
            ...messages,
            assistantMsg,   // assistant message that contained tool_calls
            ...toolResults, // tool result messages
        ]
    } else {
        // XML mode: strip the raw XML from the assistant turn, then inject results
        const cleanedContent = (assistantMsg.content ?? '').replace(/<tool_call[\s\S]*?<\/tool_call>/gi, '').trim()
        finalMessages = [
            ...messages,
            ...(cleanedContent ? [{ role: 'assistant', content: cleanedContent }] : []),
            ...toolResults,
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
    const finalContent = finalData.choices?.[0]?.message?.content ?? ''

    return {
        text: finalContent,
        usedLocations,
        modelUsed,
        toolCalls: trackedToolCalls,
        timing: {
            startMs: startTime,
            toolExecutionMs: toolTime,
            totalMs: Date.now() - startTime,
        },
    }
}
