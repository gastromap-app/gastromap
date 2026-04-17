import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useFavoritesStore } from '@/shared/store/useFavoritesStore'
import { useAddFavoriteMutation, useRemoveFavoriteMutation, useUserFavorites } from '@/shared/api/queries'
import { useNavigate, Link } from 'react-router-dom'
import AuroraBackground from '@/components/ui/aurora-background'
import { MapPin, Star, Heart, Clock, ChevronRight, Moon, Sun, Search as SearchIcon, SlidersHorizontal, ShieldCheck, Sunrise, Sunset, Sparkles } from 'lucide-react'
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
import { DrillDownExplorer, CountryCards } from '../components/DrillDownExplorer'
import { SmartSearchBar } from '../components/SmartSearchBar'

// --- MOBILE COMPONENTS ---
// Proper seamless marquee: two copies of the text side-by-side, animate x from 0 to -50%
const MarqueeTitle = ({ title, theme }) => {
    if (!title) return null
    return (
        <div className="overflow-hidden whitespace-nowrap relative">
            <motion.div
                animate={{ x: ['0%', '-50%'] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                className={`inline-flex text-base font-black leading-tight ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}
            >
                <span className="pr-12">{title}</span>
                <span className="pr-12">{title}</span>
            </motion.div>
        </div>
    )
}

const LocationCardMobile = ({ loc, type = 'recommended' }) => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()
    const { isFavorite: isLocalFav, toggleFavorite: localToggle } = useFavoritesStore()
    const { user } = useAuthStore()
    const addFav = useAddFavoriteMutation()
    const removeFav = useRemoveFavoriteMutation()
    const { data: dbFavs = [] } = useUserFavorites(user?.id)
    const dbFavIds = dbFavs.map(f => f.location_id)
    const isFavorite = (id) => dbFavIds.includes(id) || isLocalFav(id)
    const toggleFavorite = async (id) => {
        // DASH-5 FIX: show login prompt instead of silent fail for unauthenticated users
        if (!user?.id) {
            navigate('/login?next=/dashboard')
            return
        }
        localToggle(id)  // instant UI (optimistic update)
        if (dbFavIds.includes(id)) {
            await removeFav.mutateAsync({ userId: user.id, locationId: id })
        } else {
            await addFav.mutateAsync({ userId: user.id, locationId: id })
        }
    }
    const saved = isFavorite(loc?.id)

    if (!loc) return null

    return (
        <div
            onClick={() => navigate(`/location/${loc.id}`)}
            className={`flex-shrink-0 w-[220px] rounded-card overflow-hidden transition-all active:scale-95 group shadow-xl cursor-pointer ${isDark ? 'bg-[#1a1c24] border border-white/5' : 'bg-white'}`}
        >
            {/* Image Area */}
            <div className="relative h-[180px] overflow-hidden">
                <img
                    src={loc.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070&auto=format&fit=crop'}
                    alt={loc.title || 'Location'}
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />

                {/* Rating Badge */}
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-2xl flex items-center gap-1 shadow-md">
                    <Star size={12} className="text-blue-600 fill-blue-600" />
                    <span className="text-[11px] font-black text-gray-900">{loc.rating || '4.5'}</span>
                </div>

                {type === 'trending' && (
                    <div className="absolute top-3 left-3 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg border border-white/20">
                        Top Choice
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="p-4 relative flex justify-between items-end">
                <div className="flex-1 overflow-hidden">
                    <h4 className={`text-sm font-black leading-tight truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {loc.title || 'Unknown Place'}
                    </h4>
                    <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                        {loc.subtitle || 'Authentic flavors and vibes'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {/* Best Time Indicator - SVG Icons */}
                        {loc.best_time && loc.best_time.length > 0 && (
                            <div className="flex items-center gap-1 mr-1" title="Best time to visit">
                                {loc.best_time.includes('morning') && <Sunrise size={12} className="text-orange-400" />}
                                {loc.best_time.includes('day') && <Sun size={12} className="text-yellow-500" />}
                                {loc.best_time.includes('evening') && <Sunset size={12} className="text-orange-500" />}
                                {loc.best_time.includes('late_night') && <Sparkles size={12} className="text-indigo-400" />}
                            </div>
                        )}

                        {/* Special Labels - Subtle small chips */}
                        {loc.special_labels?.slice(0, 2).map(label => (
                            <span key={label} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isDark ? 'bg-white/5 text-white/40' : 'bg-gray-100 text-gray-500 dark:text-gray-400'}`}>
                                {translate(label)}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Heart Button */}
                <button
                    className="flex-shrink-0 w-11 h-11 -m-2 flex items-center justify-center active:scale-90 transition-transform"
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(loc.id) }}
                    aria-label={saved ? 'Remove from saved' : 'Save place'}
                >
                    <Heart size={20} className={saved ? 'text-red-500 fill-red-500' : 'text-gray-300 stroke-[2.2]'} />
                </button>
            </div>
        </div>
    )
}


// --- MAIN PAGE ---
const DashboardPage = () => {
    const { t } = useTranslation()
    const { user: authUser } = useAuthStore()
    const user = authUser ?? null
    const { locations } = useLocationsStore()
    const navigate = useNavigate()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    // Use the real loading state from the store (set by initialize() when fetching from Supabase)
    const isLoading = useLocationsStore(s => s.isLoading)

    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Drill-down navigation state
    const [drillLevel, setDrillLevel] = useState('home') // 'home' | 'cities' | 'locations'
    const [drillCountry, setDrillCountry] = useState(null)
    const [drillCity, setDrillCity] = useState(null)

    const handleSelectCountry = (country) => {
        setDrillCountry(country)
        setDrillCity(null)
        setDrillLevel('cities')
    }
    const debouncedSearch = useDebounce(searchQuery, 300)

    // ─── Load data on mount ──────────────────────────────────────────────────
    // REGRESSION FIX: use isInitialized flag instead of locations.length
    // locations.length > 0 doesn't mean global data is loaded — it could be city-scoped
    // isInitialized is only set to true after a FULL fetch (no city/country filter)
    useEffect(() => {
        const { initialize, isInitialized, isLoading } = useLocationsStore.getState()
        if (!isInitialized && !isLoading) {
            initialize()
        }
    }, [])

    // Pull-to-refresh
    const handleRefresh = async () => {
        const { initialize } = useLocationsStore.getState()
        // Force refetch by resetting isLoading guard
        useLocationsStore.setState({ isLoading: false })
        await initialize()
    }
    const { pullDistance, isRefreshing, progress, handlers: pullHandlers } = usePullToRefresh(handleRefresh)

    // Apply search to store when debounced value changes
    useEffect(() => {
        const { setSearchQuery: storeSetSearch } = useLocationsStore.getState()
        storeSetSearch(debouncedSearch)
    }, [debouncedSearch])

    // DASH-3 FIX: countries are now derived from actual locations in the store
    // Static image map as visual fallback — keeps cards looking good even without location photos
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
        // Enrich with static images; fall back to first location photo if no static image
        return dynamic.map(c => ({
            ...c,
            image: COUNTRY_IMAGES[c.slug]
                ?? locations.find(l => l.country?.toLowerCase() === c.name.toLowerCase())?.photos?.[0]
                ?? COUNTRY_IMAGES.poland, // ultimate fallback
            newCount: c.count,
        }))
    }, [locations])

    // Top-rated places
    const recommended = useMemo(
        () => [...locations].sort((a, b) => b.rating - a.rating).slice(0, 5),
        [locations]
    )

    // "Trending" — most recently added, different from recommended top-5
    const trending = useMemo(() => {
        const topIds = new Set(recommended.map(l => l.id))
        return [...locations]
            .filter(l => !topIds.has(l.id))
            .slice(-5)
            .reverse()
    }, [locations, recommended])

    const textStyle = theme === 'light' ? "text-gray-900" : "text-white"

    return (
        <PageTransition className="w-full max-w-7xl mx-auto flex flex-col relative z-0">
            <div data-testid="dashboard-page" className="contents">
            <FilterModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} theme={theme} />

            {/* MOBILE VIEW (Horizontal Sliders) */}
            <div className="md:hidden space-y-8 px-[2.5vw] pb-28" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 5rem)', paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' }}>

                {/* Search Bar */}
                <div className="space-y-4 mb-4">
                    <h2 className={`text-xl font-black tracking-tight leading-tight ${textStyle}`}>
                        {t('dashboard.tagline')}
                    </h2>
                    <SmartSearchBar
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFilter={() => setIsFilterOpen(true)}
                        placeholder={t('dashboard.search_placeholder')}
                    />
                </div>

                {/* 1. Explore by Country */}
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div>
                            <h3 className={`text-lg font-black ${textStyle}`}>{t('dashboard.explore_countries')}</h3>
                            <p className="text-[11px] text-gray-500 font-medium">{t('dashboard.culinary_traditions')}</p>
                        </div>
                    </div>
                    <CountryCards countries={countries} onSelectCountry={handleSelectCountry} />
                </div>

                                {/* 2. Recommended for you */}
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div className="">
                            <h3 className={`text-lg font-black ${textStyle}`}>{t('dashboard.recommended')}</h3>
                            <p className="text-[11px] text-gray-500 font-medium">{t('dashboard.perfect_spots')}</p>
                        </div>
                        <button onClick={() => navigate('/explore')} className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-white/5 px-4 py-2.5 rounded-full border border-white/5 active:scale-90 transition-transform min-h-11 flex items-center">
                            {t('dashboard.view_all')}
                        </button>
                    </div>

                    <div className="flex gap-[12px] overflow-x-auto pb-6 -mx-[2.5vw] px-[2.5vw] scrollbar-hide snap-x snap-mandatory">
                        {isLoading
                            ? Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="snap-center flex-shrink-0">
                                    <DashboardCardSkeleton isDark={isDark} />
                                </div>
                            ))
                            : recommended.map((loc) => (
                                <div key={loc.id} className="snap-center">
                                    <LocationCardMobile loc={loc} type="recommended" />
                                </div>
                            ))
                        }
                    </div>
                </div>

                {/* 3. Trending in Krakow */}
                <div className="space-y-4 pb-10">
                    <div className="flex justify-between items-end">
                        <div className="">
                            <h3 className={`text-lg font-black ${textStyle}`}>{t('dashboard.trending')}</h3>
                            <p className="text-[11px] text-gray-500 font-medium">{t('dashboard.hot_spots')}</p>
                        </div>
                        <button onClick={() => navigate('/explore')} className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-white/5 px-4 py-2.5 rounded-full border border-white/5 active:scale-90 transition-transform min-h-11 flex items-center">
                            {t('dashboard.view_all')}
                        </button>
                    </div>

                    <div className="flex gap-[12px] overflow-x-auto pb-6 -mx-[2.5vw] px-[2.5vw] scrollbar-hide snap-x snap-mandatory">
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

            {/* Drill-Down Overlay — replaces full page on cities/locations level */}
            <DrillDownExplorer
                countries={countries}
                level={drillLevel}
                setLevel={setDrillLevel}
                selectedCountry={drillCountry}
                setSelectedCountry={setDrillCountry}
                selectedCity={drillCity}
                setSelectedCity={setDrillCity}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setIsFilterOpen={setIsFilterOpen}
            />

            {/* DESKTOP VIEW (Original Design - Fully Restored) */}
            <div className="hidden md:flex flex-col px-[10px] pt-24 pb-6">
                <DesktopDashboard
                    locations={locations}
                    recommended={recommended}
                    authUser={user}
                    countries={countries}
                    theme={theme}
                    setIsFilterOpen={setIsFilterOpen}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                />
            </div>
            </div>
        </PageTransition>
    )
}

// --- DESKTOP VIEW COMPONENT ---
const DesktopDashboard = ({ locations, recommended, authUser, countries, theme, setIsFilterOpen, searchQuery = '', setSearchQuery = () => {} }) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [greeting, setGreeting] = useState(() => {
        const h = new Date().getHours()
        return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
    })
    const [activeTab, setActiveTab] = useState('overview')
    const [activeFilter] = useState('All')

    useEffect(() => {
        const hour = new Date().getHours()
        if (hour < 12) setGreeting(t('dashboard.greeting_morning'))
        else if (hour < 18) setGreeting(t('dashboard.greeting_afternoon'))
        else setGreeting(t('dashboard.greeting_evening'))
    }, [t])

    const glassStyle = theme === 'light'
        ? "bg-white/40 border-white/40 text-gray-900 shadow-sm hover:bg-white/60"
        : "bg-black/30 border-white/10 text-white shadow-lg hover:bg-black/40"

    const frameCardStyle = theme === 'light'
        ? "bg-white p-3 rounded-[32px] shadow-sm border border-gray-100"
        : "bg-white/10 p-3 rounded-[32px] shadow-lg border border-white/5"

    const textStyle = theme === 'light' ? "text-gray-900" : "text-white"
    const subTextStyle = theme === 'light' ? "text-gray-500" : "text-gray-500 dark:text-gray-400"

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    }

    return (
        <div className="pb-20 md:pb-8">

            {/* 2. Hero: Greeting, Search */}
            <div className="mt-[40px]">
                <div className="space-y-2">
                    <h1 className={`text-4xl md:text-5xl font-bold tracking-tight ${textStyle}`}>
                        {greeting}, <span className="text-blue-600">{authUser.name.split(' ')[0]}</span>
                    </h1>
                    <p className={`text-lg ${subTextStyle}`}>{t('dashboard.tagline')}</p>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center mt-[20px]">
                    <div className="relative flex-1 group w-full">
                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <input
                            type="text"
                            placeholder={t('dashboard.search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full h-16 pl-14 pr-6 rounded-[24px] border-2 border-transparent outline-none text-lg transition-all ${theme === 'light' ? 'bg-white shadow-xl focus:border-blue-500' : 'bg-white/10 backdrop-blur-md text-white border-white/10 focus:border-blue-500'
                                }`}
                        />
                    </div>
                    <button
                        onClick={() => navigate(searchQuery ? `/explore?q=${encodeURIComponent(searchQuery)}` : '/explore')}
                        className="h-16 px-8 rounded-[24px] bg-blue-600 text-white font-bold text-lg shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all"
                    >
                        {t('dashboard.search_btn')}
                    </button>
                </div>

            </div>

            {/* 3. Control Bar: Tabs & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mt-[20px]">
                <div className="bg-blue-600 p-1.5 rounded-full flex shadow-lg relative">
                    {['overview', 'map'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`relative px-8 py-3 rounded-full text-base font-bold capitalize transition-all duration-300 z-10 ${activeTab === tab ? 'text-blue-600' : 'text-white hover:bg-white/10'
                                }`}
                        >
                            {activeTab === tab && (
                                <motion.div layoutId="activeTab" className="absolute inset-0 bg-white rounded-full shadow-sm z-[-1]" />
                            )}
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4 ml-auto">
                    <button
                        onClick={() => setIsFilterOpen(true)}
                        className={`p-2 rounded-xl active:scale-95 transition-transform ${glassStyle}`}
                    >
                        <SlidersHorizontal size={20} />
                    </button>
                </div>
            </div>

            {activeTab === 'map' ? (
                <div className="h-[600px] rounded-[32px] overflow-hidden shadow-2xl mt-[20px]">
                    <React.Suspense fallback={<div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" /></div>}><MapTab activeFilter={activeFilter} /></React.Suspense>
                </div>
            ) : (
                <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }} className="space-y-10 mt-[20px]">

                    {/* 4. Explore by Country - Original Grid */}
                    <motion.div variants={itemVariants} className="space-y-5">
                        <div className="flex justify-between items-end px-1">
                            <div>
                                <h3 className={`text-2xl font-bold ${textStyle}`}>{t('dashboard.explore_countries')}</h3>
                                <p className={`text-sm ${subTextStyle}`}>{t('dashboard.culinary_traditions')}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {countries.map((country) => (
                                <motion.button key={country.slug} onClick={() => navigate(`/explore/${country.slug}`)} aria-label={`Explore ${country.name}`} whileHover={{ y: -8, scale: 1.02 }} className="relative h-56 rounded-[32px] overflow-hidden group cursor-pointer shadow-lg text-left w-full">
                                    <img src={country.image} alt={country.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                    <div className="absolute bottom-6 left-6 text-white">
                                        <h4 className="text-2xl font-bold mb-1">{country.name}</h4>
                                        <div className="flex items-center gap-1.5 text-xs opacity-90">
                                            <MapPin size={12} className="fill-white/20" />
                                            <span>Explore cities</span>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-6 right-6 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronRight className="text-white" size={20} />
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>

                    {/* 5. Recommended for you - Original Grid */}
                    <motion.div variants={itemVariants} className="space-y-5">
                        <div className="flex justify-between items-end px-1">
                            <div>
                                <h3 className={`text-2xl font-bold ${textStyle}`}>{t('dashboard.recommended')}</h3>
                                <p className={`text-sm ${subTextStyle}`}>{t('dashboard.perfect_spots')}</p>
                            </div>
                            <button onClick={() => navigate('/explore')} className="text-blue-500 font-medium text-sm hover:underline">{t('dashboard.view_all')}</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {recommended.map((item) => (
                                <motion.div key={item.id} onClick={() => navigate(`/location/${item.id}`)} whileHover={{ y: -8 }} className={`${frameCardStyle} transition-all duration-300 group cursor-pointer`}>
                                    <div className="relative h-56 mb-4 overflow-hidden rounded-2xl shadow-inner">
                                        <img src={item.image} crossOrigin="anonymous" alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-bold text-gray-900 flex items-center gap-1 shadow-md">
                                            <Star size={14} className="text-yellow-500 fill-yellow-500" /> {item.rating}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 px-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`text-lg font-bold ${textStyle}`}>{item.title}</h4>
                                            {item.best_time && item.best_time.length > 0 && (
                                                <div className="flex gap-1 text-sm pt-1 opacity-70">
                                                    {item.best_time.includes('morning') && '🌅'}
                                                    {item.best_time.includes('day') && '☀️'}
                                                    {item.best_time.includes('evening') && '🌙'}
                                                    {item.best_time.includes('late_night') && '✨'}
                                                </div>
                                            )}
                                        </div>
                                        <p className={`text-sm ${subTextStyle}`}>{item.subtitle}</p>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {item.special_labels?.slice(0, 3).map(label => (
                                                <span key={label} className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${theme === 'light' ? 'bg-gray-100 text-gray-500 dark:text-gray-400' : 'bg-white/10 text-white/50'}`}>
                                                    {translate(label)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                    {/* 6. Trending in Krakow - Added for parity */}
                    <motion.div variants={itemVariants} className="space-y-5">
                        <div className="flex justify-between items-end px-1">
                            <div>
                                <h3 className={`text-2xl font-bold ${textStyle}`}>{t('dashboard.trending')}</h3>
                                <p className={`text-sm ${subTextStyle}`}>{t('dashboard.hot_spots')}</p>
                            </div>
                            <button onClick={() => navigate('/explore')} className="text-blue-500 font-medium text-sm hover:underline">{t('dashboard.view_all')}</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[...locations].reverse().slice(0, 3).map((item) => (
                                <motion.div key={item.id} onClick={() => navigate(`/location/${item.id}`)} whileHover={{ y: -8 }} className={`${frameCardStyle} transition-all duration-300 group cursor-pointer`}>
                                    <div className="relative h-56 mb-4 overflow-hidden rounded-2xl shadow-inner">
                                        <img src={item.image} crossOrigin="anonymous" alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-bold text-gray-900 flex items-center gap-1 shadow-md">
                                            <Star size={14} className="text-yellow-500 fill-yellow-500" /> {item.rating}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 px-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`text-lg font-bold ${textStyle}`}>{item.title}</h4>
                                            {item.best_time && item.best_time.length > 0 && (
                                                <div className="flex gap-1 text-sm pt-1 opacity-70">
                                                    {item.best_time.includes('morning') && '🌅'}
                                                    {item.best_time.includes('day') && '☀️'}
                                                    {item.best_time.includes('evening') && '🌙'}
                                                    {item.best_time.includes('late_night') && '✨'}
                                                </div>
                                            )}
                                        </div>
                                        <p className={`text-sm ${subTextStyle}`}>{item.subtitle}</p>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {item.special_labels?.slice(0, 3).map(label => (
                                                <span key={label} className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${theme === 'light' ? 'bg-gray-100 text-gray-500 dark:text-gray-400' : 'bg-white/10 text-white/50'}`}>
                                                    {translate(label)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </div>
    )
}

export default DashboardPage
