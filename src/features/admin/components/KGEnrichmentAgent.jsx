import { useState, useCallback } from 'react'
import { Sparkles, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { config } from '@/shared/config/env'

/**
 * KGEnrichmentAgent — проходит по всем кухням с пустыми полями и дозаполняет их через AI.
 * Использует OpenRouter API напрямую (тот же ключ что и основной AI агент).
 */

const FIELDS_TO_CHECK = ['origin_country', 'flavor_profile', 'aliases', 'typical_dishes', 'key_ingredients']

function isMissing(val) {
    if (val === null || val === undefined || val === '') return true
    if (Array.isArray(val) && val.length === 0) return true
    return false
}

function needsEnrichment(cuisine) {
    return FIELDS_TO_CHECK.some(f => isMissing(cuisine[f]))
}

async function enrichCuisineWithAI(cuisine) {
    const missing = FIELDS_TO_CHECK.filter(f => isMissing(cuisine[f]))
    if (missing.length === 0) return null

    const prompt = `You are a culinary knowledge expert. Fill in the missing fields for this cuisine entry.

Cuisine: "${cuisine.name}"
${cuisine.description ? `Description: ${cuisine.description}` : ''}
${cuisine.origin_country ? `Origin country: ${cuisine.origin_country}` : ''}

Missing fields to fill: ${missing.join(', ')}

Respond with ONLY a JSON object containing the missing fields:
- origin_country: string (country or region, e.g. "Germany", "Japan", "Italy")
- flavor_profile: string (short description, e.g. "hearty, savory, rich")
- aliases: array of strings (alternative names, e.g. ["Deutsche Küche", "Deutsch"])
- typical_dishes: array of strings (3-5 iconic dishes)
- key_ingredients: array of strings (3-5 key ingredients)

Only include the fields that are listed as missing. Return valid JSON only, no markdown.`

    const apiKey = config.ai?.openRouterKey
    if (!apiKey) throw new Error('OpenRouter API key not configured')

    // Updated 2026-04-06: removed broken models (deepseek-v3-0324→404, mistral-small-3.1-24b→404)
    // Using same verified cascade as KGAIAgent
    const models = [
        'openai/gpt-oss-120b:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'google/gemma-3-27b-it:free',
        'openai/gpt-oss-20b:free',
        'stepfun/step-3.5-flash:free',
    ]

    for (let _mi = 0; _mi < models.length; _mi++) {
        const model = models[_mi]
        // Delay between attempts to avoid cascading rate limits
        if (_mi > 0) await new Promise(r => setTimeout(r, 1500))
        try {
            const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': config.app?.siteUrl || window.location.origin,
                    'X-Title': config.app?.name || 'GastroMap',
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 600,
                    temperature: 0.3,
                }),
            })

            if (resp.status === 429 || resp.status === 503) {
                console.warn(`[Enrichment] ${model} rate-limited, trying next…`)
                await new Promise(r => setTimeout(r, 2000))
                continue
            }
            if (!resp.ok) {
                console.warn(`[Enrichment] ${model} HTTP ${resp.status}, trying next…`)
                continue
            }
            const data = await resp.json()
            const text = data.choices?.[0]?.message?.content?.trim()
            if (!text) {
                console.warn(`[Enrichment] ${model} empty response, trying next…`)
                continue
            }

            // Parse JSON — strip possible markdown fences
            const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
            return JSON.parse(clean)
        } catch (e) {
            console.warn(`[Enrichment] Model ${model} failed:`, e.message)
            continue
        }
    }
    throw new Error('All models failed')
}

