import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, Sparkles, X, Plus } from 'lucide-react'
import { useUserPrefsStore } from '@/shared/store/useUserPrefsStore'
import { useTranslation } from 'react-i18next'
import { useCuisineOptions } from '@/shared/hooks/useCuisineOptions'
import { supabase } from '@/shared/api/client'

// ─── Static data ──────────────────────────────────────────────────────────

const VIBES = [
    { id: 'Romantic',      label: 'Romantic',    icon: '🕯️', desc: 'Intimate, candlelit' },
    { id: 'Casual',        label: 'Casual',      icon: '😎', desc: 'Relaxed, everyday' },
    { id: 'Sophisticated', label: 'Fine Dining', icon: '🎩', desc: 'Premium experience' },
    { id: 'Energetic',     label: 'Lively',      icon: '⚡', desc: 'Buzzing atmosphere' },
    { id: 'Cozy',          label: 'Cozy',        icon: '🧸', desc: 'Warm, homey feel' },
    { id: 'Hipster',       label: 'Trendy',      icon: '✨', desc: 'Creative spaces' },
]

const PRICE_LEVELS = [
    { id: '$',   label: 'Budget',    desc: 'Under €15/person', icon: '🪙' },
    { id: '$$',  label: 'Mid-range', desc: '€15–40/person',    icon: '💳' },
    { id: '$$$', label: 'Premium',   desc: '€40+/person',      icon: '💎' },
]

const ALLERGENS = [
    { id: 'gluten-free',   label: 'Gluten',     icon: '🌾' },
    { id: 'dairy-free',    label: 'Dairy',      icon: '🥛' },
    { id: 'egg-free',      label: 'Eggs',       icon: '🥚' },
    { id: 'nut-free',      label: 'Nuts',       icon: '🥜' },
    { id: 'seafood-free',  label: 'Seafood',    icon: '🦐' },
    { id: 'fish-free',     label: 'Fish',       icon: '🐟' },
    { id: 'soy-free',      label: 'Soy',        icon: '🫘' },
    { id: 'pork-free',     label: 'Pork',       icon: '🐷' },
    { id: 'alcohol-free',  label: 'Alcohol',    icon: '🍺' },
    { id: 'vegan',         label: 'Vegan',      icon: '🌱' },
    { id: 'vegetarian',    label: 'Vegetarian', icon: '🥗' },
    { id: 'halal',         label: 'Halal',      icon: '☪️' },
    { id: 'kosher',        label: 'Kosher',     icon: '✡️' },
]

// ─── Save DNA to Supabase ─────────────────────────────────────────────────

async function saveDNAToSupabase({ cuisines, vibes, budget, allergens }) {
    if (!supabase) return
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const userId = session.user.id

        // Always upsert to user_preferences
        // Keep 'any' in the DB — it acts as a sentinel that onboarding was completed.
        const { error: upError } = await supabase
            .from('user_preferences')
            .upsert({
                user_id:              userId,
                onboarding_completed: true,
                favorite_cuisines:    cuisines,   // preserve 'any' sentinel
                vibe_preferences:     vibes,
                dietary_restrictions: allergens,
                price_range:          budget?.length > 0 ? budget[0] : null,
                last_updated:         new Date().toISOString(),
            }, { onConflict: 'user_id' })

        if (upError) {
            console.warn('[Onboarding] user_preferences upsert failed:', upError.message)
        } else {
            console.log('[Onboarding] ✅ DNA saved to user_preferences')
        }
    } catch (err) {
        console.warn('[Onboarding] saveDNAToSupabase error:', err.message)
    }
}

// ─── Shared Chip component ────────────────────────────────────────────────

function Chip({ selected, onClick, children, className = '' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-bold transition-all active:scale-95 ${
                selected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-white/5 border-white/15 text-white/70 hover:border-white/30 hover:text-white'
            } ${className}`}
        >
            {selected && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                    <Check size={9} className="text-blue-600" strokeWidth={3} />
                </span>
            )}
            {children}
        </button>
    )
}

// ─── Progress dots ─────────────────────────────────────────────────────────

function ProgressDots({ total, current }) {
    return (
        <div className="flex gap-2 justify-center">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                        i < current
                            ? 'w-6 bg-blue-500'
                            : i === current
                            ? 'w-8 bg-white'
                            : 'w-1.5 bg-white/20'
                    }`}
                />
            ))}
        </div>
    )
}

// ─── Step 1: Cuisines ─────────────────────────────────────────────────────

function StepCuisines({ value, onChange }) {
    const { t } = useTranslation()
    const { options: cuisines, isLoading } = useCuisineOptions()
    const toggle = (id) =>
        onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                    {t('onboarding.cuisines_title')}
                </h2>
                <p className="text-white/50 text-sm font-medium mt-1">
                    {t('onboarding.cuisines_desc')}
                </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
                {isLoading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-10 rounded-2xl bg-white/10 animate-pulse"
                            style={{ width: `${70 + (i % 3) * 20}px` }}
                        />
                    ))
                    : cuisines.map((c) => (
                        <Chip key={c.id} selected={value.includes(c.name)} onClick={() => toggle(c.name)}>
                            <span className="text-base">{c.emoji}</span>
                            {c.label}
                        </Chip>
                    ))
                }
            </div>
        </div>
    )
}

