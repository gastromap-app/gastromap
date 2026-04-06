import { useState, useCallback } from 'react'
import { Sparkles, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2, AlertTriangle, Activity } from 'lucide-react'
import { config } from '@/shared/config/env'
import { callEnrichmentAI } from '@/shared/api/kg-ai-agent.api'

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
                const missingFields = FIELDS_TO_CHECK.filter(f => isMissing(cuisine[f]))
                const updates = await callEnrichmentAI(cuisine, missingFields)
                
                if (updates && Object.keys(updates).length > 0) {
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

            // Delay between cuisines
            if (i < toEnrich.length - 1) await new Promise(r => setTimeout(r, 3000))
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
            <div className="bg-slate-900 border-l-4 border-emerald-500 shadow-xl p-5 flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-500">
                <CheckCircle size={20} className="text-emerald-500 shrink-0" />
                <div>
                    <p className="text-sm font-bold text-white tracking-wide uppercase">System Optimized</p>
                    <p className="text-xs text-slate-400 mt-1">All cuisines are fully enriched with culinary metadata.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden rounded-sm transition-all duration-300">
            {/* Header */}
            <button
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between p-5 transition-colors ${open ? 'bg-slate-800/50' : 'hover:bg-slate-800/30'}`}
            >
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Sparkles size={18} className="text-amber-500 animate-pulse" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-sm text-white tracking-widest uppercase flex items-center gap-2">
                            Enrichment Agent
                            <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5">
                                {toEnrich.length} PENDING
                            </span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">
                            Industrial AI Pipeline: Automated metadata synthesis
                        </p>
                    </div>
                </div>
                {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>

            {open && (
                <div className="border-t border-slate-800 p-6 space-y-6">
                    {/* Cuisines list (Pending) */}
                    {progress.length === 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {toEnrich.map((c, i) => {
                                const missing = FIELDS_TO_CHECK.filter(f => isMissing(c[f]))
                                return (
                                    <div 
                                        key={c.id} 
                                        className="flex flex-col p-3 bg-slate-800/40 border border-slate-700/50 hover:border-amber-500/30 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
                                        style={{ animationDelay: `${i * 50}ms` }}
                                    >
                                        <span className="font-bold text-xs text-white uppercase tracking-wider">{c.name}</span>
                                        <span className="text-[10px] text-amber-500/70 mt-1 font-mono">MISSING: {missing.join(' • ')}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Active Progress */}
                    {progress.length > 0 && (
                        <div className="space-y-2">
                            {progress.map((p, i) => (
                                <div 
                                    key={p.id} 
                                    className={`flex items-center gap-3 py-2 px-4 border transition-all duration-300 ${
                                        p.status === 'loading' ? 'bg-amber-500/5 border-amber-500/30' : 
                                        p.status === 'done' ? 'bg-emerald-500/5 border-emerald-500/20' : 
                                        'bg-slate-800/40 border-slate-700/50'
                                    }`}
                                >
                                    {p.status === 'pending'  && <div className="w-2 h-2 bg-slate-600 shrink-0" />}
                                    {p.status === 'loading'  && <Activity size={14} className="text-amber-500 animate-pulse shrink-0" />}
                                    {p.status === 'done'     && <CheckCircle size={14} className="text-emerald-500 shrink-0" />}
                                    {p.status === 'skipped'  && <AlertTriangle size={14} className="text-slate-500 shrink-0" />}
                                    {p.status === 'error'    && <XCircle size={14} className="text-red-500 shrink-0" />}
                                    
                                    <div className="flex-1 flex items-center justify-between">
                                        <span className="font-bold text-xs text-slate-200 uppercase tracking-tight">{p.name}</span>
                                        
                                        {p.status === 'loading' && (
                                            <span className="text-[10px] font-mono text-amber-500/80 animate-pulse">
                                                AI PROCESSING...
                                            </span>
                                        )}
                                        
                                        {p.status === 'done' && (
                                            <div className="flex gap-1">
                                                {p.fields.map(f => (
                                                    <span key={f} className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 border border-emerald-500/20">
                                                        {f.toUpperCase()}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {p.status === 'error' && (
                                            <span className="text-[10px] font-mono text-red-500 truncate max-w-[150px]">
                                                {p.error}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Actions Panel */}
                    <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center gap-4">
                        {!running && !done && (
                            <button
                                onClick={handleRun}
                                className="group relative flex items-center gap-3 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                            >
                                <Sparkles size={14} />
                                Start AI Synthesis
                                <div className="absolute inset-0 border border-white/20 scale-105 opacity-0 group-hover:opacity-100 transition-all" />
                            </button>
                        )}
                        
                        {running && (
                            <div className="flex items-center gap-4 px-6 py-3 bg-slate-800 border border-slate-700 text-amber-500 text-xs font-black uppercase tracking-widest">
                                <Loader2 size={14} className="animate-spin" />
                                Processing: {progress.filter(p => p.status === 'done').length} / {toEnrich.length}
                            </div>
                        )}
                        
                        {done && (
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-black uppercase tracking-widest">
                                    <CheckCircle size={14} />
                                    Pipeline Complete
                                </div>
                                <button
                                    onClick={handleReset}
                                    className="px-6 py-3 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest border border-slate-700 hover:border-slate-500 transition-all"
                                >
                                    Reset
                                </button>
                            </div>
                        )}

                        <div className="ml-auto text-[10px] font-mono text-slate-600 uppercase">
                            Status: {running ? 'Active Engine' : done ? 'Idle' : 'Standby'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
