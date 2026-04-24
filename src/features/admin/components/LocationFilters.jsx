import React, { useState, useRef, useEffect } from 'react'
import { 
    Search, List as ListIcon, Map as MapIcon, Filter, X, ChevronDown, Clock, Zap,
    Star, DollarSign, Tag, SortAsc, LayoutGrid, SlidersHorizontal
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ESTABLISHMENT_TYPES, LABEL_GROUPS } from '@/shared/config/filterOptions'

const LocationFilters = ({
    view,
    onViewChange,
    viewMode,
    onViewModeChange,
    searchQuery,
    onSearchChange,
    filteredCount,
    totalCount,
    
    // Advanced Filters
    activeCategory,
    onCategoryChange,
    activePriceLevels,
    onPriceLevelsChange,
    minRating,
    onMinRatingChange,
    activeVibes,
    onVibesChange,
    sortBy,
    onSortChange,
    activeCity,
    onCityChange,
    activeCountry,
    onCountryChange,
    cities = [],
    countries = []
}) => {
    const [isSearchExpanded, setIsSearchExpanded] = useState(false)
    const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false)
    const searchInputRef = useRef(null)

    // Auto-focus search input when expanded
    useEffect(() => {
        if (isSearchExpanded && searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [isSearchExpanded])

    const togglePriceLevel = (level) => {
        if (activePriceLevels.includes(level)) {
            onPriceLevelsChange(activePriceLevels.filter(l => l !== level))
        } else {
            onPriceLevelsChange([...activePriceLevels, level])
        }
    }

    const toggleVibe = (vibe) => {
        if (activeVibes.includes(vibe)) {
            onVibesChange(activeVibes.filter(v => v !== vibe))
        } else {
            onVibesChange([...activeVibes, vibe])
        }
    }

    // Flatten all vibes for the filter list
    const allVibes = LABEL_GROUPS.flatMap(g => 
        g.items.map((item, idx) => ({ id: item, label: g.itemsRu[idx] }))
    ).sort((a, b) => a.label.localeCompare(b.label))

    return (
        <div className="flex flex-col border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900/50">
            {/* Верхняя панель: Поиск и Переключатель вида */}
            <div className="px-4 py-4 lg:px-10 lg:py-6 flex flex-wrap items-center justify-between gap-4">
                
                {/* Search Bar Container */}
                <div className="flex-1 min-w-[280px] flex items-center gap-3">
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
                                        placeholder={`Поиск по ${totalCount || 0} объектам...`}
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

                    <div className="hidden md:block">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 leading-none">
                            {searchQuery ? `Найдено: ${filteredCount}` : `Всего объектов: ${totalCount}`}
                        </p>
                    </div>
                </div>

                {/* Right Actions: Advanced Toggle, View Switcher */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border",
                            isAdvancedExpanded 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400' 
                                : 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-800 dark:border-slate-800'
                        )}
                    >
                        <SlidersHorizontal size={14} strokeWidth={2.5} />
                        <span className="hidden xs:inline">Фильтры</span>
                        {(activeCategory !== 'All' || activePriceLevels.length > 0 || minRating !== null || activeVibes.length > 0 || activeCity !== 'All' || activeCountry !== 'All') && (
                            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[8px] flex items-center justify-center">
                                !
                            </span>
                        )}
                    </button>

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
                            <span className="hidden xs:inline">Список</span>
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
                            <span className="hidden xs:inline">Карта</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            <AnimatePresence>
                {isAdvancedExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-slate-50/50 dark:bg-slate-950/10 border-t border-slate-100 dark:border-slate-800/50"
                    >
                        <div className="px-4 py-6 lg:px-10 lg:py-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
                            
                            {/* Sort & Category */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                        <SortAsc size={12} /> Сортировка
                                    </label>
                                    <select 
                                        value={sortBy}
                                        onChange={(e) => onSortChange(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    >
                                        <option value="newest">Сначала новые</option>
                                        <option value="rating">По рейтингу (наш)</option>
                                        <option value="google_rating">По рейтингу (Google)</option>
                                        <option value="name">По алфавиту</option>
                                        <option value="price_asc">Дешевле</option>
                                        <option value="price_desc">Дороже</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                        <LayoutGrid size={12} /> Категория
                                    </label>
                                    <select 
                                        value={activeCategory}
                                        onChange={(e) => onCategoryChange(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    >
                                        <option value="All">Все категории</option>
                                        {ESTABLISHMENT_TYPES.filter(t => t.id !== 'all').map(type => (
                                            <option key={type.id} value={type.id}>{type.labelRu || type.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            {/* Location Filters (Country/City) */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                        <MapIcon size={12} /> Страна
                                    </label>
                                    <select 
                                        value={activeCountry}
                                        onChange={(e) => onCountryChange(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    >
                                        <option value="All">Все страны</option>
                                        {countries.map(country => (
                                            <option key={country} value={country}>{country}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                        <MapIcon size={12} /> Город
                                    </label>
                                    <select 
                                        value={activeCity}
                                        onChange={(e) => onCityChange(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    >
                                        <option value="All">Все города</option>
                                        {cities.map(city => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Price & Rating */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                        <DollarSign size={12} /> Цена
                                    </label>
                                    <div className="flex gap-2">
                                        {['$', '$$', '$$$'].map(level => (
                                            <button
                                                key={level}
                                                onClick={() => togglePriceLevel(level)}
                                                className={cn(
                                                    "flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all border",
                                                    activePriceLevels.includes(level)
                                                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-300"
                                                )}
                                            >
                                                {level}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                        <Star size={12} /> Мин. Рейтинг: {minRating || 'Любой'}
                                    </label>
                                    <div className="flex gap-1">
                                        {[3, 3.5, 4, 4.5, 5].map(val => (
                                            <button
                                                key={val}
                                                onClick={() => onMinRatingChange(minRating === val ? null : val)}
                                                className={cn(
                                                    "flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border",
                                                    minRating === val
                                                        ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20"
                                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-300"
                                                )}
                                            >
                                                {val}+
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Vibes / Features */}
                            <div className="lg:col-span-2 space-y-3">
                                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                    <Tag size={12} /> Атмосфера и особенности
                                </label>
                                <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto no-scrollbar pr-2">
                                    {allVibes.map(vibe => (
                                        <button
                                            key={vibe.id}
                                            onClick={() => toggleVibe(vibe.id)}
                                            className={cn(
                                                "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap",
                                                activeVibes.includes(vibe.id)
                                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/10"
                                                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-50"
                                            )}
                                        >
                                            {vibe.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <div className="px-4 py-3 lg:px-10 bg-slate-100/50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800/50 flex justify-end">
                            <button 
                                onClick={() => {
                                    onCategoryChange('All')
                                    onPriceLevelsChange([])
                                    onMinRatingChange(null)
                                    onVibesChange([])
                                    onSortChange('newest')
                                    onCityChange('All')
                                    onCountryChange('All')
                                }}
                                className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-500 hover:text-rose-600 transition-colors py-2 flex items-center gap-2"
                            >
                                <X size={12} strokeWidth={3} /> Сбросить фильтры
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Вкладки (Статус) */}
            <div className="px-4 lg:px-10 pb-5 flex items-center gap-3">
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 pr-4 -mx-1 flex-1">
                    {[
                        { id: 'all', label: 'Все объекты', icon: ListIcon },
                        { id: 'pending', label: 'На модерации', icon: Clock },
                        { id: 'active', label: 'Активные', icon: Zap },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onViewChange(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap border shrink-0",
                                view === tab.id
                                    ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20 dark:bg-indigo-600 dark:border-indigo-600'
                                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                            )}
                        >
                            <tab.icon size={12} strokeWidth={2.5} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default LocationFilters
