/**
 * Agentic Loop with Function Calling
 *
 * Handles the agent pass workflow:
 * 1. Call OpenRouter with tool definitions
 * 2. If tool calls detected, execute them locally
 * 3. Send results back to model for final text generation
 */

import { fetchOpenRouter } from './openrouter'
import { executeTool } from './tools'

/**
 * Run one agentic pass:
 * 1. Call OpenRouter (no stream) to get tool_calls or direct content.
 * 2. If tool_calls → execute locally → send results back → get final text.
 *
 * @param {Array} messages - Full messages array including system prompt
 * @param {Array} [locations=[]] - Optional locations for local tool execution
 * @returns {Promise<{ text: string, usedLocations: Array, modelUsed: string }>}
 *   - text: Final text response from model
 *   - usedLocations: Array of full location objects referenced in tools
 *   - modelUsed: Which model was actually used from cascade
 */
export async function runAgentPass(messages, locations = []) {
    // First call: detect tool calls
    const { response: res, modelUsed } = await fetchOpenRouter(messages, { stream: false, withTools: true })
    const data = await res.json()
    const choice = data.choices?.[0]

    if (!choice) throw new Error('No response from OpenRouter')

    const assistantMsg = choice.message
    const finishReason = choice.finish_reason

    // No tool calls — return text directly
    if (finishReason !== 'tool_calls' || !assistantMsg.tool_calls?.length) {
        return { text: assistantMsg.content ?? '', usedLocations: [], modelUsed }
    }

    // Execute tool calls
    const toolResults = []
    let usedLocations = []

    for (const toolCall of assistantMsg.tool_calls) {
        let args = {}
        try {
            args = JSON.parse(toolCall.function.arguments)
        } catch {
            args = {}
        }

        const result = await executeTool(toolCall.function.name, args, locations)

        toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
        })

        // Collect full location objects for UI cards (from the provided locations or dynamic fetch)
        if (toolCall.function.name === 'search_locations' && Array.isArray(result)) {
            let activeLocations = locations
            if (!activeLocations?.length) {
                const { useLocationsStore } = await import('@/features/public/hooks/useLocationsStore')
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
                const { useLocationsStore } = await import('@/features/public/hooks/useLocationsStore')
                activeLocations = useLocationsStore.getState().locations
            }
            const loc = activeLocations.find(l => l.id === result.id)
            if (loc) usedLocations = [loc]
        }
    }

    // Second call: get final text with tool results (no tools needed in second pass)
    const finalMessages = [
        ...messages,
        assistantMsg,         // assistant message that contained tool_calls
        ...toolResults,       // tool result messages
    ]

    const { response: finalRes } = await fetchOpenRouter(finalMessages, { stream: false, withTools: false })
    const finalData = await finalRes.json()
    const finalContent = finalData.choices?.[0]?.message?.content ?? ''

    return { text: finalContent, usedLocations, modelUsed }
}
