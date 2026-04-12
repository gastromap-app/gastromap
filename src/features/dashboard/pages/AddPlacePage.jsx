import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
    MapPin, Sparkles, CheckCircle2, Lock, ChevronLeft,
    ChevronRight, AlertCircle, Utensils, Globe,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'
import { createSubmission } from '@/shared/api/submissions.api'
import { enrichLocation } from '@/shared/api/ai'

// ─── Constants ────────────────────────────────────────────────────────────

const STEPS = [
    { id: 'basic',   label: 'Basic Info' },
    { id: 'details', label: 'Details' },
    { id: 'review',  label: 'Review' },
]

const CATEGORIES = [
    { id: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
    { id: 'cafe',       label: 'Café',       emoji: '☕' },
    { id: 'bar',        label: 'Bar',        emoji: '🍺' },
    { id: 'bakery',     label: 'Bakery',     emoji: '🥐' },
    { id: 'other',      label: 'Other',      emoji: '📍' },
]

const PRICE_LEVELS = [
    { id: '$',    label: '€',    sub: 'Budget' },
    { id: '$$',   label: '€€',   sub: 'Mid' },
    { id: '$$$',  label: '€€€',  sub: 'Premium' },
    { id: '$$$$', label: '€€€€', sub: 'Fine Dining' },
]

const EMPTY_FORM = {
    name: '', address: '', city: '', category: 'restaurant', website_url: '',
    description: '', cuisine_types: [], tags: [], dietary_options: [],
    amenities: [], best_for: [], price_range: '', outdoor_seating: false,
    pet_friendly: false, must_try: '', insider_tip: '',
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ProgressBar({ step }) {
    return (
        <div className="flex items-center">
            {STEPS.map((s, i) => (
                <React.Fragment key={s.id}>
                    <div className={`
                        w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                        ${i < step  ? 'bg-indigo-600 text-white'
                        : i === step ? 'bg-indigo-600 text-white ring-4 ring-indigo-600/20'
                                     : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}
                    `}>
                        {i < step ? <CheckCircle2 size={14} /> : i + 1}
                    </div>
                    {i < STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 transition-colors duration-500 mx-1 ${i < step ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    )
}

function Toggle({ label, value, onChange }) {
    return (
        <label className="flex items-center justify-between cursor-pointer py-1">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
            <div
                onClick={onChange}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${value ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
            </div>
        </label>
    )
}

function SuccessScreen({ onAddAnother, onHome }) {
    return (
        <div className="max-w-3xl mx-auto px-6 py-12 md:py-20 mt-16 md:mt-24">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-slate-900 rounded-[40px] p-10 md:p-16 text-center border border-slate-100 dark:border-slate-800 shadow-2xl shadow-indigo-500/5 max-w-xl mx-auto"
            >
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-8">
                    <CheckCircle2 size={40} />
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                    Submitted!
                </h2>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                    Our team will review your submission. Usually takes up to 48 hours.
                </p>
                <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl px-4 py-2.5 mb-8">
                    <span className="text-indigo-600 dark:text-indigo-400 text-sm font-bold">🏆 +100 points</span>
                    <span className="text-indigo-400 text-sm">credited on approval</span>
                </div>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onAddAnother}
                        className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-lg active:scale-95"
                    >
                        Add Another Place
                    </button>
                    <button
                        onClick={onHome}
                        className="w-full py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-all active:scale-95"
                    >
                        Back to Home
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function AddPlacePage() {
    const { user }   = useAuthStore()
    const navigate   = useNavigate()
    const { t }      = useTranslation()

    const [step, setStep]           = useState(0)
    const [form, setForm]           = useState(EMPTY_FORM)
    const [aiLoading, setAILoading] = useState(false)
    const [aiDone, setAIDone]       = useState(false)
    const [aiError, setAIError]     = useState('')
    const [confirmed, setConfirmed] = useState(false)
    const [loading, setLoading]     = useState(false)
    const [error, setError]         = useState('')
    const [done, setDone]           = useState(false)

    const setField = (field) => (e) =>
        setForm((f) => ({ ...f, [field]: e.target.value }))

    const setCheck = (field) => () =>
        setForm((f) => ({ ...f, [field]: !f[field] }))

    async function fillWithAI() {
        if (!form.name) return
        setAIError('')
        setAILoading(true)
        try {
            const data = await enrichLocation({
                name:     form.name,
                address:  form.address,
                city:     form.city,
                category: form.category,
            })
            setForm((f) => ({ ...f, ...data }))
            setAIDone(true)
        } catch (err) {
            console.error('[AddPlacePage] AI fill error:', err)
            setAIError('AI fill failed — please fill the fields manually.')
        } finally {
            setAILoading(false)
        }
    }

    async function handleSubmit() {
        if (!confirmed) return
        setError('')
        setLoading(true)
        try {
            await createSubmission({
                ...form,
                user_id: user?.id,
            })
            setDone(true)
        } catch (err) {
            console.error('[AddPlacePage] Submit error:', err)
            setError(err.message || 'Submission failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    function reset() {
        setForm(EMPTY_FORM)
        setStep(0)
        setAIDone(false)
        setAIError('')
        setConfirmed(false)
        setError('')
        setDone(false)
    }

    const canGoNext = [
        form.name.trim().length > 0 && form.address.trim().length > 0 && form.city.trim().length > 0,
        true,
        confirmed,
    ]

    const inputCls = 'w-full h-12 px-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white text-sm'

    if (done) {
        return <SuccessScreen onAddAnother={reset} onHome={() => navigate('/dashboard')} />
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 mt-14 md:mt-20 pb-16">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => (step > 0 ? setStep((s) => s - 1) : navigate(-1))}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Suggest a Place
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">{STEPS[step].label} · Step {step + 1} of {STEPS.length}</p>
                </div>
            </div>

            <div className="mb-8">
                <ProgressBar step={step} />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
                <AnimatePresence mode="wait">

                    {/* ══════ STEP 1: Basic ══════ */}
                    {step === 0 && (
                        <motion.div key="basic"
                            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="p-8 space-y-6"
                        >
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Place name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={setField('name')}
                                    placeholder="e.g. Café Mokka"
                                    required
                                    className={inputCls}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        City <span className="text-red-400">*</span>
                                    </label>
                                    <input type="text" value={form.city} onChange={setField('city')} placeholder="Warsaw" required className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Street address <span className="text-red-400">*</span>
                                    </label>
                                    <input type="text" value={form.address} onChange={setField('address')} placeholder="ul. Nowy Świat 12" required className={inputCls} />
                                </div>
                            </div>

                            {/* Category chips */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Category</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, category: c.id }))}
                                            className={`
                                                flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold border transition-all
                                                ${form.category === c.id
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300'}
                                            `}
                                        >
                                            {c.emoji} {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    <Globe size={11} /> Website or Instagram
                                    <span className="normal-case font-normal text-slate-400">(optional)</span>
                                </label>
                                <input
                                    type="url"
                                    value={form.website_url}
                                    onChange={setField('website_url')}
                                    placeholder="https://..."
                                    className={inputCls}
                                />
                            </div>

                            <button
                                onClick={() => setStep(1)}
                                disabled={!canGoNext[0]}
                                className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-base shadow-xl hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                Continue <ChevronRight size={20} />
                            </button>
                        </motion.div>
                    )}

                    {/* ══════ STEP 2: Details ══════ */}
                    {step === 1 && (
                        <motion.div key="details"
                            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="p-8 space-y-6"
                        >
                            {/* AI panel */}
                            <div className={`border rounded-2xl p-5 space-y-3 transition-all ${
                                aiDone
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                                    : 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30'
                            }`}>
                                <div className="flex items-center gap-2">
                                    {aiDone
                                        ? <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                                        : <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
                                    }
                                    <span className={`text-sm font-bold ${aiDone ? 'text-emerald-700 dark:text-emerald-300' : 'text-indigo-700 dark:text-indigo-300'}`}>
                                        {aiDone ? 'Fields filled by AI ✓' : 'AI can fill most fields for you'}
                                    </span>
                                </div>
                                {!aiDone && (
                                    <button
                                        onClick={fillWithAI}
                                        disabled={aiLoading || !form.name}
                                        className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {aiLoading
                                            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Filling…</>
                                            : <><Sparkles size={15} /> Fill with AI</>
                                        }
                                    </button>
                                )}
                                {aiDone && (
                                    <button onClick={() => setAIDone(false)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                                        Fill again
                                    </button>
                                )}
                                {aiError && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                        <AlertCircle size={12} /> {aiError}
                                    </p>
                                )}
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Based on: <span className="font-medium">{form.name}{form.city ? `, ${form.city}` : ''}</span>
                                </p>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={setField('description')}
                                    placeholder="What makes this place special? AI will suggest something…"
                                    rows={3}
                                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white text-sm resize-none"
                                />
                            </div>

                            {/* Price range */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Price range</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {PRICE_LEVELS.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, price_range: p.id }))}
                                            className={`
                                                flex flex-col items-center py-3 rounded-2xl border text-sm transition-all
                                                ${form.price_range === p.id
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300'}
                                            `}
                                        >
                                            <span className="font-black">{p.label}</span>
                                            <span className="text-[10px] opacity-70 mt-0.5">{p.sub}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Toggles */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Features</label>
                                <Toggle label="🌿 Outdoor seating" value={form.outdoor_seating} onChange={setCheck('outdoor_seating')} />
                                <div className="border-t border-slate-200 dark:border-slate-700" />
                                <Toggle label="🐾 Pet friendly"     value={form.pet_friendly}     onChange={setCheck('pet_friendly')} />
                            </div>

                            {/* Must Try & Insider Tip — user-only */}
                            <div className="border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 rounded-2xl p-5 space-y-3">
                                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-bold">
                                    <Lock size={12} /> Your personal insights — AI will not fill these
                                </div>
                                <input
                                    value={form.must_try}
                                    onChange={setField('must_try')}
                                    placeholder="Must try dish or drink…"
                                    className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
                                />
                                <input
                                    value={form.insider_tip}
                                    onChange={setField('insider_tip')}
                                    placeholder="Insider tip (e.g. ask for the secret menu)…"
                                    className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
                                />
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-base shadow-xl hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                Continue <ChevronRight size={20} />
                            </button>
                        </motion.div>
                    )}

                    {/* ══════ STEP 3: Review ══════ */}
                    {step === 2 && (
                        <motion.div key="review"
                            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="p-8 space-y-6"
                        >
                            {/* Preview card */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                <div className="h-32 bg-gradient-to-br from-indigo-100 dark:from-indigo-900/50 to-slate-200 dark:to-slate-800 flex items-center justify-center">
                                    <div className="text-center space-y-1 opacity-40">
                                        <Utensils size={28} className="mx-auto text-slate-400 dark:text-slate-500" />
                                        <p className="text-xs text-slate-500">Photo after approval</p>
                                    </div>
                                </div>
                                <div className="p-5 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-black text-slate-900 dark:text-white text-lg leading-tight">{form.name || '—'}</p>
                                        {form.price_range && <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">{form.price_range}</span>}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                                        <MapPin size={13} />
                                        <span>{[form.address, form.city].filter(Boolean).join(', ') || '—'}</span>
                                    </div>
                                    <span className="inline-block text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-2 py-0.5 capitalize">{form.category}</span>
                                    {form.description && <p className="text-slate-500 text-xs line-clamp-2 pt-1">{form.description}</p>}
                                    {(form.outdoor_seating || form.pet_friendly) && (
                                        <div className="flex gap-3 text-xs text-slate-400 pt-1">
                                            {form.outdoor_seating && <span>🌿 Outdoor</span>}
                                            {form.pet_friendly    && <span>🐾 Pet friendly</span>}
                                        </div>
                                    )}
                                    {form.must_try && (
                                        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-3 py-2 mt-2">
                                            <p className="text-amber-700 dark:text-amber-400 text-xs font-bold">Must try</p>
                                            <p className="text-slate-600 dark:text-slate-400 text-xs">{form.must_try}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Confirmation */}
                            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <div className="relative mt-0.5 shrink-0">
                                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="sr-only" />
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                                        ${confirmed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                                        {confirmed && <CheckCircle2 size={12} className="text-white" />}
                                    </div>
                                </div>
                                <span className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    I confirm this is a real place and the information I provided is accurate.
                                </span>
                            </label>

                            {error && (
                                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl px-4 py-3">
                                    <AlertCircle size={16} className="text-red-500 shrink-0" />
                                    <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                                </div>
                            )}

                            <button
                                onClick={handleSubmit}
                                disabled={!confirmed || loading}
                                className="w-full h-16 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-base shadow-xl hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {loading
                                    ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <><CheckCircle2 size={20} /> Submit for Review</>
                                }
                            </button>
                            <p className="text-center text-xs text-slate-400">
                                🏆 +100 points on approval · Typically reviewed within 48 hours
                            </p>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div>
    )
}
