import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, MapPin, Star, ArrowLeft, Search, SlidersHorizontal } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Country → cities mapping (can be data-driven later from Supabase)
const COUNTRY_CITIES = {
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

const slideVariants = {
    enterRight: { x: '100%', opacity: 0 },
    center:     { x: 0,      opacity: 1 },
    exitLeft:   { x: '-30%', opacity: 0 },
}

/**
 * DrillDownExplorer — replaces the static countries section on Dashboard.
 * Levels: countries → cities → locations list
 * Search + filter bar stays on all levels.
 */
export function DrillDownExplorer({ countries, searchQuery, setSearchQuery, setIsFilterOpen }) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { locations } = useLocationsStore()

    // level: 'countries' | 'cities' | 'locations'
    const [level, setLevel] = useState('countries')
    const [selectedCountry, setSelectedCountry] = useState(null)
    const [selectedCity, setSelectedCity]       = useState(null)
    const [direction, setDirection]             = useState(1) // 1=forward, -1=back

    const goTo = (nextLevel, data = {}) => {
        setDirection(1)
        if (data.country) setSelectedCountry(data.country)
        if (data.city)    setSelectedCity(data.city)
        setLevel(nextLevel)
    }

    const goBack = () => {
        setDirection(-1)
        if (level === 'locations') setLevel('cities')
        else if (level === 'cities') setLevel('countries')
    }

    // Filter locations by city
    const cityLocations = useMemo(() => {
        if (!selectedCity) return []
        const q = searchQuery.toLowerCase()
        return locations.filter(l => {
            const cityMatch = (l.city || l.address || '').toLowerCase().includes(selectedCity.toLowerCase())
            const searchMatch = !q || l.title?.toLowerCase().includes(q) || l.category?.toLowerCase().includes(q)
            return cityMatch && searchMatch
        })
    }, [locations, selectedCity, searchQuery])

    const textStyle = isDark ? 'text-white' : 'text-gray-900'
    const subStyle  = 'text-gray-500 dark:text-gray-400'

    const isDeep = level !== 'countries'

    return (
        <div className="space-y-4">
            {/* Header row — title + back + search always visible */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {isDeep && (
                        <button
                            onClick={goBack}
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center active:scale-90 transition-all border ${
                                isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-100 border-gray-200 text-gray-700'
                            }`}
                        >
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <div>
                        <h3 className={`text-lg font-black ${textStyle}`}>
                            {level === 'countries' && t('dashboard.explore_countries')}
                            {level === 'cities'    && `${COUNTRY_FLAGS[selectedCountry?.slug] || ''} ${selectedCountry?.name}`}
                            {level === 'locations' && `📍 ${selectedCity}`}
                        </h3>
                        <p className={`text-[11px] font-medium ${subStyle}`}>
                            {level === 'countries' && t('dashboard.culinary_traditions')}
                            {level === 'cities'    && 'Select a city'}
                            {level === 'locations' && `${cityLocations.length} place${cityLocations.length !== 1 ? 's' : ''} found`}
                        </p>
                    </div>
                </div>

                {/* Search + Filter — always shown */}
                <div className="flex gap-2">
                    <div className={`flex items-center h-9 px-3 rounded-2xl border text-xs ${
                        isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100 shadow-sm'
                    }`}>
                        <Search size={13} className="text-blue-500 mr-1.5" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className={`bg-transparent outline-none w-24 text-xs font-semibold placeholder:text-gray-400 ${isDark ? 'text-white' : 'text-gray-900'}`}
                        />
                    </div>
                    <button
                        onClick={() => setIsFilterOpen(true)}
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center border active:scale-90 transition-all ${
                            isDark ? 'bg-blue-600/10 border-blue-500/20 text-blue-500' : 'bg-blue-600 text-white border-transparent shadow-sm'
                        }`}
                    >
                        <SlidersHorizontal size={14} />
                    </button>
                </div>
            </div>

            {/* Animated panel */}
            <div className="relative overflow-hidden">
                <AnimatePresence mode="popLayout" custom={direction}>
                    {/* COUNTRIES */}
                    {level === 'countries' && (
                        <motion.div
                            key="countries"
                            custom={direction}
                            variants={slideVariants}
                            initial={direction > 0 ? 'enterRight' : 'exitLeft'}
                            animate="center"
                            exit={direction > 0 ? 'exitLeft' : 'enterRight'}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="flex gap-3 overflow-x-auto pb-4 -mx-[2.5vw] px-[2.5vw] scrollbar-hide snap-x snap-mandatory"
                        >
                            {countries.map((country) => (
                                <button
                                    key={country.slug}
                                    onClick={() => goTo('cities', { country })}
                                    className="relative flex-shrink-0 w-[220px] h-[150px] rounded-[22px] overflow-hidden shadow-xl snap-center group text-left active:scale-95 transition-transform"
                                >
                                    <img src={country.image} crossOrigin="anonymous" alt={country.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
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
                        </motion.div>
                    )}

                    {/* CITIES */}
                    {level === 'cities' && (
                        <motion.div
                            key="cities"
                            custom={direction}
                            variants={slideVariants}
                            initial={direction > 0 ? 'enterRight' : 'exitLeft'}
                            animate="center"
                            exit={direction > 0 ? 'exitLeft' : 'enterRight'}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="grid grid-cols-2 gap-3"
                        >
                            {(COUNTRY_CITIES[selectedCountry?.slug] || []).map((city) => (
                                <button
                                    key={city}
                                    onClick={() => goTo('locations', { city })}
                                    className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border active:scale-95 transition-all text-left ${
                                        isDark
                                            ? 'bg-white/5 border-white/10 hover:bg-white/10'
                                            : 'bg-white border-gray-100 shadow-sm hover:shadow-md'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <MapPin size={14} className="text-blue-500 flex-shrink-0" />
                                        <span className={`text-sm font-bold ${textStyle}`}>{city}</span>
                                    </div>
                                    <ChevronRight size={14} className={subStyle} />
                                </button>
                            ))}
                        </motion.div>
                    )}

                    {/* LOCATIONS */}
                    {level === 'locations' && (
                        <motion.div
                            key="locations"
                            custom={direction}
                            variants={slideVariants}
                            initial="enterRight"
                            animate="center"
                            exit="exitLeft"
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="space-y-3"
                        >
                            {cityLocations.length === 0 ? (
                                <div className={`text-center py-10 ${subStyle}`}>
                                    <MapPin size={32} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-bold">No places found in {selectedCity}</p>
                                    <p className="text-xs mt-1 opacity-70">Try adjusting your search</p>
                                </div>
                            ) : (
                                cityLocations.map((loc) => (
                                    <button
                                        key={loc.id}
                                        onClick={() => navigate(`/location/${loc.id}`)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border active:scale-[0.98] transition-all text-left ${
                                            isDark
                                                ? 'bg-white/5 border-white/10 hover:bg-white/10'
                                                : 'bg-white border-gray-100 shadow-sm'
                                        }`}
                                    >
                                        <img
                                            src={loc.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=400'}
                                            alt={loc.title}
                                            className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`font-black text-sm truncate ${textStyle}`}>{loc.title}</h4>
                                            <p className={`text-xs mt-0.5 ${subStyle}`}>{loc.category}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Star size={10} className="text-blue-600 fill-blue-600" />
                                                <span className="text-[11px] font-bold text-blue-600">{loc.rating || '—'}</span>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className={subStyle} />
                                    </button>
                                ))
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
