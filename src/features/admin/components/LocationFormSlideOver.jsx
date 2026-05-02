import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import PlacesAutocomplete from '@/shared/components/PlacesAutocomplete'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, Building2, Sparkles, Wand2, MapPin, Phone, Globe,
    Clock, Star, DollarSign, ChevronDown, Image, Plus, Trash2,
    RefreshCw, Zap, Info, ChevronUp, AlertCircle, Save, Upload
} from 'lucide-react'
import { compressImage, uploadFile } from '@/shared/api/storage.api'
import { cn } from '@/lib/utils'
import LazyImage from '@/components/ui/LazyImage'
import {
    CATEGORIES_FULL as CATEGORIES,
    PRICE_LEVELS,
    getLabelEmoji,
    VISIT_TIMES,
    getLabelGroups,
    getCategoryLabel
} from '@/shared/config/filterOptions'
import { useCuisineOptions } from '@/shared/hooks/useCuisineOptions'

// ─── Field helpers ────────────────────────────────────────────────────────────
// Category/price/cuisine/label/visit taxonomies live in
// src/shared/config/filterOptions.js — single source of truth.

// ─── Micro-components ─────────────────────────────────────────────────────────

const SectionHeader = ({ title, subtitle, icon: Icon, iconColor = 'text-indigo-500', count }) => (
    <div className="flex items-center gap-3 pb-1">
        {Icon && (
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-[hsl(220,20%,9%)]", iconColor.replace('text-', 'text-'))}>
                <Icon size={14} className={iconColor} />
            </div>
        )}
        <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none flex items-center gap-2">
                {title}
                {count !== undefined && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-black">
                        {count}
                    </span>
                )}
            </h3>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
    </div>
)

const Field = ({ label, required, hint, children, className }) => (
    <div className={cn("space-y-2.5", className)}>
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-[hsl(220,10%,55%)]">
            {label}
            {required && <span className="text-rose-400">*</span>}
            {hint && (
                <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-slate-400 capitalize">
                    {hint}
                </span>
            )}
        </label>
        {children}
    </div>
)

const input = "w-full px-4 py-4 sm:py-3 bg-slate-50 dark:bg-[hsl(220,20%,9%)]/60 rounded-xl border border-slate-200/80 dark:border-white/[0.04] text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/10 transition-all"
const textarea = cn(input, "resize-none min-h-[120px]")

// ─── Main Component ───────────────────────────────────────────────────────────

