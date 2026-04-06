/**
 * KGAIAgent — AI agent chat panel for the Knowledge Graph admin page.
 *
 * Phases:
 *  idle        → user sees input + example prompts
 *  thinking    → AI is generating (shows model name)
 *  preview     → shows generated items as cards; user can toggle each
 *  saving      → persisting items one-by-one with progress per item
 *  done        → success summary
 *  error       → error message with retry
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles, Send, X, Check, Globe, UtensilsCrossed,
    Leaf, Loader2, ChevronDown, ChevronUp, Wand2,
    AlertCircle, CheckCircle2, RotateCcw, Brain,
    Zap, ArrowRight, MessageSquare, Carrot
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { callKGAgent, resolveDishCuisineIds, AGENT_EXAMPLE_PROMPTS } from '@/shared/api/kg-ai-agent.api'

// ─── Preview card for a single generated item ─────────────────────────────────

const ItemPreviewCard = ({ type, item, selected, onToggle }) => {
    const [expanded, setExpanded] = useState(false)

    const config = {
        cuisines: {
            Icon: Globe,
            bg: 'bg-indigo-50 dark:bg-indigo-500/15',
            text: 'text-indigo-600 dark:text-indigo-400',
            border: 'border-indigo-300 dark:border-indigo-500/50',
            accent: 'border-l-indigo-500 dark:border-l-indigo-400',
            selectedBg: 'bg-indigo-50 dark:bg-indigo-500/10',
            checkBg: 'bg-indigo-500',
            badge: 'bg-indigo-100 dark:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300',
            glow: 'shadow-indigo-100 dark:shadow-indigo-500/10',
        },
        dishes: {
            Icon: UtensilsCrossed,
            bg: 'bg-emerald-50 dark:bg-emerald-500/15',
            text: 'text-emerald-600 dark:text-emerald-400',
            border: 'border-emerald-300 dark:border-emerald-500/50',
            accent: 'border-l-emerald-500 dark:border-l-emerald-400',
            selectedBg: 'bg-emerald-50 dark:bg-emerald-500/10',
            checkBg: 'bg-emerald-500',
            badge: 'bg-emerald-100 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300',
            glow: 'shadow-emerald-100 dark:shadow-emerald-500/10',
        },
        ingredients: {
            Icon: Carrot,
            bg: 'bg-amber-50 dark:bg-amber-500/15',
            text: 'text-amber-600 dark:text-amber-400',
            border: 'border-amber-300 dark:border-amber-500/50',
            accent: 'border-l-amber-500 dark:border-l-amber-400',
            selectedBg: 'bg-amber-50 dark:bg-amber-500/10',
            checkBg: 'bg-amber-500',
            badge: 'bg-amber-100 dark:bg-amber-500/25 text-amber-700 dark:text-amber-300',
            glow: 'shadow-amber-100 dark:shadow-amber-500/10',
        },
    }[type]

    const tags = type === 'cuisines'
        ? (item.typical_dishes || []).slice(0, 3)
        : type === 'dishes'
        ? (item.dietary_tags || []).slice(0, 3)
        : (item.dietary_info || []).slice(0, 3)

    const meta = type === 'cuisines' ? item.region
               : type === 'dishes'   ? item.preparation_style
               : item.category

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
                'rounded-2xl border-l-4 border transition-all duration-200 cursor-pointer select-none',
                selected
                    ? [
                        config.border,
                        config.accent,
                        config.selectedBg,
                        'shadow-md',
                        config.glow,
                        'scale-[1.005]',
                      ].join(' ')
                    : 'border-l-transparent border-slate-100 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/20 opacity-50 hover:opacity-70 hover:border-slate-200 dark:hover:border-slate-700',
            )}
            onClick={onToggle}
        >
            <div className="flex items-start gap-3 p-3 lg:p-4">
                {/* Checkbox */}
                <div className={cn(
                    'w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 transition-all duration-200',
                    selected
                        ? config.checkBg
                        : 'border-2 border-slate-200 dark:border-slate-600 bg-transparent'
                )}>
                    {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>

                {/* Icon */}
                <div className={cn('w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center', config.bg)}>
                    <config.Icon size={14} className={config.text} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <span className={cn(
                                'font-semibold text-sm truncate block transition-colors',
                                selected ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                            )}>{item.name}</span>
                            {meta && (
                                <span className={cn('text-[10px] font-bold uppercase tracking-wide', config.text)}>{meta}</span>
                            )}
                        </div>
                        <button
                            onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
                            className="text-slate-300 hover:text-slate-500 flex-shrink-0 mt-0.5"
                        >
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>

                    {/* Description */}
                    {item.description && (
                        <p className={cn(
                            'text-[11px] text-slate-500 leading-relaxed mt-1',
                            expanded ? '' : 'line-clamp-1'
                        )}>
                            {item.description}
                        </p>
                    )}

                    {/* Tags */}
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {tags.map((t, i) => (
                                <span key={i} className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide', config.badge)}>
                                    {t}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Expanded details */}
                    <AnimatePresence>
                        {expanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-3 space-y-1.5 text-[11px] text-slate-500">
                                    {type === 'cuisines' && (
                                        <>
                                            {item.flavor_profile && <p><span className="font-semibold text-slate-700 dark:text-slate-300">Flavors:</span> {item.flavor_profile}</p>}
                                            {item.key_ingredients?.length > 0 && <p><span className="font-semibold text-slate-700 dark:text-slate-300">Key ingredients:</span> {item.key_ingredients.join(', ')}</p>}
                                            {item.aliases?.length > 0 && <p><span className="font-semibold text-slate-700 dark:text-slate-300">Also known as:</span> {item.aliases.join(', ')}</p>}
                                        </>
                                    )}
                                    {type === 'dishes' && (
                                        <>
                                            {item.cuisine_name && <p><span className="font-semibold text-slate-700 dark:text-slate-300">Cuisine:</span> {item.cuisine_name}</p>}
                                            {item.ingredients?.length > 0 && <p><span className="font-semibold text-slate-700 dark:text-slate-300">Ingredients:</span> {item.ingredients.join(', ')}</p>}
                                            {item.flavor_notes && <p><span className="font-semibold text-slate-700 dark:text-slate-300">Flavors:</span> {item.flavor_notes}</p>}
                                            {item.best_pairing && <p><span className="font-semibold text-slate-700 dark:text-slate-300">Pairs with:</span> {item.best_pairing}</p>}
                                        </>
                                    )}
                                    {type === 'ingredients' && (
                                        <>
                                            {item.flavor_profile && <p><span className="font-semibold text-slate-700 dark:text-slate-300">Flavors:</span> {item.flavor_profile}</p>}
                                            {item.common_pairings?.length > 0 && <p><span className="font-semibold text-slate-700 dark:text-slate-300">Pairs with:</span> {item.common_pairings.join(', ')}</p>}
                                            {item.season && <p><span className="font-semibold text-slate-700 dark:text-slate-300">Season:</span> {item.season}</p>}
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    )
}

// ─── Saving progress for individual item ─────────────────────────────────────

const SaveStatus = ({ label, icon: Icon, status }) => (
    <div className="flex items-center gap-2 py-1">
        <div className={cn(
            'w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0',
            status === 'pending'  ? 'bg-slate-100 dark:bg-slate-800' :
            status === 'saving'   ? 'bg-indigo-50 dark:bg-indigo-500/10' :
            status === 'done'     ? 'bg-emerald-50 dark:bg-emerald-500/10' :
            'bg-rose-50 dark:bg-rose-500/10'
        )}>
            {status === 'saving'  ? <Loader2 size={10} className="text-indigo-500 animate-spin" /> :
             status === 'done'    ? <Check size={10} className="text-emerald-500" strokeWidth={3} /> :
             status === 'error'   ? <X size={10} className="text-rose-500" /> :
             <Icon size={10} className="text-slate-300" />}
        </div>
        <span className={cn(
            'text-[11px] font-medium truncate',
            status === 'done'  ? 'text-emerald-600 dark:text-emerald-400' :
            status === 'error' ? 'text-rose-500' :
            status === 'saving'? 'text-indigo-500' :
            'text-slate-400'
        )}>{label}</span>
    </div>
)

// ─── Main component ───────────────────────────────────────────────────────────

const KGAIAgent = ({ cuisines = [], dishes = [], ingredients = [], onSaved }) => {
    const [phase, setPhase]           = useState('idle')        // idle|thinking|preview|saving|done|error
    const pendingRef                  = useRef(false)            // guard: prevent double-send (StrictMode / SW)
    const [input, setInput]           = useState('')
    const [lastPrompt, setLastPrompt] = useState('')
    const [currentModel, setCurrentModel] = useState('')
    const [agentResult, setAgentResult]   = useState(null)      // raw AI output
    const [selected, setSelected]         = useState({          // which items the user wants to save
        cuisines: [], dishes: [], ingredients: [],
    })
    const [saveProgress, setSaveProgress] = useState([])        // [{ id, label, icon, status }]
    const [errorMsg, setErrorMsg]         = useState('')
    const [isCollapsed, setIsCollapsed]   = useState(false)
    const [messages, setMessages]         = useState([])        // chat history
    const textareaRef = useRef(null)
    const bottomRef   = useRef(null)

    // Auto-scroll messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, phase])

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }, [input])

    // ── send ─────────────────────────────────────────────────────────────────

    const handleSend = useCallback(async (overridePrompt) => {
        const prompt = overridePrompt ?? input.trim()
        if (!prompt || phase === 'thinking') return
        // Guard against double invocation (React StrictMode dev / Service Worker)
        if (pendingRef.current) return
        pendingRef.current = true

        setLastPrompt(prompt)
        setInput('')
        setPhase('thinking')
        setCurrentModel('')
        setErrorMsg('')
        setIsCollapsed(false)

        // Add to chat
        setMessages(prev => [
            ...prev,
            { role: 'user', content: prompt },
        ])

        try {
            const result = await callKGAgent(
                prompt,
                { cuisines, dishes, ingredients },
                (model) => setCurrentModel(model),
            )

            setAgentResult(result)

            // Pre-select all generated items
            setSelected({
                cuisines:    result.items.cuisines.map((_, i) => i),
                dishes:      result.items.dishes.map((_, i) => i),
                ingredients: result.items.ingredients.map((_, i) => i),
            })

            // Add agent reply to chat
            setMessages(prev => [
                ...prev,
                {
                    role: 'agent',
                    content: result.understanding || result.plan || 'Here is what I generated:',
                    model: result.model,
                    counts: {
                        cuisines:    result.items.cuisines.length,
                        dishes:      result.items.dishes.length,
                        ingredients: result.items.ingredients.length,
                    },
                },
            ])

            setPhase('preview')
            pendingRef.current = false
        } catch (err) {
            setErrorMsg(err.message)
            setPhase('error')
            pendingRef.current = false
            setMessages(prev => [
                ...prev,
                { role: 'error', content: err.message },
            ])
        }
    }, [input, phase, cuisines, dishes, ingredients])

    // ── toggle item selection ─────────────────────────────────────────────────

    const toggleItem = (type, idx) => {
        setSelected(prev => ({
            ...prev,
            [type]: prev[type].includes(idx)
                ? prev[type].filter(i => i !== idx)
                : [...prev[type], idx],
        }))
    }

    const selectedCount =
        selected.cuisines.length + selected.dishes.length + selected.ingredients.length

    // ── save selected items ───────────────────────────────────────────────────

    const handleSave = useCallback(async () => {
        if (!agentResult || selectedCount === 0) return

        const { items } = agentResult

        // Build save plan
        const plan = []

        selected.cuisines.forEach(idx => {
            plan.push({ type: 'cuisine',    data: items.cuisines[idx],    label: items.cuisines[idx].name,    icon: Globe })
        })
        selected.dishes.forEach(idx => {
            plan.push({ type: 'dish',       data: items.dishes[idx],      label: items.dishes[idx].name,      icon: UtensilsCrossed })
        })
        selected.ingredients.forEach(idx => {
            plan.push({ type: 'ingredient', data: items.ingredients[idx], label: items.ingredients[idx].name, icon: Carrot })
        })

        // Init progress
        const progress = plan.map((p, i) => ({ id: i, label: p.label, icon: p.icon, status: 'pending' }))
        setSaveProgress(progress)
        setPhase('saving')

        // ── Throttle settings (Supabase free tier safe) ───────────────────────
        // Free tier has a small PostgREST connection pool (~10 connections).
        // Writing sequentially with a 700ms gap keeps us well under the limit.
        const SAVE_DELAY_MS    = 700   // pause between each write
        const RATE_LIMIT_DELAY = 5000  // wait after a 429 / "Too Many Requests"
        const MAX_RETRIES      = 2     // retry attempts per item on rate-limit

        const sleep = ms => new Promise(r => setTimeout(r, ms))

        // Helper: attempt one save with automatic retry on rate-limit (429)
        const saveWithRetry = async (type, data) => {
            let lastErr
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    return await onSaved(type, data)
                } catch (err) {
                    lastErr = err
                    const isRateLimit =
                        err?.status === 429 ||
                        (err?.message || '').toLowerCase().includes('too many') ||
                        (err?.message || '').toLowerCase().includes('rate limit')

                    if (isRateLimit && attempt < MAX_RETRIES - 1) {
                        console.warn(`[KGAgent] Rate limit on "${data.name}", waiting ${RATE_LIMIT_DELAY}ms…`)
                        await sleep(RATE_LIMIT_DELAY)
                    } else {
                        throw err
                    }
                }
            }
            throw lastErr
        }

        // Execute saves sequentially with throttle
        const createdCuisines = [...cuisines] // track newly created cuisines for dish linking
        const errors = []

        for (let i = 0; i < plan.length; i++) {
            const item = plan[i]

            // Throttle: wait before each write except the very first
            if (i > 0) await sleep(SAVE_DELAY_MS)

            setSaveProgress(prev => prev.map((s, idx) =>
                idx === i ? { ...s, status: 'saving' } : s
            ))

            try {
                if (item.type === 'cuisine') {
                    const created = await saveWithRetry('cuisine', item.data)
                    if (created) createdCuisines.push(created)

                } else if (item.type === 'dish') {
                    // Resolve cuisine_id using all known cuisines
                    const resolved = resolveDishCuisineIds([item.data], createdCuisines)
                    await saveWithRetry('dish', resolved[0])

                } else if (item.type === 'ingredient') {
                    await saveWithRetry('ingredient', item.data)
                }

                setSaveProgress(prev => prev.map((s, idx) =>
                    idx === i ? { ...s, status: 'done' } : s
                ))

            } catch (err) {
                console.error(`[KGAgent] Failed to save ${item.label}:`, err)
                errors.push(item.label)
                setSaveProgress(prev => prev.map((s, idx) =>
                    idx === i ? { ...s, status: 'error' } : s
                ))
            }
        }

        const savedCount = plan.length - errors.length
        setMessages(prev => [
            ...prev,
            {
                role: 'system',
                content: errors.length === 0
                    ? `✓ Saved ${savedCount} item${savedCount !== 1 ? 's' : ''} to the Knowledge Graph`
                    : `Saved ${savedCount}/${plan.length} items. Failed: ${errors.join(', ')}`,
                success: errors.length === 0,
            },
        ])

        setPhase('done')
    }, [agentResult, selected, selectedCount, cuisines, onSaved])

    // ── reset ─────────────────────────────────────────────────────────────────

    const handleReset = () => {
        setPhase('idle')
        setAgentResult(null)
        setSelected({ cuisines: [], dishes: [], ingredients: [] })
        setSaveProgress([])
        setErrorMsg('')
        setCurrentModel('')
    }

    // ── keyboard submit ───────────────────────────────────────────────────────

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            handleSend()
        }
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    const hasItems = agentResult && (
        agentResult.items.cuisines.length    > 0 ||
        agentResult.items.dishes.length      > 0 ||
        agentResult.items.ingredients.length > 0
    )

    return (
        <div className="bg-white dark:bg-slate-900/50 rounded-[28px] lg:rounded-[32px] border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">

            {/* ── Header ── */}
            <div
                className="flex items-center justify-between px-5 lg:px-7 py-4 lg:py-5 border-b border-slate-50 dark:border-slate-800/50 cursor-pointer"
                onClick={() => setIsCollapsed(v => !v)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
                        <Brain size={16} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                            KG AI Agent
                        </h2>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            Natural language → Knowledge Graph
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {phase === 'thinking' && (
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-violet-500 bg-violet-50 dark:bg-violet-500/10 px-3 py-1.5 rounded-full">
                            <Loader2 size={10} className="animate-spin" />
                            Thinking…
                        </span>
                    )}
                    {phase === 'preview' && hasItems && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-full">
                            {agentResult.items.cuisines.length + agentResult.items.dishes.length + agentResult.items.ingredients.length} items ready
                        </span>
                    )}
                    <button className="text-slate-300 hover:text-slate-500 p-1 transition-colors">
                        {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                </div>
            </div>

            {/* ── Body ── */}
            <AnimatePresence initial={false}>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 lg:px-6 pb-5 pt-4 space-y-4">

                            {/* ── Chat history ── */}
                            {messages.length > 0 && (
                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                    {messages.map((msg, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                'flex gap-2.5',
                                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                                            )}
                                        >
                                            {msg.role !== 'user' && (
                                                <div className={cn(
                                                    'w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5',
                                                    msg.role === 'error'  ? 'bg-rose-100 dark:bg-rose-500/10' :
                                                    msg.role === 'system' ? (msg.success ? 'bg-emerald-100 dark:bg-emerald-500/10' : 'bg-amber-100 dark:bg-amber-500/10') :
                                                    'bg-gradient-to-br from-violet-500 to-indigo-600'
                                                )}>
                                                    {msg.role === 'error'  ? <AlertCircle size={12} className="text-rose-500" /> :
                                                     msg.role === 'system' ? <CheckCircle2 size={12} className={msg.success ? 'text-emerald-500' : 'text-amber-500'} /> :
                                                     <Brain size={12} className="text-white" />}
                                                </div>
                                            )}
                                            <div className={cn(
                                                'max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed',
                                                msg.role === 'user'
                                                    ? 'bg-indigo-600 text-white rounded-tr-md'
                                                    : msg.role === 'error'
                                                    ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-tl-md'
                                                    : msg.role === 'system'
                                                    ? (msg.success
                                                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold rounded-tl-md'
                                                        : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-tl-md')
                                                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 rounded-tl-md'
                                            )}>
                                                {msg.content}
                                                {msg.role === 'agent' && msg.counts && (
                                                    <div className="flex gap-2 mt-1.5 flex-wrap">
                                                        {msg.counts.cuisines > 0 && (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                                                                <Globe size={8} /> {msg.counts.cuisines} cuisine{msg.counts.cuisines !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {msg.counts.dishes > 0 && (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                                                                <UtensilsCrossed size={8} /> {msg.counts.dishes} dish{msg.counts.dishes !== 1 ? 'es' : ''}
                                                            </span>
                                                        )}
                                                        {msg.counts.ingredients > 0 && (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                                                                <Carrot size={8} /> {msg.counts.ingredients} ingredient{msg.counts.ingredients !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                    <div ref={bottomRef} />
                                </div>
                            )}

                            {/* ── Thinking state ── */}
                            <AnimatePresence>
                                {phase === 'thinking' && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex items-center gap-3 px-4 py-3 bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 rounded-2xl"
                                    >
                                        <Loader2 size={14} className="text-violet-500 animate-spin flex-shrink-0" />
                                        <div>
                                            <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Generating culinary data…</p>
                                            {currentModel && (
                                                <p className="text-[10px] text-violet-500 dark:text-violet-400 mt-0.5">
                                                    Using {currentModel.split('/').pop()}
                                                </p>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Preview: generated items ── */}
                            <AnimatePresence>
                                {(phase === 'preview' || phase === 'done') && hasItems && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="space-y-3"
                                    >
                                        {/* Section groupings */}
                                        {agentResult.items.cuisines.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-1.5">
                                                    <Globe size={10} className="text-indigo-400" />
                                                    Cuisines ({agentResult.items.cuisines.length})
                                                </p>
                                                <div className="space-y-2">
                                                    {agentResult.items.cuisines.map((item, idx) => (
                                                        <ItemPreviewCard
                                                            key={`cuisine-${idx}`}
                                                            type="cuisines"
                                                            item={item}
                                                            selected={selected.cuisines.includes(idx)}
                                                            onToggle={() => phase === 'preview' && toggleItem('cuisines', idx)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {agentResult.items.dishes.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-1.5">
                                                    <UtensilsCrossed size={10} className="text-emerald-400" />
                                                    Dishes ({agentResult.items.dishes.length})
                                                </p>
                                                <div className="space-y-2">
                                                    {agentResult.items.dishes.map((item, idx) => (
                                                        <ItemPreviewCard
                                                            key={`dish-${idx}`}
                                                            type="dishes"
                                                            item={item}
                                                            selected={selected.dishes.includes(idx)}
                                                            onToggle={() => phase === 'preview' && toggleItem('dishes', idx)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {agentResult.items.ingredients.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-1.5">
                                                    <Carrot size={10} className="text-amber-400" />
                                                    Ingredients ({agentResult.items.ingredients.length})
                                                </p>
                                                <div className="space-y-2">
                                                    {agentResult.items.ingredients.map((item, idx) => (
                                                        <ItemPreviewCard
                                                            key={`ingredient-${idx}`}
                                                            type="ingredients"
                                                            item={item}
                                                            selected={selected.ingredients.includes(idx)}
                                                            onToggle={() => phase === 'preview' && toggleItem('ingredients', idx)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Saving progress ── */}
                            <AnimatePresence>
                                {phase === 'saving' && saveProgress.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                                                <Loader2 size={10} className="animate-spin" />
                                                Saving to Knowledge Graph…&nbsp;
                                                <span className="text-slate-300 dark:text-slate-600 font-semibold normal-case tracking-normal">
                                                    {saveProgress.filter(s => s.status === 'done' || s.status === 'error').length}
                                                    /{saveProgress.length}
                                                </span>
                                            </p>
                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 flex-shrink-0">
                                                throttled · free plan
                                            </span>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="h-1 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden mb-3">
                                            <motion.div
                                                className="h-full bg-indigo-400 rounded-full"
                                                animate={{
                                                    width: `${saveProgress.length
                                                        ? (saveProgress.filter(s => s.status === 'done' || s.status === 'error').length / saveProgress.length) * 100
                                                        : 0}%`
                                                }}
                                                transition={{ ease: 'easeOut', duration: 0.4 }}
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                                            {saveProgress.map(s => (
                                                <SaveStatus key={s.id} label={s.label} icon={s.icon} status={s.status} />
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Action bar (preview mode) ── */}
                            <AnimatePresence>
                                {phase === 'preview' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 6 }}
                                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                                    >
                                        <p className="text-xs text-slate-400">
                                            <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedCount}</span> of{' '}
                                            {(agentResult?.items.cuisines.length || 0) + (agentResult?.items.dishes.length || 0) + (agentResult?.items.ingredients.length || 0)} items selected
                                            <span className="hidden sm:inline text-slate-300 ml-1">· Click to toggle</span>
                                        </p>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={handleReset}
                                                className="h-9 px-4 flex items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 text-xs font-medium hover:border-slate-300 transition-all"
                                            >
                                                <X size={13} />
                                                Discard
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                disabled={selectedCount === 0}
                                                className="h-9 px-5 flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-all shadow-sm"
                                            >
                                                <Check size={13} />
                                                Add {selectedCount} to Graph
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Done state actions ── */}
                            <AnimatePresence>
                                {phase === 'done' && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex items-center justify-between"
                                    >
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                                            <CheckCircle2 size={13} />
                                            Successfully added to Knowledge Graph
                                        </p>
                                        <button
                                            onClick={handleReset}
                                            className="h-8 px-4 flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 text-xs font-medium hover:border-indigo-300 hover:text-indigo-500 transition-all"
                                        >
                                            <RotateCcw size={12} />
                                            New request
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Error state ── */}
                            <AnimatePresence>
                                {phase === 'error' && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex items-center justify-between gap-3 px-4 py-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl"
                                    >
                                        <p className="text-xs text-rose-600 dark:text-rose-400 font-medium line-clamp-2">{errorMsg}</p>
                                        <button
                                            onClick={() => handleSend(lastPrompt)}
                                            className="flex-shrink-0 h-8 px-3 text-xs font-semibold text-rose-600 bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/30 rounded-xl transition-all"
                                        >
                                            Retry
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Input area ── */}
                            {(phase === 'idle' || phase === 'done' || phase === 'error') && (
                                <div className="space-y-3">
                                    {/* Suggestion chips */}
                                    {phase === 'idle' && messages.length === 0 && (
                                        <div>
                                            <p className="text-[10px] font-bold uppercase text-slate-300 dark:text-slate-600 tracking-widest mb-2 flex items-center gap-1.5">
                                                <Zap size={9} />
                                                Quick prompts
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {AGENT_EXAMPLE_PROMPTS.slice(0, 4).map((p, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleSend(p)}
                                                        className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 px-3 py-1.5 rounded-full hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all text-left max-w-[180px] truncate"
                                                        title={p}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Textarea + send */}
                                    <div className="relative flex items-end gap-2">
                                        <div className="flex-1 relative">
                                            <textarea
                                                ref={textareaRef}
                                                value={input}
                                                onChange={e => setInput(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                placeholder="Add Italian cuisine with pasta dishes… or Enrich KG with Thai spices…"
                                                rows={1}
                                                className="w-full resize-none bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-4 py-3 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 dark:focus:border-indigo-700 transition-all leading-relaxed overflow-hidden"
                                                style={{ minHeight: 46, maxHeight: 120 }}
                                            />
                                            <span className="absolute right-3 bottom-2.5 text-[9px] text-slate-300 dark:text-slate-600 pointer-events-none hidden sm:block">
                                                ⌘↵
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleSend()}
                                            disabled={!input.trim()}
                                            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all shadow-sm"
                                        >
                                            <Send size={15} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Input during thinking (disabled) */}
                            {phase === 'thinking' && (
                                <div className="relative flex items-end gap-2 opacity-40 pointer-events-none">
                                    <div className="flex-1">
                                        <div className="bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-700/50 rounded-2xl px-4 py-3 text-sm text-slate-300 h-11">
                                            Generating…
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl bg-indigo-600">
                                        <Loader2 size={15} className="animate-spin" />
                                    </div>
                                </div>
                            )}

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default KGAIAgent
