import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useAddFavoriteMutation, useRemoveFavoriteMutation, useUserFavorites, useGeoCovers } from '@/shared/api/queries'
import { useNavigate } from 'react-router-dom'
import {
    MapPin, Star, ChevronRight, Search as SearchIcon,
    SlidersHorizontal, Sunrise, Sun, Sunset, Sparkles,
    Utensils, Coffee, Wine, X, Heart
} from 'lucide-react'
import FavoriteButton from '@/components/ui/FavoriteButton'
import { useTheme } from '@/hooks/useTheme'
const MapTab = React.lazy(() => import('../components/MapTab'))
import FilterModal from '../components/FilterModal'
import { PageTransition } from '@/components/ui/PageTransition'
import { translate } from '@/utils/translation'
import { DashboardCardSkeleton } from '@/components/ui/Skeleton'
import { useDebounce } from '@/hooks/useDebounce'
import { useTranslation } from 'react-i18next'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullRefreshIndicator } from '@/components/ui/PullRefreshIndicator'
import { SmartSearchBar } from '../components/SmartSearchBar'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getGreeting(t) {
    const h = new Date().getHours()
    if (h < 12) return t('dashboard.greeting_morning')
    if (h < 18) return t('dashboard.greeting_afternoon')
    return t('dashboard.greeting_evening')
}

// Static fallback images per country slug — defined at module level to keep stable reference
const COUNTRY_IMAGES = {
    poland:      'https://images.unsplash.com/photo-1519197924294-4ba991a11128?q=80&w=2069&auto=format&fit=crop',
    france:      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2073&auto=format&fit=crop',
    spain:       'https://images.unsplash.com/photo-1543783207-ec64e4d95325?q=80&w=2070&auto=format&fit=crop',
    italy:       'https://images.unsplash.com/photo-1529543544282-ea669407fca3?q=80&w=2048&auto=format&fit=crop',
    germany:     'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2070&auto=format&fit=crop',
    portugal:    'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?q=80&w=2070&auto=format&fit=crop',
    netherlands: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?q=80&w=2070&auto=format&fit=crop',
    czechia:     'https://images.unsplash.com/photo-1541849546-216549ae216d?q=80&w=2070&auto=format&fit=crop',
}

// ─── LOCATION CARD MOBILE ────────────────────────────────────────────────────

