import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Search, List as ListIcon, Map as MapIcon, X, Clock, Zap, Globe, MapPin, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * LocationFilters — фильтры для Admin панели.
 * Поиск + вид (список/карта) + вкладки + Country/City дропдауны.
 */
const LocationFilters = ({
    view,
    onViewChange,
    viewMode,
    onViewModeChange,
    searchQuery,
    onSearchChange,
    filteredCount,
    totalCount,
    // Country/City
    locations = [],
    selectedCountry,
    onCountryChange,
    selectedCity,
    onCityChange,
}) => {
    const [isSearchExpanded, setIsSearchExpanded] = useState(false)
    const searchInputRef = useRef(null)

    // Auto-focus search input when expanded
    useEffect(() => {
        if (isSearchExpanded && searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [isSearchExpanded])

    // Derive unique countries from locations list
    const countries = useMemo(() => {
        const set = new Set(locations.map(l => l.country).filter(Boolean))
        return Array.from(set).sort()
    }, [locations])

    // Derive cities filtered by selected country
    const cities = useMemo(() => {
        const source = selectedCountry
            ? locations.filter(l => l.country?.toLowerCase() === selectedCountry.toLowerCase())
            : locations
        const set = new Set(source.map(l => l.city).filter(Boolean))
        return Array.from(set).sort()
    }, [locations, selectedCountry])

    return (
        <div className="flex flex-col border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900/50">
            {/* Верхняя панель: Поиск и Переключатель вида */}
            <div className="px-4 py-4 lg:px-10 lg:py-8 flex items-center justify-between gap-4">
                
                {/* Search Bar */}
                <div className="flex-1 flex items-center gap-3">
                    <div className="relative flex items-center group">
                        <AnimatePresence initial={false}>
                            {!isSearchExpanded ? (
                                <motion.button
                                    key="search-btn"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    onClick={() => setIsSearchExpanded(true)}
                                    className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all border border-slate-100 dark:border-slate-800"
                                >
                                    <Search size={20} strokeWidth={2.5} />
                                </motion.button>
                            ) : (
                                <motion.div
                                    key="search-input"
                                    initial={{ width: 40, opacity: 0 }}
                                    animate={{ width: typeof window !== 'undefined' && window.innerWidth < 640 ? 'calc(100vw - 120px)' : 320, opacity: 1 }}
                                    exit={{ width: 40, opacity: 0 }}
                                    className="relative flex items-center"
                                >
                                    <Search className="absolute left-4 text-slate-300 dark:text-slate-600" size={16} />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder={`Search ${totalCount || 0} locations...`}
                                        value={searchQuery}
                                        onChange={(e) => onSearchChange(e.target.value)}
                                        onBlur={() => !searchQuery && setIsSearchExpanded(false)}
                                        className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 rounded-2xl text-[13px] font-black uppercase tracking-widest outline-none ring-2 ring-transparent focus:ring-indigo-500/10 transition-all shadow-inner dark:text-white"
                                    />
                                    {searchQuery && (
                                        <button 
                                            onClick={() => { onSearchChange(''); setIsSearchExpanded(false); }}
                                            className="absolute right-3 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="hidden sm:block">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 leading-none">
                            {searchQuery ? `Found: ${filteredCount}` : `Total: ${totalCount}`}
                        </p>
                    </div>
                </div>

                {/* Список/Карта */}
                <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800/50 shrink-0 shadow-inner">
                    <button
                        onClick={() => onViewModeChange('list')}
                        className={cn(
                            "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2",
                            viewMode === 'list' 
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                : 'text-slate-400 hover:text-slate-600'
                        )}
                    >
                        <ListIcon size={14} strokeWidth={2.5} />
                        <span className="hidden xs:inline">List</span>
                    </button>
                    <button
                        onClick={() => onViewModeChange('map')}
                        className={cn(
                            "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2",
                            viewMode === 'map' 
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                : 'text-slate-400 hover:text-slate-600'
                        )}
                    >
                        <MapIcon size={14} strokeWidth={2.5} />
                        <span className="hidden xs:inline">Map</span>
                    </button>
                </div>
            </div>

            {/* Вкладки + Country/City дропдауны */}
            <div className="px-4 lg:px-10 pb-5 flex flex-wrap items-center gap-3">

                {/* Status tabs */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 flex-shrink-0">
                    {[
                        { id: 'list',    label: 'All',      icon: ListIcon },
                        { id: 'pending', label: 'Pending',  icon: Clock },
                        { id: 'active',  label: 'Active',   icon: Zap },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onViewChange(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap border shrink-0",
                                view === tab.id
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-500/20'
                                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                            )}
                        >
                            <tab.icon size={12} strokeWidth={2.5} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

                {/* Country dropdown */}
                <div className="relative">
                    <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-[0.15em] transition-all cursor-pointer
                        bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                        <Globe size={12} strokeWidth={2.5} />
                        <select
                            value={selectedCountry || ''}
                            onChange={e => onCountryChange(e.target.value || null)}
                            className="appearance-none bg-transparent outline-none cursor-pointer pr-4 text-[10px] font-black uppercase tracking-[0.15em]"
                        >
                            <option value="">All Countries</option>
                            {countries.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <ChevronDown size={10} strokeWidth={2.5} className="pointer-events-none" />
                    </div>
                    {selectedCountry && (
                        <button
                            onClick={() => { onCountryChange(null); onCityChange(null); }}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                        >
                            <X size={8} />
                        </button>
                    )}
                </div>

                {/* City dropdown */}
                <div className="relative">
                    <div className={cn(
                        "flex items-center gap-1.5 px-4 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-[0.15em] transition-all",
                        cities.length === 0
                            ? "opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400"
                            : "cursor-pointer bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}>
                        <MapPin size={12} strokeWidth={2.5} />
                        <select
                            value={selectedCity || ''}
                            onChange={e => onCityChange(e.target.value || null)}
                            disabled={cities.length === 0}
                            className="appearance-none bg-transparent outline-none cursor-pointer pr-4 text-[10px] font-black uppercase tracking-[0.15em] disabled:cursor-not-allowed"
                        >
                            <option value="">All Cities</option>
                            {cities.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <ChevronDown size={10} strokeWidth={2.5} className="pointer-events-none" />
                    </div>
                    {selectedCity && (
                        <button
                            onClick={() => onCityChange(null)}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                        >
                            <X size={8} />
                        </button>
                    )}
                </div>

                {/* Active filter badge */}
                {(selectedCountry || selectedCity) && (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                        {filteredCount} shown
                        <button
                            onClick={() => { onCountryChange(null); onCityChange(null); }}
                            className="ml-1 hover:text-red-500 transition-colors"
                        >
                            <X size={10} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default LocationFilters
