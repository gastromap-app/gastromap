/**
 * PlacesAutocomplete — reusable Google Places autocomplete input
 *
 * Props:
 *   onPlaceSelected(normalizedPlace) — called when user picks a suggestion
 *   placeholder — input placeholder text
 *   className — extra classes for wrapper
 *   mode — 'admin' | 'user' (controls which fields are filled)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Search, MapPin, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'

// Генерируем sessiontoken для Google Places billing optimization
function newSessionToken() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

const BASE_URL = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://gastromap-five.vercel.app'

async function fetchSuggestions(q, sessiontoken) {
    const url = `${BASE_URL}/api/places/autocomplete?q=${encodeURIComponent(q)}&sessiontoken=${sessiontoken}`
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Autocomplete failed: ${r.status}`)
    return r.json()
}

async function fetchPlaceDetails(place_id, sessiontoken) {
    const url = `${BASE_URL}/api/places/autocomplete?place_id=${encodeURIComponent(place_id)}&sessiontoken=${sessiontoken}`
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Details failed: ${r.status}`)
    return r.json()
}

export default function PlacesAutocomplete({
    onPlaceSelected,
    placeholder = 'Название заведения и город…',
    className,
    value: externalValue = '',
    onChange,
    disabled = false,
}) {
    const [inputValue, setInputValue]     = useState(externalValue)
    const [suggestions, setSuggestions]   = useState([])
    const [isLoading, setIsLoading]       = useState(false)
    const [isFetching, setIsFetching]     = useState(false) // details fetch
    const [isOpen, setIsOpen]             = useState(false)
    const [activeIdx, setActiveIdx]       = useState(-1)
    const [sessionToken]                  = useState(() => newSessionToken())
    const [error, setError]               = useState(null)

    const wrapperRef = useRef(null)
    const inputRef   = useRef(null)
    const abortRef   = useRef(null)

    const debouncedQuery = useDebounce(inputValue, 280)

    // Sync external value
    useEffect(() => {
        if (externalValue !== inputValue) setInputValue(externalValue)
    }, [externalValue, inputValue])

    // Fetch suggestions when debounced query changes
    useEffect(() => {
        if (debouncedQuery.length < 3) {
            setSuggestions([])
            setIsOpen(false)
            return
        }

        // Abort previous
        if (abortRef.current) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller

        setIsLoading(true)
        setError(null)

        fetchSuggestions(debouncedQuery, sessionToken)
            .then(data => {
                if (controller.signal.aborted) return
                setSuggestions(data.predictions || [])
                setIsOpen((data.predictions || []).length > 0)
                setActiveIdx(-1)
            })
            .catch(err => {
                if (controller.signal.aborted) return
                console.error('[PlacesAutocomplete]', err)
                setError('Не удалось загрузить подсказки')
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false)
            })

        return () => controller.abort()
    }, [debouncedQuery, sessionToken])

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false)
                setActiveIdx(-1)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleInputChange = useCallback((e) => {
        const val = e.target.value
        setInputValue(val)
        onChange?.(val)
        if (val.length < 3) {
            setSuggestions([])
            setIsOpen(false)
        }
    }, [onChange])

    const handleSelect = useCallback(async (prediction) => {
        setIsOpen(false)
        setSuggestions([])
        setInputValue(prediction.main_text || prediction.description)
        setIsFetching(true)
        setError(null)
        try {
            const { result } = await fetchPlaceDetails(prediction.place_id, sessionToken)
            if (result) {
                onPlaceSelected?.(result)
            }
        } catch (err) {
            console.error('[PlacesAutocomplete] details error:', err)
            setError('Не удалось получить данные места')
        } finally {
            setIsFetching(false)
        }
    }, [sessionToken, onPlaceSelected])

    const handleKeyDown = useCallback((e) => {
        if (!isOpen || suggestions.length === 0) return
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIdx(i => Math.max(i - 1, -1))
        } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault()
            handleSelect(suggestions[activeIdx])
        } else if (e.key === 'Escape') {
            setIsOpen(false)
            setActiveIdx(-1)
        }
    }, [isOpen, suggestions, activeIdx, handleSelect])

    const handleClear = useCallback(() => {
        setInputValue('')
        setSuggestions([])
        setIsOpen(false)
        onChange?.('')
        inputRef.current?.focus()
    }, [onChange])

    const FOOD_ICON_MAP = {
        restaurant: '🍽️', cafe: '☕', bar: '🍺', restobar: '🍹',
        night_club: '🎵', food: '🍴',
    }
    const getIcon = (types = []) => {
        for (const t of types) {
            if (FOOD_ICON_MAP[t]) return FOOD_ICON_MAP[t]
        }
        return '📍'
    }

    return (
        <div ref={wrapperRef} className={cn("relative", className)}>
            {/* Input */}
            <div className="relative flex items-center">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isLoading || isFetching
                        ? <Loader2 size={15} className="text-indigo-500 animate-spin" />
                        : <Search size={15} className="text-slate-400" />
                    }
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => suggestions.length > 0 && setIsOpen(true)}
                    disabled={disabled || isFetching}
                    placeholder={isFetching ? 'Загружаю данные…' : placeholder}
                    className={cn(
                        "w-full pl-10 pr-10 py-3 bg-white dark:bg-[hsl(220,20%,9%)] rounded-xl border border-slate-200 dark:border-white/[0.08]",
                        "text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400",
                        "outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all",
                        "disabled:opacity-60 disabled:cursor-not-allowed",
                        isFetching && "border-indigo-300 dark:border-indigo-500/50"
                    )}
                />
                {inputValue && !disabled && !isFetching && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[hsl(220,20%,15%)] transition-all"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>

            {/* Error */}
            {error && (
                <p className="mt-1.5 text-[10px] text-rose-500 font-medium px-1">{error}</p>
            )}

            {/* Dropdown */}
            {isOpen && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-[200] bg-white dark:bg-[hsl(220,20%,9%)] rounded-xl border border-slate-200 dark:border-white/[0.08] shadow-xl overflow-hidden">
                    <div className="py-1.5">
                        {suggestions.map((s, idx) => (
                            <button
                                key={s.place_id}
                                onMouseDown={(e) => { e.preventDefault(); handleSelect(s) }}
                                className={cn(
                                    "w-full text-left px-3.5 py-2.5 flex items-start gap-3 transition-colors",
                                    idx === activeIdx
                                        ? "bg-indigo-50 dark:bg-indigo-500/15"
                                        : "hover:bg-slate-50 dark:hover:bg-[hsl(220,20%,15%)]/50"
                                )}
                            >
                                <span className="text-base leading-none mt-0.5 shrink-0">
                                    {getIcon(s.types)}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate leading-tight">
                                        {s.main_text}
                                    </p>
                                    {s.secondary_text && (
                                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                            {s.secondary_text}
                                        </p>
                                    )}
                                </div>
                                <MapPin size={12} className="text-indigo-400 shrink-0 mt-1" />
                            </button>
                        ))}
                    </div>
                    <div className="px-3.5 py-2 border-t border-slate-100 dark:border-white/[0.08]/50 flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">Powered by</span>
                        <span className="text-[10px] font-bold text-slate-500">Google Places</span>
                    </div>
                </div>
            )}
        </div>
    )
}
