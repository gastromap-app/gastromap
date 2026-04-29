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
import LocationImage from '@/components/ui/LocationImage'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullRefreshIndicator } from '@/components/ui/PullRefreshIndicator'
import { SmartSearchBar } from '../components/SmartSearchBar'
import CategoryFilters from '../components/CategoryFilters'
import { useUserGeo } from '@/shared/hooks/useUserGeo'
import LazyImage from '@/components/ui/LazyImage'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getGreeting(t) {
    const h = new Date().getHours()
    if (h < 12) return t('dashboard.greeting_morning')
    if (h < 18) return t('dashboard.greeting_afternoon')
    return t('dashboard.greeting_evening')
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 999999
    
    // Convert string coordinates (e.g., from DB) to numbers safely
    const nLat1 = Number(String(lat1).replace(',', '.'))
    const nLon1 = Number(String(lon1).replace(',', '.'))
    const nLat2 = Number(String(lat2).replace(',', '.'))
    const nLon2 = Number(String(lon2).replace(',', '.'))
    
    if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return 999999

    const R = 6371 // Radius of the earth in km
    const dLat = (nLat2 - nLat1) * (Math.PI / 180)
    const dLon = (nLon2 - nLon1) * (Math.PI / 180)
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(nLat1 * (Math.PI / 180)) * Math.cos(nLat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c // Distance in km
    return d
}

const formatDistance = (dist) => {
    if (dist < 1) return `${Math.round(dist * 1000)} m`
    return `${dist.toFixed(1)} km`
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
    const { t } = useTranslation()
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

    const isNearby = type === 'nearby'

    return (
        <div
            onClick={() => navigate(`/location/${loc.id}`)}
            className={`flex-shrink-0 ${isNearby ? 'w-[140px]' : 'w-[240px]'} rounded-[16px] overflow-hidden cursor-pointer active:scale-[0.97] transition-transform duration-200 ${
                isDark
                    ? 'bg-[#1c1c1e] border border-white/8'
                    : 'bg-white border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)]'
            }`}
        >
            {/* Image */}
            <div className={`relative ${isNearby ? 'h-[100px]' : 'h-[180px]'} overflow-hidden`} >
                <LocationImage
                    src={loc.image}
                    alt={loc.title || 'Location'}
                    width={400}
                    className="transition-transform duration-300 group-hover:scale-105"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                {/* Rating pill */}
                <div className={`absolute ${isNearby ? 'top-2 left-2 px-2 py-0.5' : 'top-3 left-3 px-2.5 py-1'} flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-full`}>
                    <Star size={isNearby ? 8 : 10} className="text-yellow-400 fill-yellow-400" />
                    <span className={`${isNearby ? 'text-[10px]' : 'text-[11px]'} font-bold text-white`}>{loc.rating ?? loc.google_rating ?? '4.5'}</span>
                </div>

                {/* Trending badge */}
                {type === 'trending' && (
                    <div className="absolute top-3 right-3 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                        {t('dashboard.trending_badge')}
                    </div>
                )}

                {/* Distance Badge for Nearby */}
                {isNearby && loc._distance !== undefined && loc._distance !== Infinity && (
                    <div className="absolute bottom-2 left-2 bg-blue-500/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-0.5">
                        <MapPin size={8} />
                        {formatDistance(loc._distance)}
                    </div>
                )}

                {/* Favorite button — 44px touch target */}
                {!isNearby && (
                    <button
                        onClick={(e) => toggleFavorite(e, loc.id)}
                        aria-label={saved ? t('location.saved') : t('location.save')}
                        className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center transition-all active:scale-90 hover:bg-black/60"
                    >
                        <Heart
                            size={16}
                            className={saved ? 'text-red-400 fill-red-400' : 'text-white/90'}
                        />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className={isNearby ? 'px-3 py-2.5' : 'px-4 py-3.5'}>
                <h4 className={`font-bold leading-tight truncate ${isNearby ? 'text-[13px]' : 'text-[14px]'} ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {loc.title || 'Unknown Place'}
                </h4>
                {/* Subtitle: real data — cuisine + city, not a generic fallback */}
                <p className={`${isNearby ? 'text-[11px]' : 'text-[12px]'} mt-0.5 truncate ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                    {[loc.cuisine, loc.city].filter(Boolean).join(' · ') || loc.category || ''}
                </p>

                {/* Footer row: best time icons + price + label chip */}
                <div className={`flex items-center justify-between ${isNearby ? 'mt-1.5' : 'mt-2.5'}`}>
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
                    {loc.price_range && (
                        <span className={`text-[11px] font-bold tracking-tight ${isDark ? 'text-gray-400' : 'text-slate-700'}`}>
                            {loc.price_range}
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

    // Sync local search with store (e.g. if reset in modal)
    useEffect(() => {
        const storeSearch = useLocationsStore.getState().searchQuery
        if (storeSearch !== mapSearch && !debouncedMapSearch) {
            setMapSearch(storeSearch || '')
        }
    }, [useLocationsStore.getState().searchQuery])

    // NOTE: Do NOT reset store filters on unmount — user expects filters to persist
    // when switching between tabs/pages. Filters are only cleared explicitly via UI.

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Search + filter */}
            <SmartSearchBar
                value={mapSearch}
                onChange={(e) => setMapSearch(e.target.value)}
                onFilter={() => setIsFilterOpen(true)}
                placeholder={t('dashboard.search_placeholder')}
                className="w-full"
            />

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
                    {t('dashboard.places_count', { count: filteredLocations.length })}
                </div>
                <MapTab />
            </div>
        </div>
    )
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────

const SectionHeader = ({ title, subtitle, onSeeAll, isDark }) => {
    const { t } = useTranslation()
    return (
    <div className="flex justify-between items-end">
        <div>
            <h3 className={`text-[18px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {title}
            </h3>
            {subtitle && (
                <p className={`text-[12px] mt-0.5 font-medium ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>{subtitle}</p>
            )}
        </div>
        {onSeeAll && (
            <button
                onClick={onSeeAll}
                className="text-[13px] font-semibold text-blue-500 hover:text-blue-600 transition-colors min-h-11 flex items-center"
            >
                {t('dashboard.see_all')}
            </button>
        )}
    </div>
    )
}

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
    // FIX: Use reactive store subscription instead of getState() in render
    const storeSearchQuery = useLocationsStore(s => s.searchQuery)

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

    // Sync local search with store (e.g. if reset in modal) — now reactive
    useEffect(() => {
        if (storeSearchQuery !== searchQuery && !debouncedSearch) {
            setSearchQuery(storeSearchQuery || '')
        }
    }, [storeSearchQuery])

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
        () => [...filteredLocations].sort((a, b) => (b.rating ?? b.google_rating ?? 0) - (a.rating ?? a.google_rating ?? 0)).slice(0, 5),
        [filteredLocations]
    )

    // FIX: Trending now uses recency (created_at / updated_at) + rating, not just rating
    const trending = useMemo(() => {
        const topIds = new Set(recommended.map(l => l.id))
        const now = Date.now()
        const DAY = 86_400_000
        return [...filteredLocations]
            .filter(l => !topIds.has(l.id))
            .map(l => {
                const rating = l.rating ?? l.google_rating ?? 0
                const ts = new Date(l.updated_at || l.created_at || 0).getTime()
                const ageDays = Math.max(0, (now - ts) / DAY)
                // Score: higher rating + newer = trending. Decay by 0.1 per day.
                const score = rating * Math.max(0.1, 1 - ageDays * 0.02)
                return { ...l, _trendScore: score }
            })
            .sort((a, b) => b._trendScore - a._trendScore)
            .slice(0, 5)
    }, [filteredLocations, recommended])

    const firstName = user?.name?.split(' ')[0] || 'there'
    const greeting = getGreeting(t)

    // ─── NEW SECTIONS LOGIC ───────────────────────────────────────────────
    
    // 1. Nearby Locations (Sorted by distance if location exists)
    const { lat: geoLat, lng: geoLng, status: geoStatus, requestGeo } = useUserGeo({ autoRequest: true })
    
    // Sync geo location to store
    useEffect(() => {
        if (geoLat && geoLng) {
            useLocationsStore.getState().setUserLocation({ lat: geoLat, lng: geoLng })
        }
    }, [geoLat, geoLng])
    
    const nearbyLocations = useMemo(() => {
        if (!geoLat || !geoLng || !filteredLocations.length) return []
        
        const withDistance = filteredLocations
            .map(loc => {
                let dist = loc.distance
                if (dist == null) {
                    const lat = loc.lat ?? loc.latitude ?? loc.coordinates?.lat
                    const lng = loc.lng ?? loc.longitude ?? loc.coordinates?.lng
                    dist = (lat != null && lng != null) ? calculateDistance(geoLat, geoLng, lat, lng) : Infinity
                }
                return { ...loc, _distance: dist }
            })
            .filter(loc => loc._distance <= 1) // strictly 1 km radius
            .sort((a, b) => a._distance - b._distance)

        return withDistance.slice(0, 10)
    }, [filteredLocations, geoLat, geoLng])

    // 2. Open Now Locations
    const openNowLocations = useMemo(() => {
        const isLocOpen = (openingHours) => {
            if (!openingHours) return true 
            try {
                const now = new Date()
                const currentTime = now.getHours() * 60 + now.getMinutes()
                const parts = openingHours.split('-').map(p => p.trim())
                if (parts.length !== 2) return true
                const parseTime = (t) => {
                    const [h, m] = t.split(':').map(Number)
                    return h * 60 + m
                }
                const start = parseTime(parts[0])
                const end = parseTime(parts[1])
                if (end < start) return currentTime >= start || currentTime <= end
                return currentTime >= start && currentTime <= end
            } catch (e) { return true }
        }

        return filteredLocations
            .filter(loc => isLocOpen(loc.openingHours || loc.hours))
            .slice(0, 10)
    }, [filteredLocations])

    return (
        <PageTransition className="w-full max-w-7xl mx-auto flex flex-col relative z-0">
            <div data-testid="dashboard-page" className="contents">
                <FilterModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} theme={theme} />

                {/* ── MOBILE ── */}
                <div className="md:hidden" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 5rem)' }}>



                    {/* Greeting */}
                    <div className="px-5 mb-5">
                        <p className={`text-[13px] font-medium mb-0.5 ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>{greeting}</p>
                        <h1 className={`text-[26px] font-bold tracking-tight leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {firstName} <span className="text-blue-600">✦</span>
                        </h1>
                    </div>

                    {/* Search + filter */}
                    <div className="px-5 mb-5 space-y-5">
                        <SmartSearchBar
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFilter={() => setIsFilterOpen(true)}
                            placeholder={t('dashboard.search_placeholder')}
                        />
                        
                        {/* Quick Filters Component */}
                        <CategoryFilters isDark={isDark} />
                    </div>

                    {/* Pull-to-refresh indicator */}
                    <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={progress} />

                    {/* Feed content — map is available on separate MapPage */}
                    <div className="space-y-8 pb-14 px-5" {...pullHandlers}>
                        {/* Nearby Locations */}
                        <div className="space-y-4">
                            <SectionHeader
                                title={t('dashboard.nearby_locations', 'Locations Nearby')}
                                subtitle={t('dashboard.within_distance', 'Within 1 km')}
                                onSeeAll={() => {
                                    useLocationsStore.getState().setRadius(1)
                                    navigate('/explore')
                                }}
                                isDark={isDark}
                            />
                            
                            {(geoStatus === 'loading' || geoStatus === 'idle' || isLoading) ? (
                                <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="snap-center flex-shrink-0">
                                            <DashboardCardSkeleton isDark={isDark} />
                                        </div>
                                    ))}
                                </div>
                            ) : geoStatus === 'denied' || geoStatus === 'error' ? (
                                <div className={`w-full flex flex-col items-center justify-center gap-3 py-6 px-6 rounded-card border ${isDark ? 'bg-white/[0.03] border-white/8' : 'bg-gray-50 border-gray-100'}`}>
                                    <MapPin className={isDark ? "text-gray-500" : "text-gray-400"} size={24} />
                                    <div className="text-center">
                                        <p className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dashboard.location_needed', 'Location Access Needed')}</p>
                                        <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{t('dashboard.location_desc', 'Please allow location access to see places near you.')}</p>
                                    </div>
                                    <button onClick={requestGeo} className="mt-1 px-4 py-2 rounded-pill bg-blue-600 text-white text-[12px] font-bold active:scale-95 transition-transform">
                                        {t('dashboard.enable_location', 'Enable Location')}
                                    </button>
                                </div>
                            ) : nearbyLocations.length > 0 ? (
                                <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                                    {nearbyLocations.map((loc) => (
                                        <div key={loc.id} className="snap-center">
                                            <LocationCardMobile loc={loc} type="nearby" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={`w-full flex flex-col items-center justify-center gap-3 py-6 px-6 rounded-card border ${isDark ? 'bg-white/[0.03] border-white/8' : 'bg-gray-50 border-gray-100'}`}>
                                    <MapPin className={isDark ? "text-gray-600" : "text-gray-300"} size={28} />
                                    <div className="text-center">
                                        <p className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dashboard.no_nearby_places', 'No Places Nearby')}</p>
                                        <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{t('dashboard.no_nearby_desc', 'There are no places within 1km of your current location.')}</p>
                                    </div>
                                </div>
                            )}
                        </div>

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
                                        aria-label={t('dashboard.explore_country_aria', { country: country.name })}
                                        className="relative flex-shrink-0 w-[200px] h-[140px] rounded-card overflow-hidden snap-center active:scale-[0.97] transition-transform duration-200 text-left"
                                    >
                                        <LazyImage
                                            src={country.image}
                                            alt={country.name}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                        <div className="absolute top-2.5 right-2.5 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                                            {t('dashboard.new_badge', { count: country.newCount })}
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
                                                    <p className={`text-[14px] font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dashboard.empty_title')}</p>
                                                    <p className={`text-[12px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{t('dashboard.empty_desc')}</p>
                                                </div>
                                                <button
                                                    onClick={() => navigate('/dashboard/add-place')}
                                                    className="mt-1 px-4 py-2 rounded-pill bg-blue-600 text-white text-[12px] font-bold active:scale-95 transition-transform"
                                                >
                                                    + {t('dashboard.empty_cta')}
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

                        {/* Open Now */}
                        {openNowLocations.length > 0 && (
                            <div className="space-y-4">
                                <SectionHeader
                                    title={t('dashboard.open_now')}
                                    subtitle={t('dashboard.currently_serving')}
                                    onSeeAll={() => {
                                        useLocationsStore.getState().setIsOpenNow(true)
                                        navigate('/explore')
                                    }}
                                    isDark={isDark}
                                />
                                <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                                    {openNowLocations.map((loc) => (
                                        <div key={loc.id} className="snap-center">
                                            <LocationCardMobile loc={loc} type="open_now" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── DESKTOP ── */}
                <div className="hidden md:flex flex-col px-[10px] pt-24 pb-6">
                    <DesktopDashboard
                        locations={locations}
                        recommended={recommended}
                        trending={trending}
                        nearbyLocations={nearbyLocations}
                        geoStatus={geoStatus}
                        requestGeo={requestGeo}
                        openNowLocations={openNowLocations}
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
    _locations, recommended, trending, nearbyLocations = [], openNowLocations = [],
    geoStatus, requestGeo,
    authUser, countries, theme,
    setIsFilterOpen, searchQuery = '', setSearchQuery = () => {},
    handleSelectCountry,
}) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const isLoading = useLocationsStore(s => s.isLoading)
    const isDark = theme === 'dark'
    const [activeTab, setActiveTab] = useState('overview')
    const greeting = getGreeting(t)
    const firstName = authUser?.name?.split(' ')[0] || 'there'

    const text = isDark ? 'text-[hsl(220,20%,96%)]' : 'text-gray-900'
    const sub  = isDark ? 'text-[hsl(220,10%,55%)]' : 'text-gray-500'

    const cardClass = isDark
        ? 'bg-[hsl(220,20%,6%)] border border-white/[0.06] rounded-sheet'
        : 'bg-white border border-slate-200/70 rounded-sheet shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_28px_rgba(15,23,42,0.06)]'

    const itemVariants = {
        hidden:  { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
    }

    return (
        <div className="pb-20 max-w-6xl mx-auto w-full">

            {/* Hero */}
            <div className="mt-10 mb-8 relative">
                {/* Blue glow behind hero */}
                {isDark && (
                    <div className="absolute -top-10 -left-10 w-[300px] h-[200px] bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />
                )}
                <p className={`text-[15px] font-medium ${sub} mb-1 relative`}>{greeting}</p>
                <h1 className={`text-[42px] font-bold tracking-tight leading-none mb-6 ${text} relative`}>
                    {firstName} <span className="text-blue-500">✦</span>
                </h1>

                {/* Search + Filters */}
                <div className="mb-8 space-y-6">
                    <div className="max-w-2xl">
                        <SmartSearchBar
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFilter={() => setIsFilterOpen(true)}
                            placeholder={t('dashboard.search_placeholder')}
                        />
                    </div>
                    
                    {/* Quick Filters */}
                    <CategoryFilters isDark={isDark} />
                </div>
            </div>

            {/* Tab bar + filter */}
            <div className="flex items-center justify-between mb-6">
                <div className={`flex items-center p-1 rounded-[12px] gap-0.5 ${isDark ? 'bg-white/[0.04]' : 'bg-gray-100'}`}>
                    {['overview', 'map'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`relative px-6 py-2 rounded-[9px] text-[14px] font-semibold capitalize transition-all ${
                                activeTab === tab
                                    ? isDark
                                        ? 'bg-white/[0.08] text-[hsl(220,20%,96%)] shadow-sm'
                                        : 'bg-white text-gray-900 shadow-sm'
                                    : isDark
                                        ? 'text-[hsl(220,10%,55%)] hover:text-[hsl(220,20%,96%)]'
                                        : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab === 'overview' ? t('dashboard.tab_overview') : t('dashboard.tab_map')}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setIsFilterOpen(true)}
                    className={`flex items-center gap-2 px-4 h-9 rounded-[10px] text-[13px] font-semibold transition-all active:scale-95 ${
                        isDark ? 'bg-white/[0.04] text-[hsl(220,10%,55%)] hover:bg-white/[0.08] hover:text-[hsl(220,20%,96%)]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    <SlidersHorizontal size={15} />
                    {t('dashboard.filters')}
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
                    {/* Nearby Locations */}
                    <motion.div variants={itemVariants} className="space-y-5 pb-8 border-b border-white/[0.05]">
                        <SectionHeader
                            title={t('dashboard.nearby_locations', 'Locations Nearby')}
                            subtitle={t('dashboard.within_distance', 'Within 1 km')}
                            onSeeAll={() => {
                                useLocationsStore.getState().setRadius(1)
                                navigate('/explore')
                            }}
                            isDark={isDark}
                        />
                        
                        {(geoStatus === 'loading' || geoStatus === 'idle' || isLoading) ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <DashboardCardSkeleton key={i} isDark={isDark} />
                                ))}
                            </div>
                        ) : geoStatus === 'denied' || geoStatus === 'error' ? (
                            <div className={`w-full flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-sheet border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                <MapPin className={isDark ? "text-gray-500" : "text-gray-400"} size={28} />
                                <div className="text-center">
                                    <p className={`text-[15px] font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dashboard.location_needed', 'Location Access Needed')}</p>
                                    <p className={`text-[13px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{t('dashboard.location_desc', 'Please allow location access to see places near you.')}</p>
                                </div>
                                <button onClick={requestGeo} className="mt-3 px-5 py-2.5 rounded-pill bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-bold active:scale-95 transition-all">
                                    {t('dashboard.enable_location', 'Enable Location')}
                                </button>
                            </div>
                        ) : nearbyLocations.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {nearbyLocations.slice(0, 3).map((item) => (
                                    <DesktopCard
                                        key={item.id}
                                        item={item}
                                        cardClass={cardClass}
                                        isDark={isDark}
                                        type="nearby"
                                        onClick={() => navigate(`/location/${item.id}`)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className={`w-full flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-sheet border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                <MapPin className={isDark ? "text-gray-600" : "text-gray-300"} size={32} />
                                <div className="text-center">
                                    <p className={`text-[15px] font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('dashboard.no_nearby_places', 'No Places Nearby')}</p>
                                    <p className={`text-[13px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{t('dashboard.no_nearby_desc', 'There are no places within 1km of your current location.')}</p>
                                </div>
                            </div>
                        )}
                    </motion.div>

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
                                    aria-label={t('dashboard.explore_country_aria', { country: country.name })}
                                    className="relative h-[180px] rounded-card overflow-hidden group cursor-pointer active:scale-[0.98] transition-transform duration-200 text-left"
                                >
                                    <LocationImage
                                        src={country.image}
                                        alt={country.name}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        width={400}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                    <div className="absolute top-3 right-3 bg-blue-600 text-white text-[9px] font-bold px-2.5 py-1 rounded-full">
                                        {t('dashboard.new_badge', { count: country.newCount })}
                                    </div>
                                    <div className="absolute bottom-4 left-4">
                                        <h4 className="text-[18px] font-bold text-white mb-0.5">{country.name}</h4>
                                        <div className="flex items-center gap-1 text-white/60 text-[11px]">
                                            <MapPin size={10} />
                                            <span>{t('dashboard.explore_cities')}</span>
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

                    {/* Open Now */}
                    {openNowLocations.length > 0 && (
                        <motion.div variants={itemVariants} className="space-y-5 pt-8 border-t border-white/[0.05]">
                            <SectionHeader
                                title={t('dashboard.open_now')}
                                subtitle={t('dashboard.currently_serving')}
                                onSeeAll={() => {
                                    useLocationsStore.getState().setIsOpenNow(true)
                                    navigate('/explore')
                                }}
                                isDark={isDark}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {openNowLocations.slice(0, 3).map((item) => (
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
                    )}
                </motion.div>
            )}
        </div>
    )
}

// ─── DESKTOP CARD ─────────────────────────────────────────────────────────────

const DesktopCard = ({ item, cardClass, isDark, isTrending = false, type, onClick }) => {
    const isNearby = type === 'nearby'

    if (isNearby) {
        return (
            <div
                onClick={onClick}
                className={`${cardClass} flex overflow-hidden cursor-pointer group active:scale-[0.99] transition-transform duration-200 h-[100px] border ${isDark ? 'border-white/5 bg-[#1c1c1e]' : 'border-slate-200/60 bg-white'} rounded-[16px]`}
            >
                <div className="relative w-[110px] shrink-0 overflow-hidden">
                    <LocationImage
                        src={item.image}
                        alt={item.title}
                        width={200}
                        className="transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-md px-1.5 py-0.5 rounded-full">
                        <Star size={8} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-[9px] font-bold text-white">{item.rating ?? item.google_rating}</span>
                    </div>
                </div>
                <div className="p-3 flex flex-col justify-center overflow-hidden w-full">
                    <h4 className={`text-[14px] font-semibold leading-tight truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {item.title}
                    </h4>
                    <p className={`text-[11px] mt-0.5 truncate ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>
                        {[item.cuisine, item.city].filter(Boolean).join(' · ') || item.category || ''}
                    </p>
                    {item._distance !== undefined && (
                        <div className={`mt-1.5 text-[11px] font-medium flex items-center gap-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                            <MapPin size={10} />
                            {item._distance < 1 ? `${Math.round(item._distance * 1000)} m` : `${item._distance.toFixed(1)} km`}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
    <div
        onClick={onClick}
        className={`${cardClass} overflow-hidden cursor-pointer group active:scale-[0.99] transition-transform duration-200`}
    >
        <div className="relative h-[220px] overflow-hidden">
            <LocationImage
                src={item.image}
                alt={item.title}
                width={800}
                className="transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
            <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full">
                <Star size={10} className="text-yellow-400 fill-yellow-400" />
                <span className="text-[11px] font-bold text-white">{item.rating ?? item.google_rating}</span>
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
            <p className={`text-[12px] mt-0.5 truncate ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>{item.subtitle}</p>
            {item.special_labels?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {item.special_labels.slice(0, 3).map(label => (
                        <span
                            key={label}
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                isDark ? 'bg-white/8 text-white/60' : 'bg-slate-100 text-slate-700'
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
}

export default DashboardPage
