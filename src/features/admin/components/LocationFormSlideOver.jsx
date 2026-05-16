import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import PlacesAutocomplete from '@/shared/components/PlacesAutocomplete'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, Building2, Sparkles, Wand2, MapPin, Phone, Globe,
       Clock, Star, DollarSign, ChevronDown, Image, Plus, Trash2,
       RefreshCw, Zap, Info, ChevronUp, AlertCircle, Save, Upload,
       Instagram, Facebook, Calendar, Crosshair
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { compressImage, uploadFile } from '@/shared/api/storage.api'
import { cn } from '@/lib/utils'
import LazyImage from '@/components/ui/LazyImage'
import {
    CATEGORIES_FULL as CATEGORIES,
    PRICE_LEVELS,
    getLabelEmoji,
    VISIT_TIMES,
    getLabelGroups,
} from '@/shared/config/filterOptions'
import { useCuisineOptions } from '@/shared/hooks/useCuisineOptions'

// ─── Field helpers ────────────────────────────────────────────────────────────
// Category/price/cuisine/label/visit taxonomies live in
// src/shared/config/filterOptions.js — single source of truth.

// ─── Micro-components ─────────────────────────────────────────────────────────

const SectionHeader = ({ title, icon: Icon, iconColor, count, subtitle }) => (
    <div className="flex items-center gap-4 pb-5 border-b border-slate-100 dark:border-white/[0.04] mb-8">
        {Icon && (
            <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center",
                "bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06]",
                iconColor
            )}>
                <Icon size={20} className="shrink-0" strokeWidth={1.5} />
            </div>
        )}
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
                <h3 className="text-base font-medium text-slate-900 dark:text-white tracking-tight">
                    {title}
                </h3>
                {count !== undefined && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 font-medium tabular-nums">
                        {count}
                    </span>
                )}
            </div>
            {subtitle && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-light leading-relaxed">
                    {subtitle}
                </p>
            )}
        </div>
    </div>
)

const Field = ({ label, required, hint, children, className }) => (
    <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between px-0.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
                {required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {hint && (
                <span className="text-[10px] font-light text-slate-400 italic">
                    {hint}
                </span>
            )}
        </div>
        <div className="relative">
            {children}
        </div>
    </div>
)

const input = "w-full px-4 py-3 bg-slate-50/50 dark:bg-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.05] focus:bg-white dark:focus:bg-white/[0.06] rounded-xl border border-slate-200 dark:border-white/[0.08] text-sm font-normal text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-indigo-300 dark:focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/10 transition-all"
const textarea = cn(input, "resize-none min-h-[120px] pt-4 leading-relaxed")

// ─── Draggable Map Marker for coordinate editing ─────────────────────────────
// Admin-only: shows the location on a mini-map with a draggable marker.
// Dragging the marker updates formData.lat / formData.lng in real time.

// Fix Leaflet default icon paths for the draggable marker
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
})

function DraggableMarker({ position, onDragEnd }) {
    const markerRef = useRef(null)
    return (
        <Marker
            draggable
            position={position}
            ref={markerRef}
            eventHandlers={{
                dragend() {
                    const marker = markerRef.current
                    if (marker) {
                        const { lat, lng } = marker.getLatLng()
                        onDragEnd({ lat: +lat.toFixed(7), lng: +lng.toFixed(7) })
                    }
                },
            }}
        />
    )
}

/** Re-center the map when formData.lat/lng change from inputs */
function RecenterMap({ lat, lng }) {
    const map = useMap()
    const prevRef = useRef({ lat, lng })
    useEffect(() => {
        if (lat && lng) {
            const prev = prevRef.current
            // Only re-center if coordinates changed by more than ~1m
            if (!prev.lat || !prev.lng ||
                Math.abs(lat - prev.lat) > 0.00001 ||
                Math.abs(lng - prev.lng) > 0.00001) {
                prevRef.current = { lat, lng }
                map.setView([lat, lng], map.getZoom(), { animate: true })
            }
        }
    }, [lat, lng, map])
    return null
}