// ─── Step 2: Vibe ─────────────────────────────────────────────────────────

function StepVibes({ value, onChange }) {
    const { t } = useTranslation()
    const toggle = (id) =>
        onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                    {t('onboarding.vibes_title')}
                </h2>
                <p className="text-white/50 text-sm font-medium mt-1">
                    {t('onboarding.vibes_desc')}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {VIBES.map((v) => (
                    <button
                        key={v.id}
                        type="button"
                        onClick={() => toggle(v.id)}
                        className={`relative flex flex-col gap-1 p-4 rounded-2xl border text-left transition-all active:scale-95 ${
                            value.includes(v.id)
                                ? 'bg-blue-600/20 border-blue-500/60 text-white shadow-lg shadow-blue-500/10'
                                : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                        }`}
                    >
                        {value.includes(v.id) && (
                            <span className="absolute top-3 right-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                <Check size={11} className="text-white" strokeWidth={3} />
                            </span>
                        )}
                        <span className="text-2xl">{v.icon}</span>
                        <span className="font-black text-sm">{v.label}</span>
                        <span className="text-xs font-medium text-white/40">{v.desc}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}

// ─── Step 3: Budget ───────────────────────────────────────────────────────

function StepBudget({ value, onChange }) {
    const { t } = useTranslation()
    const toggle = (id) =>
        onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                    {t('onboarding.budget_title')}
                </h2>
                <p className="text-white/50 text-sm font-medium mt-1">
                    {t('onboarding.budget_desc')}
                </p>
            </div>

            <div className="space-y-3">
                {PRICE_LEVELS.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => toggle(p.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                            value.includes(p.id)
                                ? 'bg-blue-600/20 border-blue-500/60 shadow-lg shadow-blue-500/10'
                                : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                    >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                            value.includes(p.id) ? 'bg-blue-600' : 'bg-white/10'
                        }`}>
                            {p.icon}
                        </div>
                        <div className="flex-1">
                            <p className="font-black text-white text-sm">{p.label}</p>
                            <p className="text-xs text-white/40 font-medium">{p.desc}</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            value.includes(p.id)
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-white/20'
                        }`}>
                            {value.includes(p.id) && <Check size={12} className="text-white" strokeWidth={3} />}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}

// ─── Step 4: Allergens ────────────────────────────────────────────────────

function StepAllergens({ value, onChange }) {
    const { t } = useTranslation()
    const [customInput, setCustomInput] = useState('')

    const toggle = (id) =>
        onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

    const addCustom = () => {
        const trimmed = customInput.trim()
        if (!trimmed) return
        if (!value.includes(trimmed)) {
            onChange([...value, trimmed])
        }
        setCustomInput('')
    }

    const removeCustom = (item) => onChange(value.filter((v) => v !== item))

    // Custom tags = items NOT in the predefined list
    const predefinedIds = ALLERGENS.map(a => a.id)
    const customTags = value.filter(v => !predefinedIds.includes(v))

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                    {t('onboarding.allergens_title', 'Allergies & Diet')}
                </h2>
                <p className="text-white/50 text-sm font-medium mt-1">
                    {t('onboarding.allergens_desc', "We'll filter out places that don't fit your needs")}
                </p>
            </div>

            {/* Predefined allergen chips */}
            <div className="flex flex-wrap gap-2.5">
                {ALLERGENS.map((a) => (
                    <button
                        key={a.id}
                        type="button"
                        onClick={() => toggle(a.id)}
                        className={`relative flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-sm font-bold transition-all active:scale-95 ${
                            value.includes(a.id)
                                ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-500/25'
                                : 'bg-white/5 border-white/15 text-white/70 hover:border-white/30 hover:text-white'
                        }`}
                    >
                        {value.includes(a.id) && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                                <X size={8} className="text-rose-600" strokeWidth={3} />
                            </span>
                        )}
                        <span className="text-base leading-none">{a.icon}</span>
                        <span>No {a.label}</span>
                    </button>
                ))}
            </div>

            {/* Custom allergen input */}
            <div className="space-y-3">
                <p className="text-xs font-black text-white/30 uppercase tracking-widest">
                    {t('onboarding.allergens_custom', 'Add your own')}
                </p>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={customInput}
                        onChange={e => setCustomInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCustom()}
                        placeholder={t('onboarding.allergens_placeholder', 'e.g. Sesame, Mustard…')}
                        className="flex-1 h-11 px-4 rounded-2xl bg-white/8 border border-white/15 text-white text-sm font-medium placeholder:text-white/25 outline-none focus:border-blue-500/60 focus:bg-white/10 transition-all"
                    />
                    <button
                        type="button"
                        onClick={addCustom}
                        disabled={!customInput.trim()}
                        className={`h-11 w-11 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
                            customInput.trim()
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-white/5 text-white/20 cursor-not-allowed'
                        }`}
                    >
                        <Plus size={18} />
                    </button>
                </div>

                {/* Custom tags */}
                {customTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {customTags.map(tag => (
                            <span
                                key={tag}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-300 text-xs font-bold"
                            >
                                {tag}
                                <button
                                    type="button"
                                    onClick={() => removeCustom(tag)}
                                    className="text-rose-400 hover:text-white transition-colors"
                                >
                                    <X size={11} strokeWidth={3} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* None selected hint */}
            {value.length === 0 && (
                <p className="text-xs text-white/25 font-medium text-center pt-2">
                    {t('onboarding.allergens_none', 'No restrictions? Just tap Continue →')}
                </p>
            )}
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────

const TOTAL_STEPS = 4

export function OnboardingFlow({ onComplete }) {
    const { t } = useTranslation()
    const { updatePrefs } = useUserPrefsStore()

    const [step, setStep]         = useState(0)
    const [cuisines, setCuisines] = useState([])
    const [vibes, setVibes]       = useState([])
    const [budget, setBudget]     = useState(['$$'])
    const [allergens, setAllergens] = useState([])
    const [saving, setSaving]     = useState(false)

    // Step 0–3 can-continue rules:
    //   0 (cuisines)  → at least 1
    //   1 (vibes)     → at least 1
    //   2 (budget)    → at least 1 (pre-selected '$$', always true)
    //   3 (allergens) → always allowed (optional step)
    const canContinue = [
        cuisines.length > 0,
        vibes.length > 0,
        budget.length > 0,
        true,
    ][step] ?? true

    const handleNext = () => {
        if (step < TOTAL_STEPS - 1) {
            setStep((s) => s + 1)
        } else {
            handleFinish()
        }
    }

    const handleFinish = async () => {
        setSaving(true)
        const dna = {
            cuisines:  cuisines.length > 0 ? cuisines : ['any'],
            vibes,
            budget:    budget.length > 0 ? budget : ['$$'],
            allergens,
        }

        // 1. Save to Zustand + localStorage (instant, always works)
        updatePrefs({
            onboardingCompleted:  true,
            favoriteCuisines:     dna.cuisines,
            vibePreference:       dna.vibes,
            priceRange:           dna.budget,
            dietaryRestrictions:  dna.allergens,
        })

        // 2. Save to Supabase (async, non-blocking — failures logged not thrown)
        await saveDNAToSupabase(dna)

        setSaving(false)
        onComplete()
    }

    const handleSkip = () => {
        // Mark cuisines as ['any'] so OnboardingGate never shows again
        updatePrefs({
            onboardingCompleted: true,
            favoriteCuisines: cuisines.length > 0 ? cuisines : ['any'],
            vibePreference:   vibes,
            priceRange:       budget.length > 0 ? budget : ['$$'],
            dietaryRestrictions: allergens,
        })
        // Fire-and-forget save
        saveDNAToSupabase({
            cuisines: cuisines.length > 0 ? cuisines : ['any'],
            vibes,
            budget: budget.length > 0 ? budget : ['$$'],
            allergens,
        })
        onComplete()
    }

    const steps = [
        <StepCuisines  key="cuisines"  value={cuisines}   onChange={setCuisines}  />,
        <StepVibes     key="vibes"     value={vibes}      onChange={setVibes}     />,
        <StepBudget    key="budget"    value={budget}      onChange={setBudget}    />,
        <StepAllergens key="allergens" value={allergens}   onChange={setAllergens} />,
    ]

    return (
        <div className="fixed inset-0 z-[200] bg-[#0f172a] flex flex-col">
            {/* Background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px]" />
                {step === 3 && (
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 bg-rose-600/10 rounded-full blur-[100px]" />
                )}
            </div>

            {/* Header */}
            <div className="relative z-10 px-6 pb-4 flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 3rem)' }}>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                        <Sparkles size={16} className="text-white" />
                    </div>
                    <span className="font-black text-white text-sm tracking-tight">GastroMap</span>
                </div>
                <button
                    onClick={handleSkip}
                    className="text-xs font-bold text-white/30 hover:text-white/60 transition-colors"
                >
                    {t('onboarding.skip')}
                </button>
            </div>

            {/* Progress */}
            <div className="relative z-10 px-6 pb-5">
                <ProgressDots total={TOTAL_STEPS} current={step} />
            </div>

            {/* Step content */}
            <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-4">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                    >
                        {steps[step]}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* CTA */}
            <div className="relative z-10 px-6 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2.5rem)' }}>
                <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canContinue || saving}
                    className={`w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                        canContinue && !saving
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/30 active:scale-95'
                            : 'bg-white/10 text-white/30 cursor-not-allowed'
                    }`}
                >
                    {saving ? (
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : step === TOTAL_STEPS - 1 ? (
                        <>
                            <Sparkles size={16} />
                            {t('onboarding.start')}
                        </>
                    ) : (
                        <>
                            {t('onboarding.continue')}
                            <ArrowRight size={16} />
                        </>
                    )}
                </button>

                <p className="text-center text-xs text-white/20 font-medium mt-3">
                    {t('onboarding.step_hint', { current: step + 1, total: TOTAL_STEPS })}
                </p>
            </div>
        </div>
    )
}
