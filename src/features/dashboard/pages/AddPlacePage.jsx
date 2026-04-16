import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
    MapPin, Sparkles, CheckCircle2, Lock, ChevronLeft, ChevronRight,
    AlertCircle, Globe, Search, X, Upload, Trash2, Image as ImageIcon,
} from 'lucide-react'
import { useAuthStore } from '@/features/auth/hooks/useAuthStore'
import { createSubmission, compressImage, uploadSubmissionPhoto } from '@/shared/api/submissions.api'
import { enrichLocation } from '@/shared/api/ai'
import { searchPlaces, searchCities, searchAddresses } from '../hooks/useNominatim'

// ─── Constants ─────────────────────────────────────────────────────────────

const STEPS = [
    { id: 'location', label: 'Location' },
    { id: 'details',  label: 'Details'  },
    { id: 'review',   label: 'Review'   },
]

const CATEGORIES = [
    { id: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
    { id: 'cafe',       label: 'Café',       emoji: '☕' },
    { id: 'bar',        label: 'Bar',        emoji: '🍺' },
    { id: 'bakery',     label: 'Bakery',     emoji: '🥐' },
    { id: 'other',      label: 'Other',      emoji: '📍' },
]

const PRICE_LEVELS = [
    { id: '$',    label: '€',    sub: 'Budget',      range: 'up to €15' },
    { id: '$$',   label: '€€',   sub: 'Mid-range',   range: '€15–35'    },
    { id: '$$$',  label: '€€€',  sub: 'Premium',     range: '€35–70'    },
    { id: '$$$$', label: '€€€€', sub: 'Fine Dining', range: '€70+'      },
]

// Category → Unsplash photo ID (free, no API key, high quality food photography)
const CATEGORY_PHOTOS = {
    restaurant: 'photo-1517248135467-4c7edcad34c4',
    cafe:       'photo-1559305616-3f99cd43e353',
    bar:        'photo-1543007631-283050bb3e8c',
    bakery:     'photo-1509440159596-0249088772ff',
    other:      'photo-1414235077428-338989a2e8c0',
}

const AI_PHOTO_BASE = 'https://images.unsplash.com'

const COUNTRIES = [
    { code: 'PL', name: 'Poland' }, { code: 'UA', name: 'Ukraine' }, { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' }, { code: 'IT', name: 'Italy'   }, { code: 'ES', name: 'Spain'   },
    { code: 'GB', name: 'United Kingdom' }, { code: 'US', name: 'United States' },
    { code: 'NL', name: 'Netherlands' }, { code: 'BE', name: 'Belgium' },
    { code: 'AT', name: 'Austria' }, { code: 'CH', name: 'Switzerland' },
    { code: 'CZ', name: 'Czech Republic' }, { code: 'SK', name: 'Slovakia' },
    { code: 'HU', name: 'Hungary' }, { code: 'RO', name: 'Romania' },
    { code: 'BG', name: 'Bulgaria' }, { code: 'HR', name: 'Croatia' },
    { code: 'SE', name: 'Sweden' }, { code: 'NO', name: 'Norway' },
    { code: 'DK', name: 'Denmark' }, { code: 'FI', name: 'Finland' },
    { code: 'PT', name: 'Portugal' }, { code: 'GR', name: 'Greece' },
    { code: 'TR', name: 'Turkey' }, { code: 'JP', name: 'Japan' },
    { code: 'CN', name: 'China' }, { code: 'KR', name: 'South Korea' },
    { code: 'IN', name: 'India' }, { code: 'TH', name: 'Thailand' },
    { code: 'SG', name: 'Singapore' }, { code: 'AU', name: 'Australia' },
    { code: 'CA', name: 'Canada' }, { code: 'MX', name: 'Mexico' },
    { code: 'BR', name: 'Brazil' }, { code: 'AR', name: 'Argentina' },
    { code: 'ZA', name: 'South Africa' }, { code: 'EG', name: 'Egypt' },
    { code: 'AE', name: 'UAE' }, { code: 'IL', name: 'Israel' },
].sort((a, b) => a.name.localeCompare(b.name))

const MAX_PHOTOS = 5

const EMPTY_FORM = {
    name: '', country: '', country_code: '', city: '', address: '',
    category: 'restaurant', website_url: '',
    description: '', price_range: '',
    outdoor_seating: false, pet_friendly: false,
    must_try: '', insider_tip: '',
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function getAiPhotoUrl(category) {
    const id = CATEGORY_PHOTOS[category] || CATEGORY_PHOTOS.other
    return `${AI_PHOTO_BASE}/${id}?w=800&q=80`
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ProgressBar({ step }) {
    return (
        <div className="flex items-center">
            {STEPS.map((s, i) => (
                <React.Fragment key={s.id}>
                    <div className={`
                        w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0
                        ${i < step   ? 'bg-indigo-600 text-white'
                        : i === step ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/25'
                                     : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}
                    `}>
                        {i < step ? <CheckCircle2 size={14} /> : i + 1}
                    </div>
                    {i < STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 transition-colors duration-500 ${i < step ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
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
            <div onClick={onChange} className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${value ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
            </div>
        </label>
    )
}

/** Generic autocomplete dropdown input. */
function AutocompleteInput({
    value, onChange, onSelect, suggestions, loading,
    placeholder, required, icon: Icon, label, minLength = 2,
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [])

    useEffect(() => {
        setOpen(suggestions.length > 0 && value.length >= minLength)
    }, [suggestions, value, minLength])

    const inputCls = 'w-full h-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white text-sm'

    return (
        <div ref={ref} className="relative">
            {label && (
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
            )}
            <div className="relative">
                {Icon && <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />}
                {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
                    placeholder={placeholder}
                    required={required}
                    className={`${inputCls} ${Icon ? 'pl-10' : 'px-4'} pr-4`}
                />
            </div>
            <AnimatePresence>
                {open && (
                    <motion.ul
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden max-h-52 overflow-y-auto"
                    >
                        {suggestions.map((s, i) => (
                            <li key={s.id || i}>
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        onSelect(s)
                                        setOpen(false)
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                                >
                                    <span className="font-semibold">{s.name || s.street}</span>
                                    {s.displayName && (
                                        <span className="text-slate-400 text-xs block truncate">{s.displayName}</span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    )
}

function SuccessScreen({ onAddAnother, onHome }) {
    return (
        <div className="max-w-xl mx-auto px-4 py-12 mt-14 md:mt-20 text-center">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="bg-white dark:bg-slate-900 rounded-[40px] p-10 border border-slate-100 dark:border-slate-800 shadow-2xl shadow-indigo-500/5"
            >
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
                    <CheckCircle2 size={40} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">Submitted!</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-5">Our team reviews submissions within 48 hours.</p>
                <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl px-4 py-2.5 mb-8">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm">🏆 +100 points</span>
                    <span className="text-indigo-400 text-sm">credited on approval</span>
                </div>
                <div className="flex flex-col gap-3">
                    <button onClick={onAddAnother} className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black transition-all shadow-lg active:scale-95">
                        Add Another Place
                    </button>
                    <button onClick={onHome} className="w-full py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-all active:scale-95">
                        Back to Home
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function AddPlacePage() {
    const { user }  = useAuthStore()
    const navigate  = useNavigate()

    // ── Wizard state ──────────────────────────────────────────────────────
    const [step, setStep] = useState(0)
    const [done, setDone] = useState(false)

    // ── Form data ─────────────────────────────────────────────────────────
    const [form, setForm] = useState(EMPTY_FORM)
    const setField = (field) => (val) =>
        setForm((f) => ({ ...f, [field]: typeof val === 'string' ? val : val?.target?.value ?? val }))

    // ── Autocomplete: place name ───────────────────────────────────────────
    const [placeSuggestions, setPlaceSuggestions] = useState([])
    const [placeLoading, setPlaceLoading]         = useState(false)
    const placeTimer = useRef(null)

    const onPlaceInput = useCallback((val) => {
        setField('name')(val)
        clearTimeout(placeTimer.current)
        if (val.length < 2) { setPlaceSuggestions([]); return }
        setPlaceLoading(true)
        placeTimer.current = setTimeout(async () => {
            const results = await searchPlaces(val)
            setPlaceSuggestions(results)
            setPlaceLoading(false)
        }, 350)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const onPlaceSelect = (s) => {
        setForm((f) => ({
            ...f,
            name:         s.name,
            country:      s.country,
            country_code: s.countryCode,
            city:         s.city,
            address:      s.street,
        }))
        setPlaceSuggestions([])
    }

    // ── Autocomplete: city ────────────────────────────────────────────────
    const [citySuggestions, setCitySuggestions] = useState([])
    const [cityLoading, setCityLoading]         = useState(false)
    const cityTimer = useRef(null)

    const onCityInput = useCallback((val) => {
        setField('city')(val)
        clearTimeout(cityTimer.current)
        if (val.length < 2) { setCitySuggestions([]); return }
        setCityLoading(true)
        cityTimer.current = setTimeout(async () => {
            const results = await searchCities(val, form.country_code)
            setCitySuggestions(results)
            setCityLoading(false)
        }, 350)
    }, [form.country_code]) // eslint-disable-line react-hooks/exhaustive-deps

    const onCitySelect = (s) => {
        setForm((f) => ({ ...f, city: s.name }))
        setCitySuggestions([])
    }

    // ── Autocomplete: address ─────────────────────────────────────────────
    const [addrSuggestions, setAddrSuggestions] = useState([])
    const [addrLoading, setAddrLoading]         = useState(false)
    const addrTimer = useRef(null)

    const onAddressInput = useCallback((val) => {
        setField('address')(val)
        clearTimeout(addrTimer.current)
        if (val.length < 3) { setAddrSuggestions([]); return }
        setAddrLoading(true)
        addrTimer.current = setTimeout(async () => {
            const results = await searchAddresses(val, form.city, form.country_code)
            setAddrSuggestions(results)
            setAddrLoading(false)
        }, 400)
    }, [form.city, form.country_code]) // eslint-disable-line react-hooks/exhaustive-deps

    const onAddressSelect = (s) => {
        setForm((f) => ({ ...f, address: s.street }))
        setAddrSuggestions([])
    }

    // ── AI enrichment ─────────────────────────────────────────────────────
    const [aiLoading, setAILoading] = useState(false)
    const [aiDone, setAIDone]       = useState(false)
    const [aiError, setAIError]     = useState('')
    const [aiPhoto, setAiPhoto]     = useState(null)  // URL string

    const hasDescription = form.description.trim().length > 0

    async function handleAI() {
        setAIError('')
        setAILoading(true)
        try {
            const data = await enrichLocation({
                name:     form.name,
                address:  form.address,
                city:     form.city,
                category: form.category,
                // Pass user's description as context when enhancing
                userDescription: form.description || undefined,
            })
            // Merge AI data but keep user's description if it's meaningful
            setForm((f) => ({
                ...f,
                ...data,
                // If user had a description, keep theirs (AI enhanced it)
                description: data.description || f.description,
                // Never overwrite user-only fields
                must_try:    f.must_try,
                insider_tip: f.insider_tip,
            }))
            // Set AI-suggested photo based on category
            setAiPhoto(getAiPhotoUrl(form.category))
            setAIDone(true)
        } catch (err) {
            console.error('[AddPlacePage] AI error:', err)
            setAIError('AI request failed — please fill the fields manually or try again.')
        } finally {
            setAILoading(false)
        }
    }

    // ── Photo state ───────────────────────────────────────────────────────
    const [userPhotos, setUserPhotos]       = useState([]) // [{file, preview, compressed}]
    const [photoUploading, setPhotoUploading] = useState(false)
    const fileInputRef = useRef(null)

    async function handlePhotoFiles(files) {
        const remaining = MAX_PHOTOS - userPhotos.length
        if (remaining <= 0) return
        const toAdd = Array.from(files).slice(0, remaining)
        const newPhotos = await Promise.all(toAdd.map(async (file) => {
            const preview = URL.createObjectURL(file)
            try {
                const compressed = await compressImage(file)
                return { file, preview, compressed }
            } catch {
                return { file, preview, compressed: file }
            }
        }))
        setUserPhotos((prev) => [...prev, ...newPhotos])
    }

    function removeUserPhoto(index) {
        setUserPhotos((prev) => {
            const copy = [...prev]
            URL.revokeObjectURL(copy[index].preview)
            copy.splice(index, 1)
            return copy
        })
    }

    // Displayed photos for step 3: user uploads take priority; AI photo is fallback
    const displayedPhotos = userPhotos.length > 0
        ? userPhotos.map((p) => p.preview)
        : aiPhoto
        ? [aiPhoto]
        : []
    const isAiPhotoShowing = userPhotos.length === 0 && !!aiPhoto

    // ── Validation ────────────────────────────────────────────────────────
    const [step2Error, setStep2Error] = useState('')

    const step1Valid = form.name.trim() && form.country && form.city.trim() && form.address.trim()
    const step2Valid = form.must_try.trim() && form.insider_tip.trim()

    function handleStep1Next() {
        if (step1Valid) setStep(1)
    }

    function handleStep2Next() {
        if (!form.must_try.trim() || !form.insider_tip.trim()) {
            setStep2Error('Please fill in both Must Try and Insider Tip — they make your submission unique!')
            return
        }
        setStep2Error('')
        setStep(2)
    }

    // ── Submit ────────────────────────────────────────────────────────────
    const [confirmed, setConfirmed] = useState(false)
    const [submitLoading, setSubmitLoading] = useState(false)
    const [submitError, setSubmitError]     = useState('')

    async function handleSubmit() {
        if (!confirmed) return
        setSubmitError('')
        setSubmitLoading(true)
        try {
            // Upload user photos
            let photoUrls = []
            if (userPhotos.length > 0) {
                setPhotoUploading(true)
                photoUrls = await Promise.all(
                    userPhotos.map((p) => uploadSubmissionPhoto(p.compressed || p.file, user?.id || 'anon'))
                )
                setPhotoUploading(false)
            }

            const photos = [
                ...photoUrls,
                ...(isAiPhotoShowing || photoUrls.length === 0 ? (aiPhoto ? [aiPhoto] : []) : []),
            ]

            await createSubmission({
                ...form,
                user_id: user?.id,
                photos,
                ai_photo_url: aiPhoto || null,
            })
            setDone(true)
        } catch (err) {
            console.error('[AddPlacePage] Submit error:', err)
            setSubmitError(err.message || 'Submission failed. Please try again.')
        } finally {
            setSubmitLoading(false)
            setPhotoUploading(false)
        }
    }

    function reset() {
        setForm(EMPTY_FORM)
        userPhotos.forEach((p) => URL.revokeObjectURL(p.preview))
        setUserPhotos([])
        setAiPhoto(null)
        setAIDone(false)
        setAIError('')
        setStep2Error('')
        setSubmitError('')
        setConfirmed(false)
        setStep(0)
        setDone(false)
    }

    // ── Render ────────────────────────────────────────────────────────────

    if (done) return <SuccessScreen onAddAnother={reset} onHome={() => navigate('/dashboard')} />

    const inputBase = 'w-full h-12 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white text-sm'
    const labelCls  = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5'

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 mt-14 md:mt-20 pb-20">
            {/* ── Sticky header ── */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => (step > 0 ? setStep((s) => s - 1) : navigate(-1))}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    aria-label="Go back"
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Suggest a Place</h1>
                    <p className="text-xs text-slate-400 mt-0.5">{STEPS[step].label} · Step {step + 1} of {STEPS.length}</p>
                </div>
            </div>

            <div className="mb-8"><ProgressBar step={step} /></div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
                <AnimatePresence mode="wait">

                    {/* ════════════════════ STEP 1: Location ════════════════════ */}
                    {step === 0 && (
                        <motion.div key="step1"
                            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="p-6 md:p-8 space-y-5"
                        >
                            {/* Place name — Nominatim autocomplete */}
                            <AutocompleteInput
                                label="Place name"
                                required
                                value={form.name}
                                onChange={onPlaceInput}
                                onSelect={onPlaceSelect}
                                suggestions={placeSuggestions}
                                loading={placeLoading}
                                icon={Search}
                                placeholder="e.g. Café Mokka, Krakow — start typing…"
                                minLength={2}
                            />

                            <p className="text-xs text-slate-400 -mt-2">
                                💡 Selecting from the list will auto-fill Country, City and Address
                            </p>

                            {/* Country */}
                            <div>
                                <label className={labelCls}>Country <span className="text-red-400">*</span></label>
                                <select
                                    value={form.country_code}
                                    onChange={(e) => {
                                        const opt = COUNTRIES.find((c) => c.code === e.target.value)
                                        setForm((f) => ({ ...f, country: opt?.name || '', country_code: e.target.value, city: '', address: '' }))
                                    }}
                                    required
                                    className={`${inputBase} appearance-none`}
                                >
                                    <option value="">Select country…</option>
                                    {COUNTRIES.map((c) => (
                                        <option key={c.code} value={c.code}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* City — with autocomplete filtered by country */}
                            <AutocompleteInput
                                label="City"
                                required
                                value={form.city}
                                onChange={onCityInput}
                                onSelect={onCitySelect}
                                suggestions={citySuggestions}
                                loading={cityLoading}
                                icon={MapPin}
                                placeholder="Warsaw, Berlin, Paris…"
                                minLength={2}
                            />

                            {/* Street address — with autocomplete from 3 chars */}
                            <AutocompleteInput
                                label="Street address"
                                required
                                value={form.address}
                                onChange={onAddressInput}
                                onSelect={onAddressSelect}
                                suggestions={addrSuggestions}
                                loading={addrLoading}
                                placeholder="ul. Nowy Świat 12 — type 3+ characters…"
                                minLength={3}
                            />

                            {/* Category */}
                            <div>
                                <label className={labelCls}>Category</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map((c) => (
                                        <button key={c.id} type="button"
                                            onClick={() => setForm((f) => ({ ...f, category: c.id }))}
                                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-sm font-bold border transition-all ${
                                                form.category === c.id
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
                                            }`}>
                                            {c.emoji} {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Website */}
                            <div>
                                <label className={`${labelCls} flex items-center gap-1.5`}>
                                    <Globe size={11} /> Website or Instagram
                                    <span className="normal-case font-normal text-slate-400">(optional)</span>
                                </label>
                                <input type="url" value={form.website_url}
                                    onChange={(e) => setField('website_url')(e.target.value)}
                                    placeholder="https://..." className={inputBase} />
                            </div>

                            <button onClick={handleStep1Next} disabled={!step1Valid}
                                className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-base shadow-xl hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                Continue <ChevronRight size={20} />
                            </button>
                        </motion.div>
                    )}

                    {/* ════════════════════ STEP 2: Details ════════════════════ */}
                    {step === 1 && (
                        <motion.div key="step2"
                            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="p-6 md:p-8 space-y-5"
                        >
                            {/* Description FIRST */}
                            <div>
                                <label className={labelCls}>Description</label>
                                <textarea value={form.description}
                                    onChange={(e) => setField('description')(e.target.value)}
                                    placeholder="Write something about this place… or leave empty and let AI fill it"
                                    rows={4}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white text-sm resize-none"
                                />
                            </div>

                            {/* AI button — Enhance vs Fill */}
                            <div className={`border rounded-2xl p-5 space-y-3 transition-all ${
                                aiDone
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                                    : 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30'
                            }`}>
                                <div className="flex items-start gap-2">
                                    {aiDone
                                        ? <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                        : <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                                    }
                                    <div>
                                        <p className={`text-sm font-bold ${aiDone ? 'text-emerald-700 dark:text-emerald-300' : 'text-indigo-700 dark:text-indigo-300'}`}>
                                            {aiDone
                                                ? 'AI has enriched your submission ✓'
                                                : hasDescription
                                                ? 'Enhance with AI — add verified info from the web'
                                                : 'Fill with AI — generate description & details automatically'}
                                        </p>
                                        {!aiDone && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                {hasDescription
                                                    ? 'Your description is preserved and enriched with factual details'
                                                    : 'AI will search for info about this place and write a description'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {!aiDone && (
                                    <button onClick={handleAI} disabled={aiLoading || !form.name}
                                        className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                        {aiLoading
                                            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</>
                                            : <><Sparkles size={15} /> {hasDescription ? 'Enhance with AI' : 'Fill with AI'}</>
                                        }
                                    </button>
                                )}
                                {aiDone && (
                                    <button onClick={() => setAIDone(false)} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                                        Run AI again
                                    </button>
                                )}
                                {aiError && (
                                    <p className="text-xs text-red-500 flex items-center gap-1.5">
                                        <AlertCircle size={12} /> {aiError}
                                    </p>
                                )}
                            </div>

                            {/* Price range with examples */}
                            <div>
                                <label className={labelCls}>Price range</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {PRICE_LEVELS.map((p) => (
                                        <button key={p.id} type="button"
                                            onClick={() => setForm((f) => ({ ...f, price_range: p.id }))}
                                            className={`flex flex-col items-center py-3 rounded-2xl border text-sm transition-all ${
                                                form.price_range === p.id
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400'
                                            }`}>
                                            <span className="font-black text-base">{p.label}</span>
                                            <span className="text-[11px] font-semibold opacity-80 mt-0.5">{p.sub}</span>
                                            <span className={`text-[10px] mt-0.5 ${form.price_range === p.id ? 'opacity-70' : 'text-slate-400'}`}>{p.range}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Features toggles */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3">
                                <p className={labelCls}>Features</p>
                                <Toggle label="🌿 Outdoor seating" value={form.outdoor_seating} onChange={() => setForm((f) => ({ ...f, outdoor_seating: !f.outdoor_seating }))} />
                                <div className="border-t border-slate-200 dark:border-slate-700" />
                                <Toggle label="🐾 Pet friendly" value={form.pet_friendly} onChange={() => setForm((f) => ({ ...f, pet_friendly: !f.pet_friendly }))} />
                            </div>

                            {/* Must Try + Insider Tip — REQUIRED */}
                            <div className="border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 rounded-2xl p-5 space-y-4">
                                <div className="flex items-start gap-2">
                                    <Lock size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                                            Your personal insights — required
                                        </p>
                                        <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-0.5">
                                            AI will never fill these. Your first-hand experience makes the submission valuable.
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-amber-700 dark:text-amber-400/80 uppercase tracking-wider">
                                        Must Try <span className="text-red-400">*</span>
                                    </label>
                                    <input value={form.must_try}
                                        onChange={(e) => setField('must_try')(e.target.value)}
                                        placeholder="The dish or drink everyone must order…"
                                        className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-amber-700 dark:text-amber-400/80 uppercase tracking-wider">
                                        Insider Tip <span className="text-red-400">*</span>
                                    </label>
                                    <input value={form.insider_tip}
                                        onChange={(e) => setField('insider_tip')(e.target.value)}
                                        placeholder="A secret tip only regulars know…"
                                        className="w-full h-11 px-4 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white" />
                                </div>
                            </div>

                            {step2Error && (
                                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl px-4 py-3">
                                    <AlertCircle size={16} className="text-red-500 shrink-0" />
                                    <p className="text-red-600 dark:text-red-400 text-sm">{step2Error}</p>
                                </div>
                            )}

                            <button onClick={handleStep2Next}
                                className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-base shadow-xl hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                Continue <ChevronRight size={20} />
                            </button>
                        </motion.div>
                    )}

                    {/* ════════════════════ STEP 3: Review & Photos ════════════ */}
                    {step === 2 && (
                        <motion.div key="step3"
                            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="p-6 md:p-8 space-y-6"
                        >
                            {/* ── Preview card ── */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                {/* Main photo */}
                                <div className="relative h-48 bg-gradient-to-br from-indigo-100 dark:from-indigo-900/40 to-slate-200 dark:to-slate-800 overflow-hidden">
                                    {displayedPhotos[0] ? (
                                        <img src={displayedPhotos[0]} alt="Cover" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <ImageIcon size={32} className="text-slate-300 dark:text-slate-600" />
                                        </div>
                                    )}
                                    {isAiPhotoShowing && (
                                        <div className="absolute bottom-2 left-2">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-black/40 text-white backdrop-blur-sm px-2 py-1 rounded-lg">
                                                <Sparkles size={10} /> AI suggested photo
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-5 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-black text-slate-900 dark:text-white text-xl leading-tight">{form.name}</p>
                                        {form.price_range && <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 mt-1">{form.price_range}</span>}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                                        <MapPin size={13} strokeWidth={2} />
                                        <span>{[form.address, form.city, form.country].filter(Boolean).join(', ')}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-2.5 py-1 capitalize font-semibold">{form.category}</span>
                                        {form.outdoor_seating && <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-2.5 py-1 font-semibold">🌿 Outdoor</span>}
                                        {form.pet_friendly    && <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-2.5 py-1 font-semibold">🐾 Pets OK</span>}
                                    </div>
                                    {form.description && <p className="text-slate-500 text-xs line-clamp-3 pt-1">{form.description}</p>}
                                    {form.must_try && (
                                        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-3 py-2 mt-2 space-y-1">
                                            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Must try</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-400">{form.must_try}</p>
                                        </div>
                                    )}
                                    {form.insider_tip && (
                                        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl px-3 py-2 space-y-1">
                                            <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Insider tip</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-400">{form.insider_tip}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Photos section ── */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className={labelCls}>Photos</p>
                                        <p className="text-xs text-slate-400">
                                            {userPhotos.length}/{MAX_PHOTOS} uploaded · photos are compressed automatically
                                        </p>
                                    </div>
                                    {userPhotos.length < MAX_PHOTOS && (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all"
                                        >
                                            <Upload size={14} /> Add photo
                                        </button>
                                    )}
                                </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="sr-only"
                                    onChange={(e) => handlePhotoFiles(e.target.files)}
                                />

                                {/* Photo grid */}
                                {(userPhotos.length > 0 || aiPhoto) && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* AI photo (if no user photos) */}
                                        {isAiPhotoShowing && (
                                            <div className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                                <img src={aiPhoto} alt="AI suggested" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/20 flex items-end p-1.5">
                                                    <span className="text-[9px] font-bold text-white bg-black/40 backdrop-blur-sm rounded px-1.5 py-0.5">AI photo</span>
                                                </div>
                                            </div>
                                        )}
                                        {/* User photos */}
                                        {userPhotos.map((p, i) => (
                                            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
                                                <img src={p.preview} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeUserPhoto(i)}
                                                    className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                    aria-label="Remove photo"
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                                {i === 0 && (
                                                    <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/40 backdrop-blur-sm rounded px-1.5 py-0.5">Cover</span>
                                                )}
                                            </div>
                                        ))}
                                        {/* Upload more slot */}
                                        {userPhotos.length < MAX_PHOTOS && userPhotos.length > 0 && (
                                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                                className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all">
                                                <Upload size={20} />
                                                <span className="text-[10px] font-semibold">Add</span>
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Empty state */}
                                {!aiPhoto && userPhotos.length === 0 && (
                                    <button type="button" onClick={() => fileInputRef.current?.click()}
                                        className="w-full h-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all">
                                        <Upload size={22} />
                                        <span className="text-sm font-semibold">Upload photos (optional)</span>
                                        <span className="text-xs">JPG, PNG · max {MAX_PHOTOS} · auto-compressed</span>
                                    </button>
                                )}

                                {aiPhoto && userPhotos.length === 0 && (
                                    <p className="text-xs text-slate-400 text-center">
                                        Upload your own photos to replace the AI suggestion
                                    </p>
                                )}
                            </div>

                            {/* ── Confirmation ── */}
                            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <div className="relative mt-0.5 shrink-0">
                                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="sr-only" />
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${confirmed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                                        {confirmed && <CheckCircle2 size={12} className="text-white" />}
                                    </div>
                                </div>
                                <span className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    I confirm this is a real place and the information provided is accurate.
                                </span>
                            </label>

                            {submitError && (
                                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl px-4 py-3">
                                    <AlertCircle size={16} className="text-red-500 shrink-0" />
                                    <p className="text-red-600 dark:text-red-400 text-sm">{submitError}</p>
                                </div>
                            )}

                            <button onClick={handleSubmit} disabled={!confirmed || submitLoading}
                                className="w-full h-16 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-base shadow-xl hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3">
                                {submitLoading ? (
                                    <><div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {photoUploading ? 'Uploading photos…' : 'Submitting…'}</>
                                ) : (
                                    <><CheckCircle2 size={20} /> Submit for Review</>
                                )}
                            </button>
                            <p className="text-center text-xs text-slate-400">🏆 +100 points on approval · Reviewed within 48 hours</p>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div>
    )
}
