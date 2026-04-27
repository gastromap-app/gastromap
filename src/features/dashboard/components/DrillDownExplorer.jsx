import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, MapPin, Star, Search, SlidersHorizontal, Home } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useNavigate } from 'react-router-dom'

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Simple open-status badge for mini-cards.
 * Shows "Open" / "Closed" / "—" based on opening_hours string.
 */
function OpenStatusBadge({ hours, isDark }) {
    if (!hours || hours === '—') {
        return (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${isDark ? 'bg-white/5 text-white/30' : 'bg-gray-100 text-gray-400'}`}>
                No hours
            </span>
        )
    }

    // Very naive parser — enough for most "Mon-Fri: 09:00-22:00" strings
    const now = new Date()
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const todayName = dayNames[now.getDay()]
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    // Try to find today's hours in the string
    const lines = hours.split(/[,;]/)
    let todayRange = null

    for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.toLowerCase().includes(todayName.toLowerCase())) {
            const match = trimmed.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)
            if (match) {
                const [, sh, sm, eh, em] = match
                const start = parseInt(sh) * 60 + parseInt(sm)
                const end = parseInt(eh) * 60 + parseInt(em)
                todayRange = { start, end }
            }
            break
        }
        // Also try generic "Daily" or catch-all at the end
        const match = trimmed.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)
        if (match && !todayRange) {
            const [, sh, sm, eh, em] = match
            const start = parseInt(sh) * 60 + parseInt(sm)
            const end = parseInt(eh) * 60 + parseInt(em)
            todayRange = { start, end }
        }
    }

    if (!todayRange) {
        return (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${isDark ? 'bg-white/5 text-white/30' : 'bg-gray-100 text-gray-400'}`}>
                {hours.length > 20 ? hours.slice(0, 20) + '…' : hours}
            </span>
        )
    }

    const isOpen = currentMinutes >= todayRange.start && currentMinutes < todayRange.end

    return (
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
            isOpen
                ? 'bg-emerald-500/10 text-emerald-500'
                : isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-500/10 text-red-500'
        }`}>
            {isOpen ? 'Open now' : 'Closed'}
        </span>
    )
}

// COUNTRY_CITIES used as FALLBACK only when no DB data is available
const COUNTRY_CITIES_FALLBACK = {
    poland:      ['Kraków', 'Warsaw', 'Wrocław', 'Gdańsk', 'Poznań'],
    france:      ['Paris', 'Lyon', 'Bordeaux', 'Marseille', 'Nice'],
    italy:       ['Rome', 'Milan', 'Florence', 'Venice', 'Naples'],
    spain:       ['Barcelona', 'Madrid', 'Seville', 'Valencia', 'Bilbao'],
    germany:     ['Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt'],
    portugal:    ['Lisbon', 'Porto', 'Faro', 'Braga', 'Coimbra'],
    netherlands: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven'],
    czechia:     ['Prague', 'Brno', 'Ostrava', 'Plzeň', 'Liberec'],
}
const COUNTRY_FLAGS = {
    poland: '🇵🇱', france: '🇫🇷', italy: '🇮🇹', spain: '🇪🇸',
    germany: '🇩🇪', portugal: '🇵🇹', netherlands: '🇳🇱', czechia: '🇨🇿',
}

// Slide animation — direction: 1 = forward (push right→left), -1 = back (pop left→right)
const pageVariants = {
    enterForward:  { x: '100%', opacity: 0 },
    enterBackward: { x: '-30%', opacity: 0 },
    center:        { x: 0,      opacity: 1 },
    exitForward:   { x: '-30%', opacity: 0 },
    exitBackward:  { x: '100%', opacity: 0 },
}
const pageTransition = { type: 'spring', stiffness: 320, damping: 32 }

/**
 * DrillDownExplorer
 *
 * Controlled component. When NOT drilling (level === 'home'), renders nothing —
 * the parent DashboardPage shows its own home content.
 * When level is 'cities' or 'locations', replaces the ENTIRE page content.
 *
 * Props:
 *   countries        – array of country objects
 *   level            – 'home' | 'cities' | 'locations'
 *   setLevel         – setter
 *   selectedCountry  – { name, slug, image }
 *   setSelectedCountry
 *   selectedCity     – string
 *   setSelectedCity
 *   searchQuery / setSearchQuery
 *   setIsFilterOpen
 */
export function DrillDownExplorer({
    _countries,
    level, setLevel,
    selectedCountry, setSelectedCountry,
    selectedCity, setSelectedCity,
    searchQuery, setSearchQuery,
    setIsFilterOpen,
}) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()
    const { locations, isInitialized } = useLocationsStore()

    // DYNAMIC cities: derive from real DB data, fall back to static list
    const dynamicCitiesByCountry = useMemo(() => {
        if (!locations?.length) return {}
        const map = {}
        locations.forEach(loc => {
            if (!loc.city || !loc.country) return
            const country = loc.country.toLowerCase()
            if (!map[country]) map[country] = new Set()
            map[country].add(loc.city)
        })
        // Convert Sets to sorted arrays
        return Object.fromEntries(
            Object.entries(map).map(([k, v]) => [k, [...v].sort()])
        )
    }, [locations])

    // For a given country slug, return DB cities or fallback
    const getCitiesForCountry = (countrySlug) => {
        const slug = countrySlug?.toLowerCase()
        const dbCities = dynamicCitiesByCountry[slug]
        if (dbCities?.length) return dbCities
        return COUNTRY_CITIES_FALLBACK[slug] ?? []
    }

    const [direction, setDirection] = useState(1)

    const push = (nextLevel, data = {}) => {
        setDirection(1)
        if (data.country) setSelectedCountry(data.country)
        if (data.city)    setSelectedCity(data.city)
        setLevel(nextLevel)
    }
    // eslint-disable-next-line no-unused-vars
    const pop = () => {
        setDirection(-1)
        if (level === 'locations') {
            setSelectedCity(null)
            setLevel('cities')
        } else if (level === 'cities') {
            setSelectedCity(null)
            setSelectedCountry(null)
            setLevel('home')
        }
    }

    // Filtered locations for current city
    const cityLocations = useMemo(() => {
        if (!selectedCity) return []
        const q = searchQuery.toLowerCase()
        return locations.filter(l => {
            const cityMatch = (l.city || l.city_name || '').toLowerCase().includes(selectedCity.toLowerCase())
            const searchMatch = !q || l.title?.toLowerCase().includes(q) || l.category?.toLowerCase().includes(q)
            return cityMatch && searchMatch
        })
    }, [locations, selectedCity, searchQuery])

    const textStyle = isDark ? 'text-white' : 'text-gray-900'
    const subStyle  = isDark ? 'text-gray-400' : 'text-gray-500'
    const cardStyle = isDark
        ? 'bg-white/5 border border-white/10 hover:bg-white/10'
        : 'bg-white border border-gray-100 shadow-sm hover:shadow-md'

    if (level === 'home') return null // Parent renders its own content

    // ── Portal root — escapes PageTransition's CSS transform/filter containing block ──
    // Without a portal, `fixed inset-0` on the overlay would be relative to
    // PageTransition (which applies scale/blur via framer-motion), not the viewport.
    const portalRoot = typeof document !== 'undefined' ? document.body : null

    // Breadcrumbs
    const crumbs = [
        { label: 'Home', level: 'home' },
        ...(selectedCountry ? [{ label: `${COUNTRY_FLAGS[selectedCountry.slug] || '🌍'} ${selectedCountry.name}`, level: 'cities' }] : []),
        ...(selectedCity && level === 'locations' ? [{ label: `📍 ${selectedCity}`, level: 'locations' }] : []),
    ]

    const overlay = (
        <div
            className="fixed inset-0 z-[90] flex flex-col"
            style={{
                background: isDark ? '#0f172a' : '#f8faff',
                paddingTop: 'env(safe-area-inset-top)',
            }}
        >
            {/* ── TOP BAR: Breadcrumbs + Search + Filter ── */}
            <div
                className={`flex-shrink-0 px-4 pb-3 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}
                style={{ paddingTop: '4.5rem' /* clears UniversalHeader (~64px) + 8px breathing room */ }}
            >
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1 mb-3 overflow-x-auto scrollbar-hide">
                    {crumbs.map((crumb, i) => (
                        <React.Fragment key={crumb.level}>
                            {i > 0 && <ChevronRight size={12} className={`${subStyle} flex-shrink-0 opacity-50`} />}
                            <button
                                onClick={() => {
                                    if (crumb.level === level) return
                                    setDirection(-1)
                                    // Reset stale state when jumping back to a higher level
                                    if (crumb.level === 'home') {
                                        setSelectedCity(null)
                                        setSelectedCountry(null)
                                    } else if (crumb.level === 'cities') {
                                        setSelectedCity(null)
                                    }
                                    setLevel(crumb.level)
                                }}
                                className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all active:scale-95 ${
                                    crumb.level === level
                                        ? isDark ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-600'
                                        : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'
                                }`}
                            >
                                {i === 0 && <Home size={11} className="mr-0.5" />}
                                {crumb.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* Search + Filter */}
                <div className="flex gap-2">
                    <div className={`flex-1 flex items-center h-11 px-4 rounded-2xl border ${
                        isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'
                    }`}>
                        <Search size={15} className="text-blue-500 mr-2.5 flex-shrink-0" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={level === 'locations' && selectedCity ? `Search in ${selectedCity}…` : 'Search…'}
                            className={`bg-transparent flex-1 outline-none text-sm font-semibold placeholder:text-gray-400 ${isDark ? 'text-white' : 'text-gray-900'}`}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className={`text-xs ${subStyle} ml-1`}>✕</button>
                        )}
                    </div>
                    <button
                        onClick={() => setIsFilterOpen(true)}
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center border active:scale-90 transition-all flex-shrink-0 ${
                            isDark ? 'bg-blue-600/10 border-blue-500/20 text-blue-500' : 'bg-blue-600 text-white border-transparent shadow-md'
                        }`}
                    >
                        <SlidersHorizontal size={16} />
                    </button>
                </div>
            </div>

            {/* ── ANIMATED CONTENT AREA ── */}
            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="popLayout" custom={direction} initial={false}>

                    {/* CITIES level */}
                    {level === 'cities' && (
                        <motion.div
                            key="cities"
                            initial={direction > 0 ? 'enterForward' : 'enterBackward'}
                            animate="center"
                            exit={direction > 0 ? 'exitForward' : 'exitBackward'}
                            variants={pageVariants}
                            transition={pageTransition}
                            className="absolute inset-0 overflow-y-auto"
                        >
                            {/* Country hero */}
                            <div className="relative h-40 overflow-hidden">
                                <img
                                    src={selectedCountry?.image}
                                    alt={selectedCountry?.name}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                                <div className="absolute bottom-4 left-5">
                                    <p className={`text-xs font-bold uppercase tracking-widest text-white/60 mb-1`}>Cities in</p>
                                    <h2 className="text-2xl font-black text-white leading-none">
                                        {COUNTRY_FLAGS[selectedCountry?.slug]} {selectedCountry?.name}
                                    </h2>
                                </div>
                            </div>

                            {/* City grid */}
                            <div className="p-4 grid grid-cols-2 gap-3 pb-32">
                                {(getCitiesForCountry(selectedCountry?.slug) || []).map((city, i) => (
                                    <motion.button
                                        key={city}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.04 }}
                                        onClick={() => push('locations', { city })}
                                        className={`flex items-center justify-between px-4 py-4 rounded-2xl active:scale-95 transition-all text-left ${cardStyle}`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-blue-50'}`}>
                                                <MapPin size={14} className="text-blue-500" />
                                            </div>
                                            <span className={`text-sm font-black ${textStyle}`}>{city}</span>
                                        </div>
                                        <ChevronRight size={14} className={subStyle} />
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* LOCATIONS level */}
                    {level === 'locations' && (
                        <motion.div
                            key="locations"
                            initial="enterForward"
                            animate="center"
                            exit="exitForward"
                            variants={pageVariants}
                            transition={pageTransition}
                            className="absolute inset-0 overflow-y-auto"
                        >
                            {/* City header */}
                            <div className={`px-4 pt-4 pb-3 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                                <h2 className={`text-xl font-black ${textStyle}`}>📍 {selectedCity}</h2>
                                <p className={`text-xs mt-0.5 ${subStyle}`}>
                                    {cityLocations.length} place{cityLocations.length !== 1 ? 's' : ''} found
                                </p>
                            </div>

                            {/* Location list — 2-column grid */}
                            <div className="p-4 grid grid-cols-2 gap-3 pb-32">
                                {!isInitialized ? (
                                    <>
                                        {[1,2,3,4].map(n => (
                                            <div key={n} className={`flex flex-col rounded-2xl overflow-hidden ${isDark ? 'bg-white/5' : 'bg-gray-100'} animate-pulse`}>
                                                <div className={`w-full h-28 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                                                <div className="p-3 space-y-2">
                                                    <div className={`h-3 rounded-full w-3/4 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                                                    <div className={`h-2 rounded-full w-1/2 ${isDark ? 'bg-white/8' : 'bg-gray-100'}`} />
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                ) : cityLocations.length === 0 ? (
                                    <div className={`col-span-2 text-center py-16 ${subStyle}`}>
                                        <div className="text-4xl mb-4">🍽</div>
                                        <p className="text-sm font-bold">No places in {selectedCity} yet</p>
                                        <p className="text-xs mt-1 opacity-60">Check back later or try another city</p>
                                    </div>
                                ) : (
                                    cityLocations.map((loc, i) => (
                                        <motion.button
                                            key={loc.id}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            onClick={() => navigate(`/location/${loc.id}`)}
                                            className={`flex flex-col rounded-2xl overflow-hidden active:scale-[0.98] transition-all text-left ${cardStyle}`}
                                        >
                                            {/* Image */}
                                            <div className="relative h-28 w-full overflow-hidden">
                                                <img
                                                    src={loc.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=400'}
                                                    alt={loc.title}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                                {/* Rating badge */}
                                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                                                    <Star size={9} className="text-yellow-400 fill-yellow-400" />
                                                    <span className="text-[10px] font-bold text-white">{loc.google_rating ?? loc.rating ?? '—'}</span>
                                                </div>
                                                {/* Price badge */}
                                                {loc.price_level && (
                                                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-lg">
                                                        <span className="text-[10px] font-bold text-white">{loc.price_level}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="p-3 flex flex-col flex-1">
                                                <h4 className={`font-black text-sm leading-tight line-clamp-2 ${textStyle}`}>{loc.title}</h4>
                                                <p className={`text-xs mt-0.5 truncate ${subStyle}`}>{loc.category}</p>

                                                {/* Cuisine */}
                                                {loc.cuisine && (
                                                    <p className={`text-[10px] mt-1 font-medium truncate ${subStyle} opacity-70`}>
                                                        {loc.cuisine}
                                                    </p>
                                                )}

                                                {/* Tags / Labels */}
                                                {loc.special_labels?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {loc.special_labels.slice(0, 2).map(label => (
                                                            <span
                                                                key={label}
                                                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                                                    isDark ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'
                                                                }`}
                                                            >
                                                                {label}
                                                            </span>
                                                        ))}
                                                        {loc.special_labels.length > 2 && (
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                                                                +{loc.special_labels.length - 2}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Open status */}
                                                <div className="mt-auto pt-2">
                                                    <OpenStatusBadge hours={loc.openingHours} isDark={isDark} />
                                                </div>
                                            </div>
                                        </motion.button>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div>
    )

    return portalRoot ? createPortal(overlay, portalRoot) : overlay
}

/* ── Country cards for home level — used directly in DashboardPage ── */
export function CountryCards({ countries, onSelectCountry }) {
    const { theme: _theme } = useTheme()

    return (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-[2.5vw] px-[2.5vw] scrollbar-hide snap-x snap-mandatory">
            {countries.map((country) => (
                <button
                    key={country.slug}
                    onClick={() => onSelectCountry(country)}
                    className="relative flex-shrink-0 w-[220px] h-[150px] rounded-[22px] overflow-hidden shadow-xl snap-center group text-left active:scale-95 transition-transform"
                >
                    <img src={country.image} crossOrigin="anonymous" alt={country.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    {country.newCount > 0 && (
                        <div className="absolute top-3 left-3 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                            {country.newCount} New
                        </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
                        <div>
                            <span className="text-lg">{COUNTRY_FLAGS[country.slug] || '🌍'}</span>
                            <h4 className="text-base font-black text-white leading-tight mt-0.5">{country.name}</h4>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                            <ChevronRight size={13} className="text-white" />
                        </div>
                    </div>
                </button>
            ))}
        </div>
    )
}
