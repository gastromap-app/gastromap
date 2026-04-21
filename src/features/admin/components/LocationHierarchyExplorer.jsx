import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    MapPin, ChevronRight, ArrowLeft, Building2, Star,
    Eye, EyeOff, Clock, Sun, Moon, Sunset, CloudSun,
    Edit, Trash2, Gem, Trophy, X, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminLocationsQuery } from '@/shared/api/queries'

// Country flag + image map
const COUNTRY_META = {
    'Poland':  { code: '🇵🇱', image: 'https://images.unsplash.com/photo-1519197924294-8ba991629d66?auto=format&fit=crop&q=80&w=600' },
    'Germany': { code: '🇩🇪', image: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&q=80&w=600' },
    'Italy':   { code: '🇮🇹', image: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&q=80&w=600' },
    'France':  { code: '🇫🇷', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=600' },
    'Spain':   { code: '🇪🇸', image: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fit=crop&q=80&w=600' },
    'Japan':   { code: '🇯🇵', image: 'https://images.unsplash.com/photo-1528360983277-13d9b152cace?auto=format&fit=crop&q=80&w=600' },
}
const DEFAULT_COUNTRY = { code: '🌍', image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=600' }

const CITY_IMAGES = {
    'Krakow':  'https://images.unsplash.com/photo-1519197924294-8ba991629d66?auto=format&fit=crop&q=80&w=600',
    'Warsaw':  'https://images.unsplash.com/photo-1596005553047-2b3febd4e0ab?auto=format&fit=crop&q=80&w=600',
    'Berlin':  'https://images.unsplash.com/photo-1560969184-10fe8719e654?auto=format&fit=crop&q=80&w=600',
    'Rome':    'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?auto=format&fit=crop&q=80&w=600',
    'Tokyo':   'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&q=80&w=600',
}
const DEFAULT_CITY_IMG = 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&q=80&w=600'

const LocationHierarchyExplorer = ({ className }) => {
    const [level, setLevel] = useState('countries')
    const [history, setHistory] = useState([])
    const [, setTimeOfDay] = useState('day')
    const [selectedLocation, setSelectedLocation] = useState(null)

    useEffect(() => {
        const hour = new Date().getHours()
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (hour >= 5 && hour < 12) setTimeOfDay('morning')
        // eslint-disable-next-line react-hooks/set-state-in-effect
        else if (hour >= 12 && hour < 17) setTimeOfDay('day')
        // eslint-disable-next-line react-hooks/set-state-in-effect
        else if (hour >= 17 && hour < 21) setTimeOfDay('evening')
        // eslint-disable-next-line react-hooks/set-state-in-effect
        else setTimeOfDay('night')
    }, [])

    // Load all locations from DB
    const { data: locsData, isLoading } = useAdminLocationsQuery({ all: true, limit: 500 })
    const allLocations = locsData?.data ?? []

    // Build hierarchy from real data
    const { countries, citiesByCountry, locationsByCity } = useMemo(() => {
        const countryMap = {}
        const citiesByCountry = {}
        const locationsByCity = {}

        allLocations
            .filter(loc => loc.status === 'active' || loc.status === 'approved')
            .forEach(loc => {
                const country = loc.country || 'Unknown'
                const city = loc.city || 'Unknown'

            if (!countryMap[country]) {
                countryMap[country] = { id: country, name: country, count: 0, status: 'active', ...COUNTRY_META[country] || DEFAULT_COUNTRY }
            }
            countryMap[country].count++

            if (!citiesByCountry[country]) citiesByCountry[country] = {}
            if (!citiesByCountry[country][city]) {
                citiesByCountry[country][city] = { id: city, name: city, count: 0, status: 'active', image: CITY_IMAGES[city] || DEFAULT_CITY_IMG }
            }
            citiesByCountry[country][city].count++

            if (!locationsByCity[city]) locationsByCity[city] = []
            locationsByCity[city].push(loc)
        })

        const countries = Object.values(countryMap).sort((a, b) => b.count - a.count)
        const citiesByCountryArr = {}
        Object.entries(citiesByCountry).forEach(([c, cities]) => {
            citiesByCountryArr[c] = Object.values(cities).sort((a, b) => b.count - a.count)
        })

        return { countries, citiesByCountry: citiesByCountryArr, locationsByCity }
    }, [allLocations])

    const handleSelect = (item) => {
        if (item.status === 'hidden' || item.status === 'coming_soon') return

        if (level === 'countries') {
            setHistory([...history, { level: 'countries', id: item.id, name: item.name }])
            setLevel('cities')
        } else if (level === 'cities') {
            setHistory([...history, { level: 'cities', id: item.id, name: item.name }])
            setLevel('locations')
        } else if (level === 'locations') {
            setSelectedLocation(item)
            setLevel('details')
        }
    }

    const handleBack = () => {
        if (level === 'details') {
            setSelectedLocation(null)
            setLevel('locations')
            return
        }
        const newHistory = [...history]
        newHistory.pop()
        setHistory(newHistory)
        if (level === 'locations') setLevel('cities')
        else if (level === 'cities') setLevel('countries')
    }

    const getCurrentItems = () => {
        if (level === 'countries') return { items: countries, type: 'countries' }
        if (level === 'details') return { items: [], type: 'details' }

        const parentId = history[history.length - 1]?.id
        if (level === 'cities') return { items: citiesByCountry[parentId] || [], type: 'cities', parentId }
        if (level === 'locations') return { items: locationsByCity[parentId] || [], type: 'locations', parentId }
        return { items: [], type: 'none' }
    }

    const { items, type, parentId } = getCurrentItems()

    const getStatusBadge = (status) => {
        if (status === 'coming_soon') return (
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
                <Clock size={9} /> Coming Soon
            </span>
        )
        if (status === 'hidden') return (
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-500/10 px-2 py-1 rounded-full">
                <EyeOff size={9} /> Hidden
            </span>
        )
        return null
    }

    if (isLoading) return (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50 rounded-[28px] lg:rounded-[32px] overflow-hidden shadow-sm p-8 flex items-center justify-center gap-3 text-slate-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-medium">Loading locations...</span>
        </div>
    )

    return (
        <div className={cn("bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50 rounded-[28px] lg:rounded-[32px] overflow-hidden shadow-sm", className)}>
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50">
                <div className="flex items-center gap-2">
                    {level !== 'countries' && (
                        <button onClick={handleBack} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 mr-1">
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <MapPin size={16} className="text-orange-400" />
                    <h2 className="font-semibold text-sm text-slate-900 dark:text-white">
                        {level === 'countries' ? 'География' : history.map(h => h.name).join(' / ')}
                    </h2>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {level === 'countries' ? `${countries.length} стран` : level === 'cities' ? 'Города' : level === 'locations' ? 'Объекты' : 'Детали'}
                </span>
            </div>

            <AnimatePresence mode="wait">
                {/* Details view */}
                {level === 'details' && selectedLocation ? (
                    <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-5">
                        <div className="flex gap-4">
                            {selectedLocation.image && (
                                <img src={selectedLocation.image} alt={selectedLocation.title} className="w-20 h-20 rounded-2xl object-cover shrink-0" />
                            )}
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">{selectedLocation.title}</h3>
                                <p className="text-xs text-slate-400 mt-1">{selectedLocation.category} · {selectedLocation.address}</p>
                                <div className="flex items-center gap-1 mt-2">
                                    <Star size={12} className="text-amber-400 fill-amber-400" />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedLocation.rating || '—'}</span>
                                </div>
                            </div>
                        </div>
                        {selectedLocation.description && (
                            <p className="mt-4 text-xs text-slate-500 leading-relaxed">{selectedLocation.description}</p>
                        )}
                        {selectedLocation.insider_tip && (
                            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-500/5 rounded-2xl">
                                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">💡 {selectedLocation.insider_tip}</p>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    /* Grid view — countries / cities / locations */
                    <motion.div key={level + parentId} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {items.length === 0 ? (
                            <div className="col-span-3 py-8 text-center text-slate-400 text-sm">Нет данных</div>
                        ) : items.map((item, i) => {
                            const isBlocked = item.status === 'hidden' || item.status === 'coming_soon'
                            const img = type === 'locations' ? item.image : item.image

                            return (
                                <motion.div
                                    key={item.id || i}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.04 }}
                                    onClick={() => handleSelect(item)}
                                    className={cn(
                                        "relative rounded-[20px] overflow-hidden aspect-[4/3] group cursor-pointer",
                                        isBlocked && "cursor-default"
                                    )}
                                >
                                    {img ? (
                                        <img src={img} alt={item.name || item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    ) : (
                                        <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                            <MapPin size={24} className="text-slate-300" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                    <div className="absolute inset-0 flex flex-col justify-end p-3">
                                        {type === 'countries' && item.code && (
                                            <span className="text-lg mb-0.5">{item.code}</span>
                                        )}
                                        <span className="text-white font-bold text-sm leading-tight">{item.name || item.title}</span>
                                        {type !== 'locations' && (
                                            <span className="text-white/60 text-[10px] font-medium mt-0.5">{item.count} {type === 'countries' ? 'locations' : 'spots'}</span>
                                        )}
                                        {type === 'locations' && item.rating > 0 && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <Star size={10} className="text-amber-400 fill-amber-400" />
                                                <span className="text-white/80 text-[10px] font-medium">{item.rating}</span>
                                            </div>
                                        )}
                                        {getStatusBadge(item.status)}
                                    </div>
                                    {!isBlocked && (
                                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                                <ChevronRight size={12} className="text-white" />
                                            </div>
                                        </div>
                                    )}
                                    {isBlocked && (
                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
                                    )}
                                </motion.div>
                            )
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default LocationHierarchyExplorer
