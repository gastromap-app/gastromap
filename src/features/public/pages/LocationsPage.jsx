import React, { useState, useEffect, useRef, memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
    MapPin, Search, SlidersHorizontal, Star, Clock,
    Heart, Share2, ChevronRight, Home, Utensils,
    Coffee, Wine, Store, Navigation, List,
    ArrowUpDown, X, SearchX, AlertCircle
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import FilterModal from '@/features/dashboard/components/FilterModal'
const MapTab = React.lazy(() => import('@/features/dashboard/components/MapTab'))
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useFavoritesStore } from '@/shared/store/useFavoritesStore'
import { useDebounce } from '@/hooks/useDebounce'
import { useOpenStatus } from '@/hooks/useOpenStatus'
import LazyImage from '@/components/ui/LazyImage'
import { LocationCardMobileSkeleton, LocationCardDesktopSkeleton } from '@/components/ui/Skeleton'
import { useLocationsQuery } from '@/hooks/useLocationsQuery'
import { ESTABLISHMENT_TYPES } from '@/shared/config/filterOptions'

// ─── Category config from canonical filterOptions ─────────────────────────
// EXPL-3 FIX: was hardcoded 5 items — now uses ESTABLISHMENT_TYPES (single source of truth)
const CATEGORIES = ESTABLISHMENT_TYPES.map(t => ({ name: t.id === 'all' ? 'All' : t.id, label: t.label, emoji: t.icon }))

const SORT_OPTIONS = [
    { value: 'rating',     label: 'Top Rated' },
    { value: 'price_asc',  label: 'Price ↑' },
    { value: 'price_desc', label: 'Price ↓' },
    { value: 'name',       label: 'A → Z' },
]

// ─── Open status badge (uses real openingHours) ───────────────────────────
function OpenBadge({ openingHours }) {
    const { label, color, isOpen } = useOpenStatus(openingHours)
    if (isOpen === null) return null
    return (
        <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter ${color}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
            {label}
        </div>
    )
}

// ─── Mobile location card ─────────────────────────────────────────────────
const MobileCard = memo(function MobileCard({ item, isDark, textStyle, subTextStyle }) {
    const navigate = useNavigate()
    const { isFavorite, toggleFavorite } = useFavoritesStore()
    const saved = isFavorite(item.id)

    return (
        <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            onClick={() => navigate(`/location/${item.id}`)}
            className={`relative flex flex-col p-3 rounded-[32px] overflow-hidden shadow-sm border transition-all active:scale-[0.98] cursor-pointer ${isDark ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'}`}
        >
            <div className="relative h-48 w-full rounded-[24px] overflow-hidden mb-3">
                <LazyImage
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Labels */}
                <div className="absolute top-3 left-3 flex gap-2">
                    {item.special_labels?.slice(0, 1).map(label => (
                        <div key={label} className="bg-blue-600 text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg">
                            {label}
                        </div>
                    ))}
                </div>

                {/* Save button */}
                <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id) }}
                    aria-label={saved ? 'Remove from favorites' : 'Add to favorites'}
                    className={`absolute top-3 right-3 w-10 h-10 rounded-xl backdrop-blur-md flex items-center justify-center border active:scale-90 transition-all ${
                        saved ? 'bg-red-500 border-red-400 text-white' : 'bg-white/20 border-white/30 text-white'
                    }`}
                >
                    <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
                </button>

                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                    <div className="space-y-1">
                        <span className="bg-white/20 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border border-white/40">
                            {item.category}
                        </span>
                        <h4 className="text-xl font-black text-white leading-tight mt-1">{item.title}</h4>
                    </div>
                    <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-xl shadow-blue-600/30">
                        <Navigation size={18} />
                    </div>
                </div>
            </div>

            <div className="px-1 pb-1 space-y-2.5">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                        <Star size={16} className="text-yellow-400 fill-yellow-400" />
                        <span className={`text-sm font-black ${textStyle}`}>{item.rating}</span>
                        <span className={`text-[11px] ${subTextStyle}`}>({item.reviews ?? '—'})</span>
                    </div>
                    <span className="text-blue-500 font-bold text-sm">{item.priceLevel}</span>
                </div>
                <OpenBadge openingHours={item.openingHours} />
            </div>
        </motion.div>
    )
})

