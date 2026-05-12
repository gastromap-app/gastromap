import React, { useState, useEffect, memo, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
// import { useInfiniteLocations } from '@/hooks/useLocationsQuery' (Removed duplicate)
import {
    MapPin, SlidersHorizontal, Star, Clock,
    Heart, ChevronRight, Home, Utensils,
    Coffee, Wine, Store, List,
    ArrowUpDown, X, SearchX, AlertCircle
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import FavoriteButton from '@/components/ui/FavoriteButton'
// eslint-disable-next-line no-restricted-imports
import FilterModal from '@/features/dashboard/components/FilterModal'
import { useShallow } from 'zustand/react/shallow'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useInfiniteLocations } from '@/shared/api/queries/location.queries'
// eslint-disable-next-line no-restricted-imports
import { SmartSearchBar } from '@/features/dashboard/components/SmartSearchBar'
import { useFavorites } from '@/hooks/useFavorites'
import { applyAllFilters } from '@/shared/utils/locationFilters'
import { useOpenStatus } from '@/hooks/useOpenStatus'
import { formatOpeningHours } from '@/utils/formatOpeningHours'
import LazyImage from '@/components/ui/LazyImage'
import { LocationCardMobileSkeleton, LocationCardDesktopSkeleton } from '@/components/ui/Skeleton'
import { ESTABLISHMENT_TYPES } from '@/shared/config/filterOptions'

import { useUIStore } from '@/shared/store/useUIStore'

// ─── Category config from canonical filterOptions ─────────────────────────
// EXPL-3 FIX: was hardcoded 5 items — now uses ESTABLISHMENT_TYPES (single source of truth)
const CATEGORIES = ESTABLISHMENT_TYPES.map(t => ({ name: t.id === 'all' ? 'All' : t.id, label: t.label, emoji: t.icon }))

const SORT_VALUES = ['google_rating', 'trending', 'recommended', 'price_asc', 'price_desc', 'name']
const SORT_LABEL_KEYS = {
    google_rating: 'explore.top_rated',
    trending:      'explore.trending',
    recommended:   'explore.recommended',
    price_asc:     'explore.price_asc',
    price_desc:    'explore.price_desc',
    name:          'explore.a_to_z',
}

// ─── Open status badge (uses real openingHours) ───────────────────────────
function OpenBadge({ openingHours }) {
    const { label, color, isOpen } = useOpenStatus(openingHours)
    const hoursText = formatOpeningHours(openingHours)
    if (isOpen === null) return null
    return (
        <div 
            className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter ${color}`}
            title={hoursText || undefined}
        >
            <div className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
            {label}
        </div>
    )
}

// ─── Mobile location card (compact vertical 2-column layout) ───────────────
const MobileCard = memo(function MobileCard({ item, style }) {
    const navigate = useNavigate()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { isFavorite, toggleFavorite } = useFavorites()
    const saved = isFavorite(item.id)

    const rating = item.google_rating ?? item.rating
    const cuisine = item.cuisine || (item.cuisine_types?.[0]) || ''
    const category = item.category || ''
    const displayMeta = [category, cuisine].filter(Boolean).join(' · ')

    return (
        <div style={style} className="p-1.5">
            <div
                onClick={() => navigate(`/location/${item.id}`)}
                className={`relative flex flex-col h-full rounded-2xl overflow-hidden shadow-sm border transition-all active:scale-[0.98] cursor-pointer animate-[fadeInUp_0.3s_ease-out_both] ${isDark ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-100'}`}
            >
                {/* Image */}
                <div className="relative h-32 w-full overflow-hidden">
                    <LazyImage
                        src={item.photos?.[0] || item.image}
                        alt={item.title}
                        wrapperClassName="w-full h-full"
                        className="w-full h-full object-cover"
                        sizes="(max-width: 768px) 50vw, 25vw"
                        transform={{ width: 400, quality: 75, format: 'webp' }}
                    />
                    {/* Gradient for readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                    {/* Rating badge */}
                    {rating > 0 && (
                        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                            <Star size={9} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-[10px] font-bold text-white">{Number(rating).toFixed(1)}</span>
                        </div>
                    )}

                    {/* Favorite button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id) }}
                        className={`absolute top-2 left-2 w-7 h-7 rounded-full backdrop-blur-sm flex items-center justify-center transition-all active:scale-90 ${
                            saved
                                ? 'bg-red-500 text-white'
                                : 'bg-black/40 text-white/80'
                        }`}
                    >
                        <Heart size={11} fill={saved ? 'currentColor' : 'none'} />
                    </button>

                    {/* Price badge bottom-right on image */}
                    {item.price_range && (
                        <div className="absolute bottom-2 right-2 bg-white/90 dark:bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{item.price_range}</span>
                        </div>
                    )}
                </div>

                {/* Info section */}
                <div className="p-2.5 flex flex-col gap-0.5">
                    <h4 className={`text-[13px] font-bold leading-tight line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {item.title}
                    </h4>
                    {displayMeta && (
                        <p className={`text-[10px] font-medium truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {displayMeta}
                        </p>
                    )}
                    <div className="pt-0.5">
                        <OpenBadge openingHours={item.openingHours} />
                    </div>
                </div>
            </div>
        </div>
    )
})