/** Click-to-place handler: tap on map to move the marker */
function ClickToPlace({ onMapClick }) {
    const map = useMap()
    useEffect(() => {
        const handler = (e) => {
            const { lat, lng } = e.latlng
            onMapClick({ lat: +lat.toFixed(7), lng: +lng.toFixed(7) })
        }
        map.on('click', handler)
        return () => map.off('click', handler)
    }, [map, onMapClick])
    return null
}

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
    setToast,
}) => {
    const { t, i18n } = useTranslation()
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [newImageUrl, setNewImageUrl]  = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [googlePhotosMetadata, setGooglePhotosMetadata] = useState([])
    const [, setIsFetchingPhotos] = useState(false)
    const fileInputRef = React.useRef(null)

    const isNew = !selectedLocation?.id || selectedLocation.id === 'NEW'

    // Cuisine list driven by KG — falls back to filterOptions.js while loading
    const { options: cuisineOptions, isLoading: cuisinesLoading } = useCuisineOptions()

    // ─── helpers ──────────────────────────────────────────────────────────────

    const set = useCallback((field, val) =>
        setFormData(prev => ({ ...prev, [field]: val })),
    [setFormData])

    // Sanitized setter for text inputs — strips HTML tags and event handlers
    const safeSet = useCallback((field, value) => {
        if (typeof value === 'string') {
            value = value.replace(/<[^>]*>?/gm, '').replace(/on\w+\s*=/gi, '')
        }
        set(field, value)
    }, [set])

    const handlePlaceSelected = useCallback(async (place) => {
        if (!place) return
        
        // Start updating basic info
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

        // Fetch metadata for all available photos so user can pick
        if (place.google_place_id) {
            try {
                setIsFetchingPhotos(true)
                const { fetchGooglePhotos } = await import('@/shared/api/google-places.api')
                const metadata = await fetchGooglePhotos(place.google_place_id)
                setGooglePhotosMetadata(metadata || [])
                
                // Automatically ingest ONLY the first photo to use as cover/default
                // This gives the admin immediate visual feedback but leaves slots 2 and 3 open
                if (metadata && metadata.length > 0) {
                    setIsUploading(true)
                    const { ingestGooglePhoto } = await import('@/shared/api/google-places.api')
                    const firstPhoto = metadata[0]
                    
                    if (firstPhoto.photo_reference) {
                        const stableUrl = await ingestGooglePhoto(place.google_place_id, firstPhoto.photo_reference)
                        if (stableUrl) {
                            setFormData(prev => {
                                // Only add if not already present
                                const existing = Array.isArray(prev.photos) ? prev.photos : []
                                if (existing.includes(stableUrl)) return prev
                                
                                return {
                                    ...prev,
                                    photos: [stableUrl, ...existing].slice(0, 3),
                                    image: prev.image || stableUrl
                                }
                            })
                        }
                    }
                }
            } catch (err) {
                console.error('[AdminForm] Failed to handle Google photos:', err)
            } finally {
                setIsFetchingPhotos(false)
                setIsUploading(false)
            }
        }
    }, [setFormData])

    // eslint-disable-next-line no-unused-vars
    const handleLoadGooglePhotos = async () => {
        if (!formData.google_place_id) return
        try {
            setIsFetchingPhotos(true)
            const { fetchGooglePhotos } = await import('@/shared/api/google-places.api')
            const metadata = await fetchGooglePhotos(formData.google_place_id)
            setGooglePhotosMetadata(metadata || [])
        } catch (err) {
            console.error('[AdminForm] Failed to fetch Google photos:', err)
        } finally {
            setIsFetchingPhotos(false)
        }
    }

    const handleIngestSpecificPhoto = async (photoMetadata) => {
        if (!formData.google_place_id || !photoMetadata.photo_reference) return
        
        // Check limit
        const currentCount = Array.isArray(formData.photos) ? formData.photos.length : 0
        if (currentCount >= 3) {
            setToast?.({ message: t('admin.locations.form.errors.max_photos', { count: 3 }), type: 'error' })
            return
        }

        try {
            setIsUploading(true)
            const { ingestGooglePhoto } = await import('@/shared/api/google-places.api')
            const stableUrl = await ingestGooglePhoto(formData.google_place_id, photoMetadata.photo_reference)
            
            if (stableUrl) {
                addPhoto(stableUrl)
                setToast?.({ message: t('admin.locations.form.actions.photo_ingested_success'), type: 'success' })
            }
        } catch (err) {
            console.error('[AdminForm] Specific ingestion failed:', err)
            setToast?.({ message: t('admin.locations.form.actions.upload_error', { message: err.message }), type: 'error' })
        } finally {
            setIsUploading(false)
        }
    }

    if (!isOpen || !formData) return null

    const handleFullEnrich = () => {
        if (!selectedLocation?.id) return
        fullEnrichMutation.mutate(selectedLocation.id, {
            onSuccess: (result) => {
                const errors = [result?.semantic?.error, result?.kg?.error, result?.embedding?.error].filter(Boolean)
                if (errors.length) {
                    console.warn('[LocationForm] Full enrich partial errors:', errors)
                    setToast?.({ type: 'error', message: `Enrichment partial: ${errors[0]}` })
                } else {
                    console.log('[LocationForm] Full enrich complete ✅', result)
                    setToast?.({ type: 'success', message: 'Full AI Enrichment complete ✅' })
                    // Auto-refresh form data with enriched fields
                    const enriched = result?.semantic
                    if (enriched && typeof enriched === 'object' && !enriched.error) {
                        setFormData(prev => ({
                            ...prev,
                            ...(enriched.ai_context && { ai_context: enriched.ai_context }),
                            ...(enriched.ai_keywords && { ai_keywords: enriched.ai_keywords }),
                        }))
                    }
                }
            },
            onError: (err) => {
                console.error('[LocationForm] Full enrich failed:', err)
                setToast?.({ type: 'error', message: `Enrichment failed: ${err.message}` })
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

    const addPhoto = (url, atStart = false) => {
        const finalUrl = typeof url === 'string' ? url.trim() : newImageUrl.trim()
        if (!finalUrl) return
        
        setFormData(prev => {
            const currentPhotos = Array.isArray(prev.photos) ? prev.photos : []
            if (currentPhotos.length >= 3) {
                setToast?.({ message: t('admin.locations.form.errors.max_photos', { count: 3 }), type: 'error' })
                return prev
            }
            
            // Priority logic: uploaded photos (atStart=true) go to index 0
            const newPhotos = atStart ? [finalUrl, ...currentPhotos] : [...currentPhotos, finalUrl]
            
            return {
                ...prev,
                photos: newPhotos,
                // If it's a priority upload, automatically set as cover if no cover exists or if explicitly requested
                image: atStart ? finalUrl : (prev.image || finalUrl),
            }
        })
        if (typeof url !== 'string') setNewImageUrl('')
    }

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        setIsUploading(true)
        try {
            for (const file of files) {
                const currentCount = Array.isArray(formData.photos) ? formData.photos.length : 0
                if (currentCount >= 3) {
                    setToast?.({ message: t('admin.locations.form.errors.max_photos', { count: 3 }), type: 'error' })
                    break
                }

                const compressed = await compressImage(file)
                const publicUrl = await uploadFile(compressed, 'locations', 'admin-uploads', { skipCompression: true })
                
                // Uploaded files are prioritized (added to start)
                addPhoto(publicUrl, true)
            }
        } catch (err) {
            console.error('[Upload] Error:', err)
            setToast?.({ message: t('admin.locations.form.actions.upload_error', { message: err.message }), type: 'error' })
        } finally {
            setIsUploading(false)
            if (e.target) e.target.value = '' // Reset input
        }
    }

    const removePhoto = (idx) => {
        // The rendered photos array combines image_url + formData.photos
        // We need to figure out which actual field to update
        const gallery = Array.isArray(formData.photos) ? formData.photos.filter(Boolean) : []
        const mainImage = formData.image_url || formData.image || ''
        const combined = mainImage && !gallery.includes(mainImage) ? [mainImage, ...gallery] : (gallery.length > 0 ? gallery : (mainImage ? [mainImage] : []))
        
        const urlToRemove = combined[idx]
        if (!urlToRemove) return

        setFormData(prev => {
            const newPhotos = (Array.isArray(prev.photos) ? prev.photos : []).filter(p => p !== urlToRemove)
            const newImageUrl = (prev.image_url === urlToRemove || prev.image === urlToRemove) ? (newPhotos[0] || '') : (prev.image_url || prev.image || '')
            return { 
                ...prev, 
                photos: newPhotos, 
                image_url: newImageUrl,
                image: newImageUrl,
                google_photos: newPhotos,
            }
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

    // Photos: combine image_url (main) + google_photos (gallery). 
    // If google_photos is empty but image_url exists, show image_url as the only photo.
    const photos = (() => {
        const gallery = Array.isArray(formData.photos) ? formData.photos.filter(Boolean) : []
        const mainImage = formData.image_url || formData.image || ''
        if (gallery.length > 0) {
            // If main image is not in gallery, prepend it
            return mainImage && !gallery.includes(mainImage) ? [mainImage, ...gallery] : gallery
        }
        return mainImage ? [mainImage] : []
    })()

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md"
            />

            {/* Panel container — fullscreen */}
            <div className="fixed inset-0 z-[110] pointer-events-none">
                <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 35, stiffness: 250 }}
                    className="absolute inset-0 bg-background backdrop-blur-2xl pointer-events-auto flex flex-col overflow-hidden"
                >
                    {/* ── Drag Handle (Mobile Only) ── */}
                    <div className="sm:hidden w-12 h-1 bg-secondary/80 rounded-pill mx-auto mt-4 mb-2 shrink-0" />

                    {/* ── Header ── */}
                    <div className="px-4 sm:px-8 py-3 sm:py-4 border-b border-white/[0.03] flex items-center gap-3 sm:gap-6 shrink-0 bg-background/40 backdrop-blur-xl z-20 sticky top-0 sm:relative">
                        {/* Safe area padding for mobile notches */}
                        <div className="absolute top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-background/10 pointer-events-none" />
                        
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shrink-0 mt-[env(safe-area-inset-top)] sm:mt-0">
                            <Building2 size={20} className="sm:w-6 sm:h-6 opacity-90" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0 mt-[env(safe-area-inset-top)] sm:mt-0">
                            <div className="flex items-center flex-wrap gap-2 sm:gap-3">
                                <h2 className="text-base font-medium text-slate-900 dark:text-white tracking-tight truncate max-w-[220px] sm:max-w-none">
                                    {formData.title || (isNew ? t('admin.locations.form.title_new') : t('admin.locations.form.title_edit'))}
                                </h2>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider",
                                    "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20"
                                )}>
                                    {isNew ? t('admin.locations.form.status_draft') : (formData.status || 'Active')}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-light">
                                {isNew ? t('admin.locations.form.creation_subtitle') : t('admin.locations.form.id_label', { id: selectedLocation.id.substring(0, 12) })}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-secondary/20 text-t-secondary hover:text-t-primary hover:bg-secondary/40 transition-all border border-white/[0.05] active:scale-90 mt-[env(safe-area-inset-top)] sm:mt-0"
                        >
                            <X size={18} className="sm:w-5 sm:h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
                        <div className="p-4 sm:p-10">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12">
                                
                                {/* ── Left Column: Core Info & Location ── */}
                                    <div className="space-y-6 sm:space-y-10">
                                        {/* Google Places Autocomplete */}
                                        <div className="bg-primary/[0.03] dark:bg-primary/[0.05] p-4 sm:p-6 rounded-sheet border border-primary/10 space-y-4 shadow-sm relative overflow-hidden group/magic transition-all hover:bg-primary/[0.05] dark:hover:bg-primary/[0.08]">
                                            <div className="absolute -top-12 -right-12 p-8 opacity-[0.03] pointer-events-none transition-all duration-1000 group-hover/magic:opacity-[0.08] group-hover/magic:scale-125 group-hover/magic:-rotate-12">
                                                <Zap size={160} fill="currentColor" className="text-primary" />
                                            </div>
                                            <label className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-primary relative z-10">
                                                <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                                                    <Wand2 size={14} />
                                                </div>
                                                {t('admin.locations.form.fields.google_autocomplete')}
                                                {formData._source === 'google_places' && (
                                                    <span className="ml-auto flex items-center gap-2 text-[9px] px-3.5 py-1.5 rounded-pill bg-primary text-primary-foreground font-black tracking-[0.15em] shadow-lg shadow-primary/20 animate-in fade-in zoom-in duration-500">
                                                        {t('admin.locations.form.fields.linked')}
                                                    </span>
                                                )}
                                            </label>
                                            <div className="flex gap-3 relative z-10">
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
                                                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40 transition-all shadow-md shadow-primary/20 flex items-center justify-center shrink-0 active:scale-95"
                                                        title={t('admin.locations.form.fields.ai_magic_extraction')}
                                                    >
                                                        {extractMutation?.isPending ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Основная информация */}
                                        <div className="space-y-6">
                                            <SectionHeader title={t('admin.locations.form.sections.main')} icon={Building2} iconColor="text-primary" />
                                            <div className="grid grid-cols-1 gap-5 sm:gap-6">
                                                <Field label={t('admin.locations.form.fields.title')} required hint={t('admin.locations.form.fields.title_hint')}>
                                                    <input
                                                        type="text"
                                                        value={formData.title || ''}
                                                        onChange={e => safeSet('title', e.target.value)}
                                                        className={input}
                                                        placeholder={t('admin.locations.form.fields.title_placeholder')}
                                                    />
                                                </Field>
                                                
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                                                    <Field label={t('admin.locations.form.fields.category')}>
                                                        <div className="relative group/select">
                                                            <select
                                                                value={CATEGORIES.find(c => c.toLowerCase() === (formData.category || '').toLowerCase()) || formData.category || 'Restaurant'}
                                                                onChange={e => set('category', e.target.value)}
                                                                className={cn(input, "appearance-none pr-12 cursor-pointer transition-colors focus:border-primary")}
                                                            >
                                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                                                {!CATEGORIES.find(c => c.toLowerCase() === (formData.category || '').toLowerCase()) && formData.category && (
                                                                    <option value={formData.category}>{formData.category}</option>
                                                                )}
                                                            </select>
                                                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-t-tertiary group-hover/select:text-primary pointer-events-none transition-all duration-300 group-hover/select:translate-y-[-40%]" />
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
                                                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-t-quaternary group-hover:text-primary pointer-events-none transition-colors" />
                                                        </div>
                                                    </Field>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                                                    <Field label={t('admin.locations.form.fields.cuisine')}>
                                                        <div className="relative group">
                                                            <select
                                                                value={formData.cuisine || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        cuisine: val,
                                                                        cuisine_types: val ? [val] : []
                                                                    }))
                                                                }}
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
                                                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-t-quaternary group-hover:text-primary pointer-events-none transition-colors" />
                                                        </div>
                                                    </Field>
                                                    <Field label={t('admin.locations.form.fields.rating_internal')} hint={t('admin.locations.form.fields.rating_internal_hint')}>
                                                        <div className="relative group">
                                                            <Star size={14} className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", formData.rating ? "text-primary" : "text-t-tertiary")} />
                                                            <input
                                                                type="number" min="0" max="5" step="0.1"
                                                                value={formData.rating || ''}
                                                                onChange={e => set('rating', parseFloat(e.target.value) || null)}
                                                                className={cn(input, "pl-11 border-primary/40 bg-primary/10 shadow-inner")}
                                                                placeholder="4.5"
                                                            />
                                                        </div>
                                                    </Field>
                                                    <Field label={t('admin.locations.form.fields.rating_google')} hint={t('admin.locations.form.fields.rating_google_hint')}>
                                                        <div className="relative group opacity-90">
                                                            <Star size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
                                                            <input
                                                                type="number" min="0" max="5" step="0.1"
                                                                value={formData.google_rating || ''}
                                                                onChange={e => set('google_rating', parseFloat(e.target.value) || null)}
                                                                className={cn(input, "pl-11 bg-secondary")}
                                                                placeholder="4.8"
                                                            />
                                                        </div>
                                                    </Field>
                                                </div>

                                            <Field label={t('admin.locations.form.fields.working_hours')}>
                                                <div className="relative">
                                                    <Clock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-t-tertiary" />
                                                    <input
                                                        type="text"
                                                        value={formData.opening_hours || ''}
                                                        onChange={e => safeSet('opening_hours', e.target.value)}
                                                        className={cn(input, "pl-11")}
                                                        placeholder={t('admin.locations.form.fields.working_hours_placeholder')}
                                                    />
                                                </div>
                                            </Field>
                                        </div>
                                    </div>

                                    {/* Локация и Контакты */}
                                    <div className="space-y-6">
                                        <SectionHeader title={t('admin.locations.form.sections.geo')} icon={MapPin} iconColor="text-primary" />
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                                            <Field label={t('admin.locations.form.fields.city')} required>
                                                <input
                                                    type="text"
                                                    value={formData.city || ''}
                                                    onChange={e => safeSet('city', e.target.value)}
                                                    className={input}
                                                    placeholder="Krakow"
                                                />
                                            </Field>
                                            <Field label={t('admin.locations.form.fields.country')}>
                                                <input
                                                    type="text"
                                                    value={formData.country || ''}
                                                    onChange={e => safeSet('country', e.target.value)}
                                                    className={input}
                                                    placeholder="Poland"
                                                />
                                            </Field>
                                        </div>

                                        <Field label={t('admin.locations.form.fields.address')}>
                                            <input
                                                type="text"
                                                value={formData.address || ''}
                                                onChange={e => safeSet('address', e.target.value)}
                                                className={input}
                                                placeholder="ul. Szeroka 2, 31-053"
                                            />
                                        </Field>

                                        <div className="space-y-3">
                                            {/* Coordinate inputs */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field label={t('admin.locations.form.fields.lat')}>
                                                    <div className="relative group">
                                                        <Crosshair size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-t-tertiary group-focus-within:text-primary transition-colors" />
                                                        <input
                                                            type="number" step="any"
                                                            value={formData.lat || ''}
                                                            onChange={e => set('lat', parseFloat(e.target.value) || null)}
                                                            className={cn(input, "pl-9 bg-secondary/30 font-mono text-[11px] h-10")}
                                                            placeholder="50.0647"
                                                        />
                                                    </div>
                                                </Field>
                                                <Field label={t('admin.locations.form.fields.lng')}>
                                                    <div className="relative group">
                                                        <Crosshair size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-t-tertiary group-focus-within:text-primary transition-colors" />
                                                        <input
                                                            type="number" step="any"
                                                            value={formData.lng || ''}
                                                            onChange={e => set('lng', parseFloat(e.target.value) || null)}
                                                            className={cn(input, "pl-9 bg-secondary/30 font-mono text-[11px] h-10")}
                                                            placeholder="19.9450"
                                                        />
                                                    </div>
                                                </Field>
                                            </div>

                                            {/* Draggable mini-map */}
                                            <div className="relative rounded-card overflow-hidden border border-border shadow-sm">
                                                {formData.lat && formData.lng ? (
                                                    <MapContainer
                                                        center={[formData.lat, formData.lng]}
                                                        zoom={16}
                                                        scrollWheelZoom
                                                        zoomControl={false}
                                                        attributionControl={false}
                                                        style={{ height: '220px', width: '100%' }}
                                                        className="touch-manipulation"
                                                    >
                                                        <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
                                                        <DraggableMarker
                                                            position={[formData.lat, formData.lng]}
                                                            onDragEnd={({ lat, lng }) => {
                                                                setFormData(prev => ({ ...prev, lat, lng }))
                                                            }}
                                                        />
                                                        <ClickToPlace
                                                            onMapClick={({ lat, lng }) => {
                                                                setFormData(prev => ({ ...prev, lat, lng }))
                                                            }}
                                                        />
                                                        <RecenterMap lat={formData.lat} lng={formData.lng} />
                                                    </MapContainer>
                                                ) : (
                                                    <div className="h-[220px] flex flex-col items-center justify-center gap-2 bg-secondary/30 text-t-tertiary">
                                                        <MapPin size={28} strokeWidth={1.5} />
                                                        <p className="text-xs font-medium">{t('admin.locations.form.fields.no_coords_hint', 'Enter coordinates or use Google Places to set the pin')}</p>
                                                    </div>
                                                )}
                                                {/* Drag/click hint overlay */}
                                                {formData.lat && formData.lng && (
                                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-background/95 backdrop-blur-md border border-border/80 rounded-pill text-[10px] font-bold uppercase tracking-widest text-t-primary pointer-events-none shadow-2xl flex items-center gap-2.5">
                                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                                        {t('admin.locations.form.fields.map_hint', 'Drag or tap to place')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                                            <Field label={t('admin.locations.form.fields.website')}>
                                                <div className="relative group">
                                                    <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-t-tertiary group-focus-within:text-primary transition-colors" />
                                                    <input
                                                        type="url"
                                                        value={formData.website || ''}
                                                        onChange={e => safeSet('website', e.target.value)}
                                                        className={cn(input, "pl-11")}
                                                        placeholder="https://..."
                                                    />
                                                </div>
                                            </Field>
                                            <Field label={t('admin.locations.form.fields.phone')}>
                                                <div className="relative group">
                                                    <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-t-tertiary group-focus-within:text-primary transition-colors" />
                                                    <input
                                                        type="tel"
                                                        value={formData.phone || ''}
                                                        onChange={e => safeSet('phone', e.target.value)}
                                                        className={cn(input, "pl-11")}
                                                        placeholder="+48 123 456 789"
                                                    />
                                                </div>
                                            </Field>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 pt-2">
                                            <Field label={t('admin.locations.form.fields.social_instagram')}>
                                                <div className="relative group">
                                                    <Instagram size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-t-tertiary group-focus-within:text-primary transition-colors" />
                                                    <input
                                                        type="text"
                                                        value={formData.social_instagram || ''}
                                                        onChange={e => safeSet('social_instagram', e.target.value)}
                                                        className={cn(input, "pl-11")}
                                                        placeholder="https://instagram.com/..."
                                                    />
                                                </div>
                                            </Field>
                                            <Field label={t('admin.locations.form.fields.social_facebook')}>
                                                <div className="relative group">
                                                    <Facebook size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-t-tertiary group-focus-within:text-primary transition-colors" />
                                                    <input
                                                        type="text"
                                                        value={formData.social_facebook || ''}
                                                        onChange={e => safeSet('social_facebook', e.target.value)}
                                                        className={cn(input, "pl-11")}
                                                        placeholder="https://facebook.com/..."
                                                    />
                                                </div>
                                            </Field>
                                        </div>

                                        <div className="pt-2">
                                            <Field label={t('admin.locations.form.fields.booking_url')}>
                                                <div className="relative group">
                                                    <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-t-tertiary group-focus-within:text-primary transition-colors" />
                                                    <input
                                                        type="text"
                                                        value={formData.booking_url || ''}
                                                        onChange={e => set('booking_url', e.target.value)}
                                                        className={cn(input, "pl-11")}
                                                        placeholder="https://booking-site.com/..."
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
                                                    onChange={e => safeSet('description', e.target.value)}
                                                    rows={6}
                                                    className={cn(textarea, "pt-5 pb-16")}
                                                    placeholder={t('admin.locations.form.fields.description_placeholder')}
                                                />
                                                <div className="flex items-center gap-2 mt-2.5 px-1.5">
                                                    <div className="w-1 h-1 rounded-full bg-primary/40" />
                                                    <p className="text-micro text-t-tertiary leading-relaxed font-medium">
                                                        {t('admin.locations.form.fields.description_tip')}
                                                    </p>
                                                </div>
                                            </div>
                                        </Field>

                                        <Field label={t('admin.locations.form.fields.insider_tip')}>
                                            <textarea
                                                value={formData.insider_tip || ''}
                                                onChange={e => safeSet('insider_tip', e.target.value)}
                                                rows={2}
                                                className={textarea}
                                                placeholder={t('admin.locations.form.fields.insider_tip_placeholder')}
                                            />
                                        </Field>

                                        <Field label={t('admin.locations.form.fields.menu_hits')} hint={t('admin.locations.form.fields.menu_hits_hint')}>
                                            <div className="space-y-4">
                                                <div className="flex flex-wrap gap-2.5 min-h-[50px] p-4 bg-secondary/30 rounded-card border border-border/60">
                                                    {whatToTry.length === 0 && <span className="text-micro text-t-tertiary font-medium px-1 opacity-60">{t('admin.locations.form.fields.empty_list')}</span>}
                                                    {whatToTry.map((dish, i) => (
                                                        <motion.span
                                                            initial={{ scale: 0.9, opacity: 0 }}
                                                            animate={{ scale: 1, opacity: 1 }}
                                                            key={i}
                                                            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-pill bg-background shadow-sm text-micro font-bold text-t-secondary border border-border/80 group hover:border-primary/50 transition-all hover:shadow-md"
                                                        >
                                                            {dish}
                                                            <button onClick={() => removeDish(i)} className="text-t-tertiary hover:text-destructive transition-colors p-0.5">
                                                                <X size={14} />
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
                                        <div className="p-4 sm:p-6 bg-secondary rounded-sheet border border-border space-y-6">
                                            {photos.length > 0 ? (
                                                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-4">
                                                    {photos.map((url, idx) => {
                                                        const isGoogle = url.includes('googleusercontent.com') || url.includes('google')
                                                        const isUploaded = url.includes('supabase.co') || url.includes('admin-uploads')
                                                        
                                                        return (
                                                            <div key={idx} className="relative group aspect-square rounded-card overflow-hidden shadow-sm bg-background border border-border/80 transition-all hover:shadow-md hover:border-primary/30">
                                                                <LazyImage src={url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                                
                                                                {/* Source Badges */}
                                                                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                                                                    {isGoogle && (
                                                                        <div className="px-1.5 py-0.5 bg-blue-500/90 backdrop-blur-md text-white text-[7px] font-black uppercase tracking-tighter rounded-sm shadow-sm">
                                                                            Google
                                                                        </div>
                                                                    )}
                                                                    {isUploaded && (
                                                                        <div className="px-1.5 py-0.5 bg-emerald-500/90 backdrop-blur-md text-white text-[7px] font-black uppercase tracking-tighter rounded-sm shadow-sm">
                                                                            Upload
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="absolute inset-0 bg-black/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                                                                    <button
                                                                        onClick={() => set('image', url)}
                                                                        className={cn(
                                                                            "p-2.5 rounded-card text-white transition-all",
                                                                            formData.image === url ? "bg-primary shadow-xl shadow-primary/40" : "bg-white/20 hover:bg-white/40"
                                                                        )}
                                                                        title={t('admin.locations.form.cover_badge')}
                                                                    >
                                                                        <Star size={16} fill={formData.image === url ? "currentColor" : "none"} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => removePhoto(idx)}
                                                                        className="p-2.5 rounded-card bg-destructive/80 hover:bg-destructive text-white shadow-xl shadow-destructive/20 transition-all"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                                {formData.image === url && (
                                                                    <div className="absolute top-2 left-2 px-2.5 py-1 bg-primary text-[9px] font-bold text-white rounded-pill uppercase tracking-widest shadow-md z-10">
                                                                        {t('admin.locations.form.cover_badge')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-12 text-t-tertiary space-y-4 bg-background/40 rounded-card border border-dashed border-border/60">
                                                    <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                                                        <Image size={32} strokeWidth={1} className="opacity-40" />
                                                    </div>
                                                    <p className="text-micro font-bold uppercase tracking-[0.2em]">{t('admin.locations.form.fields.no_photos')}</p>
                                                </div>
                                            )}
                                            {/* Google Photos Selection Gallery */}
                                            {googlePhotosMetadata.length > 0 && (
                                                <div className="space-y-4 pt-4 border-t border-border/40 pb-2">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-micro font-black uppercase tracking-[0.2em] text-t-secondary flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                            {t('admin.locations.form.fields.available_google_photos')}
                                                        </h4>
                                                        <span className="text-[9px] font-bold text-t-tertiary bg-secondary px-2 py-0.5 rounded-sm">
                                                            {googlePhotosMetadata.length} {t('admin.locations.form.fields.total')}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex gap-3 overflow-x-auto pb-4 pt-1 scrollbar-hide -mx-1 px-1">
                                                        {googlePhotosMetadata.map((photo, idx) => {
                                                            const safeRef = (photo.photo_reference || '').substring(0, 20).replace(/[^a-zA-Z0-9]/g, '')
                                                            const isAlreadyAdded = photos.some(p => p.includes(safeRef))
                                                            
                                                            return (
                                                                <div 
                                                                    key={idx} 
                                                                    onClick={() => !isAlreadyAdded && !isUploading && handleIngestSpecificPhoto(photo)}
                                                                    className={cn(
                                                                        "relative min-w-[120px] max-w-[120px] aspect-square rounded-card overflow-hidden border-2 transition-all cursor-pointer group/gp",
                                                                        isAlreadyAdded 
                                                                            ? "border-emerald-500/50 opacity-60 grayscale-[0.5]" 
                                                                            : "border-transparent hover:border-primary hover:shadow-lg hover:-translate-y-0.5"
                                                                    )}
                                                                >
                                                                    <LazyImage 
                                                                        src={photo.url} 
                                                                        alt="" 
                                                                        className="w-full h-full object-cover" 
                                                                    />
                                                                    
                                                                    {isUploading && (
                                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                                            <RefreshCw size={16} className="text-white animate-spin" />
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {isAlreadyAdded && (
                                                                        <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                                                                            <div className="bg-emerald-500 text-white p-1 rounded-full shadow-lg">
                                                                                <Star size={12} fill="currentColor" />
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/gp:opacity-100 transition-opacity flex items-end p-2">
                                                                        <span className="text-[8px] font-bold text-white uppercase tracking-tighter">
                                                                            {isAlreadyAdded ? t('admin.locations.form.fields.already_added') : t('admin.locations.form.fields.add_to_gallery')}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/20">
                                                {/* File Upload Card */}
                                                <div 
                                                    onClick={() => !isUploading && fileInputRef.current?.click()}
                                                    className={cn(
                                                        "group relative flex flex-col items-center justify-center py-5 px-4 border-2 border-dashed rounded-sheet transition-all cursor-pointer",
                                                        isUploading 
                                                            ? "bg-secondary border-border cursor-wait"
                                                            : "bg-background border-border hover:border-primary hover:bg-primary/5"
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
                                                        "w-14 h-14 rounded-card flex items-center justify-center transition-all duration-500",
                                                        isUploading 
                                                            ? "bg-primary/20 text-primary"
                                                            : "bg-secondary/80 text-t-tertiary group-hover:bg-primary group-hover:text-white group-hover:scale-110 group-hover:rotate-6 shadow-sm border border-border/40"
                                                    )}>
                                                        {isUploading ? (
                                                            <RefreshCw size={28} className="animate-spin" />
                                                        ) : (
                                                            <Upload size={28} strokeWidth={1.5} />
                                                        )}
                                                    </div>
                                                    <div className="mt-5 text-center">
                                                        <span className="block text-micro font-bold uppercase tracking-[0.2em] text-t-primary">
                                                            {isUploading ? t('admin.locations.form.fields.uploading') : t('admin.locations.form.fields.upload_photo')}
                                                        </span>
                                                        <p className="mt-1.5 text-micro text-t-tertiary font-medium opacity-80">
                                                            {t('admin.locations.form.fields.upload_hint')}
                                                        </p>
                                                    </div>
                                                    
                                                    {isUploading && (
                                                        <motion.div 
                                                            initial={{ width: 0 }}
                                                            animate={{ width: '100%' }}
                                                            className="absolute bottom-0 left-0 h-1 bg-primary rounded-b-full"
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
                                                            className={cn(input, "bg-background shadow-sm pr-14")}
                                                            placeholder={t('admin.locations.form.fields.photo_url_placeholder')}
                                                        />
                                                        <button
                                                            onClick={addPhoto}
                                                            disabled={!newImageUrl.trim() || isUploading}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-card bg-primary text-white shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-40 transition-all"
                                                        >
                                                            <Plus size={20} />
                                                        </button>
                                                    </div>
                                                    <div className="px-1 flex items-start gap-2">
                                                        <Info size={12} className="text-t-tertiary mt-0.5 shrink-0" />
                                                        <p className="text-micro text-t-tertiary leading-tight">
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
                                                                "flex flex-col items-center gap-3 py-5 rounded-card border-2 transition-all active:scale-95",
                                                                active
                                                                    ? "bg-primary border-primary text-primary-foreground shadow-2xl shadow-primary/30 scale-[1.02]"
                                                                    : "bg-secondary/40 border-transparent text-t-secondary hover:border-border/60 hover:bg-secondary/60 shadow-sm"
                                                            )}
                                                        >
                                                            <span className="text-3xl filter drop-shadow-sm">{t.emoji}</span>
                                                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-center px-1 opacity-90">{t.label}</span>
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
                                                        <div key={group} className="space-y-2">
                                                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 ml-1">{group}</p>
                                                            <div className="flex flex-wrap gap-1.5">
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
                                                                                "px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all flex items-center gap-1.5 active:scale-95",
                                                                                active
                                                                                    ? isHiddenGem 
                                                                                        ? "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20"
                                                                                        : "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20"
                                                                                    : "bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]"
                                                                            )}
                                                                        >
                                                                            {emoji && <span className={cn("text-xs", isHiddenGem && active && "animate-bounce")}>{emoji}</span>}
                                                                            {isHiddenGem ? t('labels.hidden_gem') : item.label}
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
                                    <div className="bg-background rounded-sheet border border-border/80 overflow-hidden transition-all shadow-sm group">
                                        <button
                                            onClick={() => setShowAdvanced(v => !v)}
                                            className="w-full flex items-center justify-between px-6 py-8 text-t-primary hover:bg-secondary/30 transition-all"
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className={cn(
                                                    "w-14 h-14 rounded-card flex items-center justify-center transition-all duration-500 shadow-lg",
                                                    showAdvanced ? "bg-primary text-primary-foreground shadow-primary/40 rotate-12 scale-110" : "bg-secondary text-primary shadow-black/5"
                                                )}>
                                                    <Zap size={24} fill={showAdvanced ? "currentColor" : "none"} strokeWidth={2} />
                                                </div>
                                                <div className="text-left">
                                                    <span className="text-micro font-bold uppercase tracking-[0.25em] text-primary">{t('admin.locations.form.ai.intelligence_title')}</span>
                                                    <p className="text-micro text-t-tertiary font-medium mt-1 opacity-80">{t('admin.locations.form.ai.intelligence_subtitle')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-5">
                                                {!isNew && !showAdvanced && (
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary animate-pulse hidden sm:inline bg-primary/10 px-3 py-1 rounded-pill">
                                                        {t('admin.locations.form.actions.update_available')}
                                                    </span>
                                                )}
                                                <div className={cn(
                                                    "w-10 h-10 rounded-pill border border-border flex items-center justify-center transition-all duration-500",
                                                    showAdvanced ? "bg-primary text-primary-foreground border-primary rotate-180" : "bg-background text-t-tertiary"
                                                )}>
                                                    <ChevronDown size={20} />
                                                </div>
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
                                                    <div className="px-6 pb-8 space-y-8 border-t border-border/40 pt-8">
                                                        {formData.ai_context ? (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-2.5 px-1">
                                                                    <Sparkles size={14} className="text-primary" />
                                                                    <p className="text-micro font-bold uppercase text-t-secondary tracking-widest">{t('admin.locations.form.ai.context_title')}</p>
                                                                </div>
                                                                <div className="bg-secondary/40 p-6 rounded-card border border-border/80 relative overflow-hidden group/context">
                                                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/30" />
                                                                    <p className="text-body-sm text-t-secondary leading-relaxed font-medium">
                                                                        {formData.ai_context}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="py-8 text-center space-y-3 bg-secondary/20 rounded-card border border-dashed border-border/60">
                                                                <Info size={20} className="mx-auto text-t-tertiary opacity-40" />
                                                                <p className="text-micro text-t-tertiary font-medium uppercase tracking-widest">{t('admin.locations.form.ai.no_context')}</p>
                                                            </div>
                                                        )}
                                                        
                                                        <div className="grid grid-cols-1 gap-4 pt-2">
                                                            {!isNew ? (
                                                                <div className="space-y-4">
                                                                    <button
                                                                        onClick={handleFullEnrich}
                                                                        disabled={fullEnrichMutation?.isPending}
                                                                        className="w-full py-5 rounded-card bg-primary hover:brightness-110 text-primary-foreground text-micro font-bold shadow-2xl shadow-primary/40 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-60 uppercase tracking-[0.2em]"
                                                                    >
                                                                        <Sparkles size={20} className={fullEnrichMutation?.isPending ? 'animate-spin' : ''} />
                                                                        {fullEnrichMutation?.isPending
                                                                            ? t('admin.locations.form.actions.enriching')
                                                                            : t('admin.locations.form.actions.full_enrich')}
                                                                    </button>
                                                                    <div className="px-6 flex items-start gap-3">
                                                                        <Info size={14} className="text-primary mt-0.5 shrink-0" />
                                                                        <p className="text-micro text-t-tertiary leading-relaxed font-medium">
                                                                            {t('admin.locations.form.actions.full_enrich_hint')}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="py-5 text-center bg-primary/5 rounded-card border border-primary/20 border-dashed">
                                                                    <p className="text-micro text-primary font-black uppercase tracking-widest px-4 py-1">
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
                <div className="px-4 sm:px-8 py-3 sm:py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border/80 bg-background/80 backdrop-blur-2xl shrink-0 sticky bottom-0 z-30 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.15)]">
                    <div className="flex items-center gap-3 max-w-5xl mx-auto">
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all active:scale-[0.98]"
                        >
                            {t('admin.locations.form.actions.cancel')}
                        </button>
                        {!isNew && onDelete && (
                            <button
                                onClick={() => {
                                    onDelete(selectedLocation?.id)
                                    // Don't call onClose() here — the delete handler in useAdminLocations
                                    // will close the panel via setIsSlideOverOpen(false) on success
                                }}
                                className="px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-500 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-500/5 transition-all active:scale-[0.98] flex items-center gap-1.5"
                            >
                                <Trash2 size={14} />
                                <span>{t('admin.locations.form.actions.delete_location')}</span>
                            </button>
                        )}
                        <button
                            onClick={onSave}
                            className="ml-auto px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-md shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center gap-2"
                        >
                            <Save size={14} />
                            <span>{isNew ? t('admin.locations.form.actions.create') : t('admin.locations.form.actions.save')}</span>
                        </button>
                    </div>
                </div>
                </motion.div>
            </div>
        </>
    )
}

export default LocationFormSlideOver