// ─── Desktop location card ────────────────────────────────────────────────
const DesktopCard = memo(function DesktopCard({ item, isDark, textStyle, subTextStyle }) {
    const navigate = useNavigate()
    const { isFavorite, toggleFavorite } = useFavoritesStore()
    const saved = isFavorite(item.id)

    return (
        <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            onClick={() => navigate(`/location/${item.id}`)}
            whileHover={{ y: -8 }}
            className={`relative flex flex-col p-4 rounded-[40px] overflow-hidden group cursor-pointer transition-all duration-300 border ${
                isDark ? 'bg-white/[0.03] border-white/5 shadow-2xl' : 'bg-white border-gray-100 shadow-xl shadow-gray-200/50'
            }`}
        >
            <div className="relative h-56 mb-5 rounded-[28px] overflow-hidden">
                <LazyImage
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                {/* Rating */}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-black text-gray-900 flex items-center gap-1 shadow-md">
                    <Star size={12} className="text-yellow-500 fill-yellow-500" /> {item.rating}
                </div>
                {/* Save */}
                <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id) }}
                    className={`absolute top-4 left-4 w-9 h-9 rounded-xl backdrop-blur-md flex items-center justify-center border active:scale-90 transition-all ${
                        saved ? 'bg-red-500 border-red-400 text-white shadow-md' : 'bg-white/20 border-white/30 text-white'
                    }`}
                >
                    <Heart size={15} fill={saved ? 'currentColor' : 'none'} />
                </button>
            </div>

            <div className="space-y-3 px-2 flex-1">
                <div className="flex justify-between items-start gap-2">
                    <h4 className={`text-xl font-black leading-tight group-hover:text-blue-600 transition-colors ${textStyle}`}>
                        {item.title}
                    </h4>
                    <span className="text-blue-500 font-black text-sm flex-shrink-0">{item.priceLevel}</span>
                </div>
                <p className={`text-[13px] font-bold ${subTextStyle}`}>{item.cuisine} · {item.category}</p>

                <div className={`pt-4 flex justify-between items-center border-t ${isDark ? 'border-white/5' : 'border-gray-50'}`}>
                    <div className="space-y-0.5">
                        <OpenBadge openingHours={item.openingHours} />
                        {item.vibe && (
                            <span className={`text-[10px] font-bold ${subTextStyle}`}>{item.vibe}</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={(e) => e.stopPropagation()}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/50' : 'bg-gray-50 hover:bg-gray-100 text-gray-500 dark:text-gray-400'}`}>
                            <Share2 size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    )
})

