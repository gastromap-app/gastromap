import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Star, RotateCcw, Sunrise, Sun, Sunset, Sparkles, ArrowUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useGeoStore } from '@/shared/store/useGeoStore'
import { useLocationFilters } from '@/shared/filters/useLocationFilters'
import { useLocations } from '@/shared/api/queries/location.queries'
import { 
    ESTABLISHMENT_TYPES, 
    ESTABLISHMENT_TYPE_NAMES,
    getCategoryLabel,
    getLabelGroups,
    getLabelTranslation,
    getLabelEmoji,
    BEST_TIMES
} from '@/shared/config/filterOptions'
import { useCuisineOptions } from '@/shared/hooks/useCuisineOptions'


// Non-cuisine static labels that stay in the "Cuisine & Menu" group
const CUISINE_MENU_LABELS = [
    'Signature Cuisine', 'Fusion Cuisine', 'Vegan Options', 'Tasty Desserts', 'All Day Brunch'
]

// Sort options available in the filter modal (mirrors LocationsPage SORT_VALUES)
const SORT_OPTIONS = [
    { value: 'google_rating', labelKey: 'explore.top_rated' },
    { value: 'trending',      labelKey: 'explore.trending' },
    { value: 'recommended',   labelKey: 'explore.recommended' },
    { value: 'newest',        labelKey: 'explore.newest' },
    { value: 'price_asc',     labelKey: 'explore.price_asc' },
    { value: 'price_desc',    labelKey: 'explore.price_desc' },
    { value: 'name',          labelKey: 'explore.a_to_z' },
]


const FilterModal = ({ isOpen, onClose, theme }) => {
    const { t, i18n } = useTranslation()
    const isDark = theme === 'dark'

    // Cuisine list from KG (falls back to static filterOptions while loading)
    const { options: cuisineOptions } = useCuisineOptions() // eslint-disable-line no-unused-vars

    // URL-driven filter state — single source of truth for the modal's
    // applied filters (Phase 2 — task 2.5 expanded scope). The modal still
    // keeps its own transient `selected*` local state so the user can dial
    // in a filter set before clicking Apply; only `handleApply` writes the
    // result back to the URL via `setFilters`.
    const { filters, setFilters, resetFilters } = useLocationFilters()

    // ── Local filter state ──────────────────────────────────────────────────
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [selectedRating, setSelectedRating] = useState(null)       // null | 4 | 4.5
    const [selectedPriceLevels, setSelectedPriceLevels] = useState([]) // e.g. ['$', '$$']
    const [selectedFeatures, setSelectedFeatures] = useState([])
    const [selectedSortBy, setSelectedSortBy] = useState('google_rating')
    const [radius, setRadius] = useState(0)
    const [selectedBestTime, setSelectedBestTime] = useState(null)
    const [geoError, setGeoError] = useState(null)
    const [geoGranted, setGeoGranted] = useState(false)

    // Request geolocation when radius filter is activated
    const handleRadiusChange = useCallback((newRadius) => {
        const { setUserLocation } = useGeoStore.getState()
        if (newRadius > 0 && !geoGranted) {
            if (!navigator.geolocation) {
                setGeoError(t('filter.geo_unsupported'))
                return
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => { 
                    setGeoGranted(true)
                    setGeoError(null)
                    setRadius(newRadius)
                    setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                },
                () => { setGeoError(t('filter.geo_denied')); setRadius(0) },
                { timeout: 5000 }
            )
        } else {
            setRadius(newRadius)
            if (newRadius === 0) setGeoError(null)
        }
    }, [geoGranted, t])

    // Sync local state with the URL-driven filters when the modal opens.
    // `activeBestTime` is NOT part of the canonical `LocationFilters` URL
    // surface (design Section 3.2 lists 11 fields, best-time is not among
    // them) — it stays as transient modal-only state and does not survive
    // a page reload. This matches the pre-migration UX, where best-time
    // was never persisted to the URL either.
    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedCategory(filters.categories.length > 0 ? filters.categories[0] : 'all')
            setSelectedRating(filters.minRating)
            setSelectedPriceLevels(filters.priceLevels)
            setSelectedFeatures(filters.vibes)
            setSelectedSortBy(filters.sortBy || 'google_rating')
            setSelectedBestTime(null)
            setRadius(filters.radius || 0)
        }
    }, [isOpen, filters])

