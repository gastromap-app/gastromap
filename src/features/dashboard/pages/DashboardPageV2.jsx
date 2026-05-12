/**
 * DashboardPageV2 — Premium mobile-first dashboard with animated components.
 * 
 * Design language:
 * - Dark mode: Deep black, subtle borders, glow accents
 * - Light mode: Clean white, soft shadows, Apple-style rounded cards
 * - Animations: Spring cards, scramble text, parallax scroll, micro-interactions
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, useInView, useMotionValue, useAnimationFrame } from 'framer-motion'
import { useAuthStore } from '@/shared/store/useAuthStore'
import { useGeoStore } from '@/shared/store/useGeoStore'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useGeoCovers, useUserPreferences } from '@/shared/api/queries'
import { isCurrentlyOpen } from '@/utils/formatOpeningHours'
import { normalizeCityName, normalizeCountryName } from '@/utils/normalizeCityName'
import { useNavigate } from 'react-router-dom'
import { MapPin, Star, ChevronRight, ArrowUpRight } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'
import LazyImage from '@/components/ui/LazyImage'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullRefreshIndicator } from '@/components/ui/PullRefreshIndicator'
import { SmartSearchBar } from '../components/SmartSearchBar'
import { useUserGeo } from '@/shared/hooks/useUserGeo'
import { calculateDistance } from '@/lib/geo.js'
import ManifestoSection from '../components/ManifestoSection'
import FilterModal from '../components/FilterModal'

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED COMPONENTS (inspired by fancy-components)
// ═══════════════════════════════════════════════════════════════════════════════

// Scramble-in text effect for greeting
function ScrambleText({ text, className = '' }) {
    const [display, setDisplay] = useState('')
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true })
    const chars = 'abcdefghijklmnopqrstuvwxyz'

    useEffect(() => {
        if (!isInView) return
        let frame = 0
        const totalFrames = text.length * 3
        const interval = setInterval(() => {
            frame++
            const progress = Math.min(frame / totalFrames, 1)
            const revealed = Math.floor(progress * text.length)
            const scrambled = Array(Math.min(2, text.length - revealed))
                .fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('')
            setDisplay(text.slice(0, revealed) + scrambled)
            if (frame >= totalFrames) { setDisplay(text); clearInterval(interval) }
        }, 30)
        return () => clearInterval(interval)
    }, [isInView, text])

    return <span ref={ref} className={className}>{display || '\u00A0'}</span>
}

// Spring-animated card wrapper
function SpringCard({ children, className = '', delay = 0 }) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: '-40px' })

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay }}
            className={className}
        >
            {children}
        </motion.div>
    )
}

// Floating subtle animation for decorative elements
function Float({ children, className = '', speed = 0.5, amplitude = 8 }) {
    const y = useMotionValue(0)
    const time = useRef(0)

    useAnimationFrame(() => {
        time.current += speed * 0.02
        y.set(Math.sin(time.current) * amplitude)
    })

    return <motion.div style={{ y }} className={className}>{children}</motion.div>
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOOD SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════

const MOODS = [
    { id: 'all', emoji: '✨', label: 'All' },
    { id: 'cafe', emoji: '☕', label: 'Coffee' },
    { id: 'restaurant', emoji: '🍕', label: 'Quick Bite' },
    { id: 'bar', emoji: '🍷', label: 'Drinks' },
    { id: 'fine_dining', emoji: '🎩', label: 'Fine Dining' },
    { id: 'healthy', emoji: '🌿', label: 'Healthy' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// CARD COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function HeroRecommendation({ location, isDark, navigate }) {
    if (!location) return null
    const rating = location.google_rating || location.rating || 0

    return (
        <SpringCard className="mb-4">
            <motion.div
                onClick={() => navigate(`/location/${location.id}`)}
                whileTap={{ scale: 0.97 }}
                className={`relative rounded-[20px] overflow-hidden cursor-pointer ${
                    isDark ? 'ring-1 ring-white/5' : 'shadow-lg shadow-black/5'
                }`}
            >
                <div className="relative h-52 w-full">
                    <LazyImage
                        src={location.photos?.[0] || location.image || location.image_url}
                        alt={location.title}
                        className="w-full h-full object-cover"
                        sizes="100vw"
                        transform={{ width: 600, quality: 80, format: 'webp' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Floating rating — always on dark image overlay */}
                    {rating > 0 && (
                        <Float amplitude={3} speed={0.3} className="absolute top-4 right-4">
                            <div className={`backdrop-blur-xl px-2.5 py-1 rounded-full flex items-center gap-1 ${
                                isDark ? 'bg-white/15 border border-white/20' : 'bg-black/40 border border-white/30'
                            }`}>
                                <Star size={11} className="text-yellow-400 fill-yellow-400" />
                                <span className="text-[12px] font-semibold text-white">{Number(rating).toFixed(1)}</span>
                            </div>
                        </Float>
                    )}

                    {/* Content overlay — on dark gradient */}
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                        <p className={`text-[10px] font-medium tracking-[0.15em] uppercase mb-1 ${
                            isDark ? 'text-white/50' : 'text-white/70'
                        }`}>
                            Recommended for you
                        </p>
                        <h3 className="text-[20px] font-semibold text-white leading-tight tracking-tight">{location.title}</h3>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[11px] font-medium ${isDark ? 'text-white/60' : 'text-white/80'}`}>{location.category}</span>
                            {location.cuisine && <span className={`text-[11px] ${isDark ? 'text-white/40' : 'text-white/50'}`}>·</span>}
                            {location.cuisine && <span className={`text-[11px] font-medium ${isDark ? 'text-white/60' : 'text-white/80'}`}>{location.cuisine}</span>}
                            {location.price_range && <span className={`text-[11px] ${isDark ? 'text-white/40' : 'text-white/50'}`}>·</span>}
                            {location.price_range && <span className="text-[11px] text-emerald-400 font-semibold">{location.price_range}</span>}
                        </div>
                    </div>
                </div>
            </motion.div>
        </SpringCard>
    )
}

function CompactCard({ location, isDark, navigate, index = 0 }) {
    const rating = location.google_rating || location.rating || 0

    return (
        <SpringCard delay={index * 0.05}>
            <motion.div
                onClick={() => navigate(`/location/${location.id}`)}
                whileTap={{ scale: 0.96 }}
                className={`flex-shrink-0 w-[160px] rounded-2xl overflow-hidden cursor-pointer ${
                    isDark ? 'bg-white/[0.04] ring-1 ring-white/5' : 'bg-white shadow-sm border border-slate-100'
                }`}
            >
                <div className="relative h-[100px] w-full">
                    <LazyImage
                        src={location.photos?.[0] || location.image || location.image_url}
                        alt={location.title}
                        className="w-full h-full object-cover"
                        sizes="160px"
                        transform={{ width: 320, quality: 75, format: 'webp' }}
                    />
                    {rating > 0 && (
                        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <Star size={8} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-[9px] font-semibold text-white">{Number(rating).toFixed(1)}</span>
                        </div>
                    )}
                </div>
                <div className="p-2.5">
                    <p className={`text-[12px] font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{location.title}</p>
                    <p className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
                        {location.category}{location.price_range ? ` · ${location.price_range}` : ''}
                    </p>
                </div>
            </motion.div>
        </SpringCard>
    )
}