// ─── Error state ──────────────────────────────────────────────────────────
function ErrorState({ isDark }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-20 text-center"
        >
            <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center mb-6 ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                <AlertCircle size={36} className="text-red-400" />
            </div>
            <h3 className={`text-lg font-black mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Failed to load venues
            </h3>
            <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-500 dark:text-gray-400'}`}>
                Check your connection and try again.
            </p>
        </motion.div>
    )
}

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyState({ query, isDark }) {
    const { resetFilters } = useLocationsStore()
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-20 text-center"
        >
            <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center mb-6 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                <SearchX size={36} className={isDark ? 'text-white/30' : 'text-gray-500 dark:text-gray-400'} />
            </div>
            <h3 className={`text-lg font-black mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                No results {query ? `for "${query}"` : ''}
            </h3>
            <p className={`text-sm font-medium mb-6 ${isDark ? 'text-white/40' : 'text-gray-500 dark:text-gray-400'}`}>
                Try a different keyword or remove some filters.
            </p>
            <button
                onClick={resetFilters}
                className="px-6 py-3 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all"
            >
                Clear filters
            </button>
        </motion.div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────
const LocationsPage = () => {
    const { country, city } = useParams()
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    // Store
    const {
        filteredLocations,
        activeCategory,
        searchQuery: storeQuery,
        sortBy,
        setCategory,
        setSearchQuery: storeSetSearch,
        setSortBy,
        resetFilters,
    } = useLocationsStore()

    // Local search input → debounce → store
    const [localSearch, setLocalSearch] = useState(storeQuery)
    const debouncedSearch = useDebounce(localSearch, 300)

    useEffect(() => {
        storeSetSearch(debouncedSearch)
    }, [debouncedSearch, storeSetSearch])

    // Sync from URL query param on mount
    useEffect(() => {
        const q = new URLSearchParams(window.location.search).get('q')
        if (q) { setLocalSearch(q); storeSetSearch(q) }
        return () => resetFilters()
    }, [])

    // Fetch city-scoped locations; data used directly (NOT synced to global store)
    const { isPending: isLoading, isError, data: cityData } = useLocationsQuery(city, country)

    // REGRESSION FIX: use query data directly for city pages, not global store
    // The global store holds ALL locations — filtering here by city avoids store pollution
    const localFilteredLocations = useMemo(() => {
        const source = cityData ?? []
        const q = localSearch.toLowerCase()
        return source.filter(loc => {
            const searchMatch = !q || loc.title?.toLowerCase().includes(q) || loc.category?.toLowerCase().includes(q)
            const catMatch = activeCategory === 'All' || loc.category === activeCategory
            const ratingMatch = !minRating || (loc.rating ?? 0) >= minRating
            const priceMatch = activePriceLevels.length === 0 || activePriceLevels.includes(loc.price_level)
            return searchMatch && catMatch && ratingMatch && priceMatch
        })
    }, [cityData, localSearch, activeCategory, minRating, activePriceLevels])

    const scrollContainerRef = useRef(null)
    const virtualizer = useVirtualizer({
        count: isLoading ? 0 : localFilteredLocations.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => 342,
        overscan: 3,
    })

    const [activeTab, setActiveTab] = useState('overview')
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [sortOpen, setSortOpen] = useState(false)

    const textStyle = isDark ? 'text-white' : 'text-gray-900'
    const subTextStyle = isDark ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'
    const currentSort = SORT_OPTIONS.find(o => o.value === sortBy)

    return (
        // Using a plain div here (not PageTransition) because:
        // 1. This page uses `fixed inset-0` children (map layer, bottom sheet).
        //    Wrapping them in a motion.div with scale/y transforms breaks `position:fixed`
        //    — fixed elements inside a CSS-transformed parent are positioned relative
        //    to that parent, not the viewport.
        // 2. The individual child elements already have their own motion animations.
        <div data-lenis-prevent className="fixed inset-0 w-full h-[100dvh] bg-transparent overflow-hidden overscroll-none">
            <FilterModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} theme={theme} />

            {/* ── MOBILE: Map + Search + Filters only ─────────────── */}
            <div className="md:hidden fixed inset-0 z-0">
                <div className="w-full h-full [&>div]:h-full [&>div]:w-full [&>div]:rounded-none [&>div]:border-none">
                    <MapTab activeFilter={activeCategory} />
                </div>

                {/* Floating search + filter bar */}
                <div className="absolute left-4 right-4 z-40" style={{ top: 'calc(env(safe-area-inset-top) + 5rem)' }}>
                    <div className="flex gap-2">
                        <div className={`flex-1 relative flex items-center h-12 px-4 rounded-2xl border backdrop-blur-xl shadow-lg ${isDark ? 'bg-[#0a0a0a]/80 border-white/10' : 'bg-white/90 border-gray-200 shadow-xl'}`}>
                            <Search size={17} className="text-blue-500 mr-2.5 flex-shrink-0" />
                            <input
                                type="text"
                                placeholder={`Search in ${city}...`}
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                className={`bg-transparent flex-1 outline-none text-sm font-semibold placeholder:text-gray-400 ${isDark ? 'text-white' : 'text-gray-900'}`}
                            />
                            {localSearch && (
                                <button onClick={() => setLocalSearch('')} className="ml-2 text-gray-400 hover:text-gray-600">
                                    <X size={15} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setIsFilterOpen(true)}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center border backdrop-blur-xl shadow-lg active:scale-95 transition-all ${isDark ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-blue-600 text-white border-transparent shadow-blue-200'}`}
                        >
                            <SlidersHorizontal size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── DESKTOP VIEW ──────────────────────────────────────────── */}
            {/* Wraps in absolute+overflow-y-auto so the grid scrolls within the
                fixed inset-0 root that is required by the mobile map/sheet layout. */}
            <div className="hidden md:flex absolute inset-0 overflow-y-auto z-10">
                <div className="w-full max-w-7xl mx-auto px-8 pt-24 pb-10">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

                    {/* Hero */}
                    <div className="mt-10 space-y-6">
                        <div className="space-y-2">
                            <h1 className={`text-5xl font-black tracking-tight capitalize ${textStyle}`}>
                                Explore <span className="text-blue-600">{city}</span>
                            </h1>
                            <p className={`text-lg ${subTextStyle}`}>
                                Top restaurants and hidden gems in the heart of {city}.
                            </p>
                        </div>

                        {/* Search bar */}
                        <div className="flex gap-4 items-center">
                            <div className="relative flex-1 group">
                                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                                    <Search size={22} className="text-blue-600" />
                                </div>
                                <input
                                    type="text"
                                    placeholder={`Search in ${city}, ${country}...`}
                                    value={localSearch}
                                    onChange={(e) => setLocalSearch(e.target.value)}
                                    className={`w-full h-16 pl-14 pr-12 rounded-[24px] border-2 border-transparent outline-none text-lg transition-all ${isDark ? 'bg-white/5 text-white border-white/10 focus:border-blue-500' : 'bg-white shadow-xl focus:border-blue-500'}`}
                                />
                                {localSearch && (
                                    <button
                                        onClick={() => setLocalSearch('')}
                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-600"
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>

                            {/* Sort dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setSortOpen((o) => !o)}
                                    aria-label="Sort locations"
                                    aria-expanded={sortOpen}
                                    className={`h-16 px-6 rounded-[24px] flex items-center gap-2 font-bold text-sm border transition-all ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 shadow-sm hover:border-blue-400'}`}
                                >
                                    <ArrowUpDown size={18} className="text-blue-500" />
                                    {currentSort?.label}
                                </button>
                                <AnimatePresence>
                                    {sortOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -8, scale: 0.96 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -8, scale: 0.96 }}
                                            transition={{ duration: 0.15 }}
                                            className={`absolute right-0 top-full mt-2 w-40 rounded-2xl border shadow-xl z-50 overflow-hidden ${isDark ? 'bg-gray-900 border-white/10' : 'bg-white border-gray-100'}`}
                                        >
                                            {SORT_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => { setSortBy(opt.value); setSortOpen(false) }}
                                                    className={`w-full text-left px-5 py-3 text-sm font-bold transition-colors ${
                                                        sortBy === opt.value
                                                            ? 'text-blue-600 bg-blue-50 dark:bg-blue-600/10'
                                                            : isDark ? 'text-white/70 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <button
                                onClick={() => setIsFilterOpen(true)}
                                aria-label="Open filters"
                                className={`h-16 w-16 rounded-[24px] flex items-center justify-center transition-all active:scale-95 border ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 shadow-sm hover:border-blue-400'}`}
                            >
                                <SlidersHorizontal size={22} />
                            </button>
                        </div>
                    </div>

                    {/* Controls row */}
                    <div className="flex justify-between items-center gap-6 mt-10">
                        {/* Tab switcher */}
                        <div className="bg-blue-600 p-1.5 rounded-full flex shadow-lg">
                            {['overview', 'map'].map((tab) => (
                                <button
                                    key={tab}
                                    role="tab"
                                    aria-selected={activeTab === tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`relative px-10 py-3 rounded-full text-base font-bold capitalize transition-all z-10 ${activeTab === tab ? 'text-blue-600' : 'text-white hover:bg-white/10'}`}
                                >
                                    {activeTab === tab && (
                                        <motion.div layoutId="activeTabLocations" className="absolute inset-0 bg-white rounded-full shadow-sm z-[-1]" />
                                    )}
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Breadcrumb */}
                        <nav className={`hidden md:flex items-center px-5 py-2.5 rounded-full border backdrop-blur-md ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-gray-100'}`}>
                            <Link to="/dashboard" className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors">
                                <Home size={12} /><span>Dashboard</span>
                            </Link>
                            <ChevronRight size={14} className="mx-2 text-gray-500/50" />
                            <Link to={`/explore/${country}`} className="text-[10px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors capitalize">{country}</Link>
                            <ChevronRight size={14} className="mx-2 text-gray-500/50" />
                            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-blue-600">
                                <MapPin size={12} className="fill-blue-600/20" />
                                <span className="capitalize">{city}</span>
                            </div>
                        </nav>

                        {/* Results count */}
                        <p className={`text-sm font-bold ml-auto ${subTextStyle}`}>
                            {filteredLocations.length} result{filteredLocations.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    {/* Content */}
                    <div className="mt-8 min-h-[400px]">
                        {activeTab === 'map' ? (
                            <MapTab activeFilter={activeCategory} />
                        ) : isLoading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <LocationCardDesktopSkeleton key={i} isDark={isDark} />
                                ))}
                            </div>
                        ) : isError ? (
                            <ErrorState isDark={isDark} />
                        ) : localFilteredLocations.length === 0 ? (
                            <EmptyState query={localSearch} isDark={isDark} />
                        ) : (
                            <motion.div
                                initial="hidden"
                                animate="visible"
                                variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                            >
                                {filteredLocations.map((item) => (
                                    <DesktopCard
                                        key={item.id}
                                        item={item}
                                        isDark={isDark}
                                        textStyle={textStyle}
                                        subTextStyle={subTextStyle}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </div>
                </motion.div>
                </div>
            </div>
        </div>
    )
}

export default LocationsPage