const LocationCardMobile = ({ loc, type = 'recommended' }) => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const addFav = useAddFavoriteMutation()
    const removeFav = useRemoveFavoriteMutation()
    const { data: dbFavs = [] } = useUserFavorites(user?.id)
    const dbFavIds = dbFavs.map(f => f.location_id)
    // DB cache is the source of truth — mutations update it optimistically via onMutate
    const isFavorite = (id) => dbFavIds.includes(id)
    const toggleFavorite = (e, id) => {
        e.stopPropagation()
        if (!user?.id) {
            navigate(`/login?next=/location/${id}`)
            return
        }
        if (dbFavIds.includes(id)) {
            removeFav.mutate({ userId: user.id, locationId: id })
        } else {
            addFav.mutate({ userId: user.id, locationId: id })
        }
    }

    const saved = isFavorite(loc?.id)
    if (!loc) return null

    return (
        <div
            onClick={() => navigate(`/location/${loc.id}`)}
            className={`flex-shrink-0 w-[240px] rounded-card overflow-hidden cursor-pointer active:scale-[0.97] transition-transform duration-200 ${
                isDark
                    ? 'bg-[#1c1c1e] border border-white/8'
                    : 'bg-white border border-gray-100 shadow-[0_2px_16px_rgba(0,0,0,0.08)]'
            }`}
        >
            {/* Image */}
            <div className="relative h-[180px] overflow-hidden">
                <img
                    src={loc.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070&auto=format&fit=crop'}
                    alt={loc.title || 'Location'}
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                {/* Rating pill */}
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full">
                    <Star size={10} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-[11px] font-bold text-white">{loc.rating || '4.5'}</span>
                </div>

                {/* Trending badge */}
                {type === 'trending' && (
                    <div className="absolute top-3 right-3 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                        Trending
                    </div>
                )}

                {/* Favorite button — 44px touch target */}
                <button
                    onClick={(e) => toggleFavorite(e, loc.id)}
                    aria-label={saved ? 'Remove from saved' : 'Save place'}
                    className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center transition-all active:scale-90 hover:bg-black/60"
                >
                    <Heart
                        size={16}
                        className={saved ? 'text-red-400 fill-red-400' : 'text-white/90'}
                    />
                </button>
            </div>

            {/* Content */}
            <div className="px-4 py-3.5">
                <h4 className={`text-[14px] font-bold leading-tight truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {loc.title || 'Unknown Place'}
                </h4>
                {/* Subtitle: real data — cuisine + city, not a generic fallback */}
                <p className="text-[12px] text-gray-400 mt-0.5 truncate">
                    {[loc.cuisine, loc.city].filter(Boolean).join(' · ') || loc.category || ''}
                </p>

                {/* Footer row: best time icons + price + label chip */}
                <div className="flex items-center justify-between mt-2.5">
                    <div className="flex items-center gap-1.5">
                        {loc.best_time && loc.best_time.length > 0 && (
                            <div className="flex items-center gap-0.5">
                                {loc.best_time.includes('morning') && <Sunrise size={11} className="text-orange-400" />}
                                {loc.best_time.includes('day') && <Sun size={11} className="text-yellow-500" />}
                                {loc.best_time.includes('evening') && <Sunset size={11} className="text-orange-500" />}
                                {loc.best_time.includes('late_night') && <Sparkles size={11} className="text-indigo-400" />}
                            </div>
                        )}
                        {loc.special_labels?.[0] && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-600'
                            }`}>
                                {translate(loc.special_labels[0])}
                            </span>
                        )}
                    </div>
                    {/* Price level — key decision signal for users */}
                    {(loc.price_range || loc.price_level || loc.priceLevel) && (
                        <span className={`text-[11px] font-bold tracking-tight ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {loc.price_range ?? loc.price_level ?? loc.priceLevel}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── MAP CATEGORY CONFIG ──────────────────────────────────────────────────────

const MAP_CATEGORIES = [
    { name: 'All',         icon: MapPin,   emoji: '📍' },
    { name: 'Cafe',        icon: Coffee,   emoji: '☕' },
    { name: 'Restaurant',  icon: Utensils, emoji: '🍽️' },
    { name: 'Bar',         icon: Wine,     emoji: '🍸' },
    { name: 'Fine Dining', icon: Star,     emoji: '🎩' },
]

// ─── MAP DISCOVERY PANEL ─────────────────────────────────────────────────────

const MapDiscoveryPanel = ({ height = 'h-[calc(100vh-260px)]', setIsFilterOpen }) => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { t } = useTranslation()
    const { activeCategory, setCategory, filteredLocations } = useLocationsStore()
    const [mapSearch, setMapSearch] = useState('')
    const debouncedMapSearch = useDebounce(mapSearch, 300)

    useEffect(() => {
        useLocationsStore.getState().setSearchQuery(debouncedMapSearch)
    }, [debouncedMapSearch])

    useEffect(() => {
        return () => {
            useLocationsStore.getState().setSearchQuery('')
            useLocationsStore.getState().setCategory('All')
        }
    }, [])

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Search + filter */}
            <div className="flex gap-2">
                <div className={`flex-1 relative flex items-center h-12 px-4 rounded-input border transition-all ${
                    isDark ? 'bg-white/6 border-white/10' : 'bg-white border-gray-200 shadow-sm'
                }`}>
                    <SearchIcon size={16} className="text-blue-500 mr-3 flex-shrink-0" />
                    <input
                        type="text"
                        placeholder={t('dashboard.search_placeholder')}
                        value={mapSearch}
                        onChange={(e) => setMapSearch(e.target.value)}
                        className={`bg-transparent flex-1 outline-none text-[14px] font-medium placeholder:text-gray-400 ${isDark ? 'text-white' : 'text-gray-900'}`}
                    />
                    {mapSearch && (
                        <button onClick={() => setMapSearch('')} className="ml-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => setIsFilterOpen(true)}
                    aria-label="Open filters"
                    className={`w-12 h-12 flex-shrink-0 rounded-input flex items-center justify-center active:scale-95 transition-all ${
                        isDark ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20' : 'bg-blue-600 text-white shadow-sm'
                    }`}
                >
                    <SlidersHorizontal size={18} />
                </button>
            </div>

            {/* Category chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {MAP_CATEGORIES.map((cat) => {
                    const active = activeCategory === cat.name
                    return (
                        <button
                            key={cat.name}
                            onClick={() => setCategory(active && cat.name !== 'All' ? 'All' : cat.name)}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 min-h-11 rounded-pill text-[12px] font-semibold whitespace-nowrap transition-all ${
                                active
                                    ? 'bg-blue-600 text-white'
                                    : isDark
                                        ? 'bg-white/6 text-white/60 border border-white/10 hover:bg-white/10'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            <span>{cat.emoji}</span>
                            {cat.name}
                        </button>
                    )
                })}
            </div>

            {/* Map */}
            <div className={`relative ${height} rounded-card overflow-hidden ${isDark ? 'border border-white/6' : 'border border-gray-100 shadow-sm'}`}>
                <div className={`absolute top-3 left-3 z-[500] px-3 py-1.5 rounded-pill text-[11px] font-semibold backdrop-blur-md pointer-events-none ${
                    isDark ? 'bg-black/60 text-white/80 border border-white/15' : 'bg-white/90 text-gray-700 border border-gray-200/60'
                }`}>
                    {filteredLocations.length} place{filteredLocations.length !== 1 ? 's' : ''}
                </div>
                <MapTab />
            </div>
        </div>
    )
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────

const SectionHeader = ({ title, subtitle, onSeeAll, isDark }) => (
    <div className="flex justify-between items-end">
        <div>
            <h3 className={`text-[18px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {title}
            </h3>
            {subtitle && (
                <p className="text-[12px] text-gray-500 mt-0.5 font-medium">{subtitle}</p>
            )}
        </div>
        {onSeeAll && (
            <button
                onClick={onSeeAll}
                className="text-[13px] font-semibold text-blue-500 hover:text-blue-600 transition-colors min-h-11 flex items-center"
            >
                See all
            </button>
        )}
    </div>
)

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const DashboardPage = () => {
    const { t } = useTranslation()
    const { user: authUser } = useAuthStore()
    const user = authUser ?? null
    const { locations, filteredLocations } = useLocationsStore()
    const navigate = useNavigate()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const isLoading = useLocationsStore(s => s.isLoading)

    // Geo cover images from DB (admin-uploaded). Falls back to static map below.
    const { data: geoCoversData = [] } = useGeoCovers('country')
    const dbCoverMap = Object.fromEntries(geoCoversData.map(c => [c.slug, c.image_url]))

    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    const handleSelectCountry = (country) => {
        navigate(`/explore/${country.slug}`)
    }
    const debouncedSearch = useDebounce(searchQuery, 300)

    // ─── Ensure data is loaded when Dashboard mounts/remounts ──────────────────
    // The store is the single source of truth; initialize() only fetches if needed.
    // With the React Query select-callback race condition removed, isLoading
    // can no longer get stuck, so no defensive force-resets are required.
    useEffect(() => {
        const { isInitialized, locations, initialize } = useLocationsStore.getState()
        if (!isInitialized || locations.length === 0) {
            initialize()
        }
    }, [])

    // Pull-to-refresh
    const handleRefresh = async () => {
        await useLocationsStore.getState().reinitialize()
    }
    const { pullDistance, isRefreshing, progress, handlers: pullHandlers } = usePullToRefresh(handleRefresh)

    // Apply search to store when debounced value changes
    useEffect(() => {
        useLocationsStore.getState().setSearchQuery(debouncedSearch)
    }, [debouncedSearch])

    // DASH-3 FIX: countries are now derived from actual locations in the store
    // COUNTRY_IMAGES is defined at module level — no need to include in deps
    const countries = useMemo(() => {
        // Build from real DB data — aggregate unique countries with real location counts
        const countryMap = {}
        locations.forEach(loc => {
            const raw = loc.country ?? ''
            if (!raw) return
            const slug = raw.toLowerCase().replace(/\s+/g, '-')
            const name = raw.charAt(0).toUpperCase() + raw.slice(1)
            if (!countryMap[slug]) {
                countryMap[slug] = { name, slug, count: 0 }
            }
            countryMap[slug].count++
        })
        const dynamic = Object.values(countryMap).sort((a, b) => b.count - a.count)
        // Priority: 1) admin-uploaded DB image  2) static map  3) first location photo  4) Poland default
        return dynamic.map(c => ({
            ...c,
            image: dbCoverMap[c.slug]
                ?? COUNTRY_IMAGES[c.slug]
                ?? locations.find(l => l.country?.toLowerCase() === c.name.toLowerCase())?.photos?.[0]
                ?? COUNTRY_IMAGES.poland,
            newCount: c.count,
        }))
    }, [locations, dbCoverMap])

    const recommended = useMemo(
        () => [...filteredLocations].sort((a, b) => b.rating - a.rating).slice(0, 5),
        [filteredLocations]
    )

    const trending = useMemo(() => {
        const topIds = new Set(recommended.map(l => l.id))
        return [...filteredLocations].filter(l => !topIds.has(l.id)).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 5)
    }, [filteredLocations, recommended])

    const firstName = user?.name?.split(' ')[0] || 'there'
    const greeting = getGreeting(t)

    return (
        <PageTransition className="w-full max-w-7xl mx-auto flex flex-col relative z-0">
            <div data-testid="dashboard-page" className="contents">
                <FilterModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} theme={theme} />

                {/* ── MOBILE ── */}
                <div className="md:hidden" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 5rem)' }}>



                    {/* Greeting */}
                    <div className="px-5 mb-5">
                        <p className="text-[13px] font-medium text-gray-500 mb-0.5">{greeting}</p>
                        <h1 className={`text-[26px] font-bold tracking-tight leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {firstName} <span className="text-blue-600">✦</span>
                        </h1>
                    </div>

                    {/* Search + filter */}
                    <div className="px-5 mb-5 flex gap-2.5">
                        <div className={`flex-1 relative flex items-center h-[46px] px-4 rounded-[14px] transition-all ${
                            isDark
                                ? 'bg-white/8 border border-white/10'
                                : 'bg-gray-100/80'
                        }`}>
                            <SearchIcon size={16} className="text-gray-400 mr-3 flex-shrink-0" />
                            <input
                                type="text"
                                placeholder={t('dashboard.search_placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`bg-transparent flex-1 outline-none text-[14px] font-medium placeholder:text-gray-400 ${isDark ? 'text-white' : 'text-gray-900'}`}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="ml-2 text-gray-400">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setIsFilterOpen(true)}
                            aria-label="Open filters"
                            className={`w-[46px] h-[46px] flex-shrink-0 rounded-[14px] flex items-center justify-center active:scale-95 transition-all ${
                                isDark ? 'bg-blue-600/15 text-blue-400' : 'bg-blue-600 text-white'
                            }`}
                        >
                            <SlidersHorizontal size={17} />
                        </button>
                    </div>

                    {/* Pull-to-refresh indicator */}
                    <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={progress} />

                    {/* Feed content — map is available on separate MapPage */}
                    <div className="space-y-8 pb-14 px-5" {...pullHandlers}>
                        {/* Explore by Country */}
                        <div className="space-y-4">
                            <SectionHeader
                                title={t('dashboard.explore_countries')}
                                subtitle={t('dashboard.culinary_traditions')}
                                onSeeAll={() => navigate('/explore')}
                                isDark={isDark}
                            />
                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                                {countries.map((country) => (
                                    <button
                                        key={country.slug}
                                        onClick={() => handleSelectCountry(country)}
                                        aria-label={`Explore ${country.name}`}
                                        className="relative flex-shrink-0 w-[200px] h-[140px] rounded-card overflow-hidden snap-center active:scale-[0.97] transition-transform duration-200 text-left"
                                    >
                                        <img
                                            src={country.image}
                                            crossOrigin="anonymous"
                                            alt={country.name}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                        <div className="absolute top-2.5 right-2.5 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                                            {country.newCount} New
                                        </div>
                                        <div className="absolute bottom-3.5 left-4">
                                            <h4 className="text-[17px] font-bold text-white">{country.name}</h4>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Recommended */}
                        <div className="space-y-4">
                            <SectionHeader
                                title={t('dashboard.recommended')}
                                subtitle={t('dashboard.perfect_spots')}
                                onSeeAll={() => navigate('/explore')}
                                isDark={isDark}
                            />
                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                                {isLoading
                                    ? Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="snap-center flex-shrink-0">
                                            <DashboardCardSkeleton isDark={isDark} />
                                        </div>
                                    ))
                                    : recommended.length > 0
                                        ? recommended.map((loc) => (
                                            <div key={loc.id} className="snap-center">
                                                <LocationCardMobile loc={loc} type="recommended" />
                                            </div>
                                        ))
                                        : (
                                            /* Empty state — only shown after loading finishes */
                                            <div className={`w-full flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-card border ${
                                                isDark ? 'bg-white/[0.03] border-white/8' : 'bg-gray-50 border-gray-100'
                                            }`}>
                                                <div className="text-4xl">🍽️</div>
                                                <div className="text-center">
                                                    <p className={`text-[14px] font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>No places yet</p>
                                                    <p className="text-[12px] text-gray-400 mt-0.5">Be the first to add a spot</p>
                                                </div>
                                                <button
                                                    onClick={() => navigate('/dashboard/add-place')}
                                                    className="mt-1 px-4 py-2 rounded-pill bg-blue-600 text-white text-[12px] font-bold active:scale-95 transition-transform"
                                                >
                                                    + Add a place
                                                </button>
                                            </div>
                                        )
                                }
                            </div>
                        </div>

                        {/* Trending */}
                        <div className="space-y-4">
                            <SectionHeader
                                title={t('dashboard.trending')}
                                subtitle={t('dashboard.hot_spots')}
                                onSeeAll={() => navigate('/explore')}
                                isDark={isDark}
                            />
                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                                {isLoading
                                    ? Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="snap-center flex-shrink-0">
                                            <DashboardCardSkeleton isDark={isDark} />
                                        </div>
                                    ))
                                    : trending.map((loc) => (
                                        <div key={loc.id} className="snap-center">
                                            <LocationCardMobile loc={loc} type="trending" />
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── DESKTOP ── */}
                <div className="hidden md:flex flex-col px-[10px] pt-24 pb-6">
                    <DesktopDashboard
                        locations={locations}
                        recommended={recommended}
                        trending={trending}
                        authUser={user}
                        countries={countries}
                        theme={theme}
                        setIsFilterOpen={setIsFilterOpen}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        handleSelectCountry={handleSelectCountry}
                    />
                </div>
            </div>
        </PageTransition>
    )
}

