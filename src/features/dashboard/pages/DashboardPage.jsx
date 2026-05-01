import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useGeoStore } from '@/shared/store/useGeoStore'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useAddFavoriteMutation, useRemoveFavoriteMutation, useUserFavorites, useGeoCovers } from '@/shared/api/queries'
import { useNavigate } from 'react-router-dom'
import { 
    Search, MapPin, TrendingUp, Star, Clock, Heart, 
    Sparkles, ChevronRight, Award, Trophy, Filter,
    Navigation, Bell, Settings, Share2, Plus, Info,
    Sunrise, Sun, Sunset, Utensils, Coffee, Wine, X,
    SlidersHorizontal
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { PageTransition } from '@/components/ui/PageTransition'
import { translate } from '@/utils/translation'
import { DashboardCardSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { useDebounce } from '@/hooks/useDebounce'
import { useTranslation } from 'react-i18next'
import LocationImage from '@/components/ui/LocationImage'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullRefreshIndicator } from '@/components/ui/PullRefreshIndicator'
import { SmartSearchBar } from '../components/SmartSearchBar'
import CategoryFilters from '../components/CategoryFilters'
import { useUserGeo } from '@/shared/hooks/useUserGeo'
import LazyImage from '@/components/ui/LazyImage'
import ManifestoSection from '../components/ManifestoSection'
import FilterModal from '../components/FilterModal'

const MapTab = React.lazy(() => import('../components/MapTab'))

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────

// DesktopDashboard and DesktopCard are defined at the bottom of this file.

const LocationCardMobile = ({ location, onClick, type }) => {
    return (
        <button 
            onClick={onClick}
            className={`flex-shrink-0 ${type === 'nearby' ? 'w-[140px]' : 'w-[240px]'} bg-white dark:bg-gray-900 rounded-[16px] overflow-hidden border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-all`}
        >
            <div className={`h-[120px] w-full bg-gray-200 dark:bg-gray-700`}>
                <img src={location.image} alt={location.title} className="h-full w-full object-cover" />
            </div>
            <div className="p-3 text-left">
                <h3 className="font-bold text-gray-900 dark:text-white truncate text-sm">{location.title}</h3>
                <p className="text-xs text-gray-500 truncate mt-1">{location.city}</p>
            </div>
        </button>
    )
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getGreeting(t, name, city, visitCount) {
    const h = new Date().getHours()
    if (visitCount > 1 && city && city !== 'Unknown') {
        return t('dashboard.welcome_back', { name, city }) || `Hello ${name}! Happy to see you back in ${city}!`
    }
    const timeGreeting = h < 12 ? t('dashboard.greeting_morning') : (h < 18 ? t('dashboard.greeting_afternoon') : t('dashboard.greeting_evening'))
    if (city && city !== 'Unknown') return `${timeGreeting}, ${city}`
    return timeGreeting
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 999999
    const nLat1 = Number(String(lat1).replace(',', '.'))
    const nLon1 = Number(String(lon1).replace(',', '.'))
    const nLat2 = Number(String(lat2).replace(',', '.'))
    const nLon2 = Number(String(lon2).replace(',', '.'))
    if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return 999999
    const R = 6371 
    const dLat = (nLat2 - nLat1) * (Math.PI / 180)
    const dLon = (nLon2 - nLon1) * (Math.PI / 180)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(nLat1 * (Math.PI / 180)) * Math.cos(nLat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

const formatDistance = (dist) => {
    if (dist < 1) return `${Math.round(dist * 1000)} m`
    return `${dist.toFixed(1)} km`
}

const COUNTRY_IMAGES = {
    poland: 'https://images.unsplash.com/photo-1519197924294-4ba991a11128?q=80&w=2069&auto=format&fit=crop',
    france: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2073&auto=format&fit=crop',
    spain: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?q=80&w=2070&auto=format&fit=crop',
    italy: 'https://images.unsplash.com/photo-1529543544282-ea669407fca3?q=80&w=2048&auto=format&fit=crop',
    germany: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2070&auto=format&fit=crop',
    portugal: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?q=80&w=2070&auto=format&fit=crop',
    netherlands: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?q=80&w=2070&auto=format&fit=crop',
    czechia: 'https://images.unsplash.com/photo-1541849546-216549ae216d?q=80&w=2070&auto=format&fit=crop',
}

const MAP_CATEGORIES = [
    { name: 'All', icon: MapPin, emoji: '📍' },
    { name: 'Cafe', icon: Coffee, emoji: '☕' },
    { name: 'Restaurant', icon: Utensils, emoji: '🍽️' },
    { name: 'Bar', icon: Wine, emoji: '🍸' },
    { name: 'Fine Dining', icon: Star, emoji: '🎩' },
]

const SectionHeader = ({ title, subtitle, onSeeAll, isDark }) => {
    const { t } = useTranslation()
    return (
        <div className="flex justify-between items-end">
            <div>
                <h3 className={`text-[18px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
                {subtitle && <p className={`text-[12px] mt-0.5 font-medium ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>{subtitle}</p>}
            </div>
            {onSeeAll && <button onClick={onSeeAll} className="text-[13px] font-semibold text-blue-500 hover:text-blue-600 transition-colors">{t('dashboard.see_all')}</button>}
        </div>
    )
}

const FooterDisclaimer = ({ isDark }) => {
    const { t } = useTranslation()
    return (
        <div className="mt-12 mb-8 px-4 text-center">
            <p className={`text-[10px] leading-relaxed opacity-50 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{t('dashboard.test_mode_disclaimer')}</p>
        </div>
    )
}

const DashboardPage = () => {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const { locations, filteredLocations, isLoading, initialize } = useLocationsStore()
    const navigate = useNavigate()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { city: currentCity = 'Unknown', visitCount = 0 } = useGeoStore()
    const { lat: geoLat, lng: geoLng, status: geoStatus, requestGeo } = useUserGeo({ autoRequest: true })

    const { data: geoCoversData = [] } = useGeoCovers('country')
    const dbCoverMap = Object.fromEntries(geoCoversData.map(c => [c.slug, c.image_url]))

    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearch = useDebounce(searchQuery, 300)
    const storeSearchQuery = useLocationsStore(state => state.searchQuery)

    useEffect(() => {
        if (!useLocationsStore.getState().isInitialized) initialize()
    }, [])

    useEffect(() => {
        if (geoLat && geoLng) useLocationsStore.getState().setUserLocation({ lat: geoLat, lng: geoLng })
    }, [geoLat, geoLng])

    // Sync search input with store
    useEffect(() => {
        useLocationsStore.getState().setSearchQuery(debouncedSearch)
    }, [debouncedSearch])

    useEffect(() => {
        if (storeSearchQuery !== searchQuery && !debouncedSearch) {
            setSearchQuery(storeSearchQuery || '')
        }
    }, [storeSearchQuery])

    // Pull-to-refresh
    const handleRefresh = async () => {
        await useLocationsStore.getState().reinitialize()
    }
    const { pullDistance, isRefreshing, progress, handlers: pullHandlers } = usePullToRefresh(handleRefresh)

    const countries = useMemo(() => {
        const countryMap = {}
        locations.forEach(loc => {
            const raw = loc.country ?? ''
            if (!raw) return
            const slug = raw.toLowerCase().replace(/\s+/g, '-')
            const name = raw.charAt(0).toUpperCase() + raw.slice(1)
            if (!countryMap[slug]) countryMap[slug] = { name, slug, count: 0 }
            countryMap[slug].count++
        })
        return Object.values(countryMap).map(c => ({
            ...c,
            image: dbCoverMap[c.slug] ?? COUNTRY_IMAGES[c.slug] ?? COUNTRY_IMAGES.poland,
            newCount: c.count,
        }))
    }, [locations, dbCoverMap])

    const nearbyLocations = useMemo(() => {
        if (!geoLat || !geoLng) return []
        return filteredLocations
            .map(loc => ({ ...loc, _dist: calculateDistance(geoLat, geoLng, loc.lat, loc.lng) }))
            .filter(l => l._dist < 10)
            .sort((a, b) => a._dist - b._dist)
    }, [filteredLocations, geoLat, geoLng])

    // ── Missing variables for mobile & desktop layouts ──────────────────────
    const text = isDark ? 'text-white' : 'text-gray-900'
    const sub  = isDark ? 'text-gray-500' : 'text-slate-600'
    const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || t('dashboard.traveler')
    const greeting = useMemo(() => {
        const hour = new Date().getHours()
        if (hour < 12) return t('dashboard.greeting_morning', { name: firstName })
        if (hour < 18) return t('dashboard.greeting_afternoon', { name: firstName })
        return t('dashboard.greeting_evening', { name: firstName })
    }, [firstName, t])
    const [activeTab, setActiveTab] = useState('all')
    const handleSelectCountry = useCallback((country) => {
        useLocationsStore.getState().setCountry(country.name)
        navigate('/explore')
    }, [navigate])
    const recommended = useMemo(() => {
        return [...filteredLocations]
            .sort((a, b) => (b.google_rating || b.rating || 0) - (a.google_rating || a.rating || 0))
            .slice(0, 10)
    }, [filteredLocations])
    const trending = useMemo(() => {
        return [...filteredLocations]
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            .slice(0, 10)
    }, [filteredLocations])
    const openNowLocations = useMemo(() => {
        return filteredLocations.filter(loc => {
            if (!loc.opening_hours) return false
            // Simple open-now check: look for current day in opening_hours string
            const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
            const today = days[new Date().getDay()]
            return loc.opening_hours.toLowerCase().includes(today)
        })
    }, [filteredLocations])

    return (
        <PageTransition className="w-full max-w-7xl mx-auto flex flex-col relative z-0">
            <FilterModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} theme={theme} />

            {/* ── Mobile Layout ─────────────────────────────────────────────── */}
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
                    <CategoryFilters isDark={isDark} />
                </div>

                {/* Pull-to-refresh indicator */}
                <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={progress} />

                {/* Feed content */}
                <div className="space-y-6 pb-10 px-5" {...pullHandlers}>
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
                        {(geoStatus === 'loading' || geoStatus === 'idle' || (isLoading && nearbyLocations.length === 0)) ? (
                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="snap-center flex-shrink-0">
                                        <DashboardCardSkeleton isDark={isDark} />
                                    </div>
                                ))}
                            </div>
                        ) : geoStatus === 'denied' || geoStatus === 'error' ? (
                            <div className={`w-full flex flex-col items-center justify-center gap-3 py-6 px-6 rounded-card border ${isDark ? 'bg-white/[0.03] border-slate-200/20' : 'bg-white border-slate-200/50 shadow-sm'}`}>
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
                                        <LocationCardMobile location={loc} type="nearby" onClick={() => navigate(`/location/${loc.id}`)} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={`w-full flex flex-col items-center justify-center gap-3 py-6 px-6 rounded-card border ${isDark ? 'bg-white/[0.03] border-slate-200/20' : 'bg-white border-slate-200/50 shadow-sm'}`}>
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
                            title={currentCity && currentCity !== 'Unknown'
                                ? t('dashboard.recommended_in_city', { city: currentCity }) || `Top Picks in ${currentCity}`
                                : t('dashboard.recommended')}
                            subtitle={t('dashboard.perfect_spots')}
                            onSeeAll={() => navigate('/explore')}
                            isDark={isDark}
                        />
                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                            {(isLoading && recommended.length === 0)
                                ? Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="snap-center flex-shrink-0">
                                        <DashboardCardSkeleton isDark={isDark} />
                                    </div>
                                ))
                                : recommended.length > 0
                                    ? recommended.map((loc) => (
                                        <div key={loc.id} className="snap-center">
                                            <LocationCardMobile location={loc} type="recommended" onClick={() => navigate(`/location/${loc.id}`)} />
                                        </div>
                                    ))
                                    : (
                                        <div className={`w-full flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-card border ${
                                            isDark ? 'bg-white/[0.03] border-slate-200/20' : 'bg-white border-slate-200/50 shadow-sm'
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
                            title={currentCity && currentCity !== 'Unknown'
                                ? t('dashboard.trending_in_city', { city: currentCity }) || `Trending in ${currentCity}`
                                : t('dashboard.trending')}
                            subtitle={t('dashboard.hot_spots')}
                            onSeeAll={() => navigate('/explore')}
                            isDark={isDark}
                        />
                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                            {(isLoading && trending.length === 0)
                                ? Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="snap-center flex-shrink-0">
                                        <DashboardCardSkeleton isDark={isDark} />
                                    </div>
                                ))
                                : trending.map((loc) => (
                                    <div key={loc.id} className="snap-center">
                                        <LocationCardMobile location={loc} type="trending" onClick={() => navigate(`/location/${loc.id}`)} />
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
                            <div className="flex gap-4 overflow-x-auto pb-6 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                                {openNowLocations.slice(0, 5).map((loc) => (
                                    <div key={loc.id} className="snap-center">
                                        <LocationCardMobile location={loc} type="nearby" onClick={() => navigate(`/location/${loc.id}`)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <ManifestoSection isDark={isDark} />
                    <FooterDisclaimer isDark={isDark} />
                </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:block">
                    <DesktopDashboard
                        isDark={isDark}
                        text={text}
                        sub={sub}
                        greeting={greeting}
                        firstName={firstName}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        setIsFilterOpen={setIsFilterOpen}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        geoStatus={geoStatus}
                        isLoading={isLoading}
                        requestGeo={requestGeo}
                        nearbyLocations={nearbyLocations}
                        countries={countries}
                        handleSelectCountry={handleSelectCountry}
                        recommended={recommended}
                        trending={trending}
                        openNowLocations={openNowLocations}
                        navigate={navigate}
                        t={t}
                        visitCount={visitCount || 0}
                        currentCity={currentCity || 'Unknown'}
                    />
                </div>
        </PageTransition>
    )
}

// ─── DESKTOP DASHBOARD ─────────────────────────────────────────────────────────

const DesktopDashboard = ({
    isDark, text, sub, greeting, firstName,
    searchQuery, setSearchQuery, setIsFilterOpen,
    activeTab, setActiveTab, geoStatus, isLoading,
    requestGeo, nearbyLocations, countries, handleSelectCountry,
    recommended, trending, openNowLocations, navigate, t,
    visitCount = 0, currentCity = 'Unknown'
}) => {
    const cardClass = isDark
        ? 'bg-[hsl(220,20%,6%)] border border-white/[0.06] rounded-sheet'
        : 'bg-white border border-slate-200/50 rounded-sheet shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_28px_rgba(15,23,42,0.06)]'

    const itemVariants = {
        hidden:  { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
    }

    return (
        <div className="pb-20 max-w-6xl mx-auto w-full px-4">

            {/* Hero */}
            <div className="mt-8 mb-6 relative">
                {/* Blue glow behind hero */}
                {isDark && (
                    <div className="absolute -top-10 -left-10 w-[300px] h-[200px] bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />
                )}
                {visitCount > 1 && currentCity && currentCity !== 'Unknown' ? (
                    <h1 className={`text-[32px] font-bold tracking-tight leading-tight mb-5 ${text} relative`}>
                        {greeting} <span className="text-blue-500">✦</span>
                    </h1>
                ) : (
                    <>
                        <p className={`text-[15px] font-medium ${sub} mb-0.5 relative`}>{greeting}</p>
                        <h1 className={`text-[40px] font-bold tracking-tight leading-none mb-5 ${text} relative`}>
                            {firstName} <span className="text-blue-500">✦</span>
                        </h1>
                    </>
                )}

                {/* Search + Filters */}
                <div className="mb-6 space-y-5">
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
                <Suspense fallback={<div className="h-[calc(100vh-300px)] flex items-center justify-center"><Skeleton className="h-12 w-12 rounded-full" /></div>}>
                    <MapTab />
                </Suspense>
            ) : (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
                    className="space-y-10"
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
                            <div className={`w-full flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-sheet border ${isDark ? 'bg-white/[0.02] border-slate-200/20' : 'bg-white border-slate-200/50 shadow-sm'}`}>
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
                            <div className={`w-full flex flex-col items-center justify-center gap-3 py-10 px-6 rounded-sheet border ${isDark ? 'bg-white/[0.02] border-slate-200/20' : 'bg-white border-slate-200/50 shadow-sm'}`}>
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
                    {/* Manifesto Section Integrated */}
                    <div className="pt-12 pb-12 border-t border-white/[0.05]">
                        <ManifestoSection isDark={isDark} />
                        <FooterDisclaimer isDark={isDark} />
                    </div>
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
                className={`${cardClass} flex overflow-hidden cursor-pointer group active:scale-[0.99] transition-transform duration-200 h-[100px] border ${isDark ? 'border-white/5 bg-[#1c1c1e]' : 'border-slate-200/50 bg-white'} rounded-[16px]`}
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
                        {String([item.cuisine, item.city].filter(Boolean).join(' · ') || item.category || '')}
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

    // Standard card for recommended / trending / open-now
    return (
        <div
            onClick={onClick}
            className={`${cardClass} overflow-hidden cursor-pointer group active:scale-[0.99] transition-transform duration-200`}
        >
            <div className="relative aspect-[16/10] overflow-hidden">
                <LocationImage
                    src={item.image}
                    alt={item.title}
                    width={600}
                    className="transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/50 backdrop-blur-md px-1.5 py-0.5 rounded-full">
                    <Star size={8} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-[9px] font-bold text-white">{item.rating ?? item.google_rating}</span>
                </div>
                {isTrending && (
                    <div className="absolute top-2.5 right-2.5 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        Trending
                    </div>
                )}
            </div>
            <div className="p-3.5">
                <h4 className={`text-[15px] font-semibold leading-tight truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {item.title}
                </h4>
                <p className={`text-[12px] mt-1 truncate ${isDark ? 'text-gray-500' : 'text-slate-600'}`}>
                    {String([item.category, item.city].filter(Boolean).join(' · '))}
                </p>
            </div>
        </div>
    )
}

export default DashboardPage
