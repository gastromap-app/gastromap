/**
 * AI Utility Functions
 *
 * - testAIConnection: Test connectivity with OpenRouter
 * - robustParseJSON: Extract and parse JSON from LLM responses
 */

import { getActiveAIConfig } from '../ai-config.api'
import { config } from '@/shared/config/env'
import { OPENROUTER_URL, MODEL_CASCADE } from './constants'

/**
 * Test AI connectivity with a simple query.
 * Uses the full model cascade to find an available model.
 *
 * @param {string} message - Test message
 * @param {string} [preferredModel] - Optional preferred model to try first
 * @returns {Promise<{ ok: boolean, text: string, modelUsed: string, latency: number, error?: string }>}
 */
export async function testAIConnection(message, preferredModel) {
    const startTime = performance.now()

    try {
        const { apiKey } = getActiveAIConfig()
        const useProxy = config.ai.useProxy

        if (!apiKey && !useProxy) {
            return {
                ok: false,
                text: 'No API key configured. Add your OpenRouter API key in Settings or set VITE_OPENROUTER_API_KEY.',
                modelUsed: 'none',
                latency: 0,
            }
        }

        const messages = [
            { role: 'system', content: 'You are a helpful assistant. Keep responses under 2 sentences.' },
            { role: 'user', content: message },
        ]

        // ── DIRECT call to the specific model — no cascade fallback during test ──
        // This ensures the test result reflects EXACTLY the chosen model performance.
        const modelToTest = preferredModel || MODEL_CASCADE[0]
        const url = useProxy ? config.ai.proxyUrl : OPENROUTER_URL
        const headers = { 'Content-Type': 'application/json' }
        if (!useProxy) {
            headers['Authorization'] = `Bearer ${apiKey}`
            headers['HTTP-Referer'] = 'https://gastromap.app'
            headers['X-Title'] = 'GastroMap'
        }

        const body = {
            model: modelToTest,
            messages,
            max_tokens: 256,
            // Pass a flag so the proxy knows this is a direct test (no cascade)
            _direct_model: true,
        }

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        })

        const data = await res.json()
        const latency = Math.round(performance.now() - startTime)

        if (!res.ok) {
            const errMsg = data?.error?.message || `Model returned ${res.status}`
            return { ok: false, text: errMsg, modelUsed: modelToTest, latency }
        }

        // Proxy may return _model_used to confirm which model actually answered
        const actualModel = data._model_used || modelToTest
        const text = data.choices?.[0]?.message?.content || '(no response)'

        return { ok: true, text, modelUsed: actualModel, latency }
    } catch (err) {
        const latency = Math.round(performance.now() - startTime)
        return {
            ok: false,
            text: err.message || 'Unknown error',
            modelUsed: preferredModel || 'unknown',
            latency,
            error: err.message,
        }
    }
}

/**
 * Robust JSON extraction from LLM response.
 * Handles markdown blocks, extra text, and problematic control characters.
 *
 * @param {string} text - Raw model response
 * @returns {Object}     - Parsed JSON or empty object
 */
export function robustParseJSON(text) {
    if (!text) return {}

    try {
        // 1. Remove markdown code blocks and excess whitespace
        let cleaned = text.replace(/```json\n?|```/g, '').trim()

        // 2. Isolate the first '{' and last '}'
        const firstBrace = cleaned.indexOf('{')
        const lastBrace = cleaned.lastIndexOf('}')

        if (firstBrace !== -1 && lastBrace !== -1) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1)
        }

        try {
            return JSON.parse(cleaned)
        } catch (initialError) {
            // 4. Second attempt: Clean "bad control characters" ONLY inside strings
            // This regex finds content inside double quotes properly handling escaped quotes \".
            // It finds and escapes literal newlines, tabs, and other non-printable control chars.
            let surgicallyCleaned = cleaned.replace(/"(?:[^"\\]|\\.)*"/gs, (m) => {
                // Keep the opening and closing quotes, clean the inner part
                const inner = m.substring(1, m.length - 1)
                // eslint-disable-next-line no-control-regex
                const cleanedInner = inner.replace(/[\x00-\x1F]/g, (char) => {
                    const map = {
                        '\n': '\\n',
                        '\r': '\\r',
                        '\t': '\\t',
                        '\f': '\\f',
                        '\b': '\\b'
                    }
                    return map[char] || '' // Strip other control chars
                })
                return '"' + cleanedInner + '"'
            })

            // 5. Fix common escaping/trailing issues
            surgicallyCleaned = surgicallyCleaned
                .replace(/\\(?!["\\bfnrtu])/g, '\\\\') // Escape lone backslashes
                .replace(/,\s*}/g, '}')                  // Trailing comma in objects
                .replace(/,\s*\]/g, ']')                  // Trailing comma in arrays

            try {
                return JSON.parse(surgicallyCleaned)
            } catch {
                // 5.5. Handling truncated JSON (missing closing braces/brackets/quotes)
                try {
                    const closed = closeTruncatedJSON(surgicallyCleaned)
                    return JSON.parse(closed)
                } catch {
                    // Final fallback: Basic field extraction using regex for key fields
                    try {
                        const result = {}
                        const fields = [
                            'name', 'title', 'category', 'cuisine', 'description',
                            'city', 'country', 'address', 'insider_tip', 'phone',
                            'website', 'opening_hours', 'summary', 'keywords'
                        ]
                        for (const field of fields) {
                            // Match "field": "value" or "field": ["value", "value"]
                            const regex = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i')
                            const match = surgicallyCleaned.match(regex)
                            if (match) {
                                result[field] = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
                            } else if (field === 'keywords' || field === 'tags') {
                                // Array match attempt
                                const arrRegex = new RegExp(`"${field}"\\s*:\\s*\\[(.*?)\\]`, 'is')
                                const arrMatch = surgicallyCleaned.match(arrRegex)
                                if (arrMatch) {
                                    result[field] = arrMatch[1].split(',').map(s => s.trim().replace(/^"|"$/g, ''))
                                }
                            }
                        }
                        if (Object.keys(result).length > 0) return result
                    } catch { /* ignore */ }

                    throw initialError
                }
            }
        }
    } catch (err) {
        console.warn('[GastroAI] Robust parse failed:', err.message)
        throw err
    }
}

/**
 * Attempts to close an unterminated JSON string by adding missing quotes, brackets, and braces.
 */
function closeTruncatedJSON(json) {
    let result = json.trim()
    
    // 1. Handle unclosed quotes
    const quoteCount = (result.match(/"/g) || []).length
    if (quoteCount % 2 !== 0) {
        result += '"'
    }

    // 2. Count braces and brackets
    const stack = []
    for (let i = 0; i < result.length; i++) {
        const char = result[i]
        if (char === '{') stack.push('}')
        else if (char === '[') stack.push(']')
        else if (char === '}') {
            if (stack[stack.length - 1] === '}') stack.pop()
        } else if (char === ']') {
            if (stack[stack.length - 1] === ']') stack.pop()
        }
    }

    // 3. Close from inner to outer
    while (stack.length > 0) {
        result += stack.pop()
    }

    return result
}