function TrendingRow({ location, index, isDark, navigate }) {
    const rating = location.google_rating || location.rating || 0

    return (
        <SpringCard delay={index * 0.06}>
            <motion.button
                onClick={() => navigate(`/location/${location.id}`)}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 py-3 px-3 rounded-xl transition-colors ${
                    isDark ? 'hover:bg-white/[0.03] active:bg-white/[0.05]' : 'hover:bg-slate-50 active:bg-slate-100'
                }`}
            >
                <span className={`text-[14px] font-light w-5 text-center tabular-nums ${isDark ? 'text-white/20' : 'text-slate-300'}`}>{index + 1}</span>
                <div className={`w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 ring-1 ${isDark ? 'ring-white/5' : 'ring-black/5'}`}>
                    <LazyImage src={location.photos?.[0] || location.image || location.image_url} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                    <p className={`text-[13px] font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{location.title}</p>
                    <p className={`text-[11px] ${isDark ? 'text-white/35' : 'text-slate-400'}`}>{location.category}{location.price_range ? ` · ${location.price_range}` : ''}</p>
                </div>
                {rating > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <Star size={10} className="text-amber-400 fill-amber-400" />
                        <span className={`text-[11px] font-medium tabular-nums ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{Number(rating).toFixed(1)}</span>
                    </div>
                )}
                <ChevronRight size={14} className={isDark ? 'text-white/15' : 'text-slate-200'} />
            </motion.button>
        </SpringCard>
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const DashboardPageV2 = () => {
    const { t: _t } = useTranslation()
    const { user } = useAuthStore()
    const locations = useLocationsStore(state => state.locations)
    const filteredLocations = useLocationsStore(state => state.filteredLocations)
    const _isLoading = useLocationsStore(state => state.isLoading)
    const { data: userPrefs = {} } = useUserPreferences(user?.id)
    const navigate = useNavigate()
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const currentCity = useGeoStore(state => state.city) || 'Unknown'
    const currentCountry = useGeoStore(state => state.country)
    const { lat: geoLat, lng: geoLng } = useUserGeo({ autoRequest: true })

    const [activeMood, setActiveMood] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [isFilterOpen, setIsFilterOpen] = useState(false)

    // Geo covers
    const { data: geoCoversData = [] } = useGeoCovers('country')
    const _dbCoverMap = Object.fromEntries(geoCoversData.map(c => [c.slug, c.image_url]))

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

    // Mood filter
    const moodFiltered = useMemo(() => {
        if (activeMood === 'all') return filteredLocations
        if (activeMood === 'healthy') return filteredLocations.filter(l => (l.dietary || []).some(d => ['vegan', 'vegetarian', 'healthy'].includes(d.toLowerCase())))
        return filteredLocations.filter(l => (l.category || '').toLowerCase().replace(/\s+/g, '_').includes(activeMood))
    }, [filteredLocations, activeMood])

    // Nearby
    const nearbyLocations = useMemo(() => {
        if (!geoLat || !geoLng) return []
        return moodFiltered
            .map(loc => ({ ...loc, _dist: calculateDistance(geoLat, geoLng, loc.lat, loc.lng) }))
            .filter(l => l._dist < 1).sort((a, b) => a._dist - b._dist).slice(0, 8)
    }, [moodFiltered, geoLat, geoLng])

    // Recommended
    const recommended = useMemo(() => {
        const dna = userPrefs?.longTerm || {}
        const cuisines = (dna.favoriteCuisines || []).map(c => c.toLowerCase())
        if (!cuisines.length) return [...moodFiltered].sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0)).slice(0, 8)
        return moodFiltered.map(loc => {
            let score = (loc.google_rating || 0) / 2
            if (cuisines.some(c => (loc.cuisine || '').toLowerCase().includes(c))) score += 3
            return { ...loc, _score: score }
        }).sort((a, b) => b._score - a._score).slice(0, 8)
    }, [moodFiltered, userPrefs])

    // Trending
    const trending = useMemo(() => [...moodFiltered].sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0)).slice(0, 5), [moodFiltered])

    // Countries
    const countries = useMemo(() => {
        const map = {}
        locations.forEach(loc => { const raw = loc.country ?? ''; if (!raw) return; const slug = raw.toLowerCase().replace(/\s+/g, '-'); if (!map[slug]) map[slug] = { name: raw.charAt(0).toUpperCase() + raw.slice(1), slug, count: 0 }; map[slug].count++ })
        return Object.values(map).sort((a, b) => b.count - a.count)
    }, [locations])

    // Open now
    const openNow = useMemo(() => moodFiltered.filter(loc => { const { isOpen } = isCurrentlyOpen(loc.opening_hours || loc.openingHours); return isOpen === true }).slice(0, 8), [moodFiltered])

    const buildExploreUrl = useCallback((sort) => {
        const rawCity = currentCity !== 'Unknown' ? currentCity : null
        const city = rawCity ? normalizeCityName(rawCity).toLowerCase().replace(/\s+/g, '-') : null
        const country = currentCountry ? normalizeCountryName(currentCountry).toLowerCase().replace(/\s+/g, '-') : null
        if (city && country) return sort ? `/explore/${country}/${city}?sort=${sort}` : `/explore/${country}/${city}`
        return sort ? `/explore?sort=${sort}` : '/explore'
    }, [currentCity, currentCountry])

    return (
        <div className="w-full max-w-7xl mx-auto relative z-0">
            <FilterModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} theme={theme} />

            {/* ── Mobile ─────────────────────────────────────────────────── */}
            <div className="md:hidden min-h-screen" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 5.5rem)' }}>

                {/* Greeting with scramble effect */}
                <div className="px-5 mb-5">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
                        <h1 className={`text-[22px] font-semibold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            <ScrambleText text={greeting} />
                        </h1>
                        <p className={`text-[12px] font-medium mt-1.5 flex items-center gap-1.5 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                            <MapPin size={11} className="text-blue-500" />
                            {currentCity !== 'Unknown' ? currentCity : 'Locating...'}
                            {nearbyLocations.length > 0 && <span>· {nearbyLocations.length} nearby</span>}
                        </p>
                    </motion.div>
                </div>

                {/* Search */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="px-5 mb-4">
                    <SmartSearchBar
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFilter={() => setIsFilterOpen(true)}
                        placeholder="Search places..."
                    />
                </motion.div>

                {/* Mood Selector */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="px-5 mb-6">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {MOODS.map((mood) => (
                            <motion.button
                                key={mood.id}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => setActiveMood(mood.id)}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                                    activeMood === mood.id
                                        ? isDark
                                            ? 'bg-white text-black shadow-lg shadow-white/10'
                                            : 'bg-gray-900 text-white shadow-lg shadow-black/10'
                                        : isDark
                                            ? 'bg-white/[0.05] text-white/50 border border-white/[0.08]'
                                            : 'bg-slate-50 text-slate-500 border border-slate-200/60'
                                }`}
                            >
                                <span className="text-[13px]">{mood.emoji}</span>
                                <span>{mood.label}</span>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>

                {/* Pull-to-refresh */}
                <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} progress={progress} />

                {/* Feed */}
                <div className="px-5 space-y-8 pb-32" {...pullHandlers}>

                    {/* Hero Recommendation */}
                    {recommended.length > 0 && (
                        <div>
                            <HeroRecommendation location={recommended[0]} isDark={isDark} navigate={navigate} />
                            {recommended.length > 1 && (
                                <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
                                    {recommended.slice(1, 5).map((loc, i) => (
                                        <CompactCard key={loc.id} location={loc} isDark={isDark} navigate={navigate} index={i} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Nearby */}
                    {nearbyLocations.length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h2 className={`text-[15px] font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Nearby</h2>
                                <button onClick={() => navigate(buildExploreUrl())} className="text-[11px] font-medium text-blue-500 flex items-center gap-0.5">
                                    See all <ChevronRight size={12} />
                                </button>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
                                {nearbyLocations.slice(0, 6).map((loc, i) => (
                                    <CompactCard key={loc.id} location={loc} isDark={isDark} navigate={navigate} index={i} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Trending */}
                    {trending.length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h2 className={`text-[15px] font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Trending 🔥</h2>
                                <button onClick={() => navigate(buildExploreUrl('trending'))} className="text-[11px] font-medium text-blue-500 flex items-center gap-0.5">
                                    See all <ChevronRight size={12} />
                                </button>
                            </div>
                            <div className={`rounded-2xl overflow-hidden ${isDark ? 'bg-white/[0.02] ring-1 ring-white/5' : 'bg-white border border-slate-100 shadow-sm'}`}>
                                {trending.map((loc, i) => (
                                    <TrendingRow key={loc.id} location={loc} index={i} isDark={isDark} navigate={navigate} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Countries */}
                    {countries.length > 0 && (
                        <div>
                            <h2 className={`text-[15px] font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Explore</h2>
                            <div className="flex gap-2 flex-wrap">
                                {countries.map((c, i) => (
                                    <SpringCard key={c.slug} delay={i * 0.04}>
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => navigate(`/explore/${c.slug}`)}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all ${
                                                isDark ? 'bg-white/[0.04] text-white/60 ring-1 ring-white/[0.06]' : 'bg-slate-50 text-slate-600 border border-slate-200/60'
                                            }`}
                                        >
                                            <span className="capitalize">{c.name}</span>
                                            <span className={`text-[10px] ${isDark ? 'text-white/25' : 'text-slate-400'}`}>{c.count}</span>
                                        </motion.button>
                                    </SpringCard>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Open Now */}
                    {openNow.length > 0 && (
                        <div>
                            <h2 className={`text-[15px] font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Open Now 🟢</h2>
                            <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
                                {openNow.slice(0, 5).map((loc, i) => (
                                    <CompactCard key={loc.id} location={loc} isDark={isDark} navigate={navigate} index={i} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Manifesto */}
                    <ManifestoSection isDark={isDark} />
                </div>
            </div>

            {/* ── Desktop placeholder ────────────────────────────────────── */}
            <div className="hidden md:flex items-center justify-center min-h-[60vh]" style={{ paddingTop: '6rem' }}>
                <p className={`text-lg font-light ${isDark ? 'text-white/30' : 'text-slate-400'}`}>Desktop — use /dashboard</p>
            </div>
        </div>
    )
}

export default DashboardPageV2
