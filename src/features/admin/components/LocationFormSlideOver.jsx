import React, { useState, useCallback } from 'react'
import PlacesAutocomplete from '@/shared/components/PlacesAutocomplete'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, Building2, Sparkles, Wand2, MapPin, Phone, Globe,
    Clock, Star, DollarSign, ChevronDown, Image, Plus, Trash2,
    RefreshCw, Zap, Info, ChevronUp, AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    CATEGORIES_FULL as CATEGORIES,
    PRICE_LEVELS,
    CUISINE_OPTIONS,
    LABEL_GROUPS,
    VISIT_TIMES,
} from '@/shared/constants/taxonomy'

// ─── Field helpers ────────────────────────────────────────────────────────────
// Category/price/cuisine/label/visit taxonomies live in
// src/shared/constants/taxonomy.js — single source of truth.

// ─── Micro-components ─────────────────────────────────────────────────────────

const SectionHeader = ({ title, subtitle, icon: Icon, iconColor = 'text-indigo-500', count }) => (
    <div className="flex items-center gap-3 pb-1">
        {Icon && (
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800", iconColor.replace('text-', 'text-'))}>
                <Icon size={14} className={iconColor} />
            </div>
        )}
        <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-none flex items-center gap-2">
                {title}
                {count !== undefined && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-black">
                        {count}
                    </span>
                )}
            </h3>
            {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
    </div>
)

const Field = ({ label, required, hint, children, className }) => (
    <div className={cn("space-y-2", className)}>
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {label}
            {required && <span className="text-rose-400">*</span>}
            {hint && (
                <span className="ml-auto text-[9px] font-normal normal-case tracking-normal text-slate-400 capitalize">
                    {hint}
                </span>
            )}
        </label>
        {children}
    </div>
)

const input = "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/50 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/10 transition-all"
const textarea = cn(input, "resize-none")

// ─── Main Component ───────────────────────────────────────────────────────────

