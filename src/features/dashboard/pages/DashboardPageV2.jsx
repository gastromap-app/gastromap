/**
 * DashboardPageV2 — Redesigned mobile-first dashboard.
 * 
 * Changes from V1:
 * - Compact greeting with geo context
 * - Mood Selector pills (replaces CategoryFilters)
 * - Hero card for top recommendation
 * - Trending as compact list (not cards)
 * - Countries as pills (not large cards)
 * - Cleaner visual hierarchy
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useGeoStore } from '@/shared/store/useGeoStore'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useGeoCovers, useUserPreferences } from '@/shared/api/queries'
import { isCurrentlyOpen } from '@/utils/formatOpeningHours'
import { normalizeCityName, normalizeCountryName } from '@/utils/normalizeCityName'
import { useNavigate } from 'react-router-dom'
import { MapPin, Star, ChevronRight, TrendingUp } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { PageTransition } from '@/components/ui/PageTransition'
import { DashboardCardSkeleton } from '@/components/ui/Skeleton'
import { useTranslation } from 'react-i18next'
import LazyImage from '@/components/ui/LazyImage'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullRefreshIndicator } from '@/components/ui/PullRefreshIndicator'
import { SmartSearchBar } from '../components/SmartSearchBar'
import { useUserGeo } from '@/shared/hooks/useUserGeo'
import { calculateDistance } from '@/lib/geo.js'
import { LocationCardDefault, LocationCardNearby } from '@/shared/components/cards'
import ManifestoSection from '../components/ManifestoSection'
import FilterModal from '../components/FilterModal'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const COUNTRY_IMAGES = {
    poland: 'https://images.unsplash.com/photo-1519197924294-4ba991a11128?q=80&w=2069&auto=format&fit=crop',
    france: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2073&auto=format&fit=crop',
    spain: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?q=80&w=2070&auto=format&fit=crop',
    italy: 'https://images.unsplash.com/photo-1529543544282-ea669407fca3?q=80&w=2048&auto=format&fit=crop',
    germany: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2070&auto=format&fit=crop',
}

const MOODS = [
    { id: 'all', emoji: '✨', label: 'All' },
    { id: 'cafe', emoji: '☕', label: 'Coffee' },
    { id: 'restaurant', emoji: '🍕', label: 'Quick Bite' },
    { id: 'bar', emoji: '🍷', label: 'Drinks' },
    { id: 'fine_dining', emoji: '🎩', label: 'Fine Dining' },
    { id: 'healthy', emoji: '🌿', label: 'Healthy' },
]

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

const SectionHeader = ({ title, onSeeAll, isDark }) => {
    const { t } = useTranslation()
    return (
        <div className="flex justify-between items-center mb-3">
            <h2 className={`text-[16px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
            {onSeeAll && (
                <button onClick={onSeeAll} className="text-[12px] font-semibold text-blue-500 flex items-center gap-0.5">
                    {t('dashboard.see_all')} <ChevronRight size={14} />
                </button>
            )}
        </div>
    )
}

// Hero recommendation card
const HeroCard = ({ location, isDark, navigate }) => {
    if (!location) return null
    const rating = location.google_rating || location.rating || 0

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => navigate(`/location/${location.id}`)}
            className={`relative rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform ${isDark ? 'bg-white/[0.03]' : 'bg-white shadow-sm'}`}
        >
            <div className="relative h-44 w-full">
                <LazyImage
                    src={location.photos?.[0] || location.image || location.image_url}
                    alt={location.title}
                    className="w-full h-full object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                {rating > 0 && (
                    <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Star size={10} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-[11px] font-bold text-white">{Number(rating).toFixed(1)}</span>
                    </div>
                )}
                <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-[18px] font-bold text-white leading-tight">{location.title}</h3>
                    <p className="text-[12px] text-white/70 mt-1">
                        {location.category}{location.cuisine ? ` · ${location.cuisine}` : ''}{location.price_range ? ` · ${location.price_range}` : ''}
                    </p>
                </div>
            </div>
        </motion.div>
    )
}

// Compact trending list item
const TrendingItem = ({ location, index, isDark, navigate }) => {
    const rating = location.google_rating || location.rating || 0
    return (
        <button
            onClick={() => navigate(`/location/${location.id}`)}
            className={`w-full flex items-center gap-3 py-2.5 px-1 rounded-xl transition-colors active:scale-[0.98] ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
        >
            <span className={`text-[12px] font-bold w-5 text-center ${isDark ? 'text-white/30' : 'text-slate-300'}`}>{index + 1}</span>
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                <LazyImage src={location.photos?.[0] || location.image || location.image_url} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 text-left">
                <p className={`text-[13px] font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{location.title}</p>
                <p className={`text-[11px] ${isDark ? 'text-white/40' : 'text-slate-500'}`}>{location.category}{location.price_range ? ` · ${location.price_range}` : ''}</p>
            </div>
            {rating > 0 && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Star size={10} className="text-amber-400 fill-amber-400" />
                    <span className={`text-[11px] font-semibold ${isDark ? 'text-white/60' : 'text-slate-600'}`}>{Number(rating).toFixed(1)}</span>
                </div>
            )}
        </button>
    )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const DashboardPageV2 = () => {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const locations = useLocationsStore(state => state.locations)
    const filteredLocations = useLocationsStore(state => state.filteredLocations)
    const isLoading = useLocationsStore(state => state.isLoading)
    const initialize = useLocationsStore(state => state.initialize)
    const { data: userPrefs = {} } = useUserPreferences(user?.id)
    const navigate = useNavigate()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const currentCity = useGeoStore(state => state.city) || 'Unknown'
    const currentCountry = useGeoStore(state => state.country)
    const { lat: geoLat, lng: geoLng, status: geoStatus, requestGeo } = useUserGeo({ autoRequest: true })

    const [activeMood, setActiveMood] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [isFilterOpen, setIsFilterOpen] = useState(false)

    // Geo covers for country images
    const { data: geoCoversData = [] } = useGeoCovers('country')
    const dbCoverMap = Object.fromEntries(geoCoversData.map(c => [c.slug, c.image_url]))

    // Pull to refresh
    const handleRefresh = async () => { await useLocationsStore.getState().reinitialize() }
    const { pullDistance, isRefreshing, progress, handlers: pullHandlers } = usePullToRefresh(handleRefresh)

    // Greeting
    const [hourNow, setHourNow] = useState(() => new Date().getHours())
    useEffect(() => { const id = setInterval(() => setHourNow(new Date().getHours()), 60_000); return () => clearInterval(id) }, [])
    const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Traveler'
    const greeting = useMemo(() => {
        if (hourNow >= 6 && hourNow < 12) return `Good morning, ${firstName}`
        if (hourNow >= 12 && hourNow < 18) return `Good afternoon, ${firstName}`
        if (hourNow >= 18 && hourNow < 24) return `Good evening, ${firstName}`
        return `Good night, ${firstName}`
    }, [hourNow, firstName])

    // Mood-filtered locations
    const moodFiltered = useMemo(() => {
        if (activeMood === 'all') return filteredLocations
        if (activeMood === 'healthy') {
            return filteredLocations.filter(l => (l.dietary || []).some(d => ['vegan', 'vegetarian', 'healthy'].includes(d.toLowerCase())))
        }
        return filteredLocations.filter(l => (l.category || '').toLowerCase().replace(/\s+/g, '_').includes(activeMood))
    }, [filteredLocations, activeMood])

    // Nearby
    const nearbyLocations = useMemo(() => {
        if (!geoLat || !geoLng) return []
        return moodFiltered
            .map(loc => ({ ...loc, _dist: calculateDistance(geoLat, geoLng, loc.lat, loc.lng) }))
            .filter(l => l._dist < 1)
            .sort((a, b) => a._dist - b._dist)
            .slice(0, 10)
    }, [moodFiltered, geoLat, geoLng])

    // Recommended (DNA-based)
    const recommended = useMemo(() => {
        const dna = userPrefs?.longTerm || {}
        const cuisines = (dna.favoriteCuisines || []).map(c => c.toLowerCase())
        if (!cuisines.length) {
            return [...moodFiltered].sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0)).slice(0, 8)
        }
        return moodFiltered
            .map(loc => {
                let score = 0
                const locCuisine = (loc.cuisine || '').toLowerCase()
                if (cuisines.some(c => locCuisine.includes(c))) score += 3
                score += (loc.google_rating || 0) / 2
                return { ...loc, _score: score }
            })
            .sort((a, b) => b._score - a._score)
            .slice(0, 8)
    }, [moodFiltered, userPrefs])

    // Trending
    const trending = useMemo(() => {
        return [...moodFiltered]
            .sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0))
            .slice(0, 5)
    }, [moodFiltered])

    // Countries
    const countries = useMemo(() => {
        const map = {}
        locations.forEach(loc => {
            const raw = loc.country ?? ''
            if (!raw) return
            const slug = raw.toLowerCase().replace(/\s+/g, '-')
            const name = raw.charAt(0).toUpperCase() + raw.slice(1)
            if (!map[slug]) map[slug] = { name, slug, count: 0 }
            map[slug].count++
        })
        return Object.values(map).sort((a, b) => b.count - a.count)
    }, [locations])

    // Open now
    const openNow = useMemo(() => {
        return moodFiltered.filter(loc => {
            const { isOpen } = isCurrentlyOpen(loc.opening_hours || loc.openingHours)
            return isOpen === true
        }).slice(0, 8)
    }, [moodFiltered])

    const buildExploreUrl = useCallback((sort) => {
        const rawCity = currentCity && currentCity !== 'Unknown' ? currentCity : null
        const rawCountry = currentCountry || null
        const city = rawCity ? normalizeCityName(rawCity).toLowerCase().replace(/\s+/g, '-') : null
        const country = rawCountry ? normalizeCountryName(rawCountry).toLowerCase().replace(/\s+/g, '-') : null
        if (city && country) return sort ? `/explore/${country}/${city}?sort=${sort}` : `/explore/${country}/${city}`
        return sort ? `/explore?sort=${sort}` : '/explore'
    }, [currentCity, currentCountry])

    return (
        <PageTransition className="w-full max-w-7xl mx-auto flex flex-col relative z-0">
            <FilterModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} theme={theme} />

            {/* ── Mobile Layout ─────────────────────────────────────────── */}
            <div className="md:hidden" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6.5rem)' }}>

                {/* Greeting */}
                <div className="px-5 mb-4">
                    <h1 className={`text-[22px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {greeting}
                    </h1>
                    <p className={`text-[13px] font-medium mt-1 flex items-center gap-1.5 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
                        <MapPin size={12} className="text-blue-500" />
                        {currentCity !== 'Unknown' ? currentCity : 'Locating...'} · {nearbyLocations.length > 0 ? `${nearbyLocations.length} spots nearby` : 'Explore the city'}
                    </p>
                </div>

                {/* Search */}
                <div className="px-5 mb-4">
                    <SmartSearchBar
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFilter={() => setIsFilterOpen(true)}
                        placeholder={t('dashboard.search_placeholder')}
                    />
                </div>

                {/* Mood Selector */}
                <div className="px-5 mb-5">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {MOODS.map((mood) => (
                            <button
                                key={mood.id}
                                onClick={() => setActiveMood(mood.id)}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all active:scale-95 ${
                                    activeMood === mood.id
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                        : isDark
                                            ? 'bg-white/[0.06] text-white/60 border border-white/10'
                                            : 'bg-slate-100 text-slate-600 border border-slate-200/50'
                                }`}
                            >
                                <span>{mood.emoji}</span>
                                <span>{mood.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Pull-to-refresh */}
                <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={progress} />

                {/* Feed */}
                <div className="space-y-6 pb-10 px-5" {...pullHandlers}>

                    {/* Nearby */}
                    {(geoStatus === 'granted' || nearbyLocations.length > 0) && (
                        <div>
                            <SectionHeader title="Nearby" onSeeAll={() => navigate(buildExploreUrl())} isDark={isDark} />
                            {nearbyLocations.length > 0 ? (
                                <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                                    {nearbyLocations.map((loc) => (
                                        <div key={loc.id} className="snap-center">
                                            <LocationCardNearby location={loc} />
                                        </div>
                                    ))}
                                </div>
                            ) : isLoading ? (
                                <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
                                    {[0,1,2].map(i => <div key={i} className="flex-shrink-0"><DashboardCardSkeleton isDark={isDark} /></div>)}
                                </div>
                            ) : null}
                        </div>
                    )}

                    {/* For You — Hero + mini cards */}
                    <div>
                        <SectionHeader
                            title={currentCity !== 'Unknown' ? `For You in ${currentCity}` : 'For You'}
                            onSeeAll={() => navigate(buildExploreUrl('recommended'))}
                            isDark={isDark}
                        />
                        <HeroCard location={recommended[0]} isDark={isDark} navigate={navigate} />
                        {recommended.length > 1 && (
                            <div className="flex gap-3 overflow-x-auto pb-2 mt-3 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                                {recommended.slice(1).map((loc) => (
                                    <div key={loc.id} className="snap-center">
                                        <LocationCardDefault location={loc} className="flex-shrink-0 w-[200px]" imageHeight="h-[100px]" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Trending — compact list */}
                    {trending.length > 0 && (
                        <div>
                            <SectionHeader title="Trending 🔥" onSeeAll={() => navigate(buildExploreUrl('trending'))} isDark={isDark} />
                            <div className={`rounded-2xl overflow-hidden ${isDark ? 'bg-white/[0.03] border border-white/5' : 'bg-white border border-slate-100 shadow-sm'}`}>
                                <div className="divide-y divide-slate-100 dark:divide-white/5 px-3">
                                    {trending.map((loc, i) => (
                                        <TrendingItem key={loc.id} location={loc} index={i} isDark={isDark} navigate={navigate} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Explore Countries — pills */}
                    {countries.length > 0 && (
                        <div>
                            <SectionHeader title="Explore Countries" onSeeAll={() => navigate('/explore')} isDark={isDark} />
                            <div className="flex gap-2 flex-wrap">
                                {countries.map((c) => (
                                    <button
                                        key={c.slug}
                                        onClick={() => navigate(`/explore/${c.slug}`)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95 ${
                                            isDark ? 'bg-white/[0.06] text-white/70 border border-white/10' : 'bg-slate-50 text-slate-700 border border-slate-200/50'
                                        }`}
                                    >
                                        <span className="capitalize">{c.name}</span>
                                        <span className={`text-[10px] ${isDark ? 'text-white/30' : 'text-slate-400'}`}>{c.count}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Open Now */}
                    {openNow.length > 0 && (
                        <div>
                            <SectionHeader title="Open Now 🟢" isDark={isDark} />
                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory">
                                {openNow.slice(0, 5).map((loc) => (
                                    <div key={loc.id} className="snap-center">
                                        <LocationCardDefault location={loc} className="flex-shrink-0 w-[200px]" imageHeight="h-[100px]" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Manifesto */}
                    <ManifestoSection isDark={isDark} />
                </div>
            </div>

            {/* ── Desktop — redirect to original for now ────────────────── */}
            <div className="hidden md:block" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6.5rem)' }}>
                <div className="text-center py-20">
                    <p className={`text-lg ${isDark ? 'text-white/50' : 'text-slate-500'}`}>Desktop version — use original Dashboard</p>
                </div>
            </div>
        </PageTransition>
    )
}

export default DashboardPageV2