// ─── DESKTOP DASHBOARD ────────────────────────────────────────────────────────

const DesktopDashboard = ({
    _locations, recommended, trending, authUser, countries, theme,
    setIsFilterOpen, searchQuery = '', setSearchQuery = () => {},
    handleSelectCountry,
}) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const isDark = theme === 'dark'
    const [activeTab, setActiveTab] = useState('overview')
    const greeting = getGreeting(t)
    const firstName = authUser?.name?.split(' ')[0] || 'there'

    const text = isDark ? 'text-white' : 'text-gray-900'
    const sub  = 'text-gray-500'

    const cardClass = isDark
        ? 'bg-[#1c1c1e] border border-white/8 rounded-sheet'
        : 'bg-white border border-gray-100 rounded-sheet shadow-[0_2px_20px_rgba(0,0,0,0.06)]'

    const itemVariants = {
        hidden:  { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
    }

    return (
        <div className="pb-20 max-w-6xl mx-auto w-full">

            {/* Hero */}
            <div className="mt-10 mb-8">
                <p className={`text-[15px] font-medium ${sub} mb-1`}>{greeting}</p>
                <h1 className={`text-[42px] font-bold tracking-tight leading-none mb-6 ${text}`}>
                    {firstName} <span className="text-blue-600">✦</span>
                </h1>

                {/* Search */}
                <div className="flex gap-3">
                    <div className={`relative flex-1 flex items-center h-[54px] px-5 rounded-[18px] transition-all ${
                        isDark
                            ? 'bg-white/8 border border-white/10 focus-within:border-white/20'
                            : 'bg-gray-100 focus-within:bg-white focus-within:border-gray-300 border border-transparent'
                    }`}>
                        <SearchIcon size={18} className="text-gray-400 mr-3 flex-shrink-0" />
                        <input
                            type="text"
                            placeholder={t('dashboard.search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`bg-transparent flex-1 outline-none text-[15px] font-medium placeholder:text-gray-400 ${isDark ? 'text-white' : 'text-gray-900'}`}
                        />
                    </div>
                    <button
                        onClick={() => navigate(searchQuery ? `/explore?q=${encodeURIComponent(searchQuery)}` : '/explore')}
                        className="h-[54px] px-7 rounded-[18px] bg-blue-600 text-white font-semibold text-[15px] hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm"
                    >
                        {t('dashboard.search_btn')}
                    </button>
                </div>
            </div>

            {/* Tab bar + filter */}
            <div className="flex items-center justify-between mb-6">
                <div className={`flex items-center p-1 rounded-[12px] gap-0.5 ${isDark ? 'bg-white/6' : 'bg-gray-100'}`}>
                    {['overview', 'map'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`relative px-6 py-2 rounded-[9px] text-[14px] font-semibold capitalize transition-all ${
                                activeTab === tab
                                    ? isDark
                                        ? 'bg-white/12 text-white shadow-sm'
                                        : 'bg-white text-gray-900 shadow-sm'
                                    : isDark
                                        ? 'text-white/40 hover:text-white/70'
                                        : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab === 'overview' ? 'Overview' : 'Map'}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setIsFilterOpen(true)}
                    className={`flex items-center gap-2 px-4 h-9 rounded-[10px] text-[13px] font-semibold transition-all active:scale-95 ${
                        isDark ? 'bg-white/8 text-white/70 hover:bg-white/12' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    <SlidersHorizontal size={15} />
                    Filters
                </button>
            </div>

            {/* Content */}
            {activeTab === 'map' ? (
                <MapDiscoveryPanel height="h-[calc(100vh-300px)]" setIsFilterOpen={setIsFilterOpen} />
            ) : (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
                    className="space-y-12"
                >
                    {/* Countries */}
                    <motion.div variants={itemVariants} className="space-y-5">
                        <SectionHeader
                            title={t('dashboard.explore_countries')}
                            subtitle={t('dashboard.culinary_traditions')}
                            isDark={isDark}
                        />
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {countries.map((country) => (
                                <button
                                    key={country.slug}
                                    onClick={() => handleSelectCountry(country)}
                                    aria-label={`Explore ${country.name}`}
                                    className="relative h-[180px] rounded-card overflow-hidden group cursor-pointer active:scale-[0.98] transition-transform duration-200 text-left"
                                >
                                    <img src={country.image} alt={country.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                    <div className="absolute top-3 right-3 bg-blue-600 text-white text-[9px] font-bold px-2.5 py-1 rounded-full">
                                        {country.newCount} New
                                    </div>
                                    <div className="absolute bottom-4 left-4">
                                        <h4 className="text-[18px] font-bold text-white mb-0.5">{country.name}</h4>
                                        <div className="flex items-center gap-1 text-white/60 text-[11px]">
                                            <MapPin size={10} />
                                            <span>Explore cities</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Recommended */}
                    <motion.div variants={itemVariants} className="space-y-5">
                        <SectionHeader
                            title={t('dashboard.recommended')}
                            subtitle={t('dashboard.perfect_spots')}
                            onSeeAll={() => navigate('/explore')}
                            isDark={isDark}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recommended.map((item) => (
                                <DesktopCard
                                    key={item.id}
                                    item={item}
                                    cardClass={cardClass}
                                    isDark={isDark}
                                    onClick={() => navigate(`/location/${item.id}`)}
                                />
                            ))}
                        </div>
                    </motion.div>

                    {/* Trending */}
                    <motion.div variants={itemVariants} className="space-y-5">
                        <SectionHeader
                            title={t('dashboard.trending')}
                            subtitle={t('dashboard.hot_spots')}
                            onSeeAll={() => navigate('/explore')}
                            isDark={isDark}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {trending.map((item) => (
                                <DesktopCard
                                    key={item.id}
                                    item={item}
                                    cardClass={cardClass}
                                    isDark={isDark}
                                    isTrending
                                    onClick={() => navigate(`/location/${item.id}`)}
                                />
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </div>
    )
}

// ─── DESKTOP CARD ─────────────────────────────────────────────────────────────

const DesktopCard = ({ item, cardClass, isDark, isTrending = false, onClick }) => (
    <div
        onClick={onClick}
        className={`${cardClass} overflow-hidden cursor-pointer group active:scale-[0.99] transition-transform duration-200`}
    >
        <div className="relative h-[220px] overflow-hidden">
            <img
                src={item.image}
                crossOrigin="anonymous"
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full">
                <Star size={10} className="text-yellow-400 fill-yellow-400" />
                <span className="text-[11px] font-bold text-white">{item.rating}</span>
            </div>
            {isTrending && (
                <div className="absolute top-3 right-3 bg-blue-600 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                    Trending
                </div>
            )}
            {item.best_time && item.best_time.length > 0 && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1 text-white/80">
                    {item.best_time.includes('morning')   && <Sunrise size={13} className="text-orange-300" />}
                    {item.best_time.includes('day')       && <Sun size={13} className="text-yellow-300" />}
                    {item.best_time.includes('evening')   && <Sunset size={13} className="text-orange-400" />}
                    {item.best_time.includes('late_night') && <Sparkles size={13} className="text-indigo-300" />}
                </div>
            )}
        </div>

        <div className="p-4">
            <h4 className={`text-[15px] font-semibold leading-tight truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {item.title}
            </h4>
            <p className="text-[12px] text-gray-500 mt-0.5 truncate">{item.subtitle}</p>
            {item.special_labels?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {item.special_labels.slice(0, 3).map(label => (
                        <span
                            key={label}
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                isDark ? 'bg-white/8 text-white/50' : 'bg-gray-100 text-gray-500'
                            }`}
                        >
                            {translate(label)}
                        </span>
                    ))}
                </div>
            )}
        </div>
    </div>
)

export default DashboardPage
