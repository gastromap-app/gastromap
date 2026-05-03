import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useGeoStore } from '@/shared/store/useGeoStore'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useGeoCovers } from '@/shared/api/queries'
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

import { DashboardCardSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { useDebounce } from '@/hooks/useDebounce'
import { useTranslation } from 'react-i18next'
import LocationImage from '@/components/ui/LocationImage'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullRefreshIndicator } from '@/components/ui/PullRefreshIndicator'
import { SmartSearchBar } from '../components/SmartSearchBar'
import CategoryFilters from '../components/CategoryFilters'
import { useUserGeo } from '@/shared/hooks/useUserGeo'
import { calculateDistance } from '@/lib/geo.js'
import { LocationCardDefault, LocationCardNearby } from '@/shared/components/cards'
import LazyImage from '@/components/ui/LazyImage'
import ManifestoSection from '../components/ManifestoSection'
import FilterModal from '../components/FilterModal'

const MapTab = React.lazy(() => import('../components/MapTab'))

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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
        <div className="flex justify-between items-end mb-6">
            <div className="space-y-1">
                {subtitle && <p className="text-eyebrow-muted">{subtitle}</p>}
                <h2 className="text-2xl md:text-[1.75rem] font-extrabold leading-[1.2] tracking-tight text-t-primary">{title}</h2>
            </div>
            {onSeeAll && (
                <button 
                    onClick={onSeeAll} 
                    className="group flex items-center gap-1.5 text-sm font-bold text-blue-500 hover:text-blue-400 transition-all"
                >
                    {t('dashboard.see_all')}
                    <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </button>
            )}
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
    }, [initialize])

    useEffect(() => {
        if (geoLat && geoLng) useLocationsStore.getState().setUserLocation({ lat: geoLat, lng: geoLng })
    }, [geoLat, geoLng])

    // Sync search input with store
    useEffect(() => {
        useLocationsStore.getState().setSearchQuery(debouncedSearch)
    }, [debouncedSearch])

    useEffect(() => {
        if (storeSearchQuery !== searchQuery && !debouncedSearch) {
            const t = setTimeout(() => setSearchQuery(storeSearchQuery || ''), 0)
            return () => clearTimeout(t)
        }
    }, [storeSearchQuery, searchQuery, debouncedSearch])

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
            .filter(l => l._dist < 1)
            .sort((a, b) => a._dist - b._dist)
            .slice(0, 10)
    }, [filteredLocations, geoLat, geoLng])

    // ── Missing variables for mobile & desktop layouts ──────────────────────
    const text = isDark ? 'text-white' : 'text-gray-900'
    const sub  = isDark ? 'text-gray-500' : 'text-slate-600'
    const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || t('dashboard.traveler')
    const greeting = useMemo(() => {
        const hour = new Date().getHours()
        if (hour >= 6 && hour < 12) return t('dashboard.greeting_morning', { name: firstName })
        if (hour >= 12 && hour < 18) return t('dashboard.greeting_afternoon', { name: firstName })
        if (hour >= 18 && hour < 24) return t('dashboard.greeting_evening', { name: firstName })
        return t('dashboard.greeting_night', { name: firstName })
    }, [firstName, t])
    const cityTagline = useMemo(() => {
        const validCity = currentCity && currentCity !== 'Unknown' && currentCity.trim() !== ''
        return validCity
            ? t('dashboard.explore_today', { city: currentCity })
            : t('dashboard.explore_today_fallback')
    }, [currentCity, t])
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
                <div className="px-5 mb-6">
                    <motion.h1 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`text-[24px] font-bold tracking-tight leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}
                    >
                        {greeting}
                    </motion.h1>
                    <motion.p 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className={`text-[15px] font-semibold mt-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                    >
                        {cityTagline}
                    </motion.p>
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
                                        <LocationCardNearby location={loc} />
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
                                            <LocationCardDefault location={loc} className="flex-shrink-0 w-[240px]" imageHeight="h-[120px]" />
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
                                        <LocationCardDefault location={loc} className="flex-shrink-0 w-[240px]" imageHeight="h-[120px]" />
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
                                        <LocationCardDefault location={loc} className="flex-shrink-0 w-[240px]" imageHeight="h-[120px]" />
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
                    cityTagline={cityTagline}
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
    isDark, text, sub, greeting, cityTagline, firstName,
    searchQuery, setSearchQuery, setIsFilterOpen,
    activeTab, setActiveTab, geoStatus, isLoading,
    requestGeo, nearbyLocations, countries, handleSelectCountry,
    recommended, trending, openNowLocations, navigate, t,
    visitCount = 0, currentCity = 'Unknown'
}) => {
    const itemVariants = {
        hidden:  { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
    }

    return (
        <div className="pb-32 max-w-7xl mx-auto w-full px-6 lg:px-8">

            <div className="mt-20 mb-12 relative">
                {/* Subtle glow behind hero */}
                {isDark && (
                    <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
                )}
                
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10 max-w-4xl"
                >
                    {/* Branded Display Typography */}
                    <h1 className="text-[3rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-t-primary mb-4">
                        {greeting}
                    </h1>
                    <p className="text-[1.125rem] font-bold text-blue-500/90 mb-8 max-w-2xl tracking-tight">
                        {cityTagline}
                    </p>

                    {/* Search + Filters Integrated */}
                    <div className="flex flex-col gap-6">
                        <div className="w-full max-w-4xl">
                            <SmartSearchBar
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFilter={() => setIsFilterOpen(true)}
                                placeholder={t('dashboard.search_placeholder')}
                                showFilter={false}
                            />
                        </div>
                        <div className="w-full">
                            <CategoryFilters isDark={isDark} />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Tab bar + filter */}
            <div className="flex items-center justify-between mb-12 border-b border-border pb-6">
                <div className="flex items-center p-1 rounded-2xl gap-1 bg-secondary/50 backdrop-blur-sm">
                    {['overview', 'map'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`relative px-8 py-2.5 rounded-xl text-sm font-bold capitalize transition-all duration-300 ${
                                activeTab === tab
                                    ? 'bg-white dark:bg-white/10 text-t-primary shadow-lg shadow-black/5 dark:shadow-none'
                                    : 'text-t-tertiary hover:text-t-primary'
                            }`}
                        >
                            {tab === 'overview' ? t('dashboard.tab_overview') : t('dashboard.tab_map')}
                            {activeTab === tab && (
                                <motion.div 
                                    layoutId="activeTab" 
                                    className="absolute inset-0 bg-white dark:bg-white/10 rounded-xl -z-10"
                                />
                            )}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setIsFilterOpen(true)}
                    className="flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-bold transition-all active:scale-95 bg-secondary hover:bg-secondary/80 text-t-primary border border-border"
                >
                    <SlidersHorizontal size={16} />
                    {t('dashboard.filters')}
                </button>
            </div>

            {/* Content */}
            {activeTab === 'map' ? (
                <Suspense fallback={<div className="h-[70vh] flex items-center justify-center"><Skeleton className="h-12 w-12 rounded-full" /></div>}>
                    <div className="h-[70vh] rounded-[32px] overflow-hidden border border-border shadow-2xl">
                        <MapTab />
                    </div>
                </Suspense>
            ) : (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                    className="space-y-20"
                >
                    {/* Nearby Locations */}
                    <motion.div variants={itemVariants} className="space-y-8">
                        <SectionHeader
                            title={t('dashboard.nearby_locations', 'Locations Nearby')}
                            subtitle={t('dashboard.within_distance', 'Within 1 km')}
                            onSeeAll={() => {
                                useLocationsStore.getState().setRadius(1)
                                navigate('/explore')
                            }}
                            isDark={isDark}
                        />
                        
                        {/* Nearby Locations Grid */}
                        {(geoStatus === 'loading' || geoStatus === 'idle' || isLoading) ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <DashboardCardSkeleton key={i} isDark={isDark} />
                                ))}
                            </div>
                        ) : geoStatus === 'denied' || geoStatus === 'error' ? (
                            <div className="w-full flex flex-col items-center justify-center gap-4 py-16 px-8 surface border-dashed border-2">
                                <div className="p-4 rounded-full bg-blue-500/10 text-blue-500">
                                    <MapPin size={32} />
                                </div>
                                <div className="text-center max-w-sm">
                                    <p className="text-lg font-black text-t-primary">{t('dashboard.location_needed', 'Location Access Needed')}</p>
                                    <p className="text-sm mt-2 text-t-tertiary leading-relaxed">{t('dashboard.location_desc', 'Please allow location access to see places near you.')}</p>
                                </div>
                                <button onClick={requestGeo} className="mt-4 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold active:scale-95 transition-all shadow-xl shadow-blue-500/20">
                                    {t('dashboard.enable_location', 'Enable Location')}
                                </button>
                            </div>
                        ) : nearbyLocations.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {nearbyLocations.map((item) => (
                                    <LocationCardNearby key={item.id} location={item} width="w-full" />
                                ))}
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center justify-center gap-4 py-16 px-8 surface border-dashed border-2">
                                <div className="p-4 rounded-full bg-slate-500/10 text-t-quaternary">
                                    <MapPin size={32} />
                                </div>
                                <div className="text-center max-w-sm">
                                    <p className="text-lg font-black text-t-primary">{t('dashboard.no_nearby_places', 'No Places Nearby')}</p>
                                    <p className="text-sm mt-2 text-t-tertiary leading-relaxed">{t('dashboard.no_nearby_desc', 'There are no places within 1km of your current location.')}</p>
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* Countries */}
                    <motion.div variants={itemVariants} className="space-y-8">
                        <SectionHeader
                            title={t('dashboard.explore_countries')}
                            subtitle={t('dashboard.culinary_traditions')}
                            isDark={isDark}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-8">
                            {countries.map((country) => (
                                <button
                                    key={country.slug}
                                    onClick={() => handleSelectCountry(country)}
                                    aria-label={t('dashboard.explore_country_aria', { country: country.name })}
                                    className="relative aspect-[16/9] w-full rounded-[32px] overflow-hidden group cursor-pointer active:scale-[0.98] transition-all duration-500 text-left surface-elevated border-none hover:-translate-y-2 hover:shadow-2xl"
                                >
                                    <LocationImage
                                        src={country.image}
                                        alt={country.name}
                                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                        width={400}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent group-hover:from-black transition-colors" />
                                    <div className="absolute top-5 right-5 bg-blue-600 text-white text-[11px] font-black px-4 py-2 rounded-full shadow-lg transform group-hover:scale-110 transition-transform">
                                        {t('dashboard.new_badge', { count: country.newCount })}
                                    </div>
                                    <div className="absolute bottom-8 left-8 right-8">
                                        <h4 className="text-[1.75rem] font-black text-white mb-2 leading-none group-hover:text-blue-400 transition-colors tracking-tighter">
                                            {country.name}
                                        </h4>
                                        <div className="flex items-center gap-2 text-white/70 text-[0.6875rem] font-bold uppercase tracking-[0.14em]">
                                            <MapPin size={12} className="text-blue-500" />
                                            <span>{t('dashboard.explore_cities')}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Recommended */}
                    <motion.div variants={itemVariants} className="space-y-8">
                        <SectionHeader
                            title={t('dashboard.recommended')}
                            subtitle={t('dashboard.perfect_spots')}
                            onSeeAll={() => navigate('/explore')}
                            isDark={isDark}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {recommended.map((item) => (
                                <LocationCardDefault key={item.id} location={item} />
                            ))}
                        </div>
                    </motion.div>

                    {/* Trending */}
                    <motion.div variants={itemVariants} className="space-y-8">
                        <SectionHeader
                            title={t('dashboard.trending')}
                            subtitle={t('dashboard.hot_spots')}
                            onSeeAll={() => navigate('/explore')}
                            isDark={isDark}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {trending.map((item) => (
                                <LocationCardDefault key={item.id} location={item} />
                            ))}
                        </div>
                    </motion.div>

                    {/* Open Now */}
                    {openNowLocations.length > 0 && (
                        <motion.div variants={itemVariants} className="space-y-8">
                            <SectionHeader
                                title={t('dashboard.open_now')}
                                subtitle={t('dashboard.currently_serving')}
                                onSeeAll={() => {
                                    useLocationsStore.getState().setIsOpenNow(true)
                                    navigate('/explore')
                                }}
                                isDark={isDark}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {openNowLocations.slice(0, 4).map((item) => (
                                    <LocationCardDefault key={item.id} location={item} />
                                ))}
                            </div>
                        </motion.div>
                    )}
                    
                    <div className="pt-20">
                        <ManifestoSection isDark={isDark} />
                        <FooterDisclaimer isDark={isDark} />
                    </div>
                </motion.div>
            )}
        </div>
    )
}

export default DashboardPage
