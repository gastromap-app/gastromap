import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Globe, MapPin, ChevronRight, ArrowLeft, Eye, EyeOff,
    Clock, Star, Building2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGeoCovers } from '@/shared/api/queries'
import { updateGeoVisibility } from '@/shared/api/geo.api'
import { useQueryClient } from '@tanstack/react-query'

/**
 * GeoHierarchyList — compact list-based drill-down for Admin Locations page.
 * Countries → Cities → (triggers filter on locations list)
 *
 * Features:
 * - Toggle visibility (hide from public app)
 * - Toggle "Coming Soon" (card visible but not clickable)
 * - Compact row design (48px desktop, 56px mobile)
 */
export default function GeoHierarchyList({ locations = [], onSelectCity, onBack: _onBack, className }) {
    const [level, setLevel] = useState('countries') // 'countries' | 'cities'
    const [selectedCountry, setSelectedCountry] = useState(null)
    const queryClient = useQueryClient()

    // Fetch geo_covers for visibility state
    const { data: countryCovers = [] } = useGeoCovers('country')
    const { data: cityCovers = [] } = useGeoCovers('city')

    const coverMap = useMemo(() => {
        const map = {}
        countryCovers.forEach(c => { map[`country:${c.slug}`] = c })
        cityCovers.forEach(c => { map[`city:${c.slug}`] = c })
        return map
    }, [countryCovers, cityCovers])

    // Build hierarchy from locations
    const { countries, citiesByCountry } = useMemo(() => {
        const countryMap = {}
        const citiesByCountry = {}

        locations.forEach(loc => {
            const country = loc.country || 'Unknown'
            const city = loc.city || 'Unknown'
            const slug = country.toLowerCase().replace(/\s+/g, '-')

            if (!countryMap[country]) {
                countryMap[country] = { name: country, slug, cities: new Set(), count: 0, totalRating: 0, ratedCount: 0 }
            }
            countryMap[country].count++
            countryMap[country].cities.add(city)
            const r = loc.google_rating || loc.rating
            if (r > 0) { countryMap[country].totalRating += r; countryMap[country].ratedCount++ }

            if (!citiesByCountry[country]) citiesByCountry[country] = {}
            const citySlug = city.toLowerCase().replace(/\s+/g, '-')
            if (!citiesByCountry[country][city]) {
                citiesByCountry[country][city] = { name: city, slug: citySlug, count: 0, totalRating: 0, ratedCount: 0 }
            }
            citiesByCountry[country][city].count++
            if (r > 0) { citiesByCountry[country][city].totalRating += r; citiesByCountry[country][city].ratedCount++ }
        })

        const countries = Object.values(countryMap)
            .map(c => ({ ...c, cityCount: c.cities.size, avgRating: c.ratedCount ? (c.totalRating / c.ratedCount).toFixed(1) : null }))
            .sort((a, b) => b.count - a.count)

        const citiesMap = {}
        Object.entries(citiesByCountry).forEach(([country, cities]) => {
            citiesMap[country] = Object.values(cities)
                .map(c => ({ ...c, avgRating: c.ratedCount ? (c.totalRating / c.ratedCount).toFixed(1) : null }))
                .sort((a, b) => b.count - a.count)
        })

        return { countries, citiesByCountry: citiesMap }
    }, [locations])

    const handleToggleVisibility = useCallback(async (slug, geoType, name, currentVisible) => {
        try {
            await updateGeoVisibility({ slug, geo_type: geoType, name, is_visible: !currentVisible })
            queryClient.invalidateQueries({ queryKey: ['geo-covers'] })
        } catch (err) {
            console.error('[GeoHierarchy] Toggle visibility failed:', err)
        }
    }, [queryClient])

    const handleToggleComingSoon = useCallback(async (slug, geoType, name, currentComingSoon) => {
        try {
            await updateGeoVisibility({ slug, geo_type: geoType, name, is_coming_soon: !currentComingSoon })
            queryClient.invalidateQueries({ queryKey: ['geo-covers'] })
        } catch (err) {
            console.error('[GeoHierarchy] Toggle coming soon failed:', err)
        }
    }, [queryClient])

    const handleCountryClick = (country) => {
        setSelectedCountry(country.name)
        setLevel('cities')
    }

    const handleCityClick = (city) => {
        if (onSelectCity) onSelectCity(city.name, selectedCountry)
    }

    const handleBack = () => {
        if (level === 'cities') {
            setLevel('countries')
            setSelectedCountry(null)
        }
    }

    const currentItems = level === 'countries' ? countries : (citiesByCountry[selectedCountry] || [])

    return (
        <div className={cn('', className)}>
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-white/[0.04]">
                {level !== 'countries' && (
                    <button
                        onClick={handleBack}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors text-slate-400"
                    >
                        <ArrowLeft size={16} />
                    </button>
                )}
                <div className="flex items-center gap-1.5">
                    {level === 'countries' ? <Globe size={14} className="text-indigo-500" /> : <Building2 size={14} className="text-orange-500" />}
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        {level === 'countries' ? 'Countries' : selectedCountry}
                    </span>
                </div>
                <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {currentItems.length} {level === 'countries' ? 'countries' : 'cities'}
                </span>
            </div>

            {/* List */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={level + selectedCountry}
                    initial={{ opacity: 0, x: level === 'cities' ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: level === 'cities' ? -10 : 10 }}
                    transition={{ duration: 0.15 }}
                    className="divide-y divide-slate-50 dark:divide-white/[0.03]"
                >
                    {currentItems.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-sm">No data</div>
                    ) : currentItems.map((item) => {
                        const key = `${level === 'countries' ? 'country' : 'city'}:${item.slug}`
                        const cover = coverMap[key]
                        const isVisible = cover?.is_visible !== false
                        const isComingSoon = cover?.is_coming_soon === true
                        const geoType = level === 'countries' ? 'country' : 'city'

                        return (
                            <div
                                key={item.slug}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group',
                                    !isVisible && 'opacity-50'
                                )}
                            >
                                {/* Click area — name + meta */}
                                <div
                                    className="flex-1 flex items-center gap-3 cursor-pointer min-w-0"
                                    onClick={() => level === 'countries' ? handleCountryClick(item) : handleCityClick(item)}
                                >
                                    {/* Icon */}
                                    <div className={cn(
                                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
                                        level === 'countries'
                                            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600'
                                            : 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                                    )}>
                                        {level === 'countries' ? <Globe size={14} /> : <MapPin size={14} />}
                                    </div>

                                    {/* Name + stats */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                {item.name}
                                            </span>
                                            {isComingSoon && (
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                                    Soon
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <span className="text-[11px] text-slate-400 font-medium">
                                                {item.count} spots
                                            </span>
                                            {level === 'countries' && (
                                                <span className="text-[11px] text-slate-400 font-medium">
                                                    {item.cityCount} cities
                                                </span>
                                            )}
                                            {item.avgRating && (
                                                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-0.5">
                                                    <Star size={9} className="text-amber-400 fill-amber-400" />
                                                    {item.avgRating}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Drill-down arrow */}
                                    <ChevronRight size={14} className="text-slate-300 dark:text-white/20 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1 shrink-0">
                                    {/* Visibility toggle */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleVisibility(item.slug, geoType, item.name, isVisible) }}
                                        title={isVisible ? 'Hide from app' : 'Show in app'}
                                        className={cn(
                                            'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                                            isVisible
                                                ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                                                : 'text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                                        )}
                                    >
                                        {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>

                                    {/* Coming Soon toggle */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleComingSoon(item.slug, geoType, item.name, isComingSoon) }}
                                        title={isComingSoon ? 'Remove Coming Soon' : 'Mark as Coming Soon'}
                                        className={cn(
                                            'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                                            isComingSoon
                                                ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                                                : 'text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                                        )}
                                    >
                                        <Clock size={14} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}