export default function KGEnrichmentAgent({ cuisines = [], onEnriched }) {
    const [open, setOpen]       = useState(false)
    const [running, setRunning] = useState(false)
    const [progress, setProgress] = useState([])  // { name, status, fields }
    const [done, setDone]       = useState(false)

    const toEnrich = cuisines.filter(needsEnrichment)

    const handleRun = useCallback(async () => {
        if (toEnrich.length === 0 || running) return
        setRunning(true)
        setDone(false)
        setProgress(toEnrich.map(c => ({ id: c.id, name: c.name, status: 'pending', fields: [] })))

        let enrichedCount = 0

        for (let i = 0; i < toEnrich.length; i++) {
            const cuisine = toEnrich[i]

            setProgress(prev => prev.map((p, idx) =>
                idx === i ? { ...p, status: 'loading' } : p
            ))

            try {
                const updates = await enrichCuisineWithAI(cuisine)
                if (updates && Object.keys(updates).length > 0) {
                    // Save to DB via onEnriched callback
                    await onEnriched(cuisine.id, updates)
                    enrichedCount++
                    setProgress(prev => prev.map((p, idx) =>
                        idx === i ? { ...p, status: 'done', fields: Object.keys(updates) } : p
                    ))
                } else {
                    setProgress(prev => prev.map((p, idx) =>
                        idx === i ? { ...p, status: 'skipped' } : p
                    ))
                }
            } catch (err) {
                console.error(`[Enrichment] Failed for ${cuisine.name}:`, err)
                setProgress(prev => prev.map((p, idx) =>
                    idx === i ? { ...p, status: 'error', error: err.message } : p
                ))
            }

            // Small delay to avoid rate limits
            if (i < toEnrich.length - 1) await new Promise(r => setTimeout(r, 800))
        }

        setRunning(false)
        setDone(true)
    }, [toEnrich, running, onEnriched])

    const handleReset = () => {
        setProgress([])
        setDone(false)
    }

    if (toEnrich.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900/50 rounded-[28px] border border-slate-100 dark:border-slate-800/50 shadow-sm p-5 flex items-center gap-3">
                <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">All cuisines are fully enriched</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Every cuisine has origin_country, flavor_profile, aliases, typical_dishes and key_ingredients.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-slate-900/50 rounded-[28px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center">
                        <Sparkles size={16} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="text-left">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white">
                            KG Enrichment Agent
                            <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                                {toEnrich.length} cuisines need enrichment
                            </span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Auto-fill missing fields: origin_country, flavor_profile, aliases, typical_dishes, key_ingredients
                        </p>
                    </div>
                </div>
                {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {open && (
                <div className="border-t border-slate-100 dark:border-slate-800/50 p-5 space-y-4">
                    {/* Cuisines list */}
                    {progress.length === 0 && (
                        <div className="space-y-2">
                            {toEnrich.map(c => {
                                const missing = FIELDS_TO_CHECK.filter(f => isMissing(c[f]))
                                return (
                                    <div key={c.id} className="flex items-center justify-between text-sm py-1.5 px-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                                        <span className="font-medium text-slate-700 dark:text-slate-200">{c.name}</span>
                                        <span className="text-xs text-amber-600 dark:text-amber-400">missing: {missing.join(', ')}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Progress */}
                    {progress.length > 0 && (
                        <div className="space-y-2">
                            {progress.map((p) => (
                                <div key={p.id} className="flex items-center gap-3 text-sm py-1.5 px-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                                    {p.status === 'pending'  && <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
                                    {p.status === 'loading'  && <Loader2 size={15} className="text-indigo-500 animate-spin shrink-0" />}
                                    {p.status === 'done'     && <CheckCircle size={15} className="text-emerald-500 shrink-0" />}
                                    {p.status === 'skipped'  && <AlertTriangle size={15} className="text-slate-400 shrink-0" />}
                                    {p.status === 'error'    && <XCircle size={15} className="text-red-500 shrink-0" />}
                                    <span className="font-medium text-slate-700 dark:text-slate-200 flex-1">{p.name}</span>
                                    {p.status === 'done'    && <span className="text-xs text-emerald-600 dark:text-emerald-400">+{p.fields.join(', ')}</span>}
                                    {p.status === 'error'   && <span className="text-xs text-red-500">{p.error}</span>}
                                    {p.status === 'skipped' && <span className="text-xs text-slate-400">nothing to add</span>}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                        {!running && !done && (
                            <button
                                onClick={handleRun}
                                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors"
                            >
                                <Sparkles size={14} />
                                Enrich {toEnrich.length} cuisines
                            </button>
                        )}
                        {running && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 text-sm font-medium rounded-xl">
                                <Loader2 size={14} className="animate-spin" />
                                Enriching... ({progress.filter(p => p.status === 'done').length}/{toEnrich.length})
                            </div>
                        )}
                        {done && (
                            <>
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium rounded-xl">
                                    <CheckCircle size={14} />
                                    Done! {progress.filter(p => p.status === 'done').length} enriched
                                </div>
                                <button
                                    onClick={handleReset}
                                    className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
                                >
                                    Reset
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
