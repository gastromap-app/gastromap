import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    MapPin, ChefHat, Wallet, ArrowRight, Check, Sparkles,
    Coffee, UtensilsCrossed, Wine, Fish, Leaf, Flame
} from 'lucide-react'
import { useUserPrefsStore } from '@/shared/store/useUserPrefsStore'
import { useTranslation } from 'react-i18next'

// ─── Step data ────────────────────────────────────────────────────────────
const CUISINES = [
    { id: 'polish', label: 'Polish', icon: '🥟' },
    { id: 'italian', label: 'Italian', icon: '🍝' },
    { id: 'japanese', label: 'Japanese', icon: '🍣' },
    { id: 'middle-eastern', label: 'Middle Eastern', icon: '🧆' },
    { id: 'french', label: 'French', icon: '🥐' },
    { id: 'mexican', label: 'Mexican', icon: '🌮' },
    { id: 'indian', label: 'Indian', icon: '🍛' },
    { id: 'coffee', label: 'Specialty Coffee', icon: '☕' },
]

const VIBES = [
    { id: 'Romantic', label: 'Romantic', icon: '🕯️', desc: 'Intimate, candlelit' },
    { id: 'Casual', label: 'Casual', icon: '😎', desc: 'Relaxed, everyday' },
    { id: 'Sophisticated', label: 'Fine Dining', icon: '🎩', desc: 'Premium experience' },
    { id: 'Energetic', label: 'Lively', icon: '⚡', desc: 'Buzzing atmosphere' },
    { id: 'Cozy', label: 'Cozy', icon: '🧸', desc: 'Warm, homey feel' },
    { id: 'Hipster', label: 'Trendy', icon: '✨', desc: 'Creative spaces' },
]

const PRICE_LEVELS = [
    { id: '$', label: 'Budget', desc: 'Under €15/person', icon: '🪙' },
    { id: '$$', label: 'Mid-range', desc: '€15–40/person', icon: '💳' },
    { id: '$$$', label: 'Premium', desc: '€40+/person', icon: '💎' },
]

const DIETARY = [
    { id: 'vegetarian', label: 'Vegetarian' },
    { id: 'vegan', label: 'Vegan' },
    { id: 'gluten-free', label: 'Gluten-Free' },
    { id: 'halal', label: 'Halal' },
]

// ─── Toggle chip ──────────────────────────────────────────────────────────
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

// ─── Progress dots ────────────────────────────────────────────────────────
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
                {CUISINES.map((c) => (
                    <Chip key={c.id} selected={value.includes(c.id)} onClick={() => toggle(c.id)}>
                        <span className="text-base">{c.icon}</span>
                        {c.label}
                    </Chip>
                ))}
            </div>

            <div>
                <p className="text-xs font-black text-white/30 uppercase tracking-widest mb-2">
                    {t('onboarding.dietary')}
                </p>
                <div className="flex flex-wrap gap-2">
                    {DIETARY.map((d) => (
                        <Chip key={d.id} selected={value.includes(d.id)} onClick={() => toggle(d.id)}>
                            {d.label}
                        </Chip>
                    ))}
                </div>
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

// ─── Main component ───────────────────────────────────────────────────────
const TOTAL_STEPS = 3

/**
 * OnboardingFlow — first-launch preference wizard.
 *
 * @param {{ onComplete: () => void }} props
 */
export function OnboardingFlow({ onComplete }) {
    const { t } = useTranslation()
    const { updatePrefs } = useUserPrefsStore()

    const [step, setStep] = useState(0)
    const [cuisines, setCuisines] = useState([])
    const [vibes, setVibes] = useState([])
    const [budget, setBudget] = useState(['$$'])

    const canContinue = [
        cuisines.length > 0,
        vibes.length > 0,
        budget.length > 0,
    ][step] ?? true

    const handleNext = () => {
        if (step < TOTAL_STEPS - 1) {
            setStep((s) => s + 1)
        } else {
            handleFinish()
        }
    }

    // Save full selections and close. Guarantees favoriteCuisines.length > 0
    // so OnboardingGate never shows again.
    const handleFinish = () => {
        updatePrefs({
            favoriteCuisines: cuisines.length > 0 ? cuisines : ['any'],
            vibePreference: vibes,
            priceRange: budget.length > 0 ? budget : ['$$'],
        })
        onComplete()
    }

    // Skip: save whatever was partially selected, mark cuisines as 'any'
    // if the user never picked anything (the 'never show again' marker).
    const handleSkip = () => {
        updatePrefs({
            favoriteCuisines: cuisines.length > 0 ? cuisines : ['any'],
            vibePreference: vibes,
            priceRange: budget.length > 0 ? budget : ['$$'],
        })
        onComplete()
    }

    const steps = [
        <StepCuisines key="cuisines" value={cuisines} onChange={setCuisines} />,
        <StepVibes key="vibes" value={vibes} onChange={setVibes} />,
        <StepBudget key="budget" value={budget} onChange={setBudget} />,
    ]

    return (
        <div className="fixed inset-0 z-[200] bg-[#0f172a] flex flex-col">
            {/* Background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px]" />
            </div>

            {/* Header */}
            <div className="relative z-10 px-6 pt-safe pt-12 pb-4 flex items-center justify-between">
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
            <div className="relative z-10 px-6 pb-6">
                <ProgressDots total={TOTAL_STEPS} current={step} />
            </div>

            {/* Step content */}
            <div className="relative z-10 flex-1 overflow-y-auto px-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                        {steps[step]}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* CTA */}
            <div className="relative z-10 px-6 pb-safe pb-10 pt-4">
                <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canContinue}
                    className={`w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                        canContinue
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/30 active:scale-95'
                            : 'bg-white/10 text-white/30 cursor-not-allowed'
                    }`}
                >
                    {step === TOTAL_STEPS - 1 ? (
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