const LocationFormSlideOver = ({
    isOpen,
    onClose,
    selectedLocation,
    formData,
    setFormData,
    onSave,
    // AI props
    aiQueryMutation,
    reindexMutation,
    isImproving,
    setIsImproving,
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [newImageUrl, setNewImageUrl]  = useState('')

    const isNew = !selectedLocation?.id || selectedLocation.id === 'NEW'

    // ─── helpers ──────────────────────────────────────────────────────────────

    const set = useCallback((field, val) =>
        setFormData(prev => ({ ...prev, [field]: val })),
    [setFormData])

    const handlePlaceSelected = useCallback((place) => {
        if (!place) return
        setFormData(prev => ({
            ...prev,
            title:         place.title         || prev?.title         || '',
            category:      place.category       || prev?.category      || 'Restaurant',
            address:       place.address        || prev?.address       || '',
            city:          place.city           || prev?.city          || '',
            country:       place.country        || prev?.country       || '',
            lat:           place.lat            ?? prev?.lat           ?? null,
            lng:           place.lng            ?? prev?.lng           ?? null,
            phone:         place.phone          || prev?.phone         || '',
            website:       place.website        || prev?.website       || '',
            rating:        place.rating         ?? prev?.rating        ?? null,
            price_level:   place.price_level    || prev?.price_level   || '$$',
            opening_hours: place.opening_hours  || prev?.opening_hours || '',
            description:   place.description    || prev?.description   || '',
            google_place_id: place.google_place_id || prev?.google_place_id || null,
            google_maps_url: place.google_maps_url || prev?.google_maps_url || null,
            _source:       'google_places',
        }))
    }, [setFormData])

    if (!isOpen || !formData) return null

    const handleImproveDesc = async () => {
        const text = formData.description
        if (!text || text.length < 10) return
        setIsImproving('description')
        try {
            const prompt = `Improve this restaurant description. Keep the original language (Russian or English). Make it warm, evocative, 2-3 sentences. Text: "${text}"`
            const result = await aiQueryMutation.mutateAsync({ message: prompt })
            const improved = (typeof result === 'string' ? result : result?.text || result?.content || '')
                .replace(/^["']|["']$/g, '').trim()
            if (improved) set('description', improved)
        } catch (e) {
            console.error('Improve failed:', e)
        } finally {
            setIsImproving(null)
        }
    }

    const handleReindex = () => {
        if (isNew) return
        reindexMutation.mutate(selectedLocation.id, {
            onSuccess: (updated) => {
                setFormData(prev => ({ ...prev, ...updated }))
            }
        })
    }

    const addPhoto = () => {
        const url = newImageUrl.trim()
        if (!url) return
        setFormData(prev => ({
            ...prev,
            photos: [...(Array.isArray(prev.photos) ? prev.photos : []), url],
            image: prev.image || url,
        }))
        setNewImageUrl('')
    }

    const removePhoto = (idx) => {
        setFormData(prev => {
            const photos = (Array.isArray(prev.photos) ? prev.photos : []).filter((_, i) => i !== idx)
            return { ...prev, photos, image: prev.image === (prev.photos || [])[idx] ? (photos[0] || '') : prev.image }
        })
    }

    const toggleLabel = (label) => {
        const cur = formData.special_labels || []
        set('special_labels', cur.includes(label) ? cur.filter(l => l !== label) : [...cur, label])
    }

    const toggleTime = (id) => {
        const cur = formData.best_for || []
        set('best_for', cur.includes(id) ? cur.filter(t => t !== id) : [...cur, id])
    }

    // what_to_try helpers
    const whatToTry = Array.isArray(formData.what_to_try) ? formData.what_to_try : []
    const addDish = (dish) => {
        const val = dish.trim()
        if (!val || whatToTry.includes(val)) return
        set('what_to_try', [...whatToTry, val])
    }
    const removeDish = (i) => set('what_to_try', whatToTry.filter((_, idx) => idx !== i))

    const photos = Array.isArray(formData.photos) ? formData.photos : (formData.image ? [formData.image] : [])

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 260 }}
                className="fixed top-0 right-0 w-full sm:w-[580px] bg-white dark:bg-slate-900 h-full z-[110] flex flex-col shadow-2xl overflow-hidden"
            >
                {/* ── Header ── */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4 shrink-0 bg-white dark:bg-slate-900">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25">
                        <Building2 size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white leading-none truncate">
                            {isNew ? 'Новый объект' : (formData.title || 'Редактирование')}
                        </h2>
                        <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-semibold">
                            {isNew ? 'Создание' : `ID: ${selectedLocation.id?.slice(0, 8)}…`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-6 space-y-8">

                        {/* ── Google Places Autocomplete ── */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                <Wand2 size={11} className="text-indigo-500" />
                                Найти заведение
                                {formData._source === 'google_places' && (
                                    <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold normal-case tracking-normal">
                                        ✓ Google Places
                                    </span>
                                )}
                            </label>
                            <PlacesAutocomplete
                                onPlaceSelected={handlePlaceSelected}
                                placeholder="Название и город — напр. «Hamsa Krakow»"
                            />
                            <p className="text-[10px] text-slate-400 px-1">
                                Начните вводить — выберите из списка, поля заполнятся автоматически
                            </p>
                        </div>

                        {/* ── 3. Локация и Контакты ── */}
                        <div className="space-y-5">
                            <SectionHeader title="Локация и Контакты" icon={MapPin} iconColor="text-rose-500" />

                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Город" required>
                                    <input
                                        type="text"
                                        value={formData.city || ''}
                                        onChange={e => set('city', e.target.value)}
                                        className={input}
                                        placeholder="Krakow"
                                    />
                                </Field>
                                <Field label="Страна">
                                    <input
                                        type="text"
                                        value={formData.country || ''}
                                        onChange={e => set('country', e.target.value)}
                                        className={input}
                                        placeholder="Poland"
                                    />
                                </Field>
                            </div>

                            <Field label="Адрес">
                                <input
                                    type="text"
                                    value={formData.address || ''}
                                    onChange={e => set('address', e.target.value)}
                                    className={input}
                                    placeholder="ul. Szeroka 2"
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Широта (lat)">
                                    <input
                                        type="number" step="any"
                                        value={formData.lat || ''}
                                        onChange={e => set('lat', parseFloat(e.target.value) || null)}
                                        className={input}
                                        placeholder="50.0647"
                                    />
                                </Field>
                                <Field label="Долгота (lng)">
                                    <input
                                        type="number" step="any"
                                        value={formData.lng || ''}
                                        onChange={e => set('lng', parseFloat(e.target.value) || null)}
                                        className={input}
                                        placeholder="19.9450"
                                    />
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Сайт">
                                    <div className="relative">
                                        <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="url"
                                            value={formData.website || ''}
                                            onChange={e => set('website', e.target.value)}
                                            className={cn(input, "pl-8")}
                                            placeholder="https://..."
                                        />
                                    </div>
                                </Field>
                                <Field label="Телефон">
                                    <div className="relative">
                                        <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="tel"
                                            value={formData.phone || ''}
                                            onChange={e => set('phone', e.target.value)}
                                            className={cn(input, "pl-8")}
                                            placeholder="+48 12 …"
                                        />
                                    </div>
                                </Field>
                            </div>
                        </div>

                        {/* ── 1. Основное ── */}
                        <div className="space-y-5">
                            <SectionHeader title="Основная информация" icon={Building2} />

                            <Field label="Название" required>
                                <input
                                    type="text"
                                    value={formData.title || ''}
                                    onChange={e => set('title', e.target.value)}
                                    className={input}
                                    placeholder="Напр. Hamsa"
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Категория">
                                    <div className="relative">
                                        <select
                                            value={formData.category || 'Restaurant'}
                                            onChange={e => set('category', e.target.value)}
                                            className={cn(input, "appearance-none pr-8")}
                                        >
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </Field>
                                <Field label="Цена">
                                    <div className="relative">
                                        <select
                                            value={formData.price_level || '$$'}
                                            onChange={e => set('price_level', e.target.value)}
                                            className={cn(input, "appearance-none pr-8")}
                                        >
                                            {PRICE_LEVELS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                        </select>
                                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Кухня">
                                    <div className="relative">
                                        <select
                                            value={formData.cuisine || ''}
                                            onChange={e => set('cuisine', e.target.value)}
                                            className={cn(input, "appearance-none pr-8")}
                                        >
                                            <option value="">— выбрать —</option>
                                            {CUISINE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </Field>
                                <Field label="Рейтинг" hint="0 – 5">
                                    <div className="relative">
                                        <Star size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
                                        <input
                                            type="number" min="0" max="5" step="0.1"
                                            value={formData.rating || ''}
                                            onChange={e => set('rating', parseFloat(e.target.value) || null)}
                                            className={cn(input, "pl-8")}
                                            placeholder="4.5"
                                        />
                                    </div>
                                </Field>
                            </div>

                            <Field label="Режим работы">
                                <div className="relative">
                                    <Clock size={13} className="absolute left-3 top-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={formData.opening_hours || ''}
                                        onChange={e => set('opening_hours', e.target.value)}
                                        className={cn(input, "pl-8")}
                                        placeholder="Пн-Пт 10:00-22:00 | Сб-Вс 11:00-23:00"
                                    />
                                </div>
                            </Field>
                        </div>

                        {/* ── 2. Описание ── */}
                        <div className="space-y-5">
                            <SectionHeader title="Контент" icon={Sparkles} iconColor="text-amber-500" />

                            <Field label="Описание">
                                <div className="relative">
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={e => set('description', e.target.value)}
                                        rows={4}
                                        className={textarea}
                                        placeholder="Расскажите об атмосфере, кухне и особенностях..."
                                    />
                                    {aiQueryMutation && (
                                        <button
                                            onClick={handleImproveDesc}
                                            disabled={isImproving === 'description' || !formData.description}
                                            title="Улучшить текст с AI"
                                            className="absolute bottom-2.5 right-2.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 disabled:opacity-40 transition-all flex items-center gap-1 text-[10px] font-bold"
                                        >
                                            {isImproving === 'description'
                                                ? <><RefreshCw size={10} className="animate-spin" /> AI…</>
                                                : <><Sparkles size={10} /> Улучшить</>
                                            }
                                        </button>
                                    )}
                                </div>
                            </Field>

                            <Field label="Совет знатока (insider tip)">
                                <textarea
                                    value={formData.insider_tip || ''}
                                    onChange={e => set('insider_tip', e.target.value)}
                                    rows={2}
                                    className={textarea}
                                    placeholder="Лучший столик у окна, спросите фирменный безалкогольный коктейль…"
                                />
                            </Field>

                            {/* What to try */}
                            <Field label="Что попробовать" hint="нажмите Enter чтобы добавить">
                                <div className="space-y-2">
                                    {whatToTry.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {whatToTry.map((dish, i) => (
                                                <span
                                                    key={i}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 group"
                                                >
                                                    {dish}
                                                    <button
                                                        onClick={() => removeDish(i)}
                                                        className="text-slate-400 hover:text-rose-500 transition-colors"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        className={input}
                                        placeholder="Название блюда + Enter"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                addDish(e.target.value)
                                                e.target.value = ''
                                            }
                                        }}
                                    />
                                </div>
                            </Field>
                        </div>

                        {/* ── 4. Фото ── */}
                        <div className="space-y-4">
                            <SectionHeader
                                title="Фотографии"
                                icon={Image}
                                iconColor="text-violet-500"
                                count={photos.length}
                            />

                            {photos.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {photos.map((url, idx) => (
                                        <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                                            <img
                                                src={url} alt=""
                                                className="w-full h-full object-cover"
                                                onError={e => { e.target.style.display = 'none' }}
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => set('image', url)}
                                                    title="Сделать главным"
                                                    className={cn(
                                                        "p-1.5 rounded-lg text-white text-[9px] font-bold",
                                                        formData.image === url ? "bg-amber-500" : "bg-white/20 hover:bg-white/30"
                                                    )}
                                                >
                                                    <Star size={11} />
                                                </button>
                                                <button
                                                    onClick={() => removePhoto(idx)}
                                                    className="p-1.5 rounded-lg bg-rose-500/80 hover:bg-rose-500 text-white"
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                            {formData.image === url && (
                                                <div className="absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 bg-amber-400 text-amber-900 rounded-md uppercase">
                                                    Главное
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={newImageUrl}
                                    onChange={e => setNewImageUrl(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addPhoto()}
                                    className={cn(input, "flex-1")}
                                    placeholder="https://... (URL фото)"
                                />
                                <button
                                    onClick={addPhoto}
                                    disabled={!newImageUrl.trim()}
                                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-all flex items-center gap-1.5 text-[11px] font-bold"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>

                        {/* ── 5. Лучшее время ── */}
                        <div className="space-y-4">
                            <SectionHeader title="Лучшее время для посещения" icon={Clock} iconColor="text-sky-500" />
                            <div className="grid grid-cols-4 gap-2">
                                {VISIT_TIMES.map(t => {
                                    const active = (formData.best_for || []).includes(t.id)
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => toggleTime(t.id)}
                                            className={cn(
                                                "flex flex-col items-center gap-1.5 py-3 rounded-xl border text-center transition-all",
                                                active
                                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300 dark:hover:border-indigo-500/50"
                                            )}
                                        >
                                            <span className="text-lg leading-none">{t.emoji}</span>
                                            <span className="text-[9px] font-bold uppercase tracking-wider">{t.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* ── 6. Лейблы ── */}
                        <div className="space-y-5">
                            <SectionHeader
                                title="Лейблы и Теги"
                                count={(formData.special_labels || []).length}
                            />
                            {Object.entries(LABEL_GROUPS).map(([group, labels]) => (
                                <div key={group} className="space-y-2.5">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{group}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {labels.map(label => {
                                            const active = (formData.special_labels || []).includes(label)
                                            return (
                                                <button
                                                    key={label}
                                                    onClick={() => toggleLabel(label)}
                                                    className={cn(
                                                        "px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all",
                                                        active
                                                            ? "bg-indigo-600 text-white border-indigo-600"
                                                            : "bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300"
                                                    )}
                                                >
                                                    {label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── 7. AI Семантика (только для существующих) ── */}
                        {!isNew && (
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                                <button
                                    onClick={() => setShowAdvanced(v => !v)}
                                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Zap size={14} className="text-indigo-500" />
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">AI & Семантика</span>
                                        {formData.ai_context && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold">
                                                Indexed
                                            </span>
                                        )}
                                    </div>
                                    {showAdvanced ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                </button>

                                <AnimatePresence>
                                    {showAdvanced && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden border-t border-slate-100 dark:border-slate-800"
                                        >
                                            <div className="p-4 space-y-4">
                                                {formData.ai_context && (
                                                    <div className="space-y-1.5">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">AI Context</p>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
                                                            {formData.ai_context}
                                                        </p>
                                                    </div>
                                                )}
                                                {formData.ai_keywords?.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Ключевые слова</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {formData.ai_keywords.map((kw, i) => (
                                                                <span key={i} className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-semibold">
                                                                    {kw}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* KG data */}
                                                {(formData.kg_dishes?.length > 0 || formData.kg_cuisines?.length > 0) && (
                                                    <div className="space-y-1.5">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Knowledge Graph</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {[...(formData.kg_cuisines || []), ...(formData.kg_dishes || [])].map((kw, i) => (
                                                                <span key={i} className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-semibold">
                                                                    {kw}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={handleReindex}
                                                    disabled={reindexMutation.isPending}
                                                    className="w-full py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Zap size={13} className={reindexMutation.isPending ? 'animate-pulse' : ''} />
                                                    {reindexMutation.isPending ? 'Индексирую…' : 'Обновить AI-семантику'}
                                                </button>
                                                <p className="text-[9px] text-slate-400 text-center">
                                                    Обновит вектор, AI-контекст и ключевые слова для поиска
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* bottom padding */}
                        <div className="h-4" />
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                        >
                            Отмена
                        </button>
                        <button
                            onClick={onSave}
                            className="flex-[2] py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            <Building2 size={14} />
                            {isNew ? 'Создать объект' : 'Сохранить изменения'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </>
    )
}

export default LocationFormSlideOver