// Normalize string for comparison: lowercase + remove accents
function normalizeForCompare(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

    // ── Dynamic cuisines from KG data ─────────────────────────────────────────
    // Automatically reflects any new cuisine added via KG enrichment.
    // Filters out establishment types (e.g. 'Cafe', 'Bar') that may have been
    // incorrectly stored in cuisine fields — those belong in `category` only.
    const { data: locationsResult = [] } = useLocations()
    const locations = Array.isArray(locationsResult) ? locationsResult : (locationsResult?.data ?? [])
    const dynamicCuisines = useMemo(() => {
        const cuisineSet = new Set()
        locations.forEach(loc => {
            // KG cuisines (primary source — auto-updated)
            if (Array.isArray(loc.kg_cuisines)) {
                loc.kg_cuisines.forEach(c => {
                    if (c && !ESTABLISHMENT_TYPE_NAMES.has(normalizeForCompare(c))) {
                        cuisineSet.add(c)
                    }
                })
            }
            // Fallback: cuisine string field — also filter out establishment types
            if (loc.cuisine && !ESTABLISHMENT_TYPE_NAMES.has(normalizeForCompare(loc.cuisine))) {
                cuisineSet.add(loc.cuisine)
            }
        })
        return [...cuisineSet].sort()
    }, [locations])

    const activeCount = [
        selectedCategory !== 'all',
        selectedRating != null,
        selectedPriceLevels.length > 0,
        selectedFeatures.length > 0,
        selectedSortBy !== 'google_rating',
        selectedBestTime != null,
        radius > 0,
    ].filter(Boolean).length

    const togglePriceLevel = (level) => {
        setSelectedPriceLevels(prev =>
            prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
        )
    }

    const toggleFeature = (feature) => {
        setSelectedFeatures(prev =>
            prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
        )
    }

    const handleApply = () => {
        // Write the modal's pending filter selection out to the URL via
        // `useLocationFilters().setFilters()`. `activeBestTime` is local-
        // only (not URL-tracked); it's cleared on the next modal open.
        setFilters({
            categories: selectedCategory === 'all' ? [] : [selectedCategory],
            minRating: selectedRating,
            priceLevels: selectedPriceLevels,
            vibes: selectedFeatures,
            sortBy: selectedSortBy,
            radius,
        })
        onClose()
    }

    const handleReset = () => {
        setSelectedCategory('all')
        setSelectedRating(null)
        setSelectedPriceLevels([])
        setSelectedFeatures([])
        setSelectedSortBy('google_rating')
        setSelectedBestTime(null)
        setRadius(0)
        resetFilters()
        onClose()
    }

    const modalVariants = {
        hidden:  { y: '100%', opacity: 1, scale: 1 },
        visible: { y: 0, opacity: 1, scale: 1, transition: { type: 'spring', damping: 25, stiffness: 200 } },
        desktopHidden:  { opacity: 0, scale: 0.95, y: 0 },
        desktopVisible: { opacity: 1, scale: 1,    y: 0, transition: { duration: 0.2 } },
    }

    // ── Shared button styles ───────────────────────────────────────────────
    const chipBase = `px-4 py-2.5 min-h-11 flex items-center rounded-xl font-bold text-[11px] border transition-all cursor-pointer`
    const chipActive = `bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20`
    const chipInactive = isDark
        ? `bg-white/5 border-white/5 text-white/70 hover:bg-white/10`
        : `bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200`

    const blockBase = `p-2 rounded-[16px] border transition-all duration-300 group cursor-pointer flex items-center gap-3`
    const blockActive = `bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20`
    const blockInactive = isDark
        ? `bg-white/[0.05] border-white/10 text-white/80 hover:bg-white/[0.1] hover:border-white/20`
        : `bg-white border-gray-100 text-gray-900 shadow-sm hover:shadow-lg hover:border-blue-500/30`

    if (typeof document === 'undefined') return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center pointer-events-auto">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Container */}
                    <motion.div
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        className={`relative w-full md:max-w-2xl overflow-hidden shadow-2xl border transition-colors duration-300
                            ${isDark ? 'bg-[hsl(220,20%,6%)] border-white/[0.06] text-[hsl(220,20%,96%)]' : 'bg-white border-gray-200 text-gray-900'}
                            rounded-t-sheet md:rounded-sheet`}
                        style={{ maxHeight: '90vh' }}
                    >
                        {/* Header */}
                        <div className={`p-6 flex justify-between items-center border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                            <div>
                                <h2 className="text-[20px] font-bold">{t('filter.title')}</h2>
                                {activeCount > 0 && (
                                    <p className="text-[11px] text-blue-500 font-bold mt-0.5">{t('filter.active_count', { count: activeCount, defaultValue: `${activeCount} active` })}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {activeCount > 0 && (
                                    <button
                                        onClick={handleReset}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${isDark ? 'bg-white/[0.04] text-[hsl(220,10%,55%)] hover:text-[hsl(220,20%,96%)]' : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 hover:text-gray-900'}`}
                                    >
                                        <RotateCcw size={12} />
                                        {t('filter.reset')}
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className={`p-2 rounded-full transition-colors ${isDark ? 'bg-white/[0.04] text-[hsl(220,10%,55%)] hover:text-[hsl(220,20%,96%)]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'}`}
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div data-lenis-prevent className="p-6 md:p-8 overflow-y-auto space-y-8 pb-40 custom-scrollbar" style={{ maxHeight: 'calc(90vh - 80px)' }}>

                            {/* Establishment Type */}
                            <div className="space-y-4 text-left md:col-span-2">
                                <label className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-slate-900'}`}>{t('filter.establishment_type')}</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                    {ESTABLISHMENT_TYPES.map(type => {
                                        const isActive = selectedCategory === type.id
                                        const displayLabel = getCategoryLabel(type.id, i18n.language)
                                        return (
                                            <motion.button
                                                key={type.id}
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setSelectedCategory(isActive ? 'all' : type.id)}
                                                className={`${blockBase} ${isActive ? blockActive : blockInactive}`}
                                            >
                                                <span className="text-xl group-hover:scale-110 transition-transform duration-300">{type.icon}</span>
                                                <span className="text-[11px] font-bold">{displayLabel}</span>
                                            </motion.button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Sort By */}
                            <div className="space-y-4 text-left">
                                <label className={`text-[11px] font-semibold uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-white/40' : 'text-slate-900'}`}>
                                    <ArrowUpDown size={14} className="text-blue-500" />
                                    {t('explore.sort')}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {SORT_OPTIONS.map(opt => {
                                        const isActive = selectedSortBy === opt.value
                                        return (
                                            <motion.button
                                                key={opt.value}
                                                whileHover={{ scale: 1.03 }}
                                                whileTap={{ scale: 0.97 }}
                                                onClick={() => setSelectedSortBy(opt.value)}
                                                className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                                            >
                                                {t(opt.labelKey)}
                                            </motion.button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Rating + Price Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Rating */}
                                <div className="space-y-4 text-left">
                                    <label className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-slate-900'}`}>{t('filter.rating')}</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { val: null, label: t('common.all') },
                                            { val: 4,    label: '4+' },
                                            { val: 4.5,  label: '4.5+' },
                                        ].map(opt => {
                                            const isActive = selectedRating === opt.val
                                            return (
                                                <motion.button
                                                    key={String(opt.val)}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => setSelectedRating(isActive ? null : opt.val)}
                                                    className={`h-14 rounded-2xl border flex items-center justify-center gap-1.5 font-semibold text-sm transition-all ${isActive
                                                        ? 'bg-[hsl(217,91%,60%)] border-[hsl(217,91%,60%)] text-white shadow-lg shadow-[hsl(217,91%,60%)]/20'
                                                        : isDark ? 'bg-white/[0.03] border-white/[0.04] text-[hsl(220,20%,96%)] hover:bg-white/[0.06]' : 'bg-white border-gray-100 text-gray-600 shadow-sm hover:border-blue-400'
                                                    }`}
                                                >
                                                    {opt.val != null && <Star size={14} className={isActive ? 'text-white fill-white' : 'text-yellow-500 fill-yellow-500'} />}
                                                    {opt.label}
                                                </motion.button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Price Level */}
                                <div className="space-y-4 text-left">
                                    <label className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-slate-900'}`}>{t('filter.price_range')}</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['$', '$$', '$$$', '$$$$'].map(level => {
                                            const isActive = selectedPriceLevels.includes(level)
                                            return (
                                                <motion.button
                                                    key={level}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => togglePriceLevel(level)}
                                                    className={`h-14 rounded-2xl border flex items-center justify-center font-bold text-sm transition-all ${isActive
                                                        ? 'bg-[hsl(217,91%,60%)] border-[hsl(217,91%,60%)] text-white shadow-lg shadow-[hsl(217,91%,60%)]/20'
                                                        : isDark ? 'bg-white/[0.03] border-white/[0.04] text-[hsl(220,20%,96%)] hover:bg-white/[0.06]' : 'bg-white border-gray-100 text-gray-600 shadow-sm hover:border-blue-400'
                                                    }`}
                                                >
                                                    {level}
                                                </motion.button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Best Time to Visit */}
                            <div className="space-y-4 text-left">
                                <label className={`text-[11px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-white/40' : 'text-slate-900'}`}>{t('filter.best_time_visit')}</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {BEST_TIMES.map(time => {
                                        const isActive = selectedBestTime === time.id
                                        const displayLabel = getCategoryLabel(time.id, i18n.language)
                                        
                                        // Map IDs to Lucide components for consistent UI
                                        const IconComponent = {
                                            morning: Sunrise,
                                            day: Sun,
                                            evening: Sunset,
                                            late_night: Sparkles
                                        }[time.id] || Sun

                                        const iconClass = {
                                            morning: 'text-orange-400',
                                            day: 'text-yellow-500',
                                            evening: 'text-orange-500',
                                            late_night: 'text-indigo-400'
                                        }[time.id] || 'text-blue-500'

                                        return (
                                            <motion.button
                                                key={time.id}
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setSelectedBestTime(isActive ? null : time.id)}
                                                className={`${blockBase} ${isActive ? blockActive : blockInactive}`}
                                            >
                                                <IconComponent size={20} className={`${iconClass} group-hover:scale-110 transition-transform`} />
                                                <span className="text-[11px] font-bold">{displayLabel}</span>
                                            </motion.button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Special Features */}
                            <div className="space-y-6 text-left">
                                <label className={`text-[11px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-white/40' : 'text-slate-900'}`}>{t('filter.special_features')}</label>
                                <div className="space-y-6">
                                    {getLabelGroups(i18n.language).map((cat, idx) => {
                                        // First group (Cuisine & Menu) uses dynamic KG data
                                        let items = cat.items
                                        if (idx === 0) {
                                            // Convert dynamicCuisines (strings) + static labels to localized objects
                                            items = [
                                                ...CUISINE_MENU_LABELS.map(val => ({
                                                    value: val,
                                                    label: getLabelTranslation(val, i18n.language)
                                                })),
                                                ...dynamicCuisines.map(c => ({
                                                    value: c,
                                                    label: getLabelTranslation(c, i18n.language)
                                                }))
                                            ]
                                        }
                                        
                                        if (items.length === 0) return null
                                        const groupLabel = cat.group

                                        return (
                                        <div key={cat.group} className="space-y-3">
                                            <h4 className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-white/50' : 'text-slate-800'}`}>{groupLabel}</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {items.map(chip => {
                                                    const isActive = selectedFeatures.includes(chip.value)
                                                    return (
                                                        <motion.button
                                                            key={chip.value}
                                                            whileHover={{ scale: 1.03 }}
                                                            whileTap={{ scale: 0.97 }}
                                                            onClick={() => toggleFeature(chip.value)}
                                                            className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                                                        >
                                                            <span className="mr-1.5 opacity-90 group-hover:scale-125 transition-transform duration-300">
                                                                {getLabelEmoji(chip.value)}
                                                            </span>
                                                            {chip.label}
                                                        </motion.button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Search Radius */}
                            <div className={`space-y-4 text-left pt-6 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                                <div className="flex justify-between items-center">
                                    <label className={`text-[11px] font-semibold uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-slate-900'}`}>{t('filter.search_radius')}</label>
                                    <span className="text-blue-500 font-bold text-sm">{radius} km</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={50}
                                    value={radius}
                                    onChange={e => handleRadiusChange(Number(e.target.value))}
                                    className="w-full h-2 bg-blue-600/10 rounded-full appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className={`flex justify-between text-[10px] font-bold uppercase ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                                    <span>{t('filter.radius_nearby')}</span>
                                    <span>{t('filter.radius_city_wide')}</span>
                                    <span>{t('filter.radius_regional')}</span>
                                </div>
                                {geoError && (
                                    <p className="text-xs text-amber-500 mt-1">⚠️ {geoError}</p>
                                )}
                            </div>

                        </div>

                        {/* Footer */}
                        <div className={`absolute bottom-0 left-0 right-0 p-6 pb-8 md:p-8 backdrop-blur-md border-t ${isDark ? 'bg-[hsl(220,20%,6%)]/80 border-white/[0.04]' : 'bg-white/80 border-gray-100'}`}>
                            <button
                                onClick={handleApply}
                                className="w-full h-16 bg-blue-600 text-white font-bold rounded-[20px] shadow-xl shadow-blue-500/30 active:scale-[0.98] hover:bg-blue-700 transition-all text-base"
                            >
                                {activeCount > 0 ? t('filter.apply_count', { count: activeCount }) : t('filter.apply')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}

export default FilterModal