const LocationFormSlideOver = ({
    isOpen,
    onClose,
    selectedLocation,
    formData,
    setFormData,
    onSave,
    onDelete,
    // AI props
    aiQueryMutation,
    reindexMutation,
    embeddingMutation,
    fullEnrichMutation,
    extractMutation,
    handleAIMagic,
    isImproving,
    setIsImproving,
}) => {
    const { t, i18n } = useTranslation()
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [newImageUrl, setNewImageUrl]  = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = React.useRef(null)

    const isNew = !selectedLocation?.id || selectedLocation.id === 'NEW'

    // Cuisine list driven by KG — falls back to filterOptions.js while loading
    const { options: cuisineOptions, isLoading: cuisinesLoading } = useCuisineOptions()

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
            google_rating: place.rating         ?? prev?.google_rating ?? null,
            rating:        prev?.rating         ?? place.rating        ?? null,
            price_range:   place.price_range    || place.price_level   || prev?.price_range   || '$$',
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

    const handleFullEnrich = () => {
        if (!selectedLocation?.id) return
        fullEnrichMutation.mutate(selectedLocation.id, {
            onSuccess: (result) => {
                const errors = [result?.semantic?.error, result?.kg?.error, result?.embedding?.error].filter(Boolean)
                if (errors.length) {
                    console.warn('[LocationForm] Full enrich partial errors:', errors)
                } else {
                    console.log('[LocationForm] Full enrich complete ✅', result)
                }
            },
        })
    }

    const _handleUpdateEmbedding = () => {
        if (!selectedLocation?.id) return
        embeddingMutation.mutate(selectedLocation.id, {
            onSuccess: () => {
                // Toast via existing toast system if available
                console.log('[LocationForm] Embedding updated ✅')
            },
        })
    }

    const _handleReindex = () => {
        if (isNew) return
        reindexMutation.mutate(selectedLocation.id, {
            onSuccess: (updated) => {
                setFormData(prev => ({ ...prev, ...updated }))
            }
        })
    }

    const addPhoto = (url) => {
        const finalUrl = typeof url === 'string' ? url.trim() : newImageUrl.trim()
        if (!finalUrl) return
        setFormData(prev => ({
            ...prev,
            photos: [...(Array.isArray(prev.photos) ? prev.photos : []), finalUrl],
            image: prev.image || finalUrl,
        }))
        if (typeof url !== 'string') setNewImageUrl('')
    }

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        setIsUploading(true)
        try {
            for (const file of files) {
                // 1. Compress
                const compressed = await compressImage(file)
                // 2. Upload to 'locations' bucket
                const publicUrl = await uploadFile(compressed, 'locations', 'admin-uploads')
                // 3. Add to photos
                addPhoto(publicUrl)
            }
        } catch (err) {
            console.error('[Upload] Error:', err)
            alert(t('admin.locations.form.actions.upload_error', { message: err.message }))
        } finally {
            setIsUploading(false)
            if (e.target) e.target.value = '' // Reset input
        }
    }

    const removePhoto = (idx) => {
        setFormData(prev => {
            const photos = (Array.isArray(prev.photos) ? prev.photos : []).filter((_, i) => i !== idx)
            return { ...prev, photos, image: prev.image === (prev.photos || [])[idx] ? (photos[0] || '') : prev.image }
        })
    }

    const toggleLabel = (labelValue) => {
        const cur = formData.special_labels || []
        set('special_labels', cur.includes(labelValue) ? cur.filter(l => l !== labelValue) : [...cur, labelValue])
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

            {/* Panel container */}
            <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-8 lg:p-12 pointer-events-none">
                <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                    className="w-full sm:max-w-[95vw] lg:aspect-video h-[100dvh] sm:h-auto sm:max-h-[95vh] bg-white dark:bg-[hsl(220,20%,3%)] pointer-events-auto flex flex-col shadow-[0_40px_80px_-15px_rgba(0,0,0,0.5)] rounded-t-[32px] sm:rounded-[40px] overflow-hidden border-t sm:border border-white/40 dark:border-white/[0.03]"
                >
                    {/* ── Drag Handle (Mobile Only) ── */}
                    <div className="sm:hidden w-12 h-1.5 bg-slate-200 dark:bg-[hsl(220,20%,9%)] rounded-full mx-auto mt-4 mb-2 shrink-0" />

                    {/* ── Header ── */}
                    <div className="px-4 sm:px-12 py-4 sm:py-8 border-b border-slate-100/50 dark:border-white/[0.03] flex items-center gap-3 sm:gap-8 shrink-0 bg-white/90 dark:bg-[hsl(220,20%,6%)]/90 backdrop-blur-2xl z-20 sticky top-0 sm:relative">
                        {/* Safe area padding for mobile notches */}
                        <div className="absolute top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-white/90 dark:bg-[hsl(220,20%,6%)]/90 pointer-events-none" />
                        
                        <div className="w-11 h-11 sm:w-20 sm:h-20 rounded-xl sm:rounded-[28px] bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/30 shrink-0 mt-[env(safe-area-inset-top)] sm:mt-0">
                            <Building2 size={18} className="sm:w-8 sm:h-8" />
                        </div>
                        <div className="flex-1 min-w-0 mt-[env(safe-area-inset-top)] sm:mt-0">
                            <div className="flex items-center flex-wrap gap-1.5 sm:gap-3">
                                <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none truncate max-w-[150px] sm:max-w-none">
                                    {formData.title || (isNew ? t('admin.locations.form.title_new') : t('admin.locations.form.title_edit'))}
                                </h2>
                                <span className={cn(
                                    "px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider",
                                    "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20"
                                )}>
                                    {isNew ? t('admin.locations.form.status_draft') : (formData.status || 'Active')}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-2 uppercase tracking-[0.2em] font-black opacity-60">
                                {isNew ? t('admin.locations.form.creation_subtitle') : t('admin.locations.form.id_label', { id: selectedLocation.id.substring(0, 12) })}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-[hsl(220,20%,9%)] text-slate-400 hover:text-slate-600 dark:hover:text-[hsl(220,20%,90%)] transition-all border border-slate-100 dark:border-white/[0.08] active:scale-90 mt-[env(safe-area-inset-top)] sm:mt-0"
                        >
                            <X size={20} className="sm:w-6 sm:h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
                        <div className="p-4 sm:p-10">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12">
                                
                                {/* ── Left Column: Core Info & Location ── */}
                                    <div className="space-y-6 sm:space-y-10">
                                        {/* Google Places Autocomplete */}
                                        <div className="bg-slate-50/50 dark:bg-[hsl(220,20%,9%)]/30 p-4 sm:p-6 rounded-2xl sm:rounded-[32px] border border-slate-100 dark:border-white/[0.03] space-y-4">
                                            <label className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">
                                                <Wand2 size={14} className="sm:w-3.5 sm:h-3.5" />
                                                {t('admin.locations.form.fields.google_autocomplete')}
                                                {formData._source === 'google_places' && (
                                                    <span className="ml-auto flex items-center gap-1 text-[8px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold">
                                                        <Zap size={8} fill="currentColor" /> {t('admin.locations.form.fields.linked')}
                                                    </span>
                                                )}
                                            </label>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <PlacesAutocomplete
                                                        onPlaceSelected={handlePlaceSelected}
                                                        placeholder={t('admin.locations.form.fields.title_placeholder')}
                                                    />
                                                </div>
                                                {handleAIMagic && (
                                                    <button
                                                        onClick={() => {
                                                            const query = prompt(t('admin.locations.form.actions.ai_extract_prompt'))
                                                            if (query) handleAIMagic(query)
                                                        }}
                                                        disabled={extractMutation?.isPending}
                                                        className="w-11 h-11 sm:w-auto sm:px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center shrink-0"
                                                        title={t('admin.locations.form.fields.ai_magic_extraction')}
                                                    >
                                                        {extractMutation?.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Основная информация */}
                                        <div className="space-y-6">
                                            <SectionHeader title={t('admin.locations.form.sections.main')} icon={Building2} iconColor="text-indigo-500" />
                                            <div className="grid grid-cols-1 gap-5 sm:gap-6">
                                                <Field label={t('admin.locations.form.fields.title')} required hint={t('admin.locations.form.fields.title_hint')}>
                                                    <input
                                                        type="text"
                                                        value={formData.title || ''}
                                                        onChange={e => set('title', e.target.value)}
                                                        className={input}
                                                        placeholder={t('admin.locations.form.fields.title_placeholder')}
                                                    />
                                                </Field>
                                                
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                                                    <Field label={t('admin.locations.form.fields.category')}>
                                                        <div className="relative group">
                                                            <select
                                                                value={CATEGORIES.find(c => c.toLowerCase() === (formData.category || '').toLowerCase()) || formData.category || 'Restaurant'}
                                                                onChange={e => set('category', e.target.value)}
                                                                className={cn(input, "appearance-none pr-10 cursor-pointer")}
                                                            >
                                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                                {!CATEGORIES.find(c => c.toLowerCase() === (formData.category || '').toLowerCase()) && formData.category && (
                                                                    <option value={formData.category}>{formData.category}</option>
                                                                )}
                                                            </select>
                                                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 pointer-events-none transition-colors" />
                                                        </div>
                                                    </Field>
                                                    <Field label={t('admin.locations.form.fields.price')}>
                                                        <div className="relative group">
                                                            <select
                                                                value={formData.price_range || '$$'}
                                                                onChange={e => set('price_range', e.target.value)}
                                                                className={cn(input, "appearance-none pr-10 cursor-pointer")}
                                                            >
                                                                {PRICE_LEVELS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                                            </select>
                                                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 pointer-events-none transition-colors" />
                                                        </div>
                                                    </Field>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                                                    <Field label={t('admin.locations.form.fields.cuisine')}>
                                                        <div className="relative group">
                                                            <select
                                                                value={formData.cuisine || ''}
                                                                onChange={e => set('cuisine', e.target.value)}
                                                                className={cn(input, "appearance-none pr-10 cursor-pointer")}
                                                                disabled={cuisinesLoading}
                                                            >
                                                                <option value="">{t('admin.locations.form.fields.select_cuisine')}</option>
                                                                {cuisineOptions.map(c => (
                                                                    <option key={c.id} value={c.name}>
                                                                        {c.emoji} {c.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 pointer-events-none transition-colors" />
                                                        </div>
                                                    </Field>
                                                    <Field label={t('admin.locations.form.fields.rating_internal')} hint={t('admin.locations.form.fields.rating_internal_hint')}>
                                                        <div className="relative group">
                                                            <Star size={14} className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", formData.rating ? "text-indigo-500" : "text-slate-400")} />
                                                            <input
                                                                type="number" min="0" max="5" step="0.1"
                                                                value={formData.rating || ''}
                                                                onChange={e => set('rating', parseFloat(e.target.value) || null)}
                                                                className={cn(input, "pl-11 border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/10")}
                                                                placeholder="4.5"
                                                            />
                                                        </div>
                                                    </Field>
                                                    <Field label={t('admin.locations.form.fields.rating_google')} hint={t('admin.locations.form.fields.rating_google_hint')}>
                                                        <div className="relative opacity-80">
                                                            <Star size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" />
                                                            <input
                                                                type="number" min="0" max="5" step="0.1"
                                                                value={formData.google_rating || ''}
                                                                onChange={e => set('google_rating', parseFloat(e.target.value) || null)}
                                                                className={cn(input, "pl-11 bg-slate-100/50 dark:bg-[hsl(220,20%,9%)]/20")}
                                                                placeholder="4.8"
                                                            />
                                                        </div>
                                                    </Field>
                                                </div>

                                            <Field label={t('admin.locations.form.fields.working_hours')}>
                                                <div className="relative">
                                                    <Clock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        value={formData.opening_hours || ''}
                                                        onChange={e => set('opening_hours', e.target.value)}
                                                        className={cn(input, "pl-11")}
                                                        placeholder={t('admin.locations.form.fields.working_hours_placeholder')}
                                                    />
                                                </div>
                                            </Field>
                                        </div>
                                    </div>

                                    {/* Локация и Контакты */}
                                    <div className="space-y-6">
                                        <SectionHeader title={t('admin.locations.form.sections.geo')} icon={MapPin} iconColor="text-rose-500" />
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                                            <Field label={t('admin.locations.form.fields.city')} required>
                                                <input
                                                    type="text"
                                                    value={formData.city || ''}
                                                    onChange={e => set('city', e.target.value)}
                                                    className={input}
                                                    placeholder="Krakow"
                                                />
                                            </Field>
                                            <Field label={t('admin.locations.form.fields.country')}>
                                                <input
                                                    type="text"
                                                    value={formData.country || ''}
                                                    onChange={e => set('country', e.target.value)}
                                                    className={input}
                                                    placeholder="Poland"
                                                />
                                            </Field>
                                        </div>

                                        <Field label={t('admin.locations.form.fields.address')}>
                                            <input
                                                type="text"
                                                value={formData.address || ''}
                                                onChange={e => set('address', e.target.value)}
                                                className={input}
                                                placeholder="ul. Szeroka 2, 31-053"
                                            />
                                        </Field>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 p-4 sm:p-5 bg-slate-50 dark:bg-[hsl(220,20%,9%)]/30 rounded-2xl sm:rounded-[24px] border border-slate-100 dark:border-white/[0.03]">
                                            <Field label={t('admin.locations.form.fields.lat')}>
                                                <input
                                                    type="number" step="any"
                                                    value={formData.lat || ''}
                                                    onChange={e => set('lat', parseFloat(e.target.value) || null)}
                                                    className={cn(input, "bg-white dark:bg-[hsl(220,20%,6%)]/50")}
                                                    placeholder="50.0647"
                                                />
                                            </Field>
                                            <Field label={t('admin.locations.form.fields.lng')}>
                                                <input
                                                    type="number" step="any"
                                                    value={formData.lng || ''}
                                                    onChange={e => set('lng', parseFloat(e.target.value) || null)}
                                                    className={cn(input, "bg-white dark:bg-[hsl(220,20%,6%)]/50")}
                                                    placeholder="19.9450"
                                                />
                                            </Field>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                                            <Field label={t('admin.locations.form.fields.website')}>
                                                <div className="relative group">
                                                    <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                    <input
                                                        type="url"
                                                        value={formData.website || ''}
                                                        onChange={e => set('website', e.target.value)}
                                                        className={cn(input, "pl-11")}
                                                        placeholder="https://..."
                                                    />
                                                </div>
                                            </Field>
                                            <Field label={t('admin.locations.form.fields.phone')}>
                                                <div className="relative group">
                                                    <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                                    <input
                                                        type="tel"
                                                        value={formData.phone || ''}
                                                        onChange={e => set('phone', e.target.value)}
                                                        className={cn(input, "pl-11")}
                                                        placeholder="+48 123 456 789"
                                                    />
                                                </div>
                                            </Field>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Right Column: Content, Media & AI ── */}
                                <div className="space-y-10">
                                    
                                    {/* Описание и Контент */}
                                    <div className="space-y-6">
                                        <SectionHeader title={t('admin.locations.form.sections.content')} icon={Sparkles} iconColor="text-amber-500" />
                                        
                                        <Field label={t('admin.locations.form.fields.description')}>
                                            <div className="relative group">
                                                <textarea
                                                    value={formData.description || ''}
                                                    onChange={e => set('description', e.target.value)}
                                                    rows={5}
                                                    className={cn(textarea, "pt-4")}
                                                    placeholder={t('admin.locations.form.fields.description_placeholder')}
                                                />
                                                <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed italic">
                                                    {t('admin.locations.form.fields.description_tip')}
                                                </p>
                                                {aiQueryMutation && (
                                                    <button
                                                        onClick={handleImproveDesc}
                                                        disabled={isImproving === 'description' || !formData.description}
                                                        className="absolute bottom-4 right-4 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 text-[11px] font-bold"
                                                    >
                                                        {isImproving === 'description'
                                                            ? <><RefreshCw size={12} className="animate-spin" /> {t('admin.locations.form.actions.improving')}</>
                                                            : <><Sparkles size={12} /> {t('admin.locations.form.actions.improve_ai')}</>
                                                        }
                                                    </button>
                                                )}
                                            </div>
                                        </Field>

                                        <Field label={t('admin.locations.form.fields.insider_tip')}>
                                            <textarea
                                                value={formData.insider_tip || ''}
                                                onChange={e => set('insider_tip', e.target.value)}
                                                rows={2}
                                                className={textarea}
                                                placeholder={t('admin.locations.form.fields.insider_tip_placeholder')}
                                            />
                                        </Field>

                                        <Field label={t('admin.locations.form.fields.menu_hits')} hint={t('admin.locations.form.fields.menu_hits_hint')}>
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-slate-50 dark:bg-[hsl(220,20%,9%)]/30 rounded-2xl border border-slate-100 dark:border-white/[0.03]">
                                                    {whatToTry.length === 0 && <span className="text-[11px] text-slate-400 italic">{t('admin.locations.form.fields.empty_list')}</span>}
                                                    {whatToTry.map((dish, i) => (
                                                        <motion.span
                                                            initial={{ scale: 0.8, opacity: 0 }}
                                                            animate={{ scale: 1, opacity: 1 }}
                                                            key={i}
                                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[hsl(220,20%,9%)] shadow-sm text-[11px] font-bold text-slate-700 dark:text-[hsl(220,20%,90%)] border border-slate-100 dark:border-white/[0.08] group"
                                                        >
                                                            {dish}
                                                            <button onClick={() => removeDish(i)} className="text-slate-400 hover:text-rose-500 transition-colors">
                                                                <X size={12} />
                                                            </button>
                                                        </motion.span>
                                                    ))}
                                                </div>
                                                <input
                                                    type="text"
                                                    className={input}
                                                    placeholder={t('admin.locations.form.fields.menu_hits_placeholder')}
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

                                    {/* Фотографии */}
                                        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-[hsl(220,20%,9%)]/30 rounded-[24px] sm:rounded-[32px] border border-slate-100 dark:border-white/[0.03] space-y-6">
                                            {photos.length > 0 ? (
                                                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-3">
                                                    {photos.map((url, idx) => (
                                                        <div key={idx} className="relative group aspect-square rounded-xl sm:rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-[hsl(220,20%,6%)] border border-slate-200 dark:border-white/[0.08]">
                                                            <LazyImage src={url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 sm:group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => set('image', url)}
                                                                    className={cn(
                                                                        "p-2 rounded-xl text-white transition-all",
                                                                        formData.image === url ? "bg-amber-500 shadow-lg shadow-amber-500/40" : "bg-white/20 hover:bg-white/40"
                                                                    )}
                                                                >
                                                                    <Star size={14} fill={formData.image === url ? "currentColor" : "none"} />
                                                                </button>
                                                                <button
                                                                    onClick={() => removePhoto(idx)}
                                                                    className="p-2 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                            {formData.image === url && (
                                                                <div className="absolute top-2 left-2 px-2 py-1 bg-amber-400 text-[8px] font-black text-amber-900 rounded-lg uppercase tracking-wider shadow-sm">
                                                                    {t('admin.locations.form.cover_badge')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-6 text-slate-400 space-y-2">
                                                    <Image size={24} strokeWidth={1} />
                                                    <p className="text-[10px] font-medium">{t('admin.locations.form.fields.no_photos')}</p>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {/* File Upload Card */}
                                                <div 
                                                    onClick={() => !isUploading && fileInputRef.current?.click()}
                                                    className={cn(
                                                        "group relative flex flex-col items-center justify-center py-5 px-4 border-2 border-dashed rounded-2xl sm:rounded-[32px] transition-all cursor-pointer",
                                                        isUploading 
                                                            ? "bg-slate-50 dark:bg-[hsl(220,20%,6%)]/50 border-slate-200 dark:border-white/[0.06] cursor-wait"
                                                            : "bg-white dark:bg-[hsl(220,20%,6%)]/40 border-slate-200 dark:border-white/[0.08] hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5"
                                                    )}
                                                >
                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        onChange={handleFileUpload}
                                                        accept="image/*"
                                                        multiple
                                                        className="hidden"
                                                    />
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                                                        isUploading 
                                                            ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                                            : "bg-slate-100 dark:bg-[hsl(220,20%,9%)] text-slate-500 group-hover:bg-indigo-500 group-hover:text-white group-hover:scale-110 group-hover:rotate-6 shadow-sm"
                                                    )}>
                                                        {isUploading ? (
                                                            <RefreshCw size={24} className="animate-spin" />
                                                        ) : (
                                                            <Upload size={24} />
                                                        )}
                                                    </div>
                                                    <div className="mt-4 text-center">
                                                        <span className="block text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-[hsl(220,20%,90%)]">
                                                            {isUploading ? t('admin.locations.form.fields.uploading') : t('admin.locations.form.fields.upload_photo')}
                                                        </span>
                                                        <p className="mt-1 text-[9px] text-slate-400 font-medium">
                                                            {t('admin.locations.form.fields.upload_hint')}
                                                        </p>
                                                    </div>
                                                    
                                                    {isUploading && (
                                                        <motion.div 
                                                            initial={{ width: 0 }}
                                                            animate={{ width: '100%' }}
                                                            className="absolute bottom-0 left-0 h-1 bg-indigo-500 rounded-b-full"
                                                        />
                                                    )}
                                                </div>

                                                {/* URL Input Area */}
                                                <div className="flex flex-col gap-3 justify-center">
                                                    <div className="relative group">
                                                        <input
                                                            type="url"
                                                            value={newImageUrl}
                                                            onChange={e => setNewImageUrl(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && addPhoto()}
                                                            className={cn(input, "bg-white dark:bg-[hsl(220,20%,6%)] shadow-sm pr-14")}
                                                            placeholder={t('admin.locations.form.fields.photo_url_placeholder')}
                                                        />
                                                        <button
                                                            onClick={addPhoto}
                                                            disabled={!newImageUrl.trim() || isUploading}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 disabled:opacity-40 transition-all"
                                                        >
                                                            <Plus size={20} />
                                                        </button>
                                                    </div>
                                                    <div className="px-1 flex items-start gap-2">
                                                        <Info size={12} className="text-slate-400 mt-0.5 shrink-0" />
                                                        <p className="text-[9px] text-slate-400 leading-tight">
                                                            {t('admin.locations.form.fields.photo_url_hint')}
                                                        </p>
                                                    </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Лучшее время и Лейблы */}
                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <SectionHeader title={t('admin.locations.form.sections.timing')} icon={Clock} iconColor="text-sky-500" />
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                {VISIT_TIMES.map(t => {
                                                    const active = (formData.best_for || []).includes(t.id)
                                                    return (
                                                        <button
                                                            key={t.id}
                                                            onClick={() => toggleTime(t.id)}
                                                            className={cn(
                                                                "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all active:scale-95",
                                                                active
                                                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                                                                    : "bg-white dark:bg-[hsl(220,20%,9%)]/50 border-slate-100 dark:border-white/[0.06] text-slate-400 hover:border-indigo-200 dark:hover:border-indigo-500/30"
                                                            )}
                                                        >
                                                            <span className="text-xl sm:text-2xl">{t.emoji}</span>
                                                            <span className="text-[10px] font-black uppercase tracking-tighter text-center px-1">{t.label}</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <SectionHeader 
                                                title={t('admin.locations.form.sections.tags')} 
                                                count={(formData.special_labels || []).length}
                                                subtitle={t('admin.locations.form.fields.tags_subtitle')}
                                            />
                                            <div className="space-y-6">
                                                {getLabelGroups(i18n.language).map(({ group, items }) => {
                                                    if (items.length === 0) return null
                                                    return (
                                                        <div key={group} className="space-y-3">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">{group}</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {items.map(item => {
                                                                    const active = (formData.special_labels || []).includes(item.value)
                                                                    const emoji = getLabelEmoji(item.value)
                                                                    const isHiddenGem = item.value === 'Hidden Gem'
                                                                    
                                                                    return (
                                                                        <button
                                                                            key={item.value}
                                                                            onClick={() => toggleLabel(item.value)}
                                                                            title={isHiddenGem ? t('labels.hidden_gem_desc') : undefined}
                                                                            className={cn(
                                                                                "px-4 py-2 rounded-xl text-[11px] font-bold border-2 transition-all flex items-center gap-2",
                                                                                active
                                                                                    ? "bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/20"
                                                                                    : "bg-slate-50 dark:bg-[hsl(220,20%,9%)]/40 text-slate-500 dark:text-[hsl(220,10%,55%)] border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                                                            )}
                                                                        >
                                                                            {emoji && <span>{emoji}</span>}
                                                                            {item.label}
                                                                        </button>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* AI & Semantics */}
                                    <div className="bg-slate-50 dark:bg-[hsl(220,20%,6%)]/40 rounded-[32px] border border-slate-100 dark:border-white/[0.03] overflow-hidden transition-all shadow-sm">
                                        <button
                                            onClick={() => setShowAdvanced(v => !v)}
                                            className="w-full flex items-center justify-between px-6 py-5 text-slate-900 dark:text-white group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center transition-colors group-hover:bg-indigo-200 dark:group-hover:bg-indigo-500/30">
                                                    <Zap size={16} className="text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div className="text-left">
                                                    <span className="text-[12px] font-black uppercase tracking-widest block">{t('admin.locations.form.ai.intelligence_title')}</span>
                                                    <p className="text-[9px] text-slate-400 font-medium italic">{t('admin.locations.form.ai.intelligence_subtitle')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {!isNew && !showAdvanced && (
                                                    <span className="text-[9px] font-bold text-indigo-500 animate-pulse hidden sm:inline">{t('admin.locations.form.actions.update_available')}</span>
                                                )}
                                                <ChevronDown size={18} className={cn("text-slate-400 transition-transform duration-300", showAdvanced && "rotate-180")} />
                                            </div>
                                        </button>

                                        <AnimatePresence>
                                            {showAdvanced && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-6 pb-6 space-y-6">
                                                        <div className="h-px bg-slate-200/50 dark:bg-white/5" />
                                                        
                                                        {formData.ai_context ? (
                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                                    <p className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">{t('admin.locations.form.ai.context_title')}</p>
                                                                </div>
                                                                <div className="bg-white dark:bg-[hsl(220,20%,3%)]/40 p-4 rounded-2xl border border-slate-100 dark:border-white/[0.03]">
                                                                    <p className="text-[12px] text-slate-600 dark:text-[hsl(220,10%,55%)] leading-relaxed italic">
                                                                        "{formData.ai_context}"
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="py-4 text-center space-y-2">
                                                                <Info size={16} className="mx-auto text-slate-300 dark:text-[hsl(220,10%,35%)]" />
                                                                <p className="text-[11px] text-slate-400 italic">{t('admin.locations.form.ai.no_context')}</p>
                                                            </div>
                                                        )}

                                                        <div className="grid grid-cols-1 gap-4">
                                                            {!isNew ? (
                                                                <div className="space-y-3">
                                                                    <button
                                                                        onClick={handleFullEnrich}
                                                                        disabled={fullEnrichMutation?.isPending}
                                                                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-[12px] font-black shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-60"
                                                                    >
                                                                        <Sparkles size={16} className={fullEnrichMutation?.isPending ? 'animate-spin' : ''} />
                                                                        {fullEnrichMutation?.isPending
                                                                            ? t('admin.locations.form.actions.enriching')
                                                                            : t('admin.locations.form.actions.full_enrich')}
                                                                    </button>
                                                                    <p className="text-[9px] text-slate-400 text-center px-4">
                                                                        {t('admin.locations.form.actions.full_enrich_hint')}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <div className="py-2 text-center bg-indigo-50/50 dark:bg-indigo-500/5 rounded-2xl border border-indigo-100/50 dark:border-indigo-500/10">
                                                                    <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold px-4 py-2">
                                                                        {t('admin.locations.form.actions.enrich_available')}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="px-4 sm:px-12 py-5 sm:py-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] border-t border-slate-100 dark:border-white/[0.06] bg-white/95 dark:bg-[hsl(220,20%,3%)]/95 backdrop-blur-2xl shrink-0 sticky bottom-0 z-30">
                        <div className="flex flex-col gap-3 max-w-5xl mx-auto">
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                                <button
                                    onClick={onSave}
                                    className="order-1 sm:order-2 w-full sm:flex-[2] py-4 sm:py-5 rounded-2xl sm:rounded-[24px] bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-500 hover:to-blue-600 text-white text-xs sm:text-[13px] font-black shadow-2xl shadow-indigo-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
                                >
                                    <Save size={20} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
                                    <span>{isNew ? t('admin.locations.form.actions.create') : t('admin.locations.form.actions.save')}</span>
                                </button>
                                <button
                                    onClick={onClose}
                                    className="order-2 sm:order-1 w-full sm:flex-1 py-4 sm:py-5 rounded-2xl sm:rounded-[24px] border-2 border-slate-100 dark:border-white/[0.06] text-slate-500 dark:text-[hsl(220,10%,55%)] text-xs sm:text-[13px] font-black hover:bg-slate-50 dark:hover:bg-[hsl(220,20%,12%)] transition-all uppercase tracking-widest active:scale-[0.98]"
                                >
                                    {t('admin.locations.form.actions.cancel')}
                                </button>
                            </div>
                            {!isNew && onDelete && (
                                <button
                                    onClick={() => {
                                        onDelete(selectedLocation?.id)
                                        onClose()
                                    }}
                                    className="w-full py-4 rounded-2xl sm:rounded-[24px] border-2 border-rose-200 dark:border-rose-900/50 text-rose-500 dark:text-rose-400 text-xs sm:text-[13px] font-black hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all uppercase tracking-widest active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={16} strokeWidth={2.5} />
                                    <span>{t('admin.locations.form.actions.delete_location')}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </>
    )
}

export default LocationFormSlideOver