// ─── Mobile Virtualized Grid ─────────────────────────────────────────────
const VirtualizedMobileGrid = memo(function VirtualizedMobileGrid({
    items,
    parentElement
}) {
    const columns = 2
    const rows = useMemo(() => {
        const result = []
        for (let i = 0; i < items.length; i += columns) {
            result.push(items.slice(i, i + columns))
        }
        return result
    }, [items])

    // eslint-disable-next-line react-hooks/incompatible-library
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentElement,
        estimateSize: () => 200, // Approximate height of a mobile row
        overscan: 5,
    })

    return (
        <div
            style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
            }}
        >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                <div
                    key={virtualRow.key}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="grid grid-cols-2 gap-0 px-2"
                >
                    {rows[virtualRow.index].map((item) => (
                        <MobileCard key={item.id} item={item} />
                    ))}
                </div>
            ))}
        </div>
    )
})

// ─── Desktop location card ────────────────────────────────────────────────
const DesktopCard = memo(function DesktopCard({ item, isDark, textStyle, subTextStyle }) {
    const navigate = useNavigate()
    const { isFavorite, toggleFavorite } = useFavorites()
    const saved = isFavorite(item.id)

    const rating = item.google_rating ?? item.rating
    const cuisine = item.cuisine || (item.cuisine_types?.[0]) || ''
    const category = item.category || ''
    const displayMeta = [category, cuisine].filter(Boolean).join(' · ')
    const description = item.description || item.insider_tip || ''

    return (
        <div
            onClick={() => navigate(`/location/${item.id}`)}
            className={`relative flex flex-col rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 border [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-xl animate-[fadeInUp_0.3s_ease-out_both] scroll-reveal ${
                isDark ? 'bg-white/[0.03] border-white/5 shadow-sm' : 'bg-white border-gray-100 shadow-sm'
            }`}
        >
            {/* Image */}
            <div className="relative h-40 overflow-hidden">
                <LazyImage
                    src={item.photos?.[0] || item.image}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 25vw"
                    transform={{ width: 600, quality: 80, format: 'webp' }}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                {/* Rating badge */}
                {rating > 0 && (
                    <div className="absolute top-2.5 right-2.5 bg-white/90 dark:bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
                        <Star size={10} className="text-yellow-500 fill-yellow-500" />
                        <span className="text-[11px] font-black text-gray-900 dark:text-white">{Number(rating).toFixed(1)}</span>
                    </div>
                )}

                {/* Favorite button */}
                <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id) }}
                    className={`absolute top-2.5 left-2.5 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center border active:scale-90 transition-all ${
                        saved ? 'bg-red-500 border-red-400 text-white shadow-md' : 'bg-black/30 border-white/20 text-white hover:bg-black/50'
                    }`}
                >
                    <Heart size={13} fill={saved ? 'currentColor' : 'none'} />
                </button>

                {/* Category pill on image bottom */}
                {category && (
                    <div className="absolute bottom-2.5 left-2.5 bg-white/90 dark:bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">{category}</span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-3.5 flex flex-col gap-1">
                {/* Title + Price */}
                <div className="flex justify-between items-start gap-2">
                    <h4 className={`text-sm font-bold leading-tight line-clamp-1 [@media(hover:hover)]:group-hover:text-blue-600 transition-colors ${textStyle}`}>
                        {item.title}
                    </h4>
                    {item.price_range && (
                        <span className="text-emerald-500 font-black text-xs flex-shrink-0">{item.price_range}</span>
                    )}
                </div>

                {/* Cuisine meta */}
                {displayMeta && (
                    <p className={`text-[11px] font-medium truncate ${subTextStyle}`}>{displayMeta}</p>
                )}

                {/* Description snippet */}
                {description && (
                    <p className={`text-[11px] line-clamp-2 leading-snug ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {description}
                    </p>
                )}

                {/* Open status */}
                <div className="pt-1">
                    <OpenBadge openingHours={item.openingHours} />
                </div>
            </div>
        </div>
    )
})

// ─── Desktop Virtualized Grid ─────────────────────────────────────────────
const VirtualizedDesktopGrid = memo(function VirtualizedDesktopGrid({
    items,
    isDark,
    textStyle,
    subTextStyle,
    parentElement
}) {
    const columns = 4
    const rows = useMemo(() => {
        const result = []
        for (let i = 0; i < items.length; i += columns) {
            result.push(items.slice(i, i + columns))
        }
        return result
    }, [items])

    // eslint-disable-next-line react-hooks/incompatible-library
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentElement,
        estimateSize: () => 340, // height of a card + gap-6 (24px) vertical spacing
        overscan: 3,
    })

    return (
        <div
            style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
            }}
        >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                <div
                    key={virtualRow.key}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-1 pb-6"
                >
                    {rows[virtualRow.index].map((item) => (
                        <DesktopCard
                            key={item.id}
                            item={item}
                            isDark={isDark}
                            textStyle={textStyle}
                            subTextStyle={subTextStyle}
                        />
                    ))}
                </div>
            ))}
        </div>
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
            <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                Check your connection and try again.
            </p>
        </motion.div>
    )
}

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyState({ query, isDark }) {
    const resetFilters = useLocationsStore(s => s.resetFilters)
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-20 text-center"
        >
            <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center mb-6 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                <SearchX size={36} className={isDark ? 'text-white/30' : 'text-gray-400'} />
            </div>
            <h3 className={`text-lg font-black mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                No results {query ? `for "${query}"` : ''}
            </h3>
            <p className={`text-sm font-medium mb-6 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
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
    const { t } = useTranslation()
    const { country, city } = useParams()
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    // Store state values (search is LOCAL to SmartSearchBar — not synced to store)
    const {
        activeCategories,
        activeCategory,
        sortBy,
        minRating,
        activePriceLevels,
    } = useLocationsStore(useShallow(s => ({
        activeCategories: s.activeCategories,
        activeCategory: s.activeCategory,
        sortBy: s.sortBy,
        minRating: s.minRating,
        activePriceLevels: s.activePriceLevels,
    })))

    // Store actions (stable)
    const setSortBy = useLocationsStore(s => s.setSortBy)
    const resetFilters = useLocationsStore(s => s.resetFilters)
    const activeFiltersCount = useLocationsStore(s => s.getActiveFiltersCount())

    // Local search input — purely for the search bar, does NOT affect page list
    const [localSearch, setLocalSearch] = useState(() => {
        const params = new URLSearchParams(window.location.search)
        return params.get('q') || ''
    })

    // Sync sortBy from URL query param on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const sort = params.get('sort')
        if (sort && sort !== sortBy) {
            setSortBy(sort)
        }
    }, [setSortBy, sortBy])

    // Note: filters are NOT reset on unmount — they persist in the global store.
    // Users can clear them via the "Reset" button in the filter modal or the
    // active-filters badge. Dashboard "See All" calls resetFilters() before
    // navigating here, providing a clean entry point.

    // Fetch city-scoped locations with infinite scroll — search query is NOT passed
    // here so the page always shows all locations for the city. Search is handled
    // independently by SmartSearchBar (server-side FTS in dropdown).
    const {
        data: infiniteData,
        isPending: isLoading,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteLocations({ city, country, category: activeCategory !== 'All' ? activeCategory : null, price_range: activePriceLevels, minRating, sortBy, limit: 24 })

    // Flatten pages into a single array for rendering
    const localFilteredLocations = useMemo(() => {
        const items = infiniteData?.pages?.flatMap(page => page.data) || []
        const filters = {
            activeCategories,
            activeCity: city,
            activeCountry: country,
            activePriceLevels,
            minRating,
            sortBy,
        }
        if (typeof applyAllFilters !== 'function') {
            console.warn('[LocationsPage] applyAllFilters is not ready yet')
            return items
        }
        return applyAllFilters(items, filters)
    }, [infiniteData, activeCategories, city, country, activePriceLevels, minRating, sortBy])

    // Infinite Scroll (Mobile Intersection Observer)
    const mobileSentinelRef = useRef(null)

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
                fetchNextPage()
            }
        }, { threshold: 0.1, rootMargin: '400px' })

        const el = mobileSentinelRef.current
        if (el) observer.observe(el)
        return () => observer.disconnect()
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    const [desktopScrollEl, setDesktopScrollEl] = useState(null)
    const [mobileScrollEl, setMobileScrollEl] = useState(null)
    const [showFloatingSearch, setShowFloatingSearch] = useState(true)
    const lastScrollY = useRef(0)
        const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [sortOpen, setSortOpen] = useState(false)

    const textStyle = isDark ? 'text-white' : 'text-gray-900'
    const subTextStyle = isDark ? 'text-gray-400' : 'text-gray-500'
    const currentSort = { value: sortBy, label: t(SORT_LABEL_KEYS[sortBy] || 'explore.top_rated') }

    // Sync header background with internal scroll container
    const setHeaderScrolled = useUIStore(s => s.setHeaderScrolled)

    const handleMobileScroll = useCallback((e) => {
        const scrollTop = e.currentTarget.scrollTop
        const isScrolled = scrollTop > 20
        setHeaderScrolled(isScrolled)

        const scrollingDown = scrollTop > lastScrollY.current && scrollTop > 80
        const scrollingUp = scrollTop < lastScrollY.current
        lastScrollY.current = scrollTop

        if (scrollingDown && showFloatingSearch) {
            setShowFloatingSearch(false)
        } else if (scrollingUp && !showFloatingSearch) {
            setShowFloatingSearch(true)
        }
    }, [setHeaderScrolled, showFloatingSearch])

    return (
        // Using a plain div here (not PageTransition) because:
        // 1. This page uses `fixed inset-0` children (map layer, bottom sheet).
        //    Wrapping them in a motion.div with scale/y transforms breaks `position:fixed`
        //    — fixed elements inside a CSS-transformed parent are positioned relative
        //    to that parent, not the viewport.
        // 2. The individual child elements already have their own motion animations.
        <div data-lenis-prevent className="fixed inset-0 md:left-[72px] w-full h-[100dvh] bg-transparent overflow-hidden overscroll-none">
            <FilterModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} theme={theme} />

            {/* ── MOBILE: Location Cards + Search + Filters ─────────────── */}
            <div className="md:hidden fixed inset-0 z-0 overflow-y-auto overscroll-contain" ref={setMobileScrollEl} onScroll={handleMobileScroll}>
                {/* Header with search */}
                <motion.div
                    className="sticky top-0 z-30 px-4 pb-3"
                    style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4.5rem)' }}
                    initial={false}
                    animate={{
                        y: showFloatingSearch ? 0 : -120,
                        opacity: showFloatingSearch ? 1 : 0,
                    }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                    <SmartSearchBar
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        onFilter={() => setIsFilterOpen(true)}
                        placeholder={city ? t('explore.search_in', { city }) : t('explore.search_everywhere')}
                        city={city}
                        country={country}
                    />
                </motion.div>

                {/* Mobile location cards */}
                <div className="px-3 pb-28">
                    {isLoading ? (
                        <div className="grid grid-cols-2 gap-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <LocationCardMobileSkeleton key={i} isDark={isDark} />
                            ))}
                        </div>
                    ) : isError ? (
                        <ErrorState isDark={isDark} />
                    ) : localFilteredLocations.length === 0 ? (
                        <EmptyState query={localSearch} isDark={isDark} />
                    ) : (
                        <>
                            {/* Results counter + Clear filters */}
                            <div className="flex items-center justify-center gap-3 mb-3">
                                <p className={`text-[12px] font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {t('explore.showing_of', { 
                                        shown: localFilteredLocations.length, 
                                        total: localFilteredLocations.length 
                                    })}
                                </p>
                                {activeFiltersCount > 0 && (
                                    <button
                                        onClick={resetFilters}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${isDark ? 'bg-white/[0.04] text-red-400 hover:bg-white/[0.08]' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                                    >
                                        <X size={10} />
                                        {t('filter.reset', 'Reset')}
                                    </button>
                                )}
                            </div>

                            <VirtualizedMobileGrid
                                items={localFilteredLocations}
                                parentElement={mobileScrollEl}
                            />

                            {/* Infinite scroll sentinel */}
                            {hasNextPage && (
                                <div ref={mobileSentinelRef} className="h-20 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── DESKTOP VIEW ──────────────────────────────────────────── */}
            {/* Wraps in absolute+overflow-y-auto so the grid scrolls within the
                fixed inset-0 root that is required by the mobile map/sheet layout. */}
            <div className="hidden md:flex absolute inset-0 overflow-y-auto z-10" ref={setDesktopScrollEl}>
                <div className="w-full max-w-7xl mx-auto px-8 pt-24 pb-10">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

                    {/* Hero */}
                    <div className="mt-10 space-y-6">
                        <div className="space-y-2">
                            <h1 className={`text-5xl font-black tracking-tight capitalize ${textStyle}`}>
                                {t('explore.explore_in')} <span className="text-blue-600">{city}</span>
                            </h1>
                            <p className={`text-lg ${subTextStyle}`}>
                                {t('explore.city_tagline', { city })}
                            </p>
                        </div>

                        {/* Search bar */}
                        <div className="flex gap-4 items-center">
                            <SmartSearchBar
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                onFilter={() => setIsFilterOpen(true)}
                                placeholder={city ? t('explore.search_in', { city }) : t('explore.search_everywhere')}
                                city={city}
                                country={country}
                                className="flex-1"
                            />

                            {/* Sort dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setSortOpen((o) => !o)}
                                    aria-label={t('explore.sort_aria')}
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
                                            {SORT_VALUES.map((value) => (
                                                <button
                                                    key={value}
                                                    onClick={() => { setSortBy(value); setSortOpen(false) }}
                                                    className={`w-full text-left px-5 py-3 text-sm font-bold transition-colors ${
                                                        sortBy === value
                                                            ? isDark ? 'text-blue-400 bg-blue-600/10' : 'text-blue-600 bg-blue-50'
                                                            : isDark ? 'text-white/70 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {t(SORT_LABEL_KEYS[value])}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <button
                                onClick={() => setIsFilterOpen(true)}
                                aria-label="Open filters"
                                className={`relative h-16 w-16 rounded-[24px] flex items-center justify-center transition-all active:scale-95 border ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 shadow-sm hover:border-blue-400'}`}
                            >
                                <SlidersHorizontal size={22} />
                                {activeFiltersCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg">
                                        {activeFiltersCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Controls row — breadcrumb + results count + reset */}
                    <div className="flex justify-between items-center gap-6 mt-8">
                        {/* Breadcrumb */}
                        <nav className={`hidden md:flex items-center px-5 py-2.5 rounded-full border backdrop-blur-md ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-gray-100'}`}>
                            <Link to="/dashboard" className={`flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase hover:text-blue-500 transition-colors ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                <Home size={12} /><span>Dashboard</span>
                            </Link>
                            <ChevronRight size={14} className="mx-2 text-gray-500/50" />
                            <Link to={`/explore/${country}`} className={`text-[10px] font-bold tracking-widest uppercase hover:text-blue-500 transition-colors capitalize ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{country}</Link>
                            <ChevronRight size={14} className="mx-2 text-gray-500/50" />
                            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-blue-600">
                                <MapPin size={12} className="fill-blue-600/20" />
                                <span className="capitalize">{city}</span>
                            </div>
                        </nav>

                        {/* Results count + Clear filters */}
                        <div className="flex items-center gap-3 ml-auto">
                            {activeFiltersCount > 0 && (
                                <button
                                    onClick={resetFilters}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${isDark ? 'bg-white/[0.04] text-red-400 hover:bg-white/[0.08]' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                                >
                                    <X size={12} />
                                    {t('filter.reset', 'Reset')}
                                </button>
                            )}
                            <p className={`text-sm font-bold ${subTextStyle}`}>
                                {localFilteredLocations.length} result{localFilteredLocations.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="mt-8 min-h-[400px]">
                        {isLoading ? (
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
                            <VirtualizedDesktopGrid
                                items={localFilteredLocations}
                                isDark={isDark}
                                textStyle={textStyle}
                                subTextStyle={subTextStyle}
                                parentElement={desktopScrollEl}
                            />
                        )}
                    </div>
                </motion.div>
                </div>
            </div>
        </div>
    )
}

export default LocationsPage
