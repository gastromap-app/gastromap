import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MapPin, Star, X } from 'lucide-react'
import { useLocationsStore } from '@/shared/store/useLocationsStore'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'

/**
 * SmartSearchBar
 * Показывает выпадающий список: макс 3 совпадения по названию/категории/городу.
 * Совпадающая часть подсвечивается.
 */
export function SmartSearchBar({ value, onChange, onFilter, placeholder = 'Search…', className = '' }) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const navigate = useNavigate()
    const { locations } = useLocationsStore()
    const [open, setOpen] = useState(false)
    const [focused, setFocused] = useState(false)
    const containerRef = useRef(null)

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        document.addEventListener('touchstart', handler)
        return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
    }, [])

    const suggestions = useMemo(() => {
        const q = value.trim().toLowerCase()
        if (q.length < 2) return []
        return locations
            .filter(l =>
                l.title?.toLowerCase().includes(q) ||
                l.category?.toLowerCase().includes(q) ||
                (l.city || l.address || '').toLowerCase().includes(q) ||
                l.cuisine?.toLowerCase().includes(q) ||
                l.tags?.some(t => t.toLowerCase().includes(q)) ||
                l.kg_dishes?.some(d => d.toLowerCase().includes(q)) ||
                l.kg_cuisines?.some(c => c.toLowerCase().includes(q)) ||
                l.ai_keywords?.some(k => k.toLowerCase().includes(q)) ||
                l.description?.toLowerCase().includes(q)
            )
            .slice(0, 3)
    }, [value, locations])

    const showDropdown = open && focused && suggestions.length > 0

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
        navigate(`/location/${loc.id}`)
    }

    const handleClear = () => {
        onChange({ target: { value: '' } })
        setOpen(false)
    }

    return (
        <div ref={containerRef} className={`relative flex gap-2 ${className}`}>
            {/* Input */}
            <div
                className={`flex-1 relative flex items-center h-12 px-4 rounded-2xl transition-all border ${
                    isDark
                        ? `bg-white/[0.03] border-white/[0.06] ${focused ? 'border-[hsl(217,91%,60%)]/40 shadow-lg shadow-[hsl(217,91%,60%)]/10' : ''}`
                        : `bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)] ${focused ? 'border-blue-400 shadow-[0_2px_4px_rgba(15,23,42,0.06),0_8px_24px_rgba(59,130,246,0.15)]' : ''}`
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
                    className={`bg-transparent flex-1 outline-none text-sm font-semibold ${isDark ? 'text-[hsl(220,20%,96%)] placeholder:text-white/40' : 'text-gray-900 placeholder:text-slate-400'}`}
                />
                <AnimatePresence>
                    {value && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.7 }}
                            transition={{ duration: 0.15 }}
                            onMouseDown={handleClear}
                            className={`ml-2 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isDark ? 'bg-white/[0.06] text-[hsl(220,10%,55%)]' : 'bg-gray-100 text-gray-500'}`}
                        >
                            <X size={11} />
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Filter button */}
            <button
                onClick={onFilter}
                aria-label="Open filters"
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 border flex-shrink-0 relative ${
                    isDark
                        ? 'bg-[hsl(217,91%,60%)]/10 border-[hsl(217,91%,60%)]/20 text-[hsl(217,91%,60%)]'
                        : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 border-transparent'
                }`}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                </svg>
                
                {/* Active filters badge */}
                {useLocationsStore.getState().getActiveFiltersCount() > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-[hsl(220,20%,3%)] animate-in fade-in zoom-in duration-300">
                        {useLocationsStore.getState().getActiveFiltersCount()}
                    </span>
                )}
            </button>

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
                                ? 'bg-[hsl(220,20%,6%)] border-white/[0.06]'
                                : 'bg-white border-gray-100'
                        }`}
                        style={{ boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.12)' }}
                    >
                        {suggestions.map((loc, i) => (
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
                                        <img
                                            src={loc.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=100'}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold truncate ${isDark ? 'text-[hsl(220,20%,96%)]' : 'text-gray-900'}`}>
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
                                                    <Star size={10} className="text-[hsl(217,91%,60%)] fill-[hsl(217,91%,60%)] flex-shrink-0" />
                                                    <span className="text-xs font-semibold text-[hsl(217,91%,60%)]">{loc.rating}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {/* Category pill */}
                                    {loc.category && (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                            isDark ? 'bg-white/[0.06] text-[hsl(220,10%,55%)]' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {loc.category}
                                        </span>
                                    )}
                                </button>
                            </React.Fragment>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
