import React, { useState, useRef, useEffect } from 'react'
import { useClickOutside } from '@/hooks/useClickOutside'
import LocationImage from '@/components/ui/LocationImage'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MapPin, Star, X, Loader2 } from 'lucide-react'
import { useLocationFilters } from '@/shared/filters/useLocationFilters'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'

/**
 * SmartSearchBar
 *
 * Searches the ENTIRE database via server-side FTS (not just loaded cards).
 * The dropdown shows up to 5 matching locations from all cities.
 * Typing does NOT affect the page's location card list — only the dropdown.
 *
 * Props:
 *   city / country    — optional scope for the search (e.g. explore page)
 *   onSelectLocation  — optional override; receives the selected loc. When
 *                       provided, SmartSearchBar will NOT navigate away —
 *                       useful on the map page where selecting a result
 *                       should pan the map instead of opening details.
 */
export function SmartSearchBar({ value, onChange, onFilter, placeholder = 'Search…', className = '', showFilter = true, city, country, onSelectLocation }) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    // URL-driven filter count (replaces deleted useLocationsStore.getActiveFiltersCount)
    const { filters: _filters } = useLocationFilters()
    const activeFiltersCount =
        ((_filters.categories?.length || 0) > 0 ? 1 : 0) +
        (_filters.sortBy && _filters.sortBy !== 'google_rating' ? 1 : 0) +
        (_filters.minRating != null ? 1 : 0) +
        ((_filters.priceLevels?.length || 0) > 0 ? 1 : 0) +
        ((_filters.vibes?.length || 0) > 0 ? 1 : 0) +
        ((_filters.radius || 0) > 0 ? 1 : 0) +
        (_filters.isOpenNow ? 1 : 0)
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const [focused, setFocused] = useState(false)
    const [suggestions, setSuggestions] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const containerRef = useRef(null)
    const abortRef = useRef(null)

    useClickOutside(containerRef, () => setOpen(false))

    // Server-side FTS search with debounce
    useEffect(() => {
        const q = value.trim()
        if (q.length < 3) {
            setSuggestions([])
            setIsSearching(false)
            return
        }

        // Cancel previous in-flight request
        if (abortRef.current) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller

        const timer = setTimeout(async () => {
            setIsSearching(true)
            try {
                const { getLocations } = await import('@/shared/api/locations.api')
                const result = await getLocations({
                    query: q,
                    ...(city ? { city } : {}),
                    ...(country ? { country } : {}),
                    limit: 5,
                })
                // Discard if a newer search was started
                if (controller.signal.aborted) return
                setSuggestions(result.data || [])
            } catch {
                if (!controller.signal.aborted) setSuggestions([])
            } finally {
                if (!controller.signal.aborted) setIsSearching(false)
            }
        }, 300) // 300ms debounce

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [value, city, country])

    const showDropdown = open && focused && (suggestions.length > 0 || isSearching)

    // Highlight matching substring
    const highlight = (text = '', query = '') => {
        if (!query.trim()) return <span>{text}</span>
        const idx = text.toLowerCase().indexOf(query.toLowerCase())
        if (idx === -1) return <span>{text}</span>
        return (
            <span>
                {text.slice(0, idx)}
                <span className="text-blue-500 font-black">{text.slice(idx, idx + query.length)}</span>
                {text.slice(idx + query.length)}
            </span>
        )
    }

    const handleSelect = (loc) => {
        setOpen(false)
        setFocused(false)
        onChange({ target: { value: '' } }) // clear input
        if (onSelectLocation) {
            onSelectLocation(loc)
            return
        }
        navigate(`/location/${loc.id}`)
    }

    const handleClear = () => {
        onChange({ target: { value: '' } })
        setOpen(false)
    }

    return (
        <div ref={containerRef} className={`relative flex gap-2 ${className}`}>
            {/* Input Container */}
            <div
                className={`flex-1 relative flex items-center h-12 px-4 rounded-2xl transition-all border duration-300 ${
                    isDark
                        ? `bg-white/[0.03] border-white/[0.06] backdrop-blur-md ${focused ? 'border-blue-500/40 shadow-lg shadow-blue-500/10' : ''}`
                        : `bg-white/80 backdrop-blur-md border-slate-200/50 shadow-sm ${focused ? 'border-blue-400 shadow-md' : ''}`
                }`}
            >
                <Search size={18} className="text-blue-500 mr-3 flex-shrink-0" />
                <input
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => { onChange(e); setOpen(true) }}
                    onFocus={() => { setFocused(true); setOpen(true) }}
                    onBlur={() => setTimeout(() => setFocused(false), 150)}
                    className={`bg-transparent flex-1 outline-none text-sm font-semibold ${isDark ? 'text-white placeholder:text-white/40' : 'text-gray-900 placeholder:text-slate-400'}`}
                />
                <AnimatePresence>
                    {value && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.7 }}
                            transition={{ duration: 0.15 }}
                            onMouseDown={handleClear}
                            className={`ml-2 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isDark ? 'bg-white/[0.06] text-white/40' : 'bg-gray-100 text-gray-500'}`}
                        >
                            <X size={11} />
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Filter button */}
            {showFilter && (
                <button
                    onClick={onFilter}
                    aria-label="Open filters"
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 border flex-shrink-0 relative ${
                        isDark
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                            : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 border-transparent'
                    }`}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                    </svg>
                    
                    {/* Active filters badge */}
                    {activeFiltersCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-black animate-in fade-in zoom-in duration-300">
                            {activeFiltersCount}
                        </span>
                    )}
                </button>
            )}

            {/* Dropdown */}
            <AnimatePresence>
                {showDropdown && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className={`absolute top-[calc(100%+8px)] left-0 right-12 z-50 rounded-2xl overflow-hidden shadow-2xl border ${
                            isDark
                                ? 'bg-[#1c1c1e] border-white/[0.06]'
                                : 'bg-white border-slate-200/50'
                        }`}
                        style={{ boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.12)' }}
                    >
                        {isSearching && suggestions.length === 0 ? (
                            <div className={`flex items-center justify-center gap-2 px-4 py-4 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                                <Loader2 size={14} className="animate-spin" />
                                <span className="text-xs font-medium">Searching…</span>
                            </div>
                        ) : suggestions.length === 0 ? (
                            <div className={`px-4 py-4 text-xs font-medium ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                                No locations found
                            </div>
                        ) : (
                            suggestions.map((loc, i) => (
                                <React.Fragment key={loc.id}>
                                    {i > 0 && (
                                        <div className={`h-px mx-4 ${isDark ? 'bg-white/[0.04]' : 'bg-gray-50'}`} />
                                    )}
                                    <button
                                        onMouseDown={() => handleSelect(loc)}
                                        onTouchEnd={() => handleSelect(loc)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:scale-[0.98] ${
                                            isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        {/* Thumbnail */}
                                        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                                            <LocationImage
                                                src={loc.image}
                                                alt=""
                                                width={200}
                                            />
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {highlight(loc.title, value)}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <MapPin size={10} className={isDark ? 'text-gray-400 flex-shrink-0' : 'text-slate-500 flex-shrink-0'} />
                                                <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                                                    {highlight(loc.city || loc.address || '', value)}
                                                </p>
                                                {loc.rating && (
                                                    <>
                                                        <span className={isDark ? 'text-gray-500' : 'text-slate-400'}>·</span>
                                                        <Star size={10} className="text-blue-500 fill-blue-500 flex-shrink-0" />
                                                        <span className="text-xs font-semibold text-blue-500">{loc.rating}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {/* Category pill */}
                                        {loc.category && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                                isDark ? 'bg-white/[0.06] text-white/40' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                                {loc.category}
                                            </span>
                                        )}
                                    </button>
                                </React.Fragment>
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
